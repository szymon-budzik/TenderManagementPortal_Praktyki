import { useState, useEffect, useMemo, useCallback } from 'react';
import { Send, CheckCircle2, X } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import ShareModal from './ShareModal';
import TendersFilterBar from './tenders/TendersFilterBar';
import TendersTable from './tenders/TendersTable';
import TenderDetailsModal from './tenders/TenderDetailsModal';
import {
  PAGE_SIZE,
  getTenderSource,
  parseCategoryScoreMap,
} from './tenders/tenderUtils';
import { deleteTender, getTenders, updateTenderStatus } from '../services/tendersApi';
import { getKeywordCategories } from '../services/keywordsApi';
import { getSearchSources } from '../services/endpointsApi';
import { useSort } from '../hooks/useSort';
import { usePagination } from '../hooks/usePagination';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { useNowTick, usePolling } from '../hooks/usePolling';

const INITIAL_FILTERS = {
  search: '',
  sourceFilter: '',
  statusFilter: '',
  categoryFilter: '',
  minCategoryScore: '',
  minTotalScore: '',
  dateFrom: '',
  dateTo: '',
};

const getTenderSortValue = (t, key) => (key === 'source' ? getTenderSource(t) : (t[key] ?? ''));

export default function TendersView() {
  const [allTenders, setAllTenders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [selectedTender, setSelectedTender] = useState(null);
  const [selectedTenderIds, setSelectedTenderIds] = useState([]);
  const [shareModalIds, setShareModalIds] = useState(null);
  const [shareFeedback, setShareFeedback] = useState('');

  const { confirmDialog, openConfirm, closeConfirm } = useConfirmDialog();
  const nowMs = useNowTick(60000);

  const fetchTendersAndMeta = useCallback(async () => {
    try {
      const [tendersData, kwData, epData] = await Promise.all([
        getTenders({ page: 0, size: 1000 }),
        getKeywordCategories().catch(() => []),
        getSearchSources().catch(() => []),
      ]);
      setAllTenders(tendersData);
      setCategories(kwData);
      setEndpoints(epData);
    } catch (err) {
      console.error('Błąd pobierania przetargów:', err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getTenders({ page: 0, size: 1000 }),
      getKeywordCategories().catch(() => []),
      getSearchSources().catch(() => []),
    ])
      .then(([tendersData, kwData, epData]) => {
        if (cancelled) return;
        setAllTenders(tendersData);
        setCategories(kwData);
        setEndpoints(epData);
      })
      .catch((err) => {
        console.error('Błąd pobierania przetargów:', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  usePolling(fetchTendersAndMeta, 12000);

  const availableSources = useMemo(() => {
    const set = new Set();
    endpoints.forEach((ep) => {
      if (ep.name) set.add(ep.name);
    });
    allTenders.forEach((t) => {
      const s = getTenderSource(t);
      if (s && s !== 'Nieznane') set.add(s);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pl'));
  }, [endpoints, allTenders]);

  const filteredTenders = useMemo(() => {
    return allTenders.filter((t) => {
      if (filters.search.trim()) {
        const q = filters.search.trim().toLowerCase();
        const combined = `${t.externalId || ''} ${t.title || ''} ${t.description || ''}`.toLowerCase();
        if (!combined.includes(q)) return false;
      }

      if (filters.sourceFilter) {
        const src = getTenderSource(t).toLowerCase();
        if (src !== filters.sourceFilter.toLowerCase()) return false;
      }

      if (filters.statusFilter && t.status !== filters.statusFilter) return false;

      if (filters.minTotalScore !== '') {
        const minSum = Number(filters.minTotalScore);
        if (!Number.isNaN(minSum) && (Number(t.score) || 0) < minSum) return false;
      }

      const catScoreMap = parseCategoryScoreMap(t);
      if (filters.categoryFilter) {
        const catKey = filters.categoryFilter.toLowerCase();
        const achievedInCat = catScoreMap[catKey];
        if (achievedInCat === undefined) return false;
        if (filters.minCategoryScore !== '') {
          const minCat = Number(filters.minCategoryScore);
          if (!Number.isNaN(minCat) && achievedInCat < minCat) return false;
        }
      } else if (filters.minCategoryScore !== '') {
        const minCat = Number(filters.minCategoryScore);
        const values = Object.values(catScoreMap);
        if (values.length === 0 || !values.some((v) => v >= minCat)) return false;
      }

      if (filters.dateFrom || filters.dateTo) {
        if (!t.publicationDate) return false;
        const pubTime = new Date(t.publicationDate).setHours(0, 0, 0, 0);
        if (filters.dateFrom) {
          const fromTime = new Date(filters.dateFrom).setHours(0, 0, 0, 0);
          if (pubTime < fromTime) return false;
        }
        if (filters.dateTo) {
          const toTime = new Date(filters.dateTo).setHours(23, 59, 59, 999);
          if (pubTime > toTime) return false;
        }
      }

      return true;
    });
  }, [allTenders, filters]);

  const { toggleSort, sortedItems: sortedTenders } = useSort(
    filteredTenders,
    { key: 'publicationDate', dir: 'desc' },
    getTenderSortValue
  );

  const { setPage, totalPages, currentPage, paginatedItems: paginatedTenders } = usePagination(
    sortedTenders,
    PAGE_SIZE
  );

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(0);
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setPage(0);
  };

  const handleToggleStatus = async (e, tender) => {
    e.stopPropagation();
    const nextStatus = tender.status === 'INTERESTED' ? 'NEW' : 'INTERESTED';
    try {
      const updated = await updateTenderStatus(tender.id, nextStatus);
      if (selectedTender && selectedTender.id === tender.id) {
        setSelectedTender(updated || { ...selectedTender, status: nextStatus });
      }
      window.dispatchEvent(new Event('observedUpdated'));
      fetchTendersAndMeta();
    } catch (err) {
      console.error('Błąd zmiany statusu:', err);
    }
  };

  const confirmDeleteTender = (e, tender) => {
    e.stopPropagation();
    openConfirm({
      title: 'Usuń przetarg',
      message: `Czy na pewno chcesz usunąć przetarg "${tender.title}" (${tender.externalId})?`,
      onConfirm: async () => {
        await deleteTender(tender.id);
        if (selectedTender && selectedTender.id === tender.id) {
          setSelectedTender(null);
        }
        window.dispatchEvent(new Event('observedUpdated'));
        fetchTendersAndMeta();
      },
    });
  };

  const toggleSelectTender = (id) => {
    setSelectedTenderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectPageTenders = () => {
    const pageIds = paginatedTenders.map((t) => t.id);
    const allOnPageSelected =
      pageIds.length > 0 && pageIds.every((id) => selectedTenderIds.includes(id));
    if (allOnPageSelected) {
      setSelectedTenderIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedTenderIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
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

      <ShareModal
        isOpen={Boolean(shareModalIds && shareModalIds.length > 0)}
        mode="TENDERS"
        itemIds={shareModalIds || []}
        onClose={() => setShareModalIds(null)}
        onShared={(res) => {
          setSelectedTenderIds([]);
          setShareFeedback(res?.message || 'Przesłano wybrane przetargi.');
        }}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-black">Lista Przetargów</h2>
          <p className="text-xs font-semibold text-black mt-0.5">
            Kliknij w dowolny nagłówek kolumny, aby posortować wyniki, lub zaznacz przetargi i prześlij je osobom ze swojej grupy/podgrupy.
          </p>
        </div>

        {selectedTenderIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShareModalIds(selectedTenderIds)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs cursor-pointer shadow-xs"
            >
              <Send size={14} /> Prześlij zaznaczone ({selectedTenderIds.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedTenderIds([])}
              className="px-3 py-2 bg-white border border-blue-300 hover:bg-blue-50 text-black font-bold rounded-xl text-xs cursor-pointer"
            >
              Odznacz
            </button>
          </div>
        )}
      </div>

      {shareFeedback && (
        <div className="p-3 bg-green-50 border border-green-700 rounded-xl text-xs font-extrabold text-black flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-green-700 shrink-0" />
            <span>{shareFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setShareFeedback('')}
            className="p-0.5 rounded hover:bg-green-100 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <TendersFilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        availableSources={availableSources}
        categories={categories}
        matchedCount={sortedTenders.length}
        onReset={handleResetFilters}
      />

      <TendersTable
        tenders={paginatedTenders}
        nowMs={nowMs}
        currentPage={currentPage}
        totalPages={totalPages}
        selectedTenderIds={selectedTenderIds}
        onToggleSelectTender={toggleSelectTender}
        onToggleSelectPage={toggleSelectPageTenders}
        onShareSingleTender={(e, t) => {
          e.stopPropagation();
          setShareModalIds([t.id]);
        }}
        onPageChange={setPage}
        onToggleSort={toggleSort}
        onSelectTender={setSelectedTender}
        onToggleStatus={handleToggleStatus}
        onConfirmDelete={confirmDeleteTender}
      />

      <TenderDetailsModal
        tender={selectedTender}
        categories={categories}
        nowMs={nowMs}
        onToggleStatus={handleToggleStatus}
        onConfirmDelete={confirmDeleteTender}
        onClose={() => setSelectedTender(null)}
      />
    </div>
  );
}
