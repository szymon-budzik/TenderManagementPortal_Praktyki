import { useState, useEffect, useMemo } from 'react';
import api from '../api';
import ConfirmModal from './ConfirmModal';
import HighlightedText, { MatchedKeywordsSummary } from './HighlightedText';
import {
  Search,
  RotateCcw,
  Trash2,
  Eye,
  X,
  ArrowUpDown,
  ExternalLink,
  Clock,
} from 'lucide-react';

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

function getTenderScoreEntries(tender) {
  const raw = getTenderScoreDisplay(tender);
  if (!raw || raw.endsWith(' pkt')) return [];
  return raw
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
}

function getTenderSource(tender) {
  if (!tender?.description) return 'Nieznane';
  const line = tender.description
    .split('\n')
    .find((l) => l.trim().toLowerCase().startsWith('źródło'));
  if (!line) return 'Nieznane';
  const idx = line.indexOf(':');
  return idx > 0 ? line.substring(idx + 1).trim() : line.trim();
}

function getTenderLink(tender) {
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

function getTenderDeadlineIso(tender) {
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

function getShortHoursBadge(deadlineIso, nowMs) {
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

function formatDateTimePl(iso) {
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
  const [endpoints, setEndpoints] = useState([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [sortConfig, setSortConfig] = useState({ key: 'publicationDate', dir: 'desc' });
  const [confirmDialog, setConfirmDialog] = useState(null);

  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [minCategoryScore, setMinCategoryScore] = useState('');
  const [minTotalScore, setMinTotalScore] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [page, setPage] = useState(0);
  const [selectedTender, setSelectedTender] = useState(null);

  const fetchTendersAndMeta = async () => {
    try {
      const [tendersRes, kwRes, epRes] = await Promise.all([
        api.get('/tenders', { params: { page: 0, size: 1000 } }),
        api.get('/keywords').catch(() => ({ data: [] })),
        api.get('/search/sources').catch(() => ({ data: [] })),
      ]);
      setAllTenders(tendersRes.data?.content || []);
      setCategories(kwRes.data || []);
      setEndpoints(epRes.data || []);
    } catch (err) {
      console.error('Błąd pobierania przetargów:', err);
    }
  };

  useEffect(() => {
    fetchTendersAndMeta();
    const interval = setInterval(fetchTendersAndMeta, 12000);
    const clock = setInterval(() => setNowMs(Date.now()), 60000);
    return () => {
      clearInterval(interval);
      clearInterval(clock);
    };
  }, []);

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

  const toggleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleResetFilters = () => {
    setSearch('');
    setSourceFilter('');
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
      const res = await api.patch(`/tenders/${tender.id}/status`, { status: nextStatus });
      if (selectedTender && selectedTender.id === tender.id) {
        setSelectedTender(res.data || { ...selectedTender, status: nextStatus });
      }
      window.dispatchEvent(new Event('observedUpdated'));
      fetchTendersAndMeta();
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
          window.dispatchEvent(new Event('observedUpdated'));
          fetchTendersAndMeta();
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

      if (sourceFilter) {
        const src = getTenderSource(t).toLowerCase();
        if (src !== sourceFilter.toLowerCase()) return false;
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
      const valA = key === 'source' ? getTenderSource(a) : a[key] ?? '';
      const valB = key === 'source' ? getTenderSource(b) : b[key] ?? '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * mult;
      }
      return String(valA).localeCompare(String(valB), 'pl') * mult;
    });

    return filtered;
  }, [
    allTenders,
    search,
    sourceFilter,
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

  const selectedTenderLink = selectedTender ? getTenderLink(selectedTender) : null;
  const selectedTenderDeadline = selectedTender ? getTenderDeadlineIso(selectedTender) : null;
  const selectedTenderHoursBadge = selectedTender
    ? getShortHoursBadge(selectedTenderDeadline, nowMs)
    : null;

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

      <div>
        <h2 className="text-2xl font-bold text-black">Lista Przetargów</h2>
        <p className="text-xs font-semibold text-black mt-0.5">
          Kliknij w dowolny nagłówek kolumny, aby posortować wyniki, lub w wybrany wiersz, aby otworzyć szczegóły i link do przetargu.
        </p>
      </div>

      {/* Pasek filtrów */}
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
              Źródło
            </label>
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPage(0);
              }}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg text-black bg-white font-semibold"
            >
              <option value="">Wszystkie źródła</option>
              {availableSources.map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
            </select>
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end pt-2 border-t border-blue-100">
          <div>
            <label className="block text-xs font-bold uppercase mb-1 text-black">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              className="w-full px-3 py-1.5 border border-blue-300 rounded-lg text-black bg-white text-xs font-semibold"
            >
              <option value="">Wszystkie</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

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

          <div className="md:col-span-3 flex items-center justify-between md:justify-end gap-3">
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

      {/* Tabela przetargów */}
      <div className="bg-white rounded-xl border border-blue-200 overflow-x-auto shadow-xs">
        <table className="w-full text-left border-collapse table-fixed min-w-[1120px]">
          <thead>
            <tr className="bg-blue-600 text-white text-xs uppercase tracking-wide select-none">
              <th
                onClick={() => toggleSort('externalId')}
                className="px-3.5 py-4 font-bold w-24 cursor-pointer hover:bg-blue-700 whitespace-nowrap"
              >
                <div className="inline-flex items-center gap-1">
                  ID Zewn. <ArrowUpDown size={13} />
                </div>
              </th>
              <th
                onClick={() => toggleSort('source')}
                className="px-3.5 py-4 font-bold w-40 cursor-pointer hover:bg-blue-700 whitespace-nowrap"
              >
                <div className="inline-flex items-center gap-1">
                  Źródło <ArrowUpDown size={13} />
                </div>
              </th>
              <th
                onClick={() => toggleSort('title')}
                className="px-3.5 py-4 font-bold cursor-pointer hover:bg-blue-700 whitespace-nowrap"
              >
                <div className="inline-flex items-center gap-1">
                  Tytuł i skrót informacji <ArrowUpDown size={13} />
                </div>
              </th>
              <th
                onClick={() => toggleSort('score')}
                className="px-3.5 py-4 font-bold w-56 text-center cursor-pointer hover:bg-blue-700 whitespace-nowrap"
              >
                <div className="inline-flex items-center gap-1">
                  Score (Kategorie / Suma) <ArrowUpDown size={13} />
                </div>
              </th>
              <th
                onClick={() => toggleSort('publicationDate')}
                className="px-3.5 py-4 font-bold w-44 cursor-pointer hover:bg-blue-700 whitespace-nowrap"
              >
                <div className="inline-flex items-center gap-1">
                  Data / Termin <ArrowUpDown size={13} />
                </div>
              </th>
              <th
                onClick={() => toggleSort('status')}
                className="px-3.5 py-4 font-bold w-36 text-center cursor-pointer hover:bg-blue-700 whitespace-nowrap"
              >
                <div className="inline-flex items-center gap-1">
                  Status <ArrowUpDown size={13} />
                </div>
              </th>
              <th className="px-3.5 py-4 font-bold w-28 text-center whitespace-nowrap">
                Akcje
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-blue-100 text-sm text-black">
            {paginatedTenders.length === 0 ? (
              <tr>
                <td colSpan="7" className="p-6 text-center font-medium text-black">
                  Brak przetargów spełniających wybrane kryteria.
                </td>
              </tr>
            ) : (
              paginatedTenders.map((t) => {
                const scoreEntries = getTenderScoreEntries(t);
                const sourceName = getTenderSource(t);
                const deadlineIso = getTenderDeadlineIso(t);
                const hoursBadge = getShortHoursBadge(deadlineIso, nowMs);

                return (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedTender(t)}
                    className="hover:bg-blue-50/80 transition cursor-pointer"
                  >
                    <td className="px-3.5 py-3 align-middle">
                      <div
                        title={t.externalId}
                        className="truncate font-mono text-xs font-semibold text-black"
                      >
                        {t.externalId}
                      </div>
                    </td>

                    <td className="px-3.5 py-3 align-middle">
                      <div
                        title={sourceName}
                        className="truncate px-2.5 py-1 bg-slate-100 border border-blue-200 rounded-md text-xs font-bold text-black"
                      >
                        {sourceName}
                      </div>
                    </td>

                    <td className="px-3.5 py-3 align-middle">
                      <div className="font-bold text-black line-clamp-2">{t.title}</div>
                      {t.description && (
                        <div className="text-xs text-black/80 mt-1 line-clamp-2 whitespace-pre-line">
                          {t.description}
                        </div>
                      )}
                    </td>

                    <td
                      className="px-3.5 py-3 align-middle"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="w-48 mx-auto rounded-lg bg-blue-100 border-2 border-blue-600 overflow-hidden flex flex-col">
                        {scoreEntries.length > 0 && (
                          <div className="max-h-14 overflow-y-auto px-2 py-1 space-y-0.5 text-left text-[11px] font-extrabold text-black [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-blue-50 [&::-webkit-scrollbar-thumb]:bg-blue-500 [&::-webkit-scrollbar-thumb]:rounded-full">
                            {scoreEntries.map((entry, idx) => (
                              <div key={idx} className="truncate" title={entry}>
                                {entry}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="bg-white border-t border-blue-300 px-2 py-1 text-[11px] font-extrabold text-center text-black shrink-0">
                          Suma: {t.score} pkt
                        </div>
                      </div>
                    </td>

                    {/* Data publikacji z godziną + Termin składania ofert z godziną i licznikiem godzin */}
                    <td className="px-3.5 py-3 align-middle whitespace-nowrap text-xs">
                      <div className="font-semibold text-black">
                        {formatDateTimePl(t.publicationDate)}
                      </div>
                      {deadlineIso && (
                        <div className="mt-1 space-y-0.5">
                          <div className="text-[11px] font-bold text-amber-900">
                            Do: {formatDateTimePl(deadlineIso)}
                          </div>
                          {hoursBadge && (
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-extrabold ${hoursBadge.cls}`}
                            >
                              <Clock size={10} /> {hoursBadge.text}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-3.5 py-3 align-middle text-center">
                      <button
                        type="button"
                        onClick={(e) => handleToggleStatus(e, t)}
                        className={`w-28 py-1.5 rounded-lg text-xs font-extrabold border-2 shadow-xs transition cursor-pointer text-center ${
                          t.status === 'INTERESTED'
                            ? 'bg-green-400 hover:bg-green-500 border-green-800 text-black'
                            : 'bg-blue-100 hover:bg-blue-200 border-blue-600 text-black'
                        }`}
                      >
                        {t.status}
                      </button>
                    </td>

                    <td className="px-3.5 py-3 align-middle">
                      <div className="flex flex-col gap-1.5 items-stretch">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTender(t);
                          }}
                          className="inline-flex items-center justify-center gap-1 px-2.5 py-1 bg-white border border-blue-400 hover:bg-blue-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                        >
                          <Eye size={13} /> Szczegóły
                        </button>
                        <button
                          type="button"
                          onClick={(e) => confirmDeleteTender(e, t)}
                          className="inline-flex items-center justify-center gap-1 px-2.5 py-1 bg-white border border-red-400 hover:bg-red-100 text-black rounded-lg font-bold text-xs cursor-pointer"
                        >
                          <Trash2 size={13} /> Usuń
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

      {/* Paginacja */}
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

      {/* Modal pełnych szczegółów przetargu */}
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
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2.5 py-1 bg-blue-50 border border-blue-300 rounded">
                    ID: {selectedTender.externalId}
                  </span>
                  <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 border border-slate-300 rounded">
                    Źródło: {getTenderSource(selectedTender)}
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-black mt-2">
                  <HighlightedText
                    text={selectedTender.title}
                    categories={categories}
                    descriptionForFilter={selectedTender.description}
                  />
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTender(null)}
                className="p-1.5 rounded-lg border border-blue-300 hover:bg-blue-50 cursor-pointer shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            {selectedTenderLink ? (
              <div className="p-3.5 bg-blue-50 border-2 border-blue-500 rounded-xl flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-extrabold uppercase text-blue-800">
                    Link do ogłoszenia przetargowego
                  </div>
                  <div
                    title={selectedTenderLink}
                    className="text-xs font-mono text-black truncate mt-0.5"
                  >
                    {selectedTenderLink}
                  </div>
                </div>
                <a
                  href={selectedTenderLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-lg text-xs shrink-0"
                >
                  <ExternalLink size={14} /> Otwórz przetarg
                </a>
              </div>
            ) : (
              <div className="p-3 bg-slate-100 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700">
                Brak bezpośredniego linku URL dla tego ogłoszenia.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                <div className="text-xs font-bold uppercase">Punktacja</div>
                <div className="text-xs font-extrabold mt-1">
                  {getTenderScoreDisplay(selectedTender)}
                </div>
                <div className="text-[11px] font-semibold mt-0.5">
                  Suma: {selectedTender.score} pkt
                </div>
              </div>
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                <div className="text-xs font-bold uppercase">Data publikacji</div>
                <div className="text-xs font-extrabold mt-1">
                  {formatDateTimePl(selectedTender.publicationDate)}
                </div>
              </div>
              <div className="p-3 bg-amber-50/80 border border-amber-300 rounded-xl">
                <div className="text-xs font-bold uppercase">Termin składania</div>
                <div className="text-xs font-extrabold mt-1">
                  {selectedTenderDeadline ? formatDateTimePl(selectedTenderDeadline) : 'Brak'}
                </div>
                {selectedTenderHoursBadge && (
                  <span
                    className={`mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-extrabold ${selectedTenderHoursBadge.cls}`}
                  >
                    <Clock size={10} /> {selectedTenderHoursBadge.text}
                  </span>
                )}
              </div>
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                <div className="text-xs font-bold uppercase mb-1">Status</div>
                <button
                  type="button"
                  onClick={(e) => handleToggleStatus(e, selectedTender)}
                  className={`w-28 py-1 rounded-lg text-xs font-extrabold border-2 cursor-pointer text-center ${
                    selectedTender.status === 'INTERESTED'
                      ? 'bg-green-400 border-green-800 text-black'
                      : 'bg-blue-100 border-blue-600 text-black'
                  }`}
                >
                  {selectedTender.status}
                </button>
              </div>
            </div>

            <MatchedKeywordsSummary
              text={`${selectedTender.title || ''}\n${selectedTender.description || ''}`}
              categories={categories}
              descriptionForFilter={selectedTender.description}
            />

            <div className="space-y-2">
              <div className="text-xs font-extrabold uppercase">
                Pełne szczegóły i metadane ogłoszenia
              </div>
              <div className="p-4 bg-slate-50 border border-blue-200 rounded-xl text-sm whitespace-pre-line leading-relaxed font-medium">
                {selectedTender.description ? (
                  <HighlightedText
                    text={selectedTender.description}
                    categories={categories}
                    descriptionForFilter={selectedTender.description}
                  />
                ) : (
                  'Brak dodatkowego opisu dla tego przetargu.'
                )}
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