import { useState, useEffect } from 'react';
import api from '../api';
import { Play, Globe, KeyRound, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function SearchView() {
  const [endpoints, setEndpoints] = useState([]);
  const [categories, setCategories] = useState([]);

  const [selectedEndpointIds, setSelectedEndpointIds] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [matchMode, setMatchMode] = useState('ANY'); // 'ANY' = chociaż 1 słowo, 'ALL' = wszystkie słowa

  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [epRes, kwRes] = await Promise.all([
          api.get('/search/sources'),
          api.get('/keywords'),
        ]);
        const epList = epRes.data || [];
        const kwList = kwRes.data || [];

        setEndpoints(epList);
        setCategories(kwList);

        // Domyślnie zaznacz aktywne endpointy oraz wszystkie kategorie keywordsów
        setSelectedEndpointIds(epList.filter((e) => e.isActive).map((e) => e.id));
        setSelectedCategoryIds(kwList.map((k) => k.id));
      } catch (err) {
        console.error('Błąd ładowania konfiguracji wyszukiwarki:', err);
      }
    };
    loadData();
  }, []);

  const toggleEndpoint = (id) => {
    setSelectedEndpointIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleCategory = (id) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleRunFetch = async () => {
    setErrorMsg('');
    setRunResult(null);

    if (selectedEndpointIds.length === 0) {
      setErrorMsg('Zaznacz przynajmniej jeden endpoint, z którego mają zostać pobrane przetargi.');
      return;
    }

    setRunning(true);
    try {
      const res = await api.post('/search/run', {
        endpointIds: selectedEndpointIds,
        keywordCategoryIds: selectedCategoryIds,
        matchMode,
      });
      setRunResult(res.data);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Wystąpił błąd podczas uruchamiania pobierania.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6 text-black">
      {/* Górny pasek z przyciskiem uruchamiającym pobieranie */}
      <div className="bg-white p-6 rounded-xl border-2 border-blue-600 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-black">Wyszukiwarka Przetargów</h2>
          <p className="text-sm font-medium text-black mt-1">
            Wybierz źródła danych oraz kategorie słów kluczowych, a następnie uruchom pobieranie i analizę.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRunFetch}
          disabled={running}
          className="flex items-center justify-center gap-2.5 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-extrabold rounded-xl shadow-sm transition cursor-pointer text-base shrink-0"
        >
          {running ? <Loader2 size={20} className="animate-spin" /> : <Play size={20} />}
          {running ? 'Trwa pobieranie...' : 'Uruchom pobieranie'}
        </button>
      </div>

      {/* Komunikaty błędów i raport po wykonaniu pobierania */}
      {errorMsg && (
        <div className="p-4 bg-red-100 border-2 border-red-600 rounded-xl text-black font-bold text-sm">
          {errorMsg}
        </div>
      )}

      {runResult && (
        <div className="bg-white p-5 rounded-xl border-2 border-green-700 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-green-200 pb-3">
            <h3 className="text-lg font-extrabold text-black">Wynik pobierania i analizy</h3>
            <button
              onClick={() => setRunResult(null)}
              className="text-xs font-bold px-2.5 py-1 border border-blue-300 rounded hover:bg-blue-50 cursor-pointer"
            >
              Zamknij raport
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-3.5 bg-blue-50 border border-blue-300 rounded-lg">
              <div className="text-xs font-bold uppercase">Pobrano z API</div>
              <div className="text-2xl font-extrabold mt-1">{runResult.totalFetched}</div>
            </div>
            <div className="p-3.5 bg-green-100 border border-green-600 rounded-lg">
              <div className="text-xs font-bold uppercase">Zapisano (&gt;0 pkt)</div>
              <div className="text-2xl font-extrabold mt-1">{runResult.savedCount}</div>
            </div>
            <div className="p-3.5 bg-red-100 border border-red-500 rounded-lg">
              <div className="text-xs font-bold uppercase">Wykluczone (Priorytet)</div>
              <div className="text-2xl font-extrabold mt-1">{runResult.excludedCount}</div>
            </div>
            <div className="p-3.5 bg-slate-100 border border-slate-400 rounded-lg">
              <div className="text-xs font-bold uppercase">Pominięto (0 pkt)</div>
              <div className="text-2xl font-extrabold mt-1">{runResult.zeroScoreSkippedCount ?? 0}</div>
            </div>
          </div>

          {runResult.logs && runResult.logs.length > 0 && (
            <div className="space-y-1.5 text-xs">
              {runResult.logs.map((log, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border font-bold ${
                    log.success
                      ? 'bg-green-50 border-green-400 text-black'
                      : 'bg-red-50 border-red-400 text-black'
                  }`}
                >
                  {log.success ? (
                    <CheckCircle2 size={16} className="text-green-700 shrink-0" />
                  ) : (
                    <XCircle size={16} className="text-red-700 shrink-0" />
                  )}
                  <span>{log.sourceName}:</span>
                  <span className="font-normal">{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SEKCJA 1: ENDPOINTY */}
      <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-blue-100">
          <div className="flex items-center gap-2">
            <Globe size={20} className="text-blue-600" />
            <h3 className="text-lg font-bold text-black">
              1. Źródła danych (Endpointy) — zaznacz, z których pobierać
            </h3>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedEndpointIds(endpoints.map((e) => e.id))}
              className="px-3 py-1 text-xs font-bold bg-blue-50 border border-blue-300 rounded-lg hover:bg-blue-100 cursor-pointer"
            >
              Zaznacz wszystkie
            </button>
            <button
              type="button"
              onClick={() => setSelectedEndpointIds([])}
              className="px-3 py-1 text-xs font-bold bg-white border border-blue-300 rounded-lg hover:bg-blue-50 cursor-pointer"
            >
              Odznacz wszystkie
            </button>
          </div>
        </div>

        {endpoints.length === 0 ? (
          <p className="text-sm font-medium">Brak zdefiniowanych endpointów w systemie.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {endpoints.map((ep) => {
              const checked = selectedEndpointIds.includes(ep.id);
              return (
                <label
                  key={ep.id}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition ${
                    checked
                      ? 'bg-blue-50/70 border-blue-600'
                      : 'bg-white border-blue-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleEndpoint(ep.id)}
                    className="w-5 h-5 mt-0.5 accent-blue-600 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-black">{ep.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-extrabold border ${
                          ep.isActive
                            ? 'bg-green-300 border-green-700 text-black'
                            : 'bg-red-300 border-red-700 text-black'
                        }`}
                      >
                        {ep.isActive ? 'AKTYWNY' : 'WYŁĄCZONY'}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-black truncate mt-1">
                      [{ep.httpMethod}] {ep.url}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* SEKCJA 2: KEYWORDSY + REGUŁA DOPASOWANIA */}
      <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-blue-100">
          <div className="flex items-center gap-2">
            <KeyRound size={20} className="text-blue-600" />
            <h3 className="text-lg font-bold text-black">
              2. Kategorie słów kluczowych (Keywordsy) i warunek zaliczenia
            </h3>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategoryIds(categories.map((c) => c.id))}
              className="px-3 py-1 text-xs font-bold bg-blue-50 border border-blue-300 rounded-lg hover:bg-blue-100 cursor-pointer"
            >
              Zaznacz wszystkie
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategoryIds([])}
              className="px-3 py-1 text-xs font-bold bg-white border border-blue-300 rounded-lg hover:bg-blue-50 cursor-pointer"
            >
              Odznacz wszystkie
            </button>
          </div>
        </div>

        {/* Wybór: chociaż 1 słowo vs wszystkie słowa */}
        <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-300 space-y-2">
          <div className="text-xs font-extrabold uppercase text-black">
            Warunek zaliczenia kategorii w ogłoszeniu:
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label
              className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer ${
                matchMode === 'ANY'
                  ? 'bg-white border-blue-600 font-bold'
                  : 'bg-white/70 border-blue-200'
              }`}
            >
              <input
                type="radio"
                name="matchMode"
                value="ANY"
                checked={matchMode === 'ANY'}
                onChange={() => setMatchMode('ANY')}
                className="w-4 h-4 accent-blue-600"
              />
              <div>
                <div className="text-sm font-bold text-black">
                  Chociaż 1 słowo z kategorii (OR)
                </div>
                <div className="text-xs font-normal text-black">
                  Wystarczy obecność dowolnego słowa kluczowego z danej kategorii.
                </div>
              </div>
            </label>

            <label
              className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer ${
                matchMode === 'ALL'
                  ? 'bg-white border-blue-600 font-bold'
                  : 'bg-white/70 border-blue-200'
              }`}
            >
              <input
                type="radio"
                name="matchMode"
                value="ALL"
                checked={matchMode === 'ALL'}
                onChange={() => setMatchMode('ALL')}
                className="w-4 h-4 accent-blue-600"
              />
              <div>
                <div className="text-sm font-bold text-black">
                  Wszystkie słowa z kategorii (AND)
                </div>
                <div className="text-xs font-normal text-black">
                  W ogłoszeniu muszą wystąpić wszystkie słowa z danej kategorii.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Lista kategorii keywordsów */}
        {categories.length === 0 ? (
          <p className="text-sm font-medium">Brak zdefiniowanych kategorii słów kluczowych.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {categories.map((cat) => {
              const checked = selectedCategoryIds.includes(cat.id);
              const words = (cat.keywords || '')
                .split(',')
                .map((w) => w.trim())
                .filter(Boolean);

              return (
                <label
                  key={cat.id}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition ${
                    checked
                      ? 'bg-blue-50/70 border-blue-600'
                      : 'bg-white border-blue-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCategory(cat.id)}
                    className="w-5 h-5 mt-0.5 accent-blue-600 cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-black">{cat.name}</span>
                      {cat.isExcluded ? (
                        <span className="px-2.5 py-0.5 rounded text-xs font-extrabold bg-red-400 border border-red-800 text-black">
                          WYKLUCZ
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded text-xs font-extrabold bg-blue-100 border border-blue-600 text-black">
                          +{cat.score} pkt
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {words.map((w, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-white border border-blue-200 rounded text-[11px] font-semibold text-black"
                        >
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}