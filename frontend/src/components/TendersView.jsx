import { useState, useEffect, useMemo } from 'react';
import api from '../api';
import ConfirmModal from './ConfirmModal';
import { Search, RotateCcw, Trash2, Eye, X, ArrowUpDown } from 'lucide-react';

const STATUSES = ['NEW', 'INTERESTED'];
const PAGE_SIZE = 10;

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

function parseCategoryScoreMap(tender) {
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

export default function TendersView() {
  const [allTenders, setAllTenders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'publicationDate', dir: 'desc' });
  const [confirmDialog, setConfirmDialog] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [minCategoryScore, setMinCategoryScore] = useState('');
  const [minTotalScore, setMinTotalScore] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [page, setPage] = useState(0);
  const [selectedTender, setSelectedTender] = useState(null);

  const fetchTendersAndCategories = async () => {
    try {
      const [tendersRes, kwRes] = await Promise.all([
        api.get('/tenders', { params: { page: 0, size: 1000 } }),
        api.get('/keywords').catch(() => ({ data: [] })),
      ]);
      const content = tendersRes.data?.content || [];
      setAllTenders(content);
      setCategories(kwRes.data || []);
    } catch (err) {
      console.error('Błąd pobierania przetargów:', err);
    }
  };

  useEffect(() => {
    fetchTendersAndCategories();
    const interval = setInterval(fetchTendersAndCategories, 12000);
    return () => clearInterval(interval);
  }, []);

  const toggleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setCategoryFilter('');
    setMinCategoryScore('');
    setMinTotalScore('');
    setDateFrom('');
    setDateTo('');
    setPage(0);
  };

  const handleToggleStatus = async (e, tender) => {
    e.stopPropagation();
    const nextStatus = tender.status === 'INTERESTED' ? 'NEW' : 'INTERESTED';
    try {
      await api.patch(`/tenders/${tender.id}/status`, { status: nextStatus });
      if (selectedTender && selectedTender.id === tender.id) {
        setSelectedTender({ ...selectedTender, status: nextStatus });
      }
      fetchTendersAndCategories();
    } catch (err) {
      console.error('Błąd zmiany statusu:', err);
    }
  };

  const confirmDeleteTender = (e, tender) => {
    e.stopPropagation();
    setConfirmDialog({
      title: 'Usuń przetarg',
      message: `Czy na pewno chcesz usunąć przetarg "${tender.title}" (${tender.externalId})?`,
      onConfirm: async () => {
        try {
          await api.delete(`/tenders/${tender.id}`);
          if (selectedTender && selectedTender.id === tender.id) {
            setSelectedTender(null);
          }
          fetchTendersAndCategories();
        } finally {
          setConfirmDialog(null);
        }
      },
    });
  };

  const filteredAndSortedTenders = useMemo(() => {
    const filtered = allTenders.filter((t) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const combined = `${t.externalId || ''} ${t.title || ''} ${t.description || ''}`.toLowerCase();
        if (!combined.includes(q)) return false;
      }

      if (statusFilter && t.status !== statusFilter) return false;

      if (minTotalScore !== '') {
        const minSum = Number(minTotalScore);
        if (!Number.isNaN(minSum) && (Number(t.score) || 0) < minSum) return false;
      }

      const catScoreMap = parseCategoryScoreMap(t);
      if (categoryFilter) {
        const catKey = categoryFilter.toLowerCase();
        const achievedInCat = catScoreMap[catKey];
        if (achievedInCat === undefined) return false;
        if (minCategoryScore !== '') {
          const minCat = Number(minCategoryScore);
          if (!Number.isNaN(minCat) && achievedInCat < minCat) return false;
        }
      } else if (minCategoryScore !== '') {
        const minCat = Number(minCategoryScore);
        const values = Object.values(catScoreMap);
        if (values.length === 0 || !values.some((v) => v >= minCat)) return false;
      }

      if (dateFrom || dateTo) {
        if (!t.publicationDate) return false;
        const pubTime = new Date(t.publicationDate).setHours(0, 0, 0, 0);
        if (dateFrom) {
          const fromTime = new Date(dateFrom).setHours(0, 0, 0, 0);
          if (pubTime < fromTime) return false;
        }
        if (dateTo) {
          const toTime = new Date(dateTo).setHours(23, 59, 59, 999);
          if (pubTime > toTime) return false;
        }
      }

      return true;
    });

    filtered.sort((a, b) => {
      const { key, dir } = sortConfig;
      const mult = dir === 'asc' ? 1 : -1;
      const valA = a[key] ?? '';
      const valB = b[key] ?? '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * mult;
      }
      return String(valA).localeCompare(String(valB), 'pl') * mult;
    });

    return filtered;
  }, [
    allTenders,
    search,
    statusFilter,
    categoryFilter,
    minCategoryScore,
    minTotalScore,
    dateFrom,
    dateTo,
    sortConfig,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedTenders.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedTenders = filteredAndSortedTenders.slice(
    currentPage * PAGE_SIZE,
    currentPage * PAGE_SIZE + PAGE_SIZE
  );

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

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-black">Lista Przetargów</h2>
          <p className="text-xs font-semibold text-black mt-0.5">
            Kliknij w nagłówek kolumny, aby posortować wyniki, lub w wybrany przetarg, aby zobaczyć szczegóły.
          </p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold uppercase mb-1 text-black">
              Szukaj frazy
            </label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-3 text-blue-600" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Tytuł, ID, zamawiający..."
                className="w-full pl-9 pr-3 py-2 border border-blue-300 rounded-lg text-black focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase mb-1 text-black">
              Kategoria (Score)
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(0);
              }}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg text-black bg-white font-semibold"
            >
              <option value="">Wszystkie kategorie</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase mb-1 text-black">
              Min. pkt w kategorii
            </label>
            <input
              type="number"
              value={minCategoryScore}
              onChange={(e) => {
                setMinCategoryScore(e.target.value);
                setPage(0);
              }}
              placeholder={categoryFilter ? `Min. w ${categoryFilter}` : 'np. 50'}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg text-black"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase mb-1 text-black">
              Min. Suma Punktów
            </label>
            <input
              type="number"
              value={minTotalScore}
              onChange={(e) => {
                setMinTotalScore(e.target.value);
                setPage(0);
              }}
              placeholder="np. 100"
              className="w-full px-3 py-2 border border-blue-300 rounded-lg text-black"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase mb-1 text-black">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg text-black bg-white"
            >
              <option value="">Wszystkie</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end pt-2 border-t border-blue-100">
          <div>
            <label className="block text-xs font-bold uppercase mb-1 text-black">Data od</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(0);
              }}
              className="w-full px-3 py-1.5 border border-blue-300 rounded-lg text-black text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase mb-1 text-black">Data do</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(0);
              }}
              className="w-full px-3 py-1.5 border border-blue-300 rounded-lg text-black text-xs"
            />
          </div>

          <div className="md:col-span-4 flex items-center justify-between md:justify-end gap-3">
            <span className="text-xs font-extrabold text-black">
              Znaleziono przetargów: {filteredAndSortedTenders.length}
            </span>
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 py-2 px-4 bg-white border border-blue-300 hover:bg-blue-50 text-black font-bold rounded-lg transition cursor-pointer text-xs"
            >
              <RotateCcw size={14} />
              Wyczyść filtry
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-blue-200 overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-blue-600 text-white text-sm select-none">
              <th
                onClick={() => toggleSort('externalId')}
                className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
              >
                <div className="inline-flex items-center gap-1">
                  ID Zewn. <ArrowUpDown size={14} />
                </div>
              </th>
              <th
                onClick={() => toggleSort('title')}
                className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
              >
                <div className="inline-flex items-center gap-1">
                  Tytuł i skrót informacji <ArrowUpDown size={14} />
                </div>
              </th>
              <th
                onClick={() => toggleSort('score')}
                className="p-3.5 font-bold text-center cursor-pointer hover:bg-blue-700"
              >
                <div className="inline-flex items-center gap-1">
                  Score (Kategorie i Suma) <ArrowUpDown size={14} />
                </div>
              </th>
              <th
                onClick={() => toggleSort('publicationDate')}
                className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
              >
                <div className="inline-flex items-center gap-1">
                  Data publikacji <ArrowUpDown size={14} />
                </div>
              </th>
              <th
                onClick={() => toggleSort('status')}
                className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
              >
                <div className="inline-flex items-center gap-1">
                  Status <ArrowUpDown size={14} />
                </div>
              </th>
              <th className="p-3.5 font-bold text-right">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-100 text-sm text-black">
            {paginatedTenders.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-6 text-center font-medium text-black">
                  Brak przetargów spełniających wybrane kryteria.
                </td>
              </tr>
            ) : (
              paginatedTenders.map((t) => {
                const scoreLabel = getTenderScoreDisplay(t);
                return (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedTender(t)}
                    className="hover:bg-blue-50/80 transition cursor-pointer"
                  >
                    <td className="p-3.5 font-mono font-semibold whitespace-nowrap">
                      {t.externalId}
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-black">{t.title}</div>
                      {t.description && (
                        <div className="text-xs text-black mt-1 line-clamp-2 whitespace-pre-line">
                          {t.description}
                        </div>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="inline-flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-100 border-2 border-blue-600 text-black">
                        <span className="font-extrabold text-xs">{scoreLabel}</span>
                        <span className="text-[11px] font-bold bg-white px-2 py-0.5 rounded border border-blue-300">
                          Suma: {t.score} pkt
                        </span>
                      </div>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      {t.publicationDate
                        ? new Date(t.publicationDate).toLocaleDateString('pl-PL')
                        : '—'}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => handleToggleStatus(e, t)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold border-2 shadow-xs transition transform active:scale-95 cursor-pointer ${
                          t.status === 'INTERESTED'
                            ? 'bg-green-400 hover:bg-green-500 border-green-800 text-black'
                            : 'bg-blue-100 hover:bg-blue-200 border-blue-600 text-black'
                        }`}
                      >
                        {t.status}
                      </button>
                    </td>
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTender(t);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-400 hover:bg-blue-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                        >
                          <Eye size={14} /> Szczegóły
                        </button>
                        <button
                          type="button"
                          onClick={(e) => confirmDeleteTender(e, t)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-red-400 hover:bg-red-100 text-black rounded-lg font-bold text-xs cursor-pointer"
                        >
                          <Trash2 size={14} /> Usuń
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <button
          disabled={currentPage === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="px-4 py-2 bg-white border border-blue-400 rounded-lg font-bold text-black disabled:opacity-40 hover:bg-blue-50 cursor-pointer"
        >
          Poprzednia
        </button>
        <span className="font-bold text-sm text-black">
          Strona {currentPage + 1} z {totalPages}
        </span>
        <button
          disabled={currentPage + 1 >= totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="px-4 py-2 bg-white border border-blue-400 rounded-lg font-bold text-black disabled:opacity-40 hover:bg-blue-50 cursor-pointer"
        >
          Następna
        </button>
      </div>

      {selectedTender && (
        <div
          onClick={() => setSelectedTender(null)}
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border-2 border-blue-600 max-w-2xl w-full p-6 shadow-xl space-y-5 text-black max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-4 border-b border-blue-200 pb-4">
              <div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 bg-blue-50 border border-blue-300 rounded">
                  ID Zewnętrzne: {selectedTender.externalId}
                </span>
                <h3 className="text-xl font-extrabold text-black mt-2">
                  {selectedTender.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTender(null)}
                className="p-1.5 rounded-lg border border-blue-300 hover:bg-blue-50 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                <div className="text-xs font-bold uppercase">Punktacja kategorii</div>
                <div className="text-sm font-extrabold mt-1">
                  {getTenderScoreDisplay(selectedTender)}
                </div>
                <div className="text-[11px] font-semibold mt-0.5">
                  Suma całkowita: {selectedTender.score} pkt
                </div>
              </div>
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                <div className="text-xs font-bold uppercase">Data publikacji</div>
                <div className="text-sm font-extrabold mt-1">
                  {selectedTender.publicationDate
                    ? new Date(selectedTender.publicationDate).toLocaleString('pl-PL')
                    : '—'}
                </div>
              </div>
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                <div className="text-xs font-bold uppercase mb-1">Status</div>
                <button
                  type="button"
                  onClick={(e) => handleToggleStatus(e, selectedTender)}
                  className={`px-3 py-1 rounded-lg text-xs font-extrabold border-2 cursor-pointer ${
                    selectedTender.status === 'INTERESTED'
                      ? 'bg-green-400 border-green-800 text-black'
                      : 'bg-blue-100 border-blue-600 text-black'
                  }`}
                >
                  {selectedTender.status} (Zmień)
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-extrabold uppercase">
                Pełne szczegóły i metadane ogłoszenia
              </div>
              <div className="p-4 bg-slate-50 border border-blue-200 rounded-xl text-sm whitespace-pre-line leading-relaxed font-medium">
                {selectedTender.description || 'Brak dodatkowego opisu dla tego przetargu.'}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-blue-100">
              <button
                type="button"
                onClick={(e) => confirmDeleteTender(e, selectedTender)}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-400 hover:bg-red-500 border-2 border-red-800 text-black font-extrabold rounded-xl text-xs cursor-pointer"
              >
                <Trash2 size={15} /> Usuń ten przetarg
              </button>

              <button
                type="button"
                onClick={() => setSelectedTender(null)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm cursor-pointer"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}