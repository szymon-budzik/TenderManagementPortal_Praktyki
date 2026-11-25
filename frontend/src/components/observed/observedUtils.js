export function getSourceFromDescription(desc) {
  if (!desc) return 'Nieznane źródło';
  const line = desc
    .split('\n')
    .find((l) => l.trim().toLowerCase().startsWith('źródło'));
  if (!line) return 'Nieznane źródło';
  const idx = line.indexOf(':');
  return idx > 0 ? line.substring(idx + 1).trim() : line.trim();
}

export function getLinkFromDescription(desc) {
  if (!desc) return null;
  const linkLine = desc
    .split('\n')
    .find((l) => l.trim().toLowerCase().startsWith('link:'));
  if (linkLine) {
    const url = linkLine.substring(linkLine.indexOf(':') + 1).trim();
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
  }
  const match = desc.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
}

export function getScoreBreakdown(tender) {
  if (tender?.description) {
    const line = tender.description
      .split('\n')
      .find((l) => l.startsWith('Punktacja kategorii:'));
    if (line) return line.replace('Punktacja kategorii:', '').trim();
  }
  return `${tender?.score ?? 0} pkt`;
}

export function getCleanDescription(desc) {
  if (!desc) return '';
  return desc
    .split('\n')
    .filter((line) => {
      const l = line.trim().toLowerCase();
      return (
        l &&
        !l.startsWith('punktacja kategorii:') &&
        !l.startsWith('źródło:') &&
        !l.startsWith('link:')
      );
    })
    .join('\n');
}

export function getHoursCountdown(deadlineIso, nowMs) {
  if (!deadlineIso) {
    return {
      label: 'Brak terminu',
      badgeClass: 'bg-slate-100 border-slate-400 text-slate-700',
      expired: false,
      remainingMs: null,
    };
  }
  const targetMs = new Date(deadlineIso).getTime();
  if (Number.isNaN(targetMs)) {
    return {
      label: 'Brak terminu',
      badgeClass: 'bg-slate-100 border-slate-400 text-slate-700',
      expired: false,
      remainingMs: null,
    };
  }

  const diffMs = targetMs - nowMs;
  if (diffMs <= 0) {
    const pastHours = Math.max(1, Math.round(Math.abs(diffMs) / 3600000));
    return {
      label: `Po terminie (${pastHours} godz. temu)`,
      badgeClass: 'bg-red-200 border-red-800 text-red-950',
      expired: true,
      remainingMs: diffMs,
    };
  }

  const totalHours = Math.floor(diffMs / 3600000);
  const remMinutes = Math.floor((diffMs % 3600000) / 60000);

  if (totalHours < 24) {
    return {
      label: `Pozostało: ${totalHours} godz. ${remMinutes} min`,
      badgeClass: 'bg-red-300 border-red-800 text-black',
      expired: false,
      remainingMs: diffMs,
    };
  }
  if (totalHours <= 72) {
    return {
      label: `Pozostało: ${totalHours} godz.`,
      badgeClass: 'bg-amber-200 border-amber-700 text-black',
      expired: false,
      remainingMs: diffMs,
    };
  }
  return {
    label: `Pozostało: ${totalHours} godz.`,
    badgeClass: 'bg-green-200 border-green-800 text-black',
    expired: false,
    remainingMs: diffMs,
  };
}

export function toLocalDateTimeInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function buildDiffVersions(tender, updates, updIdx) {
  const currentUpd = updates[updIdx];
  const prevUpd = updates[updIdx + 1];

  const oldVersion = prevUpd
    ? {
        versionLabel: `Aktualizacja v${prevUpd.versionNumber}`,
        title: prevUpd.title,
        externalId: prevUpd.externalId,
        submissionDeadline: prevUpd.submissionDeadline,
        description: prevUpd.description,
      }
    : {
        versionLabel: 'Oryginał (wersja bazowa)',
        title: tender.title,
        externalId: tender.externalId,
        submissionDeadline: tender.submissionDeadline,
        description: tender.description,
      };

  const newVersion = {
    versionLabel: `Aktualizacja v${currentUpd.versionNumber}`,
    title: currentUpd.title,
    externalId: currentUpd.externalId,
    submissionDeadline: currentUpd.submissionDeadline,
    description: currentUpd.description,
  };

  return { oldVersion, newVersion };
}
