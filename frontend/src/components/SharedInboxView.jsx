import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Inbox,
  BookmarkCheck,
  FileSpreadsheet,
  Eye,
  Trash2,
  User,
  Clock,
  MessageSquare,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import TenderDetailsModal from './tenders/TenderDetailsModal';
import {
  formatDateTimePl,
  getShortHoursBadge,
  getTenderDeadlineIso,
  getTenderSource,
} from './tenders/tenderUtils';
import {
  getReceivedTenders,
  markAllSharedTendersRead,
  deleteReceivedTender,
  createReportFromShared,
} from '../services/sharesApi';
import { deleteTender, updateTenderStatus } from '../services/tendersApi';
import { getKeywordCategories } from '../services/keywordsApi';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { useNowTick, usePolling } from '../hooks/usePolling';

export default function SharedInboxView() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedShareIds, setSelectedShareIds] = useState([]);
  const [reportName, setReportName] = useState('');
  const [busyAction, setBusyAction] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [selectedTender, setSelectedTender] = useState(null);

  const { confirmDialog, openConfirm, closeConfirm } = useConfirmDialog();
  const nowMs = useNowTick(60000);

  const fetchData = useCallback(async () => {
    try {
      const [received, kwData] = await Promise.all([
        getReceivedTenders(),
        getKeywordCategories().catch(() => []),
      ]);
      const list = Array.isArray(received) ? received : [];
      setItems(list);
      setCategories(kwData);
      if (list.some((item) => !item.isRead)) {
        markAllSharedTendersRead()
          .then(() => window.dispatchEvent(new Event('sharedUpdated')))
          .catch(() => {});
      }
    } catch (err) {
      console.error('Błąd pobierania przesłanych przetargów:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getReceivedTenders(), getKeywordCategories().catch(() => [])])
      .then(([received, kwData]) => {
        if (cancelled) return;
        const list = Array.isArray(received) ? received : [];
        setItems(list);
        setCategories(kwData);
        if (list.some((item) => !item.isRead)) {
          markAllSharedTendersRead()
            .then(() => window.dispatchEvent(new Event('sharedUpdated')))
            .catch(() => {});
        }
      })
      .catch((err) => {
        console.error('Błąd pobierania przesłanych przetargów:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  usePolling(fetchData, 12000);

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const t = item.tender || {};
      const hay = [
        item.senderUsername,
        item.note,
        t.externalId,
        t.title,
        t.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, search]);

  const toggleSelect = (shareId) => {
    setSelectedShareIds((prev) =>
      prev.includes(shareId) ? prev.filter((id) => id !== shareId) : [...prev, shareId]
    );
  };

  const handleToggleObserveSingle = async (tender) => {
    if (!tender) return;
    const nextStatus = tender.status === 'INTERESTED' ? 'NEW' : 'INTERESTED';
    try {
      const updated = await updateTenderStatus(tender.id, nextStatus);
      setItems((prev) =>
        prev.map((item) =>
          item.tender?.id === tender.id
            ? { ...item, tender: updated || { ...item.tender, status: nextStatus } }
            : item
        )
      );
      if (selectedTender?.id === tender.id) {
        setSelectedTender(updated || { ...selectedTender, status: nextStatus });
      }
      window.dispatchEvent(new Event('observedUpdated'));
    } catch (err) {
      setFeedback({
        success: false,
        text: err?.response?.data?.message || 'Nie udało się zmienić statusu obserwowania.',
      });
    }
  };

  const handleObserveSelected = async () => {
    if (selectedShareIds.length === 0) return;
    setBusyAction(true);
    setFeedback(null);
    try {
      const selectedItems = items.filter((i) => selectedShareIds.includes(i.id));
      const uniqueTenderIds = Array.from(
        new Set(
          selectedItems
            .filter((i) => i.tender && i.tender.status !== 'INTERESTED')
            .map((i) => i.tender.id)
        )
      );

      for (const tid of uniqueTenderIds) {
        await updateTenderStatus(tid, 'INTERESTED');
      }

      window.dispatchEvent(new Event('observedUpdated'));
      await fetchData();
      setFeedback({
        success: true,
        text:
          uniqueTenderIds.length > 0
            ? `Dodano ${uniqueTenderIds.length} przetarg(ów) do Obserwowanych.`
            : 'Wszystkie zaznaczone przetargi są już w Obserwowanych.',
      });
    } catch (err) {
      setFeedback({
        success: false,
        text: err?.response?.data?.message || 'Nie udało się dodać wybranych przetargów do Obserwowanych.',
      });
    } finally {
      setBusyAction(false);
    }
  };

  const handleCreateReport = async () => {
    if (selectedShareIds.length === 0) return;
    setBusyAction(true);
    setFeedback(null);
    try {
      const data = await createReportFromShared(selectedShareIds, reportName.trim());
      setFeedback({
        success: true,
        text:
          data?.message ||
          `Utworzono raport (#${data?.runId}) — dostępny w zakładce Raporty.`,
      });
      setSelectedShareIds([]);
      setReportName('');
    } catch (err) {
      setFeedback({
        success: false,
        text: err?.response?.data?.message || 'Nie udało się utworzyć raportu.',
      });
    } finally {
      setBusyAction(false);
    }
  };

  const handleConfirmRemoveFromInbox = (item) => {
    openConfirm({
      title: 'Usuń ze skrzynki Przesłane',
      message: `Czy usunąć przetarg „${item.tender?.title || item.tenderId}” (od ${item.senderUsername}) z Twojej listy Przesłane? Sam przetarg pozostanie w bazie.`,
      onConfirm: async () => {
        await deleteReceivedTender(item.id);
        setSelectedShareIds((prev) => prev.filter((id) => id !== item.id));
        window.dispatchEvent(new Event('sharedUpdated'));
        await fetchData();
      },
    });
  };

  const handleConfirmDeleteTenderFromModal = (e, tender) => {
    e.stopPropagation();
    openConfirm({
      title: 'Usuń przetarg z systemu',
      message: `Czy na pewno chcesz trwale usunąć przetarg „${tender.title}” (${tender.externalId}) z bazy?`,
      onConfirm: async () => {
        await deleteTender(tender.id);
        setSelectedTender(null);
        window.dispatchEvent(new Event('observedUpdated'));
        window.dispatchEvent(new Event('sharedUpdated'));
        await fetchData();
      },
    });
  };

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

      <TenderDetailsModal
        tender={selectedTender}
        categories={categories}
        nowMs={nowMs}
        onToggleStatus={(e, t) => {
          e.stopPropagation();
          handleToggleObserveSingle(t);
        }}
        onConfirmDelete={handleConfirmDeleteTenderFromModal}
        onClose={() => setSelectedTender(null)}
      />

      {/* Nagłówek */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <Inbox size={28} className="text-blue-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-2xl font-extrabold text-black">
              Przesłane Przetargi ({items.length})
            </h2>
            <p className="text-xs font-semibold text-black mt-0.5">
              Przetargi przesłane do Ciebie przez osoby z Twoich grup i podgrup. Możesz je dodać do Obserwowanych albo utworzyć z nich raport w zakładce Raporty.
            </p>
          </div>
        </div>
      </div>

      {/* Pasek akcji grupowych (Raport + Obserwowane) */}
      {items.length > 0 && (
        <div className="bg-blue-50/80 p-4 rounded-xl border-2 border-blue-600 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={19} className="text-blue-700 shrink-0" />
              <span className="font-extrabold text-sm text-black">
                Akcje dla zaznaczonych ({selectedShareIds.length})
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedShareIds(visibleItems.map((i) => i.id))}
                className="px-2.5 py-1.5 bg-white border border-blue-400 hover:bg-blue-100 rounded-lg text-xs font-bold cursor-pointer"
              >
                Zaznacz wszystkie
              </button>
              <button
                type="button"
                disabled={selectedShareIds.length === 0}
                onClick={() => setSelectedShareIds([])}
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
              placeholder="Opcjonalna nazwa raportu (np. Przetargi od zespołu IT)"
              className="flex-1 min-w-[220px] px-3.5 py-2 bg-white border border-blue-400 rounded-lg text-xs font-semibold text-black"
            />
            <button
              type="button"
              disabled={busyAction || selectedShareIds.length === 0}
              onClick={handleObserveSelected}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-extrabold rounded-lg text-xs cursor-pointer transition"
            >
              <BookmarkCheck size={15} />
              Dodaj do Obserwowanych ({selectedShareIds.length})
            </button>
            <button
              type="button"
              disabled={busyAction || selectedShareIds.length === 0}
              onClick={handleCreateReport}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-400 hover:bg-green-500 disabled:opacity-40 border-2 border-green-800 text-black font-extrabold rounded-lg text-xs cursor-pointer transition"
            >
              <FileSpreadsheet size={15} />
              Utwórz raport w Raportach ({selectedShareIds.length})
            </button>
          </div>

          {feedback && (
            <div
              className={`px-3.5 py-2 rounded-lg border text-xs font-extrabold flex items-center justify-between gap-2 ${
                feedback.success
                  ? 'bg-green-100 border-green-700 text-black'
                  : 'bg-red-100 border-red-700 text-black'
              }`}
            >
              <div className="flex items-center gap-2">
                {feedback.success ? (
                  <CheckCircle2 size={15} className="text-green-700 shrink-0" />
                ) : (
                  <AlertCircle size={15} className="text-red-700 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="p-0.5 rounded hover:bg-black/10 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filtr */}
      <div className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-xs">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj po tytule, ID przetargu, nadawcy lub wiadomości..."
            className="w-full pl-9 pr-3 py-2 border border-blue-300 rounded-lg bg-white text-sm text-black"
          />
        </div>
      </div>

      {/* Lista przesłanych przetargów */}
      {loading ? (
        <div className="p-8 bg-white rounded-xl border border-blue-200 text-center font-bold text-sm text-black">
          Ładowanie przesłanych przetargów...
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="bg-white p-10 rounded-2xl border-2 border-dashed border-blue-300 text-center space-y-2">
          <div className="font-extrabold text-base text-black">
            {items.length === 0
              ? 'Brak przesłanych przetargów'
              : 'Brak przesłanych przetargów pasujących do filtra'}
          </div>
          <p className="text-xs font-semibold text-black opacity-75">
            Gdy ktoś z Twojej grupy lub podgrupy prześle Ci przetarg z zakładki <b>Przetargi</b> lub <b>Obserwowane</b>, pojawi się on tutaj wraz z informacją od kogo i kiedy został wysłany.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleItems.map((item) => {
            const t = item.tender || {};
            const checked = selectedShareIds.includes(item.id);
            const isObserved = t.status === 'INTERESTED';
            const sourceName = getTenderSource(t);
            const deadlineIso = getTenderDeadlineIso(t);
            const hoursBadge = getShortHoursBadge(deadlineIso, nowMs);

            return (
              <div
                key={item.id}
                className={`bg-white rounded-xl border-2 p-4 shadow-xs transition ${
                  checked ? 'border-blue-600 bg-blue-50/40' : 'border-blue-200 hover:border-blue-400'
                }`}
              >
                {/* Pasek metadanych przesłania: od kogo + kiedy */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-blue-100">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelect(item.id)}
                        className="w-4 h-4 accent-blue-600 cursor-pointer"
                      />
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-100 border border-purple-400 font-extrabold text-black">
                        <User size={12} /> Od: {item.senderUsername}
                      </span>
                    </label>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 border border-blue-200 font-bold text-black">
                      <Clock size={12} /> Przesłano: {formatDateTimePl(item.createdAt)}
                    </span>
                    {!item.isRead && (
                      <span className="px-2 py-0.5 rounded-full bg-red-600 text-white font-extrabold text-[10px]">
                        NOWE
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-slate-100 border border-blue-200 text-xs font-bold text-black">
                      {sourceName}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-blue-100 border border-blue-400 text-xs font-extrabold text-black">
                      {t.score ?? 0} pkt
                    </span>
                  </div>
                </div>

                {/* Notatka nadawcy */}
                {item.note && (
                  <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-400 text-xs font-bold text-black flex items-start gap-2">
                    <MessageSquare size={14} className="text-amber-700 shrink-0 mt-0.5" />
                    <span>{item.note}</span>
                  </div>
                )}

                {/* Treść przetargu + akcje */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div
                    onClick={() => setSelectedTender(t)}
                    className="min-w-0 flex-1 cursor-pointer space-y-1"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 border border-blue-200 text-black">
                        {t.externalId}
                      </span>
                      <span className="font-extrabold text-sm text-black hover:underline">
                        {t.title}
                      </span>
                    </div>

                    {t.description && (
                      <p className="text-xs text-black/80 line-clamp-2 whitespace-pre-line">
                        {t.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-semibold text-black">
                      <span>Publikacja: {formatDateTimePl(t.publicationDate)}</span>
                      {deadlineIso && (
                        <span className="text-amber-900 font-bold">
                          Termin: {formatDateTimePl(deadlineIso)}
                        </span>
                      )}
                      {hoursBadge && (
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-extrabold ${hoursBadge.cls}`}
                        >
                          <Clock size={10} /> {hoursBadge.text}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedTender(t)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-400 hover:bg-blue-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                    >
                      <Eye size={14} /> Szczegóły
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleObserveSingle(t)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-extrabold text-xs border-2 cursor-pointer transition ${
                        isObserved
                          ? 'bg-green-400 hover:bg-green-500 border-green-800 text-black'
                          : 'bg-blue-100 hover:bg-blue-200 border-blue-600 text-black'
                      }`}
                    >
                      <BookmarkCheck size={14} />
                      {isObserved ? 'W Obserwowanych' : 'Dodaj do Obserwowanych'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmRemoveFromInbox(item)}
                      title="Usuń z listy Przesłane"
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-red-400 hover:bg-red-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                    >
                      <Trash2 size={14} /> Usuń
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
