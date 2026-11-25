export const STATUSES = ['NEW', 'INTERESTED'];
export const PAGE_SIZE = 10;

export function getTenderScoreDisplay(tender) {
  if (tender?.description) {
    const line = tender.description
      .split('\n')
      .find((l) => l.startsWith('Punktacja kategorii:'));
    if (line) {
      return line.replace('Punktacja kategorii:', '').trim();
    }
  }
  return `${tender?.score ?? 0} pkt`;
}

export function getTenderScoreEntries(tender) {
  const raw = getTenderScoreDisplay(tender);
  if (!raw || raw.endsWith(' pkt')) return [];
  return raw
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getTenderSource(tender) {
  if (!tender?.description) return 'Nieznane';
  const line = tender.description
    .split('\n')
    .find((l) => l.trim().toLowerCase().startsWith('źródło'));
  if (!line) return 'Nieznane';
  const idx = line.indexOf(':');
  return idx > 0 ? line.substring(idx + 1).trim() : line.trim();
}

export function getTenderLink(tender) {
  if (tender?.description) {
    const linkLine = tender.description
      .split('\n')
      .find((l) => l.trim().toLowerCase().startsWith('link:'));
    if (linkLine) {
      const url = linkLine.substring(linkLine.indexOf(':') + 1).trim();
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
    }
    const urlMatch = tender.description.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      return urlMatch[0];
    }
  }
  return null;
}

export function getTenderDeadlineIso(tender) {
  if (tender?.submissionDeadline) return tender.submissionDeadline;
  if (!tender?.description) return null;

  const lines = tender.description.split('\n');
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const keyNorm = line.substring(0, idx).toLowerCase().replace(/[_\-\s]/g, '');
    if (
      keyNorm.includes('publication') ||
      keyNorm.includes('publish') ||
      keyNorm.includes('created') ||
      keyNorm.includes('updated')
    ) {
      continue;
    }
    if (
      keyNorm.includes('deadline') ||
      keyNorm.includes('submitting') ||
      keyNorm.includes('submission') ||
      keyNorm.includes('closing') ||
      keyNorm.includes('termin')
    ) {
      const val = line.substring(idx + 1).trim();
      const dt = new Date(val.replace(' ', 'T'));
      if (!Number.isNaN(dt.getTime())) {
        return dt.toISOString();
      }
    }
  }
  return null;
}

export function getShortHoursBadge(deadlineIso, nowMs) {
  if (!deadlineIso) return null;
  const targetMs = new Date(deadlineIso).getTime();
  if (Number.isNaN(targetMs)) return null;
  const diffMs = targetMs - nowMs;

  if (diffMs <= 0) {
    return {
      text: 'Po terminie',
      cls: 'bg-red-100 border-red-400 text-red-900',
    };
  }
  const hours = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  if (hours < 24) {
    return {
      text: `${hours}g ${mins}m`,
      cls: 'bg-red-200 border-red-600 text-black',
    };
  }
  if (hours <= 72) {
    return {
      text: `${hours} godz.`,
      cls: 'bg-amber-100 border-amber-600 text-black',
    };
  }
  return {
    text: `${hours} godz.`,
    cls: 'bg-green-100 border-green-600 text-black',
  };
}

export function formatDateTimePl(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function parseCategoryScoreMap(tender) {
  const map = {};
  if (!tender?.description) return map;
  const line = tender.description
    .split('\n')
    .find((l) => l.startsWith('Punktacja kategorii:'));
  if (!line) return map;

  const content = line.replace('Punktacja kategorii:', '').trim();
  content.split('/').forEach((part) => {
    const idx = part.lastIndexOf(':');
    if (idx > 0) {
      const catName = part.substring(0, idx).trim().toLowerCase();
      const pts = parseInt(part.substring(idx + 1).trim(), 10);
      if (!Number.isNaN(pts)) {
        map[catName] = pts;
      }
    }
  });
  return map;
}
