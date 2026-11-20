import { useState, useEffect, useMemo } from 'react';
import api from '../api';
import ConfirmModal from './ConfirmModal';
import HighlightedText, { MatchedKeywordsSummary } from './HighlightedText';
import VersionDiffModal from './VersionDiffModal';
import {
  BookmarkCheck,
  RefreshCw,
  Clock,
  ExternalLink,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Trash2,
  Pencil,
  Check,
  X,
  Sparkles,
  ArrowDown,
  Search,
  RotateCcw,
  FileSpreadsheet,
  ArrowLeftRight,
} from 'lucide-react';

function getSourceFromDescription(desc) {
  if (!desc) return 'Nieznane źródło';
  const line = desc
    .split('\n')
    .find((l) => l.trim().toLowerCase().startsWith('źródło'));
  if (!line) return 'Nieznane źródło';
  const idx = line.indexOf(':');
  return idx > 0 ? line.substring(idx + 1).trim() : line.trim();
}

function getLinkFromDescription(desc) {
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

function getScoreBreakdown(tender) {
  if (tender?.description) {
    const line = tender.description
      .split('\n')
      .find((l) => l.startsWith('Punktacja kategorii:'));
    if (line) return line.replace('Punktacja kategorii:', '').trim();
  }
  return `${tender?.score ?? 0} pkt`;
}

function getCleanDescription(desc) {
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

function getHoursCountdown(deadlineIso, nowMs) {
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

function toLocalDateTimeInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function ObservedView() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [highlightEnabled, setHighlightEnabled] = useState(true);
  const [diffPayload, setDiffPayload] = useState(null);

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [search, setSearch] = useState('');
  const [onlyWithUpdates, setOnlyWithUpdates] = useState(false);
  const [sortBy, setSortBy] = useState('ORDER');

  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [checkResult, setCheckResult] = useState(null);

  const [selectedTenderIds, setSelectedTenderIds] = useState([]);
  const [selectedUpdateIds, setSelectedUpdateIds] = useState([]);
  const [reportName, setReportName] = useState('');
  const [creatingReport, setCreatingReport] = useState(false);
  const [reportFeedback, setReportFeedback] = useState(null);

  const [expandedCards, setExpandedCards] = useState({});
  const [editingDeadlineId, setEditingDeadlineId] = useState(null);
  const [deadlineInput, setDeadlineInput] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);

  const fetchObserved = async () => {
    try {
      const [obsRes, kwRes] = await Promise.all([
        api.get('/tenders/observed'),
        api.get('/keywords').catch(() => ({ data: [] })),
      ]);
      setItems(obsRes.data || []);
      setCategories(kwRes.data || []);
    } catch (err) {
      console.error('Błąd pobierania obserwowanych przetargów:', err);
    }
  };

  useEffect(() => {
    fetchObserved();
    const poll = setInterval(fetchObserved, 12000);
    const clock = setInterval(() => setNowMs(Date.now()), 60000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, []);

  const notifyBadgeRefresh = () => {
    window.dispatchEvent(new Event('observedUpdated'));
  };

  const toggleSelectTender = (id) => {
    setSelectedTenderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectUpdate = (id) => {
    setSelectedUpdateIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllVisible = () => {
    const tIds = visibleItems.map((entry) => entry.tender.id);
    const uIds = visibleItems.flatMap((entry) => (entry.updates || []).map((u) => u.id));
    setSelectedTenderIds(tIds);
    setSelectedUpdateIds(uIds);
  };

  const handleSelectLatestPerGroup = () => {
    const tIds = [];
    const uIds = [];
    visibleItems.forEach((entry) => {
      if (entry.updates && entry.updates.length > 0) {
        uIds.push(entry.updates[0].id);
      } else {
        tIds.push(entry.tender.id);
      }
    });
    setSelectedTenderIds(tIds);
    setSelectedUpdateIds(uIds);
  };

  const handleClearSelection = () => {
    setSelectedTenderIds([]);
    setSelectedUpdateIds([]);
  };

  const handleCreateReport = async () => {
    if (selectedTenderIds.length === 0 && selectedUpdateIds.length === 0) return;
    setCreatingReport(true);
    setReportFeedback(null);
    try {
      const res = await api.post('/tenders/observed/report', {
        tenderIds: selectedTenderIds,
        updateIds: selectedUpdateIds,
        reportName: reportName.trim() || null,
      });
      setReportFeedback({
        success: true,
        text:
          res.data?.message ||
          `Utworzono raport (#${res.data?.runId}) — jest już dostępny w zakładce Raporty.`,
      });
      setSelectedTenderIds([]);
      setSelectedUpdateIds([]);
      setReportName('');
    } catch (err) {
      setReportFeedback({
        success: false,
        text: err.response?.data?.message || err.message || 'Nie udało się utworzyć raportu.',
      });
    } finally {
      setCreatingReport(false);
    }
  };

  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    setCheckResult(null);
    try {
      const res = await api.post('/tenders/observed/check-updates');
      setCheckResult(res.data);
      await fetchObserved();
      notifyBadgeRefresh();
    } catch (err) {
      console.error('Błąd sprawdzania aktualizacji:', err);
      setCheckResult({
        error: err.response?.data?.message || err.message || 'Nie udało się sprawdzić aktualizacji.',
      });
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleMarkUpdatesRead = async (tenderId) => {
    try {
      await api.patch(`/tenders/${tenderId}/updates/read`);
      await fetchObserved();
      notifyBadgeRefresh();
    } catch (err) {
      console.error('Błąd oznaczania aktualizacji jako przeczytane:', err);
    }
  };

  const handleUnobserve = (tender) => {
    setConfirmDialog({
      title: 'Przestań obserwować przetarg',
      message: `Czy przenieść przetarg "${tender.title}" z powrotem do statusu NEW (zniknie z Obserwowanych)?`,
      onConfirm: async () => {
        try {
          await api.patch(`/tenders/${tender.id}/status`, { status: 'NEW' });
          setSelectedTenderIds((prev) => prev.filter((id) => id !== tender.id));
          await fetchObserved();
          notifyBadgeRefresh();
        } finally {
          setConfirmDialog(null);
        }
      },
    });
  };

  const handleDeleteTender = (tender) => {
    setConfirmDialog({
      title: 'Usuń przetarg na stałe',
      message: `Czy na pewno chcesz usunąć przetarg "${tender.title}" wraz ze wszystkimi jego aktualizacjami?`,
      onConfirm: async () => {
        try {
          await api.delete(`/tenders/${tender.id}`);
          setSelectedTenderIds((prev) => prev.filter((id) => id !== tender.id));
          await fetchObserved();
          notifyBadgeRefresh();
        } finally {
          setConfirmDialog(null);
        }
      },
    });
  };

  const handleDeleteUpdate = (update) => {
    setConfirmDialog({
      title: 'Usuń zapisaną aktualizację',
      message: `Czy usunąć wersję "Aktualizacja v${update.versionNumber}"? Oryginalny przetarg pozostanie bez zmian.`,
      onConfirm: async () => {
        try {
          await api.delete(`/tenders/updates/${update.id}`);
          setSelectedUpdateIds((prev) => prev.filter((id) => id !== update.id));
          await fetchObserved();
          notifyBadgeRefresh();
        } finally {
          setConfirmDialog(null);
        }
      },
    });
  };

  const handleSaveDeadline = async (tenderId) => {
    try {
      await api.patch(`/tenders/${tenderId}/deadline`, {
        submissionDeadline: deadlineInput.trim() || null,
      });
      setEditingDeadlineId(null);
      setDeadlineInput('');
      await fetchObserved();
    } catch (err) {
      console.error('Błąd zapisu terminu:', err);
    }
  };

  const toggleExpand = (key) => {
    setExpandedCards((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const openDiffForUpdate = (tender, updates, updIdx) => {
    const currentUpd = updates[updIdx];
    const prevUpd = updates[updIdx + 1]; // updates są posortowane od najnowszej do najstarszej

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

    setDiffPayload({ oldVersion, newVersion });
  };

  const visibleItems = useMemo(() => {
    const filtered = items.filter((entry) => {
      const t = entry.tender;
      const updates = entry.updates || [];
      if (onlyWithUpdates && updates.length === 0) return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const combined = [
          t.externalId,
          t.title,
          t.description,
          ...updates.map(
            (u) =>
              `${u.externalId || ''} ${u.title || ''} ${u.description || ''} ${
                u.changeSummary || ''
              }`
          ),
        ]
          .join(' ')
          .toLowerCase();
        if (!combined.includes(q)) return false;
      }
      return true;
    });

    const copy = [...filtered];
    if (sortBy === 'DEADLINE') {
      copy.sort((a, b) => {
        const da = a.effectiveDeadline
          ? new Date(a.effectiveDeadline).getTime()
          : Number.MAX_SAFE_INTEGER;
        const db = b.effectiveDeadline
          ? new Date(b.effectiveDeadline).getTime()
          : Number.MAX_SAFE_INTEGER;
        return da - db;
      });
    } else if (sortBy === 'UPDATED') {
      copy.sort((a, b) => {
        const ua = a.tender.lastUpdatedAt ? new Date(a.tender.lastUpdatedAt).getTime() : 0;
        const ub = b.tender.lastUpdatedAt ? new Date(b.tender.lastUpdatedAt).getTime() : 0;
        return ub - ua;
      });
    }
    return copy;
  }, [items, search, onlyWithUpdates, sortBy]);

  const totalUnreadGroups = items.filter(
    (entry) => entry.unreadUpdatesCount > 0 || entry.tender?.hasUnreadUpdate
  ).length;
  const totalSelectedCount = selectedTenderIds.length + selectedUpdateIds.length;

  return (
    <div className="space-y-6 text-black">
      {confirmDialog && (
        <ConfirmModal
          isOpen={true}
          open={true}
          title={confirmDialog.title}
          message={confirmDialog.message}
          description={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
          onClose={() => setConfirmDialog(null)}
        />
      )}

      {diffPayload && (
        <VersionDiffModal
          oldVersion={diffPayload.oldVersion}
          newVersion={diffPayload.newVersion}
          onClose={() => setDiffPayload(null)}
        />
      )}

      {/* Nagłówek i przycisk sprawdzania aktualizacji */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <BookmarkCheck size={28} className="text-blue-600 shrink-0 mt-0.5" />
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-2xl font-extrabold text-black">
                Obserwowane Przetargi ({items.length})
              </h2>
              {totalUnreadGroups > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-red-600 text-white">
                  Nowe aktualizacje: {totalUnreadGroups}
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-black mt-0.5">
              Zaznacz dowolne oryginalne lub zaktualizowane przetargi, aby wygenerować z nich raport, albo porównaj zmiany między wersjami.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={checkingUpdates || items.length === 0}
          onClick={handleCheckUpdates}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-extrabold rounded-xl text-xs shadow-xs cursor-pointer transition"
        >
          <RefreshCw size={15} className={checkingUpdates ? 'animate-spin' : ''} />
          {checkingUpdates ? 'Sprawdzanie aktualizacji...' : 'Sprawdź aktualizacje'}
        </button>
      </div>

      {/* Wynik ręcznego sprawdzenia aktualizacji */}
      {checkResult && (
        <div
          className={`p-4 rounded-xl border-2 space-y-2 ${
            checkResult.error
              ? 'bg-red-50 border-red-600'
              : checkResult.updatesFound > 0
              ? 'bg-amber-50 border-amber-600'
              : 'bg-green-50 border-green-700'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="font-extrabold text-sm">
              {checkResult.error
                ? `Błąd sprawdzania: ${checkResult.error}`
                : checkResult.updatesFound > 0
                ? `Wykryto ${checkResult.updatesFound} nowych aktualizacji (sprawdzono ${checkResult.checkedEndpoints} aktywnych źródeł dla ${checkResult.observedTendersCount} obserwowanych).`
                : `Brak nowych aktualizacji (sprawdzono ${checkResult.checkedEndpoints} aktywnych źródeł dla ${checkResult.observedTendersCount} obserwowanych).`}
            </div>
            <button
              type="button"
              onClick={() => setCheckResult(null)}
              className="p-1 rounded hover:bg-black/10 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
          {checkResult.logs && checkResult.logs.length > 0 && (
            <div className="text-xs font-mono space-y-0.5 pt-1 border-t border-black/10">
              {checkResult.logs.map((l, idx) => (
                <div key={idx} className={l.success ? 'text-black' : 'text-red-800 font-bold'}>
                  [{l.success ? 'OK' : 'BŁĄD'}] {l.sourceName}: {l.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pasek tworzenia raportu z zaznaczonych pozycji */}
      {items.length > 0 && (
        <div className="bg-blue-50/80 p-4 rounded-xl border-2 border-blue-600 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={20} className="text-blue-700 shrink-0" />
              <div className="text-xs">
                <span className="font-extrabold text-sm text-black">
                  Tworzenie raportu z wybranych ({totalSelectedCount})
                </span>
                <span className="ml-2 font-semibold text-slate-700">
                  Oryginały: {selectedTenderIds.length} • Aktualizacje: {selectedUpdateIds.length}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSelectLatestPerGroup}
                className="px-2.5 py-1.5 bg-white border border-blue-400 hover:bg-blue-100 rounded-lg text-xs font-bold cursor-pointer"
              >
                Zaznacz najnowsze z grup
              </button>
              <button
                type="button"
                onClick={handleSelectAllVisible}
                className="px-2.5 py-1.5 bg-white border border-blue-400 hover:bg-blue-100 rounded-lg text-xs font-bold cursor-pointer"
              >
                Zaznacz wszystkie
              </button>
              <button
                type="button"
                disabled={totalSelectedCount === 0}
                onClick={handleClearSelection}
                className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 rounded-lg text-xs font-bold cursor-pointer"
              >
                Odznacz
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              placeholder="Opcjonalna nazwa raportu (np. Pilne oferty — listopad)"
              className="flex-1 min-w-[240px] px-3.5 py-2 bg-white border border-blue-400 rounded-lg text-xs font-semibold text-black"
            />
            <button
              type="button"
              disabled={creatingReport || totalSelectedCount === 0}
              onClick={handleCreateReport}
              className="inline-flex items-center gap-2 px-5 py-2 bg-green-400 hover:bg-green-500 disabled:opacity-40 border-2 border-green-800 text-black font-extrabold rounded-lg text-xs cursor-pointer transition"
            >
              <FileSpreadsheet size={15} />
              {creatingReport
                ? 'Tworzenie raportu...'
                : `Utwórz raport w zakładce Raporty (${totalSelectedCount})`}
            </button>
          </div>

          {reportFeedback && (
            <div
              className={`px-3.5 py-2 rounded-lg border text-xs font-extrabold flex items-center justify-between gap-2 ${
                reportFeedback.success
                  ? 'bg-green-100 border-green-700 text-green-950'
                  : 'bg-red-100 border-red-700 text-red-950'
              }`}
            >
              <span>{reportFeedback.text}</span>
              <button
                type="button"
                onClick={() => setReportFeedback(null)}
                className="p-0.5 rounded hover:bg-black/10 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pasek wyszukiwania, sortowania i przełącznika podświetlania */}
      <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-2.5 text-blue-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj wśród obserwowanych i ich aktualizacji..."
            className="w-full pl-9 pr-3 py-2 border border-blue-300 rounded-lg text-xs font-semibold text-black"
          />
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 border border-blue-300 rounded-lg bg-white text-xs font-bold text-black"
        >
          <option value="ORDER">Kolejność stała (grupy w miejscu)</option>
          <option value="DEADLINE">Najbliższy termin (godziny)</option>
          <option value="UPDATED">Ostatnio zaktualizowane</option>
        </select>

        <label className="inline-flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-400 rounded-lg text-xs font-extrabold cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyWithUpdates}
            onChange={(e) => setOnlyWithUpdates(e.target.checked)}
            className="w-4 h-4 accent-amber-600 cursor-pointer"
          />
          Tylko z aktualizacjami
        </label>

        <label className="inline-flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-500 rounded-lg text-xs font-extrabold cursor-pointer select-none">
          <input
            type="checkbox"
            checked={highlightEnabled}
            onChange={(e) => setHighlightEnabled(e.target.checked)}
            className="w-4 h-4 accent-yellow-600 cursor-pointer"
          />
          Podświetl słowa kluczowe
        </label>

        {(search || onlyWithUpdates || sortBy !== 'ORDER') && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setOnlyWithUpdates(false);
              setSortBy('ORDER');
            }}
            className="inline-flex items-center gap-1 px-3 py-2 bg-white border border-blue-300 hover:bg-blue-50 rounded-lg text-xs font-bold cursor-pointer"
          >
            <RotateCcw size={13} /> Reset
          </button>
        )}
      </div>

      {/* Lista odseparowanych grup obserwowanych przetargów */}
      {visibleItems.length === 0 ? (
        <div className="bg-white p-10 rounded-2xl border-2 border-dashed border-blue-300 text-center space-y-2">
          <div className="font-extrabold text-base text-black">
            {items.length === 0
              ? 'Brak obserwowanych przetargów'
              : 'Brak obserwowanych spełniających filtry'}
          </div>
          <p className="text-xs font-semibold text-slate-600">
            Wejdź w zakładkę <b>Przetargi</b> i kliknij status <b>NEW → INTERESTED</b> przy wybranym postępowaniu, aby dodać je tutaj.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {visibleItems.map((entry, groupIndex) => {
            const tender = entry.tender;
            const updates = entry.updates || [];
            const hasUpdates = updates.length > 0;
            const hasUnread = entry.unreadUpdatesCount > 0 || tender.hasUnreadUpdate;

            const effectiveDeadline = entry.effectiveDeadline || tender.submissionDeadline;
            const groupCountdown = getHoursCountdown(effectiveDeadline, nowMs);

            const origLink = getLinkFromDescription(tender.description);
            const latestUpdateLink = updates
              .map((u) => getLinkFromDescription(u.description))
              .find(Boolean);
            const groupLink = latestUpdateLink || origLink;

            const origSource = getSourceFromDescription(tender.description);
            const origCleanDesc = getCleanDescription(tender.description);
            const origExpanded = Boolean(expandedCards[`orig-${tender.id}`]);
            const isEditingDeadline = editingDeadlineId === tender.id;
            const isOrigSelected = selectedTenderIds.includes(tender.id);

            return (
              <section
                key={tender.id}
                className={`rounded-2xl border-2 shadow-sm overflow-hidden transition ${
                  hasUnread
                    ? 'border-amber-600 bg-amber-50/40'
                    : hasUpdates
                    ? 'border-blue-600 bg-blue-50/25'
                    : 'border-slate-300 bg-white'
                }`}
              >
                {/* Nagłówek grupy */}
                <div
                  className={`px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-b-2 ${
                    hasUnread
                      ? 'bg-amber-200/80 border-amber-500'
                      : hasUpdates
                      ? 'bg-blue-100/80 border-blue-300'
                      : 'bg-slate-100 border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-white text-[11px] font-extrabold">
                      Postępowanie #{groupIndex + 1}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-white border border-slate-300 text-[11px] font-bold">
                      Źródło: {origSource}
                    </span>
                    {hasUpdates && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-300 border border-amber-800 text-[11px] font-extrabold text-black">
                        <Sparkles size={12} />
                        Powiązane wersje: {updates.length + 1}
                      </span>
                    )}
                    {hasUnread && (
                      <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[11px] font-extrabold">
                        NOWA AKTUALIZACJA
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isEditingDeadline ? (
                      <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-blue-500">
                        <input
                          type="datetime-local"
                          value={deadlineInput}
                          onChange={(e) => setDeadlineInput(e.target.value)}
                          className="text-xs font-mono px-2 py-1 border border-blue-300 rounded"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveDeadline(tender.id)}
                          className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                          title="Zapisz termin"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingDeadlineId(null)}
                          className="p-1 bg-white border border-slate-300 rounded hover:bg-slate-100 cursor-pointer"
                          title="Anuluj"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div
                          title={
                            effectiveDeadline
                              ? `Termin składania ofert: ${new Date(
                                  effectiveDeadline
                                ).toLocaleString('pl-PL')}`
                              : 'Brak automatycznego terminu — kliknij ołówek, aby wpisać ręcznie'
                          }
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border-2 text-xs font-extrabold ${groupCountdown.badgeClass}`}
                        >
                          <Clock size={14} />
                          <span>{groupCountdown.label}</span>
                          {effectiveDeadline && (
                            <span className="font-mono text-[11px] opacity-85">
                              ({new Date(effectiveDeadline).toLocaleString('pl-PL', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })})
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDeadlineId(tender.id);
                            setDeadlineInput(toLocalDateTimeInputValue(effectiveDeadline));
                          }}
                          title="Ustaw / zmień termin składania ofert"
                          className="p-1.5 bg-white border border-blue-400 hover:bg-blue-50 rounded-lg cursor-pointer"
                        >
                          <Pencil size={13} />
                        </button>
                      </>
                    )}

                    {groupLink ? (
                      <a
                        href={groupLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={groupLink}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-extrabold shadow-xs transition"
                      >
                        <ExternalLink size={14} /> Otwórz przetarg
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/80 border border-slate-300 rounded-lg text-[11px] font-bold text-slate-500">
                        Brak linku
                      </span>
                    )}

                    {hasUnread && (
                      <button
                        type="button"
                        onClick={() => handleMarkUpdatesRead(tender.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-400 hover:bg-green-500 border-2 border-green-800 rounded-lg text-xs font-extrabold text-black cursor-pointer"
                      >
                        <CheckCheck size={14} /> Przeczytane
                      </button>
                    )}
                  </div>
                </div>

                {/* Karty: aktualizacje od najnowszej + oryginał poniżej */}
                <div className="p-4 space-y-2">
                  {updates.map((upd, updIdx) => {
                    const updKey = `upd-${upd.id}`;
                    const updExpanded = Boolean(expandedCards[updKey]);
                    const updLink = getLinkFromDescription(upd.description) || origLink;
                    const updCleanDesc = getCleanDescription(upd.description);
                    const updCountdown = getHoursCountdown(upd.submissionDeadline, nowMs);
                    const isUnreadCard = !upd.isRead;
                    const isUpdSelected = selectedUpdateIds.includes(upd.id);

                    return (
                      <div key={upd.id} className="space-y-2">
                        <div
                          className={`rounded-xl border-2 p-4 space-y-3 transition ${
                            isUpdSelected
                              ? 'bg-blue-50/70 border-blue-700 ring-2 ring-blue-400/70'
                              : isUnreadCard
                              ? 'bg-white border-amber-600 shadow-xs ring-2 ring-amber-300/60'
                              : 'bg-white border-blue-500'
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <label
                                title="Zaznacz tę aktualizację do raportu"
                                className="flex flex-col items-center gap-0.5 pt-0.5 cursor-pointer shrink-0 select-none"
                              >
                                <input
                                  type="checkbox"
                                  checked={isUpdSelected}
                                  onChange={() => toggleSelectUpdate(upd.id)}
                                  className="w-5 h-5 accent-blue-600 cursor-pointer"
                                />
                                <span className="text-[9px] font-extrabold uppercase text-blue-800">
                                  Raport
                                </span>
                              </label>

                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-300 border-2 border-amber-800 text-xs font-extrabold text-black">
                                    <Sparkles size={12} /> AKTUALIZACJA v{upd.versionNumber}
                                  </span>
                                  {isUnreadCard && (
                                    <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-extrabold">
                                      NOWE
                                    </span>
                                  )}
                                  {upd.externalId && (
                                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-slate-100 border border-slate-300 rounded">
                                      ID: {upd.externalId}
                                    </span>
                                  )}
                                  <span className="text-[11px] font-semibold text-slate-600">
                                    Wykryto:{' '}
                                    {upd.detectedAt
                                      ? new Date(upd.detectedAt).toLocaleString('pl-PL')
                                      : '—'}
                                  </span>
                                </div>

                                <h3 className="text-base font-extrabold text-black leading-snug pt-0.5">
                                  <HighlightedText
                                    text={upd.title}
                                    categories={categories}
                                    descriptionForFilter={tender.description}
                                    enabled={highlightEnabled}
                                  />
                                </h3>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              {upd.submissionDeadline && (
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-extrabold ${updCountdown.badgeClass}`}
                                >
                                  <Clock size={12} /> {updCountdown.label}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => openDiffForUpdate(tender, updates, updIdx)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 border-2 border-amber-700 text-black rounded-lg text-xs font-extrabold cursor-pointer"
                              >
                                <ArrowLeftRight size={13} /> Porównaj ze starą wersją
                              </button>
                              {updLink && (
                                <a
                                  href={updLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                                >
                                  <ExternalLink size={13} /> Otwórz
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteUpdate(upd)}
                                title="Usuń tę wersję aktualizacji"
                                className="p-1.5 bg-white border border-red-300 hover:bg-red-50 rounded-lg text-black cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          {upd.changeSummary && (
                            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-400 text-xs font-bold text-black">
                              Zmiany: {upd.changeSummary}
                            </div>
                          )}

                          {updCleanDesc && (
                            <div>
                              <button
                                type="button"
                                onClick={() => toggleExpand(updKey)}
                                className="inline-flex items-center gap-1 text-xs font-extrabold text-blue-700 hover:underline cursor-pointer"
                              >
                                {updExpanded ? (
                                  <>
                                    <ChevronUp size={14} /> Ukryj pełne szczegóły aktualizacji
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown size={14} /> Pokaż pełne szczegóły aktualizacji
                                  </>
                                )}
                              </button>
                              {updExpanded && (
                                <pre className="mt-2 p-3 bg-slate-50 border border-blue-200 rounded-xl text-xs font-sans whitespace-pre-wrap break-words leading-relaxed max-h-72 overflow-y-auto">
                                  <HighlightedText
                                    text={updCleanDesc}
                                    categories={categories}
                                    descriptionForFilter={tender.description}
                                    enabled={highlightEnabled}
                                  />
                                </pre>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-center gap-2 text-[11px] font-extrabold text-blue-800 select-none">
                          <span className="h-px flex-1 bg-blue-300" />
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 border border-blue-400">
                            <ArrowDown size={12} /> dotyczy tego samego postępowania poniżej
                          </span>
                          <span className="h-px flex-1 bg-blue-300" />
                        </div>
                      </div>
                    );
                  })}

                  {/* KARTA ORYGINAŁU */}
                  <div
                    className={`rounded-xl border-2 p-4 space-y-3 transition ${
                      isOrigSelected
                        ? 'bg-blue-50/70 border-blue-700 ring-2 ring-blue-400/70'
                        : 'bg-white border-slate-300'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <label
                          title="Zaznacz ten oryginalny przetarg do raportu"
                          className="flex flex-col items-center gap-0.5 pt-0.5 cursor-pointer shrink-0 select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isOrigSelected}
                            onChange={() => toggleSelectTender(tender.id)}
                            className="w-5 h-5 accent-blue-600 cursor-pointer"
                          />
                          <span className="text-[9px] font-extrabold uppercase text-blue-800">
                            Raport
                          </span>
                        </label>

                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-md bg-green-300 border-2 border-green-800 text-xs font-extrabold text-black">
                              {hasUpdates ? 'ORYGINAŁ (wersja bazowa)' : 'OBSERWOWANY (INTERESTED)'}
                            </span>
                            <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-blue-50 border border-blue-300 rounded">
                              ID: {tender.externalId}
                            </span>
                            <span className="text-[11px] font-extrabold px-2 py-0.5 bg-blue-100 border border-blue-500 rounded">
                              Score: {tender.score} pkt ({getScoreBreakdown(tender)})
                            </span>
                            <span className="text-[11px] font-semibold text-slate-600">
                              Pobrano:{' '}
                              {tender.publicationDate
                                ? new Date(tender.publicationDate).toLocaleString('pl-PL')
                                : '—'}
                            </span>
                          </div>

                          <h3 className="text-base font-extrabold text-black leading-snug pt-0.5">
                            <HighlightedText
                              text={tender.title}
                              categories={categories}
                              descriptionForFilter={tender.description}
                              enabled={highlightEnabled}
                            />
                          </h3>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {origLink && (
                          <a
                            href={origLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                          >
                            <ExternalLink size={13} /> Otwórz przetarg
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleUnobserve(tender)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-400 hover:bg-blue-50 text-black rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Przestań obserwować
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTender(tender)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-red-400 hover:bg-red-50 text-black rounded-lg text-xs font-bold cursor-pointer"
                        >
                          <Trash2 size={13} /> Usuń
                        </button>
                      </div>
                    </div>

                    <MatchedKeywordsSummary
                      text={`${tender.title || ''}\n${origCleanDesc}`}
                      categories={categories}
                      descriptionForFilter={tender.description}
                      enabled={highlightEnabled}
                    />

                    {origCleanDesc && (
                      <div className="space-y-1.5">
                        {!origExpanded && (
                          <div className="text-xs text-black/80 line-clamp-3 whitespace-pre-line bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                            <HighlightedText
                              text={origCleanDesc}
                              categories={categories}
                              descriptionForFilter={tender.description}
                              enabled={highlightEnabled}
                            />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleExpand(`orig-${tender.id}`)}
                          className="inline-flex items-center gap-1 text-xs font-extrabold text-blue-700 hover:underline cursor-pointer"
                        >
                          {origExpanded ? (
                            <>
                              <ChevronUp size={14} /> Zwiń szczegóły
                            </>
                          ) : (
                            <>
                              <ChevronDown size={14} /> Rozwiń pełne szczegóły
                            </>
                          )}
                        </button>
                        {origExpanded && (
                          <pre className="p-3.5 bg-slate-50 border border-blue-200 rounded-xl text-xs font-sans whitespace-pre-wrap break-words leading-relaxed max-h-80 overflow-y-auto">
                            <HighlightedText
                              text={origCleanDesc}
                              categories={categories}
                              descriptionForFilter={tender.description}
                              enabled={highlightEnabled}
                            />
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}