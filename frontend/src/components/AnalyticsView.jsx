import { useState, useEffect, useMemo } from 'react';
import api from '../api';
import {
  BarChart3,
  PieChart,
  Calendar,
  Layers,
  KeyRound,
  Globe,
  TrendingUp,
  Award,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';

export default function AnalyticsView() {
  const [tenders, setTenders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  // Ramy czasowe
  const [rangePreset, setRangePreset] = useState('ALL'); // '7D' | '30D' | '90D' | 'ALL' | 'CUSTOM'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Przełącznik: 'CATEGORIES' | 'KEYWORDS' | 'ENDPOINTS'
  const [bindingMode, setBindingMode] = useState('CATEGORIES');

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const [tendersRes, keywordsRes, endpointsRes, runsRes] = await Promise.all([
          api.get('/tenders', { params: { page: 0, size: 2000 } }),
          api.get('/keywords').catch(() => ({ data: [] })),
          api.get('/search/sources').catch(() => ({ data: [] })),
          api.get('/automation/runs').catch(() => ({ data: [] })),
        ]);

        const tenderList = Array.isArray(tendersRes.data)
          ? tendersRes.data
          : tendersRes.data?.content || [];
        setTenders(tenderList);
        setCategories(keywordsRes.data || []);
        setEndpoints(endpointsRes.data || []);
        setRuns(runsRes.data || []);
      } catch (err) {
        console.error('Błąd ładowania danych analitycznych:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  const applyPreset = (preset) => {
    setRangePreset(preset);
    if (preset === 'ALL') {
      setDateFrom('');
      setDateTo('');
      return;
    }
    const now = new Date();
    const toStr = now.toISOString().split('T')[0];
    const fromDate = new Date();
    if (preset === '7D') fromDate.setDate(now.getDate() - 7);
    if (preset === '30D') fromDate.setDate(now.getDate() - 30);
    if (preset === '90D') fromDate.setDate(now.getDate() - 90);
    const fromStr = fromDate.toISOString().split('T')[0];

    setDateFrom(fromStr);
    setDateTo(toStr);
  };

  // Filtrowanie przetargów według wybranych ram czasowych
  const filteredTenders = useMemo(() => {
    return tenders.filter((t) => {
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
  }, [tenders, dateFrom, dateTo]);

  // Filtrowanie historii pobrań według tych samych ram czasowych
  const filteredRuns = useMemo(() => {
    return runs.filter((r) => {
      if (!dateFrom && !dateTo) return true;
      if (!r.createdAt) return false;
      const runTime = new Date(r.createdAt).setHours(0, 0, 0, 0);

      if (dateFrom) {
        const fromTime = new Date(dateFrom).setHours(0, 0, 0, 0);
        if (runTime < fromTime) return false;
      }
      if (dateTo) {
        const toTime = new Date(dateTo).setHours(23, 59, 59, 999);
        if (runTime > toTime) return false;
      }
      return true;
    });
  }, [runs, dateFrom, dateTo]);

  // Statystyki ogólne i podział według statusu (NEW vs INTERESTED)
  const kpi = useMemo(() => {
    const total = filteredTenders.length;
    const interested = filteredTenders.filter((t) => t.status === 'INTERESTED').length;
    const newCount = filteredTenders.filter((t) => t.status === 'NEW').length;

    const scores = filteredTenders.map((t) => Number(t.score) || 0);
    const avgScore = total > 0 ? (scores.reduce((a, b) => a + b, 0) / total).toFixed(1) : '0.0';
    const maxScore = total > 0 ? Math.max(...scores) : 0;

    const excludedTotal = filteredRuns.reduce((acc, r) => acc + (r.excludedCount || 0), 0);
    const zeroSkippedTotal = filteredRuns.reduce((acc, r) => acc + (r.zeroScoreCount || 0), 0);

    return {
      total,
      interested,
      newCount,
      interestedPct: total > 0 ? Math.round((interested / total) * 100) : 0,
      newPct: total > 0 ? Math.round((newCount / total) * 100) : 0,
      avgScore,
      maxScore,
      excludedTotal,
      zeroSkippedTotal,
    };
  }, [filteredTenders, filteredRuns]);

  // Obliczanie powiązań: Kategorie vs Słowa Kluczowe vs Endpointy
  const bindingsData = useMemo(() => {
    if (bindingMode === 'CATEGORIES') {
      const catMap = new Map();
      categories.forEach((c) => {
        catMap.set(c.name, { name: c.name, count: 0, totalScore: 0 });
      });

      filteredTenders.forEach((t) => {
        const text = `${t.title || ''} ${t.description || ''}`.toLowerCase();
        const desc = (t.description || '').toLowerCase();

        categories.forEach((cat) => {
          const positiveWords = (cat.keywords || '')
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
            .filter((part) => !part.toUpperCase().endsWith(':EXCLUDED'))
            .map((part) => part.split(':')[0].trim().toLowerCase())
            .filter(Boolean);

          const explicitlyLogged = desc.includes(`${cat.name.toLowerCase()}:`);
          const wordMatched = positiveWords.some((w) => text.includes(w));

          if (explicitlyLogged || wordMatched) {
            const entry = catMap.get(cat.name);
            if (entry) {
              entry.count += 1;
              entry.totalScore += Number(t.score) || 0;
            }
          }
        });
      });

      return Array.from(catMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
    }

    if (bindingMode === 'KEYWORDS') {
      const kwMap = new Map();

      categories.forEach((cat) => {
        const parts = (cat.keywords || '')
          .split(',')
          .map((w) => w.trim())
          .filter(Boolean);

        parts.forEach((rawPart) => {
          if (rawPart.toUpperCase().endsWith(':EXCLUDED')) return;
          const cleanWord = rawPart.split(':')[0].trim();
          if (!cleanWord) return;

          const key = cleanWord.toLowerCase();
          if (!kwMap.has(key)) {
            kwMap.set(key, {
              name: cleanWord,
              badge: cat.name,
              count: 0,
              totalScore: 0,
            });
          }
        });
      });

      filteredTenders.forEach((t) => {
        const text = `${t.title || ''} ${t.description || ''}`.toLowerCase();
        kwMap.forEach((entry, key) => {
          if (text.includes(key)) {
            entry.count += 1;
            entry.totalScore += Number(t.score) || 0;
          }
        });
      });

      return Array.from(kwMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    }

    // Tryb 'ENDPOINTS'
    const epMap = new Map();
    endpoints.forEach((ep) => {
      epMap.set(ep.name.toLowerCase(), {
        name: ep.name,
        badge: ep.httpMethod || 'API',
        url: (ep.url || '').toLowerCase(),
        count: 0,
        totalScore: 0,
      });
    });

    filteredTenders.forEach((t) => {
      const desc = t.description || '';
      const descLower = desc.toLowerCase();
      let matchedAny = false;

      epMap.forEach((entry, keyName) => {
        const byName = descLower.includes(`źródło: ${keyName}`);
        const byUrl = entry.url && descLower.includes(entry.url);
        if (byName || byUrl) {
          entry.count += 1;
          entry.totalScore += Number(t.score) || 0;
          matchedAny = true;
        }
      });

      // Fallback dla źródeł usuniętych lub o innej nazwie w opisie
      if (!matchedAny) {
        const sourceLine = desc
          .split('\n')
          .find((line) => line.trim().toLowerCase().startsWith('źródło'));
        if (sourceLine) {
          const idx = sourceLine.indexOf(':');
          const extractedName = idx > 0 ? sourceLine.substring(idx + 1).trim() : sourceLine.trim();
          const key = extractedName.toLowerCase();
          if (!epMap.has(key)) {
            epMap.set(key, {
              name: extractedName,
              badge: sourceLine.toLowerCase().includes('soup') || sourceLine.toLowerCase().includes('pandas')
                ? 'SCRAPER'
                : 'API',
              url: '',
              count: 0,
              totalScore: 0,
            });
          }
          const entry = epMap.get(key);
          entry.count += 1;
          entry.totalScore += Number(t.score) || 0;
        }
      }
    });

    return Array.from(epMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filteredTenders, categories, endpoints, bindingMode]);

  // Rozkład punktacji pod wykres kolumnowy 3D
  const scoreBrackets = useMemo(() => {
    const brackets = [
      { label: '1–25 pkt', min: 1, max: 25, count: 0, color: '#60a5fa', side: '#3b82f6', top: '#93c5fd' },
      { label: '26–50 pkt', min: 26, max: 50, count: 0, color: '#3b82f6', side: '#2563eb', top: '#60a5fa' },
      { label: '51–75 pkt', min: 51, max: 75, count: 0, color: '#2563eb', side: '#1d4ed8', top: '#3b82f6' },
      { label: '76+ pkt', min: 76, max: 9999, count: 0, color: '#1d4ed8', side: '#1e40af', top: '#2563eb' },
    ];

    filteredTenders.forEach((t) => {
      const s = Number(t.score) || 0;
      const found = brackets.find((b) => s >= b.min && s <= b.max);
      if (found) found.count += 1;
    });

    return brackets;
  }, [filteredTenders]);

  // Trend czasowy (grupowanie po dniach publikacji)
  const timelineData = useMemo(() => {
    const dayMap = new Map();
    filteredTenders.forEach((t) => {
      if (!t.publicationDate) return;
      const dayKey = new Date(t.publicationDate).toISOString().split('T')[0];
      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, { date: dayKey, total: 0, interested: 0, newCount: 0 });
      }
      const item = dayMap.get(dayKey);
      item.total += 1;
      if (t.status === 'INTERESTED') item.interested += 1;
      else item.newCount += 1;
    });

    return Array.from(dayMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-10);
  }, [filteredTenders]);

  if (loading) {
    return (
      <div className="p-8 bg-white rounded-xl border border-blue-200 font-bold text-black">
        Ładowanie danych analitycznych i generowanie wykresów 3D...
      </div>
    );
  }

  const maxBindingCount = Math.max(1, ...bindingsData.map((b) => b.count));
  const maxBracketCount = Math.max(1, ...scoreBrackets.map((b) => b.count));
  const maxTimelineCount = Math.max(1, ...timelineData.map((d) => d.total));

  // Obliczenia dla Wykresu Kołowego 3D (Donut 3D SVG)
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const interestedStroke = kpi.total > 0 ? (kpi.interested / kpi.total) * circumference : 0;
  const newStroke = kpi.total > 0 ? (kpi.newCount / kpi.total) * circumference : 0;

  return (
    <div className="space-y-6 text-black">
      {/* NAGŁÓWEK + FILTR RAM CZASOWYCH */}
      <div className="bg-white p-5 rounded-xl border-2 border-blue-600 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <BarChart3 size={26} className="text-blue-600" />
            <div>
              <h2 className="text-2xl font-extrabold text-black">
                Panel Analityczny i Statystyki 3D
              </h2>
              <p className="text-xs font-semibold text-black">
                Analiza powiązań kategorii, słów kluczowych, endpointów oraz statusów w wybranym okresie.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: '7D', label: 'Ostatnie 7 dni' },
              { id: '30D', label: 'Ostatnie 30 dni' },
              { id: '90D', label: 'Ostatnie 90 dni' },
              { id: 'ALL', label: 'Wszystkie' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold border-2 transition cursor-pointer ${
                  rangePreset === p.id
                    ? 'bg-blue-600 border-blue-800 text-white'
                    : 'bg-white border-blue-300 hover:bg-blue-50 text-black'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-blue-100 flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-blue-700 py-2">
            <Calendar size={16} />
            Własny zakres dat:
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase mb-1">Data od</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setRangePreset('CUSTOM');
              }}
              className="px-3 py-1.5 border border-blue-300 rounded-lg text-xs font-bold text-black bg-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase mb-1">Data do</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setRangePreset('CUSTOM');
              }}
              className="px-3 py-1.5 border border-blue-300 rounded-lg text-xs font-bold text-black bg-white"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => applyPreset('ALL')}
              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-300 hover:bg-blue-50 rounded-lg text-xs font-bold text-black cursor-pointer"
            >
              <RotateCcw size={13} />
              Wyczyść daty
            </button>
          )}
        </div>
      </div>

      {/* KAFELKI KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border-b-4 border-2 border-blue-600 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase">Przetargi w okresie</span>
            <Layers size={18} className="text-blue-600" />
          </div>
          <div className="text-3xl font-extrabold mt-2">{kpi.total}</div>
          <div className="text-xs font-semibold mt-1">
            z {tenders.length} wszystkich zapisanych w bazie
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border-b-4 border-2 border-green-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase">Zainteresowane (INTERESTED)</span>
            <CheckCircle2 size={18} className="text-green-700" />
          </div>
          <div className="text-3xl font-extrabold mt-2">
            {kpi.interested}{' '}
            <span className="text-base font-bold">({kpi.interestedPct}%)</span>
          </div>
          <div className="text-xs font-semibold mt-1">
            Nowe (NEW): {kpi.newCount} ({kpi.newPct}%)
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border-b-4 border-2 border-blue-500 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase">Średni / Maks. Score</span>
            <Award size={18} className="text-blue-600" />
          </div>
          <div className="text-3xl font-extrabold mt-2">{kpi.avgScore} pkt</div>
          <div className="text-xs font-semibold mt-1">
            Najwyższy wynik w okresie: <span className="font-extrabold">{kpi.maxScore} pkt</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border-b-4 border-2 border-red-600 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase">Odrzucone w pobraniach</span>
            <TrendingUp size={18} className="text-red-600" />
          </div>
          <div className="text-3xl font-extrabold mt-2">
            {kpi.excludedTotal + kpi.zeroSkippedTotal}
          </div>
          <div className="text-xs font-semibold mt-1">
            Wykluczone: {kpi.excludedTotal} | 0 pkt: {kpi.zeroSkippedTotal}
          </div>
        </div>
      </div>

      {/* RZĄD 1: POWIĄZANIA (KATEGORIE <-> SŁOWA KLUCZOWE <-> ENDPOINTY) + WYKRES KOŁOWY 3D */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-blue-200 shadow-xs flex flex-col justify-between space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 pb-4">
            <div>
              <h3 className="text-lg font-extrabold text-black">
                Najczęstsze Powiązania (Wykres 3D)
              </h3>
              <p className="text-xs font-semibold text-black">
                Przełączaj widok pomiędzy kategoriami, słowami kluczowymi oraz źródłowymi endpointami.
              </p>
            </div>

            {/* Potrójny przełącznik: Kategorie | Słowa kluczowe | Endpointy */}
            <div className="inline-flex flex-wrap rounded-xl border-2 border-blue-600 bg-blue-50 p-1 gap-1">
              <button
                type="button"
                onClick={() => setBindingMode('CATEGORIES')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                  bindingMode === 'CATEGORIES'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-black hover:bg-blue-100'
                }`}
              >
                <Layers size={14} />
                Kategorie
              </button>
              <button
                type="button"
                onClick={() => setBindingMode('KEYWORDS')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                  bindingMode === 'KEYWORDS'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-black hover:bg-blue-100'
                }`}
              >
                <KeyRound size={14} />
                Słowa kluczowe
              </button>
              <button
                type="button"
                onClick={() => setBindingMode('ENDPOINTS')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                  bindingMode === 'ENDPOINTS'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-black hover:bg-blue-100'
                }`}
              >
                <Globe size={14} />
                Endpointy
              </button>
            </div>
          </div>

          {bindingsData.length === 0 ? (
            <div className="p-8 text-center text-sm font-semibold">
              Brak danych dla wybranego widoku w tym okresie czasowym.
            </div>
          ) : (
            <div className="space-y-4">
              {bindingsData.map((item, idx) => {
                const widthPct = Math.max(6, Math.round((item.count / maxBindingCount) * 100));
                const avgItemScore =
                  item.count > 0 ? Math.round(item.totalScore / item.count) : 0;

                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="font-extrabold text-black flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-blue-100 border border-blue-400 rounded font-mono">
                          #{idx + 1}
                        </span>
                        <span>{item.name}</span>
                        {item.badge && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 bg-slate-100 border border-blue-300 rounded uppercase">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <div className="font-extrabold text-black">
                        {item.count} {bindingMode === 'ENDPOINTS' ? 'przetargów' : 'powiązań'}{' '}
                        <span className="font-semibold text-[11px]">
                          (śr. {avgItemScore} pkt)
                        </span>
                      </div>
                    </div>

                    {/* Trójwymiarowy słupek izometryczny CSS */}
                    <div className="w-full bg-slate-100 h-7 rounded-lg p-1 border border-blue-100 relative overflow-hidden">
                      <div
                        style={{ width: `${widthPct}%` }}
                        className="h-full relative transition-all duration-500 rounded-r"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 rounded-xs shadow-xs" />
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-300/70" />
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-950/50" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Prawa karta (5 kolumn): Wykres Kołowy 3D według Statusu */}
        <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-blue-200 shadow-xs flex flex-col justify-between">
          <div className="border-b border-blue-100 pb-4">
            <div className="flex items-center gap-2">
              <PieChart size={20} className="text-blue-600" />
              <h3 className="text-lg font-extrabold text-black">
                Rozdział według Statusu (Kołowy 3D)
              </h3>
            </div>
            <p className="text-xs font-semibold text-black mt-0.5">
              Stosunek nowych ogłoszeń (NEW) do oznaczonych jako interesujące (INTERESTED).
            </p>
          </div>

          <div className="my-4 flex flex-col items-center justify-center">
            <div className="relative w-64 h-52 flex items-center justify-center">
              <svg viewBox="0 0 220 190" className="w-full h-full overflow-visible">
                <ellipse cx="110" cy="118" rx="82" ry="52" fill="#cbd5e1" opacity="0.6" />

                {[14, 11, 8, 5, 2].map((offset) => (
                  <g key={offset} transform={`translate(0, ${offset}) scale(1, 0.68)`}>
                    <circle
                      cx="110"
                      cy="110"
                      r={radius}
                      fill="transparent"
                      stroke="#1e3a8a"
                      strokeWidth="28"
                    />
                    {kpi.total > 0 && (
                      <circle
                        cx="110"
                        cy="110"
                        r={radius}
                        fill="transparent"
                        stroke="#14532d"
                        strokeWidth="28"
                        strokeDasharray={`${interestedStroke} ${circumference}`}
                        transform="rotate(-90 110 110)"
                      />
                    )}
                  </g>
                ))}

                <g transform="scale(1, 0.68)">
                  <circle
                    cx="110"
                    cy="110"
                    r={radius}
                    fill="transparent"
                    stroke="#e2e8f0"
                    strokeWidth="28"
                  />
                  {kpi.total > 0 && (
                    <circle
                      cx="110"
                      cy="110"
                      r={radius}
                      fill="transparent"
                      stroke="#2563eb"
                      strokeWidth="28"
                      strokeDasharray={`${newStroke} ${circumference}`}
                      strokeDashoffset={-interestedStroke}
                      transform="rotate(-90 110 110)"
                    />
                  )}
                  {kpi.total > 0 && (
                    <circle
                      cx="110"
                      cy="110"
                      r={radius}
                      fill="transparent"
                      stroke="#4ade80"
                      strokeWidth="28"
                      strokeDasharray={`${interestedStroke} ${circumference}`}
                      transform="rotate(-90 110 110)"
                    />
                  )}
                </g>

                <text
                  x="110"
                  y="72"
                  textAnchor="middle"
                  className="fill-black font-extrabold text-xl"
                >
                  {kpi.total}
                </text>
                <text
                  x="110"
                  y="88"
                  textAnchor="middle"
                  className="fill-black font-bold text-[10px] uppercase"
                >
                  Przetargów
                </text>
              </svg>
            </div>

            <div className="w-full grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-green-100 border-2 border-green-700 flex items-center justify-between">
                <div>
                  <div className="text-xs font-extrabold uppercase">INTERESTED</div>
                  <div className="text-lg font-extrabold">{kpi.interested} szt.</div>
                </div>
                <span className="text-xl font-extrabold">{kpi.interestedPct}%</span>
              </div>

              <div className="p-3 rounded-xl bg-blue-100 border-2 border-blue-600 flex items-center justify-between">
                <div>
                  <div className="text-xs font-extrabold uppercase">NEW</div>
                  <div className="text-lg font-extrabold">{kpi.newCount} szt.</div>
                </div>
                <span className="text-xl font-extrabold">{kpi.newPct}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RZĄD 2: IZOMETRYCZNY DIAGRAM KOLUMNOWY 3D (ROZKŁAD PUNKTACJI) + TREND CZASOWY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white p-6 rounded-xl border border-blue-200 shadow-xs space-y-4">
          <div className="border-b border-blue-100 pb-3">
            <h3 className="text-lg font-extrabold text-black">
              Rozkład Punktacji Przetargów (Kolumny 3D)
            </h3>
            <p className="text-xs font-semibold text-black">
              Liczba przetargów w poszczególnych przedziałach wag punktowych (Score).
            </p>
          </div>

          <div className="w-full flex justify-center pt-2">
            <svg viewBox="0 0 420 230" className="w-full max-w-md h-56 overflow-visible">
              {[40, 85, 130, 175].map((y, i) => (
                <line
                  key={i}
                  x1="35"
                  y1={y}
                  x2="395"
                  y2={y}
                  stroke="#dbeafe"
                  strokeDasharray="4 4"
                  strokeWidth="1.5"
                />
              ))}

              <polygon
                points="30,185 45,172 405,172 390,185"
                fill="#eff6ff"
                stroke="#93c5fd"
                strokeWidth="1.5"
              />

              {scoreBrackets.map((b, i) => {
                const maxBarH = 125;
                const barH = Math.max(8, Math.round((b.count / maxBracketCount) * maxBarH));
                const x = 60 + i * 88;
                const yBottom = 180;
                const yTop = yBottom - barH;
                const w = 42;
                const dx = 12;
                const dy = -10;

                return (
                  <g key={b.label}>
                    <rect
                      x={x}
                      y={yTop}
                      width={w}
                      height={barH}
                      fill={b.color}
                      stroke="#1e3a8a"
                      strokeWidth="1"
                    />
                    <polygon
                      points={`${x},${yTop} ${x + dx},${yTop + dy} ${x + w + dx},${yTop + dy} ${x + w},${yTop}`}
                      fill={b.top}
                      stroke="#1e3a8a"
                      strokeWidth="1"
                    />
                    <polygon
                      points={`${x + w},${yTop} ${x + w + dx},${yTop + dy} ${x + w + dx},${yBottom + dy} ${x + w},${yBottom}`}
                      fill={b.side}
                      stroke="#1e3a8a"
                      strokeWidth="1"
                    />
                    <text
                      x={x + w / 2 + 5}
                      y={yTop + dy - 6}
                      textAnchor="middle"
                      className="fill-black font-extrabold text-xs"
                    >
                      {b.count}
                    </text>
                    <text
                      x={x + w / 2}
                      y={204}
                      textAnchor="middle"
                      className="fill-black font-bold text-[11px]"
                    >
                      {b.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white p-6 rounded-xl border border-blue-200 shadow-xs space-y-4">
          <div className="border-b border-blue-100 pb-3">
            <h3 className="text-lg font-extrabold text-black">
              Dynamika Ogłoszeń w Czasie (NEW vs INTERESTED)
            </h3>
            <p className="text-xs font-semibold text-black">
              Rozkład dzienny przetargów w wybranym oknie czasowym (ostatnie 10 aktywnych dni).
            </p>
          </div>

          {timelineData.length === 0 ? (
            <div className="p-8 text-center text-sm font-semibold">
              Brak danych czasowych w wybranym zakresie dat.
            </div>
          ) : (
            <div className="h-56 flex items-end justify-between gap-2 pt-6 px-2 border-b-2 border-blue-200">
              {timelineData.map((day) => {
                const totalH = Math.max(12, Math.round((day.total / maxTimelineCount) * 150));
                const intH =
                  day.total > 0 ? Math.round((day.interested / day.total) * totalH) : 0;
                const newH = totalH - intH;

                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center justify-end gap-1.5"
                  >
                    <span className="text-[11px] font-extrabold text-black">{day.total}</span>
                    <div
                      style={{ height: `${totalH}px` }}
                      className="w-full max-w-[38px] rounded-t-lg overflow-hidden border border-blue-800 flex flex-col shadow-xs"
                      title={`${day.date} — Łącznie: ${day.total} (INTERESTED: ${day.interested}, NEW: ${day.newCount})`}
                    >
                      {newH > 0 && (
                        <div
                          style={{ height: `${newH}px` }}
                          className="w-full bg-blue-600"
                        />
                      )}
                      {intH > 0 && (
                        <div
                          style={{ height: `${intH}px` }}
                          className="w-full bg-green-400 border-t border-green-800"
                        />
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-black pb-2">
                      {day.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}