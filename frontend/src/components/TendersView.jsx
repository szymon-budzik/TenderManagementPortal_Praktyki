import { useState, useEffect } from 'react';
import api from '../api';
import { Search, Filter, RotateCcw, Trash2, Eye, X } from 'lucide-react';

const STATUSES = ['NEW', 'INTERESTED'];

export default function TendersView() {
  const [tenders, setTenders] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [minScore, setMinScore] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Wybrany przetarg do modala ze szczegółami
  const [selectedTender, setSelectedTender] = useState(null);

  const fetchTenders = async () => {
    try {
      const params = { page, size: 10 };
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (minScore !== '') params.minScore = minScore;

      const res = await api.get('/tenders', { params });
      const content = res.data.content || [];
      setTenders(content);
      const total = res.data.totalPages ?? res.data.page?.totalPages ?? 1;
      setTotalPages(Math.max(1, total));
    } catch (err) {
      console.error('Błąd pobierania przetargów:', err);
    }
  };

  useEffect(() => {
    fetchTenders();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(0);
    fetchTenders();
  };

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setMinScore('');
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
      fetchTenders();
    } catch (err) {
      console.error('Błąd zmiany statusu:', err);
    }
  };

  const handleDeleteTender = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Czy na pewno chcesz usunąć ten przetarg?')) return;
    try {
      await api.delete(`/tenders/${id}`);
      if (selectedTender && selectedTender.id === id) {
        setSelectedTender(null);
      }
      fetchTenders();
    } catch (err) {
      console.error('Błąd usuwania przetargu:', err);
    }
  };

  const filteredTenders = tenders.filter((t) => {
    if (!dateFrom && !dateTo) return true;
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
    return true;
  });

  return (
    <div className="space-y-6 text-black">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-black">Lista Przetargów</h2>
          <p className="text-xs font-semibold text-black mt-0.5">
            Kliknij w wybrany wiersz przetargu, aby otworzyć pełne szczegóły ogłoszenia.
          </p>
        </div>
      </div>

      {/* Pasek filtrów */}
      <form
        onSubmit={handleSearchSubmit}
        className="bg-white p-4 rounded-xl border border-blue-200 shadow-xs grid grid-cols-1 md:grid-cols-6 gap-3 items-end"
      >
        <div className="md:col-span-2">
          <label className="block text-xs font-bold uppercase mb-1 text-black">Szukaj frazy</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-blue-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tytuł, zamawiający, opis..."
              className="w-full pl-9 pr-3 py-2 border border-blue-300 rounded-lg text-black focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase mb-1 text-black">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className="w-full px-3 py-2 border border-blue-300 rounded-lg text-black bg-white focus:outline-none focus:border-blue-600"
          >
            <option value="">Wszystkie</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase mb-1 text-black">Min. Score</label>
          <input
            type="number"
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            placeholder="np. 20"
            className="w-full px-3 py-2 border border-blue-300 rounded-lg text-black focus:outline-none focus:border-blue-600"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase mb-1 text-black">Data od</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full px-3 py-2 border border-blue-300 rounded-lg text-black focus:outline-none focus:border-blue-600"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase mb-1 text-black">Data do</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full px-3 py-2 border border-blue-300 rounded-lg text-black focus:outline-none focus:border-blue-600"
          />
        </div>

        <div className="md:col-span-6 flex justify-end gap-2 pt-2 border-t border-blue-100">
          <button
            type="button"
            onClick={handleResetFilters}
            className="flex items-center gap-1.5 py-2 px-4 bg-white border border-blue-300 hover:bg-blue-50 text-black font-bold rounded-lg transition cursor-pointer text-sm"
          >
            <RotateCcw size={15} />
            Wyczyść
          </button>
          <button
            type="submit"
            className="flex items-center gap-1.5 py-2 px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition cursor-pointer text-sm"
          >
            <Filter size={15} />
            Filtruj wyniki
          </button>
        </div>
      </form>

      {/* Tabela przetargów */}
      <div className="bg-white rounded-xl border border-blue-200 overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-blue-600 text-white text-sm">
              <th className="p-3.5 font-bold">ID Zewn.</th>
              <th className="p-3.5 font-bold">Tytuł i skrót informacji</th>
              <th className="p-3.5 font-bold text-center">Score</th>
              <th className="p-3.5 font-bold">Data publikacji</th>
              <th className="p-3.5 font-bold">Status (Kliknij)</th>
              <th className="p-3.5 font-bold text-right">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-100 text-sm text-black">
            {filteredTenders.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-6 text-center font-medium text-black">
                  Brak przetargów spełniających kryteria.
                </td>
              </tr>
            ) : (
              filteredTenders.map((t) => (
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
                  <td className="p-3.5 text-center whitespace-nowrap">
                    <span className="inline-block px-2.5 py-1 rounded-md font-extrabold bg-blue-100 border border-blue-500 text-black">
                      {t.score} pkt
                    </span>
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
                      title="Kliknij, aby zmienić status pomiędzy NEW a INTERESTED"
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
                        onClick={(e) => handleDeleteTender(e, t.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-red-400 hover:bg-red-100 text-black rounded-lg font-bold text-xs cursor-pointer"
                      >
                        <Trash2 size={14} /> Usuń
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginacja */}
      <div className="flex items-center justify-between">
        <button
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="px-4 py-2 bg-white border border-blue-400 rounded-lg font-bold text-black disabled:opacity-40 hover:bg-blue-50 cursor-pointer"
        >
          Poprzednia
        </button>
        <span className="font-bold text-sm text-black">
          Strona {page + 1} z {totalPages}
        </span>
        <button
          disabled={page + 1 >= totalPages}
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
                <div className="text-xs font-bold uppercase">Wynik punktowy</div>
                <div className="text-lg font-extrabold mt-0.5">{selectedTender.score} pkt</div>
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
                onClick={(e) => handleDeleteTender(e, selectedTender.id)}
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