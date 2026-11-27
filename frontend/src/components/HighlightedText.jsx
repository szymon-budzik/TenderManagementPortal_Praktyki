import { useMemo } from 'react';
import { Tag } from 'lucide-react';
import {
  DEFAULT_CATEGORY_COLOR,
  getCategoryHighlightStyle,
} from './keywords/categoryColorPresets';

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractMatchedCategoryNames(description) {
  if (!description) return [];
  const line = description
    .split('\n')
    .find((l) => l.startsWith('Punktacja kategorii:'));
  if (!line) return [];

  return line
    .replace('Punktacja kategorii:', '')
    .split('/')
    .map((part) => {
      const idx = part.lastIndexOf(':');
      return idx > 0 ? part.substring(0, idx).trim().toLowerCase() : '';
    })
    .filter(Boolean);
}

function buildHighlightRules(categories = [], allowedCategoryNames = []) {
  if (!Array.isArray(categories) || categories.length === 0) return [];

  const allowedSet =
    allowedCategoryNames && allowedCategoryNames.length > 0
      ? new Set(allowedCategoryNames.map((n) => n.toLowerCase()))
      : null;

  const rules = [];

  categories.forEach((cat) => {
    if (!cat || cat.isExcluded || !cat.keywords) return;
    if (allowedSet && !allowedSet.has((cat.name || '').trim().toLowerCase())) return;

    const highlightStyle = getCategoryHighlightStyle(
      cat.color || DEFAULT_CATEGORY_COLOR,
      Boolean(cat.lightText)
    );

    const fallbackScore = cat.score ?? 50;

    cat.keywords.split(',').forEach((rawPart) => {
      let trimmed = rawPart.trim();
      if (!trimmed) return;

      let isWildcard = false;
      if (trimmed.toUpperCase().endsWith(':WILDCARD')) {
        isWildcard = true;
        trimmed = trimmed.slice(0, -':WILDCARD'.length).trim();
      }

      let word = trimmed;
      let weight = fallbackScore;
      let excluded = false;

      const colonIdx = trimmed.lastIndexOf(':');
      if (colonIdx > 0) {
        word = trimmed.substring(0, colonIdx).trim();
        const suffix = trimmed.substring(colonIdx + 1).trim().toUpperCase();
        if (suffix === 'EXCLUDED') {
          excluded = true;
        } else {
          const parsed = parseInt(suffix, 10);
          if (!Number.isNaN(parsed)) weight = parsed;
        }
      }

      if (excluded || !word) return;

      let patternStr;
      if (isWildcard && word.endsWith('*')) {
        const stem = word.slice(0, -1).trim();
        if (!stem) return;
        patternStr = `(?<![\\p{L}\\p{N}_])${escapeRegex(stem)}[\\p{L}\\p{N}]*`;
      } else {
        patternStr = `(?<![\\p{L}\\p{N}_])${escapeRegex(word)}(?![\\p{L}\\p{N}_])`;
      }

      try {
        rules.push({
          word,
          weight,
          categoryName: cat.name,
          highlightStyle,
          regex: new RegExp(patternStr, 'giu'),
        });
      } catch {
        // Pominięcie ewentualnego błędnego wyrażenia
      }
    });
  });

  return rules;
}

function findNonOverlappingMatches(text, rules) {
  if (!text || !rules || rules.length === 0) return [];
  const allMatches = [];

  for (const rule of rules) {
    rule.regex.lastIndex = 0;
    let m;
    while ((m = rule.regex.exec(text)) !== null) {
      if (m[0].length === 0) break;
      allMatches.push({
        start: m.index,
        end: m.index + m[0].length,
        matchedText: m[0],
        rule,
      });
    }
  }

  if (allMatches.length === 0) return [];

  allMatches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  const selected = [];
  let lastEnd = -1;
  for (const item of allMatches) {
    if (item.start >= lastEnd) {
      selected.push(item);
      lastEnd = item.end;
    }
  }
  return selected;
}

export function MatchedKeywordsSummary({ text, categories, descriptionForFilter, enabled = true }) {
  const hits = useMemo(() => {
    if (!enabled || !text || !categories?.length) return [];
    const allowed = extractMatchedCategoryNames(descriptionForFilter);
    const rules = buildHighlightRules(categories, allowed);
    const matches = findNonOverlappingMatches(text, rules);

    const uniqueMap = new Map();
    matches.forEach((m) => {
      const key = `${m.rule.categoryName}::${m.rule.word.toLowerCase()}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, {
          word: m.rule.word,
          categoryName: m.rule.categoryName,
          weight: m.rule.weight,
          highlightStyle: m.rule.highlightStyle,
          count: 1,
        });
      } else {
        uniqueMap.get(key).count += 1;
      }
    });
    return Array.from(uniqueMap.values());
  }, [text, categories, descriptionForFilter, enabled]);

  if (!enabled || hits.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase text-slate-600 mr-1">
        <Tag size={12} /> Trafienia:
      </span>
      {hits.map((hit, idx) => (
        <span
          key={idx}
          title={`Kategoria: ${hit.categoryName} (+${hit.weight} pkt)`}
          style={hit.highlightStyle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-extrabold"
        >
          <span>{hit.word}</span>
          <span className="opacity-80 text-[10px]">
            ({hit.categoryName} +{hit.weight})
          </span>
        </span>
      ))}
    </div>
  );
}

export default function HighlightedText({
  text,
  categories,
  descriptionForFilter,
  enabled = true,
}) {
  const parts = useMemo(() => {
    if (!text) return [];
    if (!enabled || !categories || categories.length === 0) {
      return [{ type: 'plain', content: text }];
    }

    const allowed = extractMatchedCategoryNames(descriptionForFilter);
    const rules = buildHighlightRules(categories, allowed);
    const matches = findNonOverlappingMatches(text, rules);

    if (matches.length === 0) {
      return [{ type: 'plain', content: text }];
    }

    const segments = [];
    let cursor = 0;

    matches.forEach((m) => {
      if (m.start > cursor) {
        segments.push({ type: 'plain', content: text.slice(cursor, m.start) });
      }
      segments.push({
        type: 'mark',
        content: text.slice(m.start, m.end),
        rule: m.rule,
      });
      cursor = m.end;
    });

    if (cursor < text.length) {
      segments.push({ type: 'plain', content: text.slice(cursor) });
    }
    return segments;
  }, [text, categories, descriptionForFilter, enabled]);

  if (!text) return null;

  return (
    <>
      {parts.map((seg, idx) =>
        seg.type === 'mark' ? (
          <mark
            key={idx}
            title={`Kategoria: ${seg.rule.categoryName} | Słowo: ${seg.rule.word} (+${seg.rule.weight} pkt)`}
            style={seg.rule.highlightStyle}
            className="px-1 py-0.5 rounded border font-extrabold"
          >
            {seg.content}
          </mark>
        ) : (
          <span key={idx}>{seg.content}</span>
        )
      )}
    </>
  );
}
