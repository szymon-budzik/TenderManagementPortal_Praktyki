import { Award, CheckCircle2, Layers, TrendingUp } from 'lucide-react';

export default function AnalyticsKpiGrid({ kpi, totalTendersInDb }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white p-5 rounded-xl border-b-4 border-2 border-blue-600 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold uppercase">Przetargi w okresie</span>
          <Layers size={18} className="text-blue-600" />
        </div>
        <div className="text-3xl font-extrabold mt-2">{kpi.total}</div>
        <div className="text-xs font-semibold mt-1">
          z {totalTendersInDb} wszystkich zapisanych w bazie
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
  );
}
