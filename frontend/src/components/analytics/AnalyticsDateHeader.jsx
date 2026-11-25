import { BarChart3, Calendar, RotateCcw } from 'lucide-react';

const RANGE_PRESETS = [
  { id: '7D', label: 'Ostatnie 7 dni' },
  { id: '30D', label: 'Ostatnie 30 dni' },
  { id: '90D', label: 'Ostatnie 90 dni' },
  { id: 'ALL', label: 'Wszystkie' },
];

export default function AnalyticsDateHeader({
  rangePreset,
  dateFrom,
  dateTo,
  onApplyPreset,
  onDateFromChange,
  onDateToChange,
}) {
  return (
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
          {RANGE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onApplyPreset(p.id)}
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
            onChange={(e) => onDateFromChange(e.target.value)}
            className="px-3 py-1.5 border border-blue-300 rounded-lg text-xs font-bold text-black bg-white"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase mb-1">Data do</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="px-3 py-1.5 border border-blue-300 rounded-lg text-xs font-bold text-black bg-white"
          />
        </div>
        {(dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => onApplyPreset('ALL')}
            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-300 hover:bg-blue-50 rounded-lg text-xs font-bold text-black cursor-pointer"
          >
            <RotateCcw size={13} />
            Wyczyść daty
          </button>
        )}
      </div>
    </div>
  );
}
