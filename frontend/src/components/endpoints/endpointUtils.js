export const PAGE_SIZE = 10;

export const SCRAPER_PRESETS = ['table tr', 'table td', 'table, td', 'article', '.tender, .notice'];

export const DATE_TOKENS = [
  '{TODAY}',
  '{YESTERDAY}',
  '{TODAY-1D_START}',
  '{TODAY_END}',
  '{TODAY-7D}',
  '{TODAY-7D_COMPACT}',
  '{TODAY_COMPACT}',
];

export const EMPTY_ENDPOINT = {
  name: '',
  url: '',
  httpMethod: 'GET',
  payload: '',
  linkTemplate: '',
  isActive: true,
};

export function validateJsonString(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return { valid: true, empty: true, error: null };
  try {
    JSON.parse(trimmed);
    return { valid: true, empty: false, error: null };
  } catch (e) {
    return { valid: false, empty: false, error: e.message };
  }
}

function parseValueForJson(rawVal) {
  const t = rawVal.trim();
  if (t === '') return '';
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  if (!Number.isNaN(Number(t)) && t !== '') return Number(t);
  if ((t.startsWith('[') && t.endsWith(']')) || (t.startsWith('{') && t.endsWith('}'))) {
    try {
      return JSON.parse(t);
    } catch {
      return rawVal;
    }
  }
  return rawVal;
}

export function rowsToJsonString(rows) {
  const obj = {};
  rows.forEach((r) => {
    const k = r.key.trim();
    if (!k) return;
    obj[k] = parseValueForJson(r.value);
  });
  if (Object.keys(obj).length === 0) return '';
  return JSON.stringify(obj, null, 2);
}

export function jsonStringToRows(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return [{ key: '', value: '' }];
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const entries = Object.entries(parsed).map(([k, v]) => ({
        key: k,
        value: typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? ''),
      }));
      return entries.length > 0 ? entries : [{ key: '', value: '' }];
    }
  } catch {
    // niepoprawny lub nie-obiektowy JSON
  }
  return [{ key: '', value: '' }];
}

export function parseSelectorTags(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function describeCssSelector(sel) {
  if (sel.includes(' ')) {
    const parts = sel.split(/\s+/).filter(Boolean);
    return `potomek: ${parts.join(' → ')}`;
  }
  return 'element';
}

export function formatJsonField(raw, onUpdate) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return;
  try {
    const pretty = JSON.stringify(JSON.parse(trimmed), null, 2);
    onUpdate(pretty);
  } catch {
    // Niepoprawny JSON
  }
}

export function buildTestDiagnosticsMarkdown(modal) {
  if (!modal) return '';
  const ep = modal.endpoint;
  const lines = [
    `### Diagnostyka endpointu: ${ep.name}`,
    '',
    `- **Wynik:** ${modal.success ? 'POŁĄCZONO (OK)' : 'BŁĄD'}`,
    `- **Tryb / Metoda:** \`${ep.httpMethod}\``,
    `- **Kod HTTP:** \`${modal.statusCode > 0 ? modal.statusCode : 'Brak / Błąd sieci'}\``,
    `- **Czas odpowiedzi:** ${modal.responseTimeMs} ms`,
    `- **URL (szablon):** \`${ep.url}\``,
  ];

  if (modal.resolvedUrl && modal.resolvedUrl !== ep.url) {
    lines.push(`- **URL (wywołany):** \`${modal.resolvedUrl}\``);
  }

  if (ep.linkTemplate) {
    lines.push(`- **Szablon linku:** \`${ep.linkTemplate}\``);
  }

  if (ep.payload && ep.httpMethod !== 'GET') {
    const label = ep.httpMethod === 'SCRAPER' ? 'Selektor CSS' : 'Payload JSON';
    const lang = ep.httpMethod === 'POST' ? 'json' : 'text';
    lines.push('', `**${label}:**`, '```' + lang, ep.payload, '```');
  }

  lines.push('', '**Komunikat:**', `> ${modal.message}`);

  if (modal.details) {
    lines.push(
      '',
      '**Szczegóły techniczne / Treść odpowiedzi serwera:**',
      '```text',
      modal.details,
      '```'
    );
  }

  return lines.join('\n');
}
