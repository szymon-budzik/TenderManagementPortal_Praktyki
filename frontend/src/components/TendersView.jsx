import { useState, useEffect, useMemo, useCallback } from 'react';
import ConfirmModal from './ConfirmModal';
import TendersFilterBar from './tenders/TendersFilterBar';
import TendersTable from './tenders/TendersTable';
import TenderDetailsModal from './tenders/TenderDetailsModal';
import {
  PAGE_SIZE,
  getTenderScoreDisplay,
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

export { getTenderScoreDisplay };

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
    fetchTendersAndMeta();
  }, [fetchTendersAndMeta]);

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

      <div>
        <h2 className="text-2xl font-bold text-black">Lista Przetargów</h2>
        <p className="text-xs font-semibold text-black mt-0.5">
          Kliknij w dowolny nagłówek kolumny, aby posortować wyniki, lub w wybrany wiersz, aby otworzyć szczegóły i link do przetargu.
        </p>
      </div>

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
