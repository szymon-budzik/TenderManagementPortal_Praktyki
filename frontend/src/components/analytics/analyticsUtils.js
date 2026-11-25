export function computeDateRangeForPreset(preset) {
  if (preset === 'ALL') {
    return { dateFrom: '', dateTo: '' };
  }
  const now = new Date();
  const toStr = now.toISOString().split('T')[0];
  const fromDate = new Date();
  if (preset === '7D') fromDate.setDate(now.getDate() - 7);
  if (preset === '30D') fromDate.setDate(now.getDate() - 30);
  if (preset === '90D') fromDate.setDate(now.getDate() - 90);
  return { dateFrom: fromDate.toISOString().split('T')[0], dateTo: toStr };
}

export function filterByDateRange(items, dateField, dateFrom, dateTo) {
  return items.filter((item) => {
    if (!dateFrom && !dateTo) return true;
    const rawDate = item[dateField];
    if (!rawDate) return false;
    const itemTime = new Date(rawDate).setHours(0, 0, 0, 0);

    if (dateFrom) {
      const fromTime = new Date(dateFrom).setHours(0, 0, 0, 0);
      if (itemTime < fromTime) return false;
    }
    if (dateTo) {
      const toTime = new Date(dateTo).setHours(23, 59, 59, 999);
      if (itemTime > toTime) return false;
    }
    return true;
  });
}

export function computeKpi(filteredTenders, filteredRuns) {
  const total = filteredTenders.length;
  const interested = filteredTenders.filter((t) => t.status === 'INTERESTED').length;
  const newCount = filteredTenders.filter((t) => t.status === 'NEW').length;

  const scores = filteredTenders.map((t) => Number(t.score) || 0);
  const avgScore = total > 0 ? (scores.reduce((a, b) => a + b, 0) / total).toFixed(1) : '0.0';
  const maxScore = total > 0 ? Math.max(...scores) : 0;

  const excludedTotal = filteredRuns.reduce((acc, r) => acc + (r.excludedCount || 0), 0);
  const zeroSkippedTotal = filteredRuns.reduce((acc, r) => acc + (r.zeroScoreCount || 0), 0);

  return {
    total,
    interested,
    newCount,
    interestedPct: total > 0 ? Math.round((interested / total) * 100) : 0,
    newPct: total > 0 ? Math.round((newCount / total) * 100) : 0,
    avgScore,
    maxScore,
    excludedTotal,
    zeroSkippedTotal,
  };
}

export function computeBindingsData(filteredTenders, categories, endpoints, bindingMode) {
  if (bindingMode === 'CATEGORIES') {
    const catMap = new Map();
    categories.forEach((c) => {
      catMap.set(c.name, { name: c.name, count: 0, totalScore: 0 });
    });

    filteredTenders.forEach((t) => {
      const text = `${t.title || ''} ${t.description || ''}`.toLowerCase();
      const desc = (t.description || '').toLowerCase();

      categories.forEach((cat) => {
        const positiveWords = (cat.keywords || '')
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean)
          .filter((part) => !part.toUpperCase().endsWith(':EXCLUDED'))
          .map((part) => part.split(':')[0].trim().toLowerCase())
          .filter(Boolean);

        const explicitlyLogged = desc.includes(`${cat.name.toLowerCase()}:`);
        const wordMatched = positiveWords.some((w) => text.includes(w));

        if (explicitlyLogged || wordMatched) {
          const entry = catMap.get(cat.name);
          if (entry) {
            entry.count += 1;
            entry.totalScore += Number(t.score) || 0;
          }
        }
      });
    });

    return Array.from(catMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }

  if (bindingMode === 'KEYWORDS') {
    const kwMap = new Map();

    categories.forEach((cat) => {
      const parts = (cat.keywords || '')
        .split(',')
        .map((w) => w.trim())
        .filter(Boolean);

      parts.forEach((rawPart) => {
        if (rawPart.toUpperCase().includes(':EXCLUDED')) return;
        const cleanWord = rawPart.split(':')[0].trim();
        if (!cleanWord) return;

        const key = cleanWord.toLowerCase();
        if (!kwMap.has(key)) {
          kwMap.set(key, {
            name: cleanWord,
            badge: cat.name,
            count: 0,
            totalScore: 0,
          });
        }
      });
    });

    filteredTenders.forEach((t) => {
      const text = `${t.title || ''} ${t.description || ''}`.toLowerCase();
      kwMap.forEach((entry, key) => {
        if (text.includes(key.endsWith('*') ? key.slice(0, -1) : key)) {
          entry.count += 1;
          entry.totalScore += Number(t.score) || 0;
        }
      });
    });

    return Array.from(kwMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  const epMap = new Map();
  endpoints.forEach((ep) => {
    epMap.set(ep.name.toLowerCase(), {
      name: ep.name,
      badge: ep.httpMethod || 'API',
      url: (ep.url || '').toLowerCase(),
      count: 0,
      totalScore: 0,
    });
  });

  filteredTenders.forEach((t) => {
    const desc = t.description || '';
    const descLower = desc.toLowerCase();
    let matchedAny = false;

    epMap.forEach((entry, keyName) => {
      const byName = descLower.includes(`źródło: ${keyName}`);
      const byUrl = entry.url && descLower.includes(entry.url);
      if (byName || byUrl) {
        entry.count += 1;
        entry.totalScore += Number(t.score) || 0;
        matchedAny = true;
      }
    });

    if (!matchedAny) {
      const sourceLine = desc
        .split('\n')
        .find((line) => line.trim().toLowerCase().startsWith('źródło'));
      if (sourceLine) {
        const idx = sourceLine.indexOf(':');
        const extractedName = idx > 0 ? sourceLine.substring(idx + 1).trim() : sourceLine.trim();
        const key = extractedName.toLowerCase();
        if (!epMap.has(key)) {
          epMap.set(key, {
            name: extractedName,
            badge:
              sourceLine.toLowerCase().includes('soup') ||
              sourceLine.toLowerCase().includes('pandas')
                ? 'SCRAPER'
                : 'API',
            url: '',
            count: 0,
            totalScore: 0,
          });
        }
        const entry = epMap.get(key);
        entry.count += 1;
        entry.totalScore += Number(t.score) || 0;
      }
    }
  });

  return Array.from(epMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export function computeScoreBrackets(filteredTenders) {
  const brackets = [
    { label: '1–25 pkt', min: 1, max: 25, count: 0, color: '#60a5fa', side: '#3b82f6', top: '#93c5fd' },
    { label: '26–50 pkt', min: 26, max: 50, count: 0, color: '#3b82f6', side: '#2563eb', top: '#60a5fa' },
    { label: '51–75 pkt', min: 51, max: 75, count: 0, color: '#2563eb', side: '#1d4ed8', top: '#3b82f6' },
    { label: '76+ pkt', min: 76, max: 9999, count: 0, color: '#1d4ed8', side: '#1e40af', top: '#2563eb' },
  ];

  filteredTenders.forEach((t) => {
    const s = Number(t.score) || 0;
    const found = brackets.find((b) => s >= b.min && s <= b.max);
    if (found) found.count += 1;
  });

  return brackets;
}

export function computeTimelineData(filteredTenders) {
  const dayMap = new Map();
  filteredTenders.forEach((t) => {
    if (!t.publicationDate) return;
    const dayKey = new Date(t.publicationDate).toISOString().split('T')[0];
    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, { date: dayKey, total: 0, interested: 0, newCount: 0 });
    }
    const item = dayMap.get(dayKey);
    item.total += 1;
    if (t.status === 'INTERESTED') item.interested += 1;
    else item.newCount += 1;
  });

  return Array.from(dayMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-10);
}
