function isBoundaryChar(ch) {
  return !ch || /\s/.test(ch) || ch === '(' || ch === ')';
}

function matchStandaloneOp(raw, pos) {
  if (!isBoundaryChar(raw[pos - 1])) return null;
  const upper3 = raw.slice(pos, pos + 3).toUpperCase();
  if (upper3 === 'AND' && isBoundaryChar(raw[pos + 3])) return 'AND';
  const upper2 = raw.slice(pos, pos + 2).toUpperCase();
  if (upper2 === 'OR' && isBoundaryChar(raw[pos + 2])) return 'OR';
  return null;
}

function parseRawTerm(rawTerm, catMap) {
  let text = rawTerm.trim();
  let mode = 'OR';
  let modeInvalid = null;

  let sepIdx = text.lastIndexOf(';');
  if (sepIdx < 0) {
    const colonIdx = text.lastIndexOf(':');
    if (colonIdx > 0) {
      const maybe = text.slice(colonIdx + 1).trim().toUpperCase();
      if (maybe === 'OR' || maybe === 'AND' || maybe === 'ALL' || maybe === 'ANY') {
        sepIdx = colonIdx;
      }
    }
  }

  if (sepIdx > 0) {
    const suffix = text.slice(sepIdx + 1).trim().toUpperCase();
    text = text.slice(0, sepIdx).trim();
    if (suffix === 'AND' || suffix === 'ALL') {
      mode = 'AND';
    } else if (suffix === 'OR' || suffix === 'ANY') {
      mode = 'OR';
    } else {
      modeInvalid = suffix || '(pusty)';
    }
  }

  const matchedCategory = text ? catMap.get(text.toLowerCase()) || null : null;

  return {
    type: 'TERM',
    raw: rawTerm.trim(),
    categoryName: text,
    mode,
    modeInvalid,
    known: Boolean(matchedCategory),
    matchedCategory,
  };
}

export function parseCategoryQuery(rawQuery, categories = []) {
  const query = typeof rawQuery === 'string' ? rawQuery : '';
  const catMap = new Map();
  (categories || []).forEach((c) => {
    if (c?.name) {
      catMap.set(c.name.trim().toLowerCase(), c);
    }
  });

  if (!query.trim()) {
    return {
      tokens: [],
      valid: false,
      empty: true,
      error: 'Wpisz zapytanie kategorii, np. NazwaKategorii;OR OR InnaKategoria;AND',
      referencedCount: 0,
    };
  }

  const tokens = [];
  let buf = '';
  let inQuotes = false;
  let i = 0;

  const flushTerm = () => {
    const trimmed = buf.trim();
    buf = '';
    if (trimmed) {
      tokens.push(parseRawTerm(trimmed, catMap));
    }
  };

  while (i < query.length) {
    const ch = query[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      i += 1;
      continue;
    }
    if (!inQuotes && (ch === '(' || ch === ')')) {
      flushTerm();
      tokens.push({ type: ch === '(' ? 'LPAREN' : 'RPAREN', value: ch });
      i += 1;
      continue;
    }
    if (!inQuotes) {
      const op = matchStandaloneOp(query, i);
      if (op) {
        flushTerm();
        tokens.push({ type: 'OP', value: op });
        i += op.length;
        continue;
      }
    }
    buf += ch;
    i += 1;
  }

  flushTerm();

  if (inQuotes) {
    return {
      tokens,
      valid: false,
      empty: false,
      error: 'Niezamknięty cudzysłów w zapytaniu.',
      referencedCount: 0,
    };
  }

  // Walidacja gramatyki (zgodna z CategoryQueryService na backendzie)
  let pos = 0;
  let error = null;
  const referencedNames = new Set();

  const parsePrimary = () => {
    if (pos >= tokens.length) {
      error = error || 'Niekompletne zapytanie — oczekiwano nazwy kategorii po operatorze.';
      return;
    }
    const tok = tokens[pos];
    if (tok.type === 'LPAREN') {
      pos += 1;
      parseOr();
      if (pos >= tokens.length || tokens[pos].type !== 'RPAREN') {
        error = error || "Brak zamykającego nawiasu ')' w zapytaniu.";
        return;
      }
      pos += 1;
      return;
    }
    if (tok.type === 'TERM') {
      pos += 1;
      if (!tok.categoryName) {
        error = error || 'Brak nazwy kategorii przed średnikiem.';
      } else if (tok.modeInvalid) {
        error = error || `Nieznany tryb "${tok.modeInvalid}" dla "${tok.categoryName}". Użyj ;OR lub ;AND.`;
      } else if (!tok.known) {
        error = error || `Nieznana kategoria: "${tok.categoryName}".`;
      } else {
        referencedNames.add(tok.categoryName.toLowerCase());
      }
      return;
    }
    error = error || `Nieoczekiwany operator "${tok.value}" w zapytaniu.`;
    pos += 1;
  };

  const parseAnd = () => {
    parsePrimary();
    while (!error && pos < tokens.length && tokens[pos].type === 'OP' && tokens[pos].value === 'AND') {
      pos += 1;
      parsePrimary();
    }
  };

  const parseOr = () => {
    parseAnd();
    while (!error && pos < tokens.length && tokens[pos].type === 'OP' && tokens[pos].value === 'OR') {
      pos += 1;
      parseAnd();
    }
  };

  parseOr();
  if (!error && pos < tokens.length) {
    const unexpected = tokens[pos];
    error = `Nieoczekiwany fragment zapytania: "${unexpected.value || unexpected.raw}".`;
  }

  return {
    tokens,
    valid: !error && referencedNames.size > 0,
    empty: false,
    error,
    referencedCount: referencedNames.size,
  };
}

export function serializeCategoryQueryTokens(tokens) {
  const parts = [];
  (tokens || []).forEach((tok) => {
    if (tok.type === 'LPAREN') {
      parts.push('(');
    } else if (tok.type === 'RPAREN') {
      parts.push(')');
    } else if (tok.type === 'OP') {
      parts.push(tok.value);
    } else if (tok.type === 'TERM') {
      const needsQuotes = /\b(AND|OR)\b/i.test(tok.categoryName);
      const namePart = needsQuotes ? `"${tok.categoryName}"` : tok.categoryName;
      parts.push(`${namePart};${tok.mode}`);
    }
  });
  return parts
    .join(' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();
}
