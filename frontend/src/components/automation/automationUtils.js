export const EMPTY_PROFILE_FORM = {
  name: '',
  enabled: true,
  notificationsEnabled: true,
  scheduleType: 'SCHEDULE',
  cronTime: '8:00, 16:00',
  intervalMinutes: 60,
  selectedEndpointIds: [],
  selectedCategoryIds: [],
  categoryModes: {},
  recipientEmails: '',
  smtpAccountId: '',
};

export function parseIdList(str) {
  if (!str) return [];
  return str
    .split(',')
    .map((s) => Number(s.split(':')[0].trim()))
    .filter((n) => !Number.isNaN(n) && n > 0);
}

export function parseCategoryModesMap(str, fallbackMode = 'OR') {
  const def = fallbackMode === 'ALL' || fallbackMode === 'AND' ? 'AND' : 'OR';
  const map = {};
  if (!str) return map;
  str.split(',').forEach((part) => {
    const pieces = part.trim().split(':');
    const id = Number(pieces[0]?.trim());
    if (!Number.isNaN(id) && id > 0) {
      const m = pieces[1]?.trim().toUpperCase();
      map[id] = m === 'AND' || m === 'ALL' ? 'AND' : m === 'OR' || m === 'ANY' ? 'OR' : def;
    }
  });
  return map;
}

export function parseEmailTags(raw) {
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map((e) => e.trim())
    .filter(Boolean);
}

export function parseScheduleTags(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const DAY_NAMES = {
  1: 'Pon',
  2: 'Wt',
  3: 'Śr',
  4: 'Czw',
  5: 'Pt',
  6: 'Sob',
  7: 'Nd',
};

export function formatSingleScheduleTag(token) {
  const parts = token.split('/');
  const rawTime = (parts[0] || '').trim();
  const hm = rawTime.split(':');
  const normTime =
    hm.length === 2
      ? `${hm[0].trim().padStart(2, '0')}:${hm[1].trim().padStart(2, '0')}`
      : rawTime;

  if (parts.length === 1 || !parts[1].trim()) {
    return `${normTime} (Codziennie)`;
  }
  const days = parts[1]
    .split(';')
    .map((d) => DAY_NAMES[Number(d.trim())] || d.trim())
    .filter(Boolean)
    .join(', ');
  return `${normTime} (${days})`;
}
