import { useState, useEffect, useMemo, useCallback } from 'react';
import { BookmarkCheck, RefreshCw } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import VersionDiffModal from './VersionDiffModal';
import ObservedCheckResultBanner from './observed/ObservedCheckResultBanner';
import ObservedReportBar from './observed/ObservedReportBar';
import ObservedFilterBar from './observed/ObservedFilterBar';
import ObservedGroupCard from './observed/ObservedGroupCard';
import { buildDiffVersions } from './observed/observedUtils';
import {
  checkObservedUpdates,
  createObservedReport,
  deleteTender,
  deleteTenderUpdate,
  getObservedTenders,
  markTenderUpdatesRead,
  updateTenderDeadline,
  updateTenderStatus,
} from '../services/tendersApi';
import { getKeywordCategories } from '../services/keywordsApi';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { useNowTick, usePolling } from '../hooks/usePolling';

export default function ObservedView() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [highlightEnabled, setHighlightEnabled] = useState(true);
  const [diffPayload, setDiffPayload] = useState(null);

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

  const { confirmDialog, openConfirm, closeConfirm } = useConfirmDialog();
  const nowMs = useNowTick(60000);

  const fetchObserved = useCallback(async () => {
    try {
      const [obsData, kwData] = await Promise.all([
        getObservedTenders(),
        getKeywordCategories().catch(() => []),
      ]);
      setItems(obsData);
      setCategories(kwData);
    } catch (err) {
      console.error('Błąd pobierania obserwowanych przetargów:', err);
    }
  }, []);

  useEffect(() => {
    fetchObserved();
  }, [fetchObserved]);

  usePolling(fetchObserved, 12000);

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

  const handleSelectAllVisible = () => {
    setSelectedTenderIds(visibleItems.map((entry) => entry.tender.id));
    setSelectedUpdateIds(visibleItems.flatMap((entry) => (entry.updates || []).map((u) => u.id)));
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
      const data = await createObservedReport({
        tenderIds: selectedTenderIds,
        updateIds: selectedUpdateIds,
        reportName: reportName.trim() || null,
      });
      setReportFeedback({
        success: true,
        text:
          data?.message ||
          `Utworzono raport (#${data?.runId}) — jest już dostępny w zakładce Raporty.`,
      });
      handleClearSelection();
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
      const data = await checkObservedUpdates();
      setCheckResult(data);
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
      await markTenderUpdatesRead(tenderId);
      await fetchObserved();
      notifyBadgeRefresh();
    } catch (err) {
      console.error('Błąd oznaczania aktualizacji jako przeczytane:', err);
    }
  };

  const handleUnobserve = (tender) => {
    openConfirm({
      title: 'Przestań obserwować przetarg',
      message: `Czy przenieść przetarg "${tender.title}" z powrotem do statusu NEW (zniknie z Obserwowanych)?`,
      onConfirm: async () => {
        await updateTenderStatus(tender.id, 'NEW');
        setSelectedTenderIds((prev) => prev.filter((id) => id !== tender.id));
        await fetchObserved();
        notifyBadgeRefresh();
      },
    });
  };

  const handleDeleteTender = (tender) => {
    openConfirm({
      title: 'Usuń przetarg na stałe',
      message: `Czy na pewno chcesz usunąć przetarg "${tender.title}" wraz ze wszystkimi jego aktualizacjami?`,
      onConfirm: async () => {
        await deleteTender(tender.id);
        setSelectedTenderIds((prev) => prev.filter((id) => id !== tender.id));
        await fetchObserved();
        notifyBadgeRefresh();
      },
    });
  };

  const handleDeleteUpdate = (update) => {
    openConfirm({
      title: 'Usuń zapisaną aktualizację',
      message: `Czy usunąć wersję "Aktualizacja v${update.versionNumber}"? Oryginalny przetarg pozostanie bez zmian.`,
      onConfirm: async () => {
        await deleteTenderUpdate(update.id);
        setSelectedUpdateIds((prev) => prev.filter((id) => id !== update.id));
        await fetchObserved();
        notifyBadgeRefresh();
      },
    });
  };

  const handleSaveDeadline = async (tenderId) => {
    try {
      await updateTenderDeadline(tenderId, deadlineInput.trim() || null);
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

  const totalUnreadGroups = items.filter(
    (entry) => entry.unreadUpdatesCount > 0 || entry.tender?.hasUnreadUpdate
  ).length;

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
          onCancel={closeConfirm}
          onClose={closeConfirm}
        />
      )}

      {diffPayload && (
        <VersionDiffModal
          oldVersion={diffPayload.oldVersion}
          newVersion={diffPayload.newVersion}
          onClose={() => setDiffPayload(null)}
        />
      )}

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

      <ObservedCheckResultBanner
        checkResult={checkResult}
        onClose={() => setCheckResult(null)}
      />

      {items.length > 0 && (
        <ObservedReportBar
          selectedTenderCount={selectedTenderIds.length}
          selectedUpdateCount={selectedUpdateIds.length}
          reportName={reportName}
          onReportNameChange={setReportName}
          creatingReport={creatingReport}
          reportFeedback={reportFeedback}
          onDismissFeedback={() => setReportFeedback(null)}
          onSelectLatestPerGroup={handleSelectLatestPerGroup}
          onSelectAllVisible={handleSelectAllVisible}
          onClearSelection={handleClearSelection}
          onCreateReport={handleCreateReport}
        />
      )}

      <ObservedFilterBar
        search={search}
        onSearchChange={setSearch}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        onlyWithUpdates={onlyWithUpdates}
        onOnlyWithUpdatesChange={setOnlyWithUpdates}
        highlightEnabled={highlightEnabled}
        onHighlightEnabledChange={setHighlightEnabled}
        onReset={() => {
          setSearch('');
          setOnlyWithUpdates(false);
          setSortBy('ORDER');
        }}
      />

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
          {visibleItems.map((entry, groupIndex) => (
            <ObservedGroupCard
              key={entry.tender.id}
              entry={entry}
              groupIndex={groupIndex}
              nowMs={nowMs}
              categories={categories}
              highlightEnabled={highlightEnabled}
              expandedCards={expandedCards}
              onToggleExpand={toggleExpand}
              selectedTenderIds={selectedTenderIds}
              selectedUpdateIds={selectedUpdateIds}
              onToggleSelectTender={toggleSelectTender}
              onToggleSelectUpdate={toggleSelectUpdate}
              editingDeadlineId={editingDeadlineId}
              deadlineInput={deadlineInput}
              onStartEditDeadline={(id, val) => {
                setEditingDeadlineId(id);
                setDeadlineInput(val);
              }}
              onDeadlineInputChange={setDeadlineInput}
              onSaveDeadline={handleSaveDeadline}
              onCancelEditDeadline={() => setEditingDeadlineId(null)}
              onMarkUpdatesRead={handleMarkUpdatesRead}
              onOpenDiff={(tender, updates, updIdx) =>
                setDiffPayload(buildDiffVersions(tender, updates, updIdx))
              }
              onDeleteUpdate={handleDeleteUpdate}
              onUnobserve={handleUnobserve}
              onDeleteTender={handleDeleteTender}
            />
          ))}
        </div>
      )}
    </div>
  );
}
