import { Globe, KeyRound, Layers } from 'lucide-react';

export default function BindingsBarChart({ bindingsData, bindingMode, onBindingModeChange }) {
  const maxBindingCount = Math.max(1, ...bindingsData.map((b) => b.count));

  return (
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

        <div className="inline-flex flex-wrap rounded-xl border-2 border-blue-600 bg-blue-50 p-1 gap-1">
          <button
            type="button"
            onClick={() => onBindingModeChange('CATEGORIES')}
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
            onClick={() => onBindingModeChange('KEYWORDS')}
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
            onClick={() => onBindingModeChange('ENDPOINTS')}
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
            const avgItemScore = item.count > 0 ? Math.round(item.totalScore / item.count) : 0;

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
                    <span className="font-semibold text-[11px]">(śr. {avgItemScore} pkt)</span>
                  </div>
                </div>

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
  );
}
