export function hasWildcardSuffix(word) {
  if (!word) return false;
  const trimmed = word.trim();
  return trimmed.length > 1 && trimmed.endsWith('*');
}

export function parseKeywordsString(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((item) => {
      let current = item;
      let isWildcard = false;

      if (current.toUpperCase().endsWith(':WILDCARD')) {
        isWildcard = true;
        current = current.substring(0, current.length - ':WILDCARD'.length).trim();
      }

      const idx = current.lastIndexOf(':');
      if (idx > 0) {
        const word = current.substring(0, idx).trim();
        const val = current.substring(idx + 1).trim().toUpperCase();
        const validWildcard = isWildcard && hasWildcardSuffix(word);
        if (val === 'EXCLUDED') {
          return { word, score: 50, isExcluded: true, isWildcard: validWildcard };
        }
        const parsedScore = parseInt(val, 10);
        return {
          word,
          score: Number.isNaN(parsedScore) ? 50 : Math.max(1, Math.min(100, parsedScore)),
          isExcluded: false,
          isWildcard: validWildcard,
        };
      }
      return {
        word: current,
        score: 50,
        isExcluded: false,
        isWildcard: isWildcard && hasWildcardSuffix(current),
      };
    });
}

export function serializeKeywordsList(list) {
  return list
    .map((k) => {
      const cleanWord = k.word.trim();
      const validWildcard = Boolean(k.isWildcard && hasWildcardSuffix(cleanWord));
      return `${cleanWord}:${k.isExcluded ? 'EXCLUDED' : k.score}${
        validWildcard ? ':WILDCARD' : ''
      }`;
    })
    .join(', ');
}
