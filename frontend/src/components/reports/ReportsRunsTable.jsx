import { ArrowUpDown, Trash2 } from 'lucide-react';

export default function ReportsRunsTable({
  runs,
  selectedRunIds,
  onToggleSelectRun,
  onToggleSort,
  onConfirmDeleteRun,
}) {
  return (
    <div className="rounded-xl border border-blue-200 overflow-hidden">
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="bg-blue-600 text-white select-none">
            <th className="p-3.5 font-bold w-12 text-center">Wybór</th>
            <th
              onClick={() => onToggleSort('id')}
              className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
            >
              <div className="inline-flex items-center gap-1">
                ID Pob. <ArrowUpDown size={14} />
              </div>
            </th>
            <th
              onClick={() => onToggleSort('createdAt')}
              className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
            >
              <div className="inline-flex items-center gap-1">
                Data i godzina <ArrowUpDown size={14} />
              </div>
            </th>
            <th
              onClick={() => onToggleSort('sourceType')}
              className="p-3.5 font-bold cursor-pointer hover:bg-blue-700 whitespace-nowrap"
            >
              <div className="inline-flex items-center gap-1">
                Tryb <ArrowUpDown size={14} />
              </div>
            </th>
            <th
              onClick={() => onToggleSort('sourcesSummary')}
              className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
            >
              <div className="inline-flex items-center gap-1">
                Źródła danych <ArrowUpDown size={14} />
              </div>
            </th>
            <th
              onClick={() => onToggleSort('totalFetched')}
              className="p-3.5 font-bold text-center cursor-pointer hover:bg-blue-700"
            >
              <div className="inline-flex items-center gap-1">
                Pobrano <ArrowUpDown size={14} />
              </div>
            </th>
            <th
              onClick={() => onToggleSort('savedCount')}
              className="p-3.5 font-bold text-center cursor-pointer hover:bg-blue-700"
            >
              <div className="inline-flex items-center gap-1">
                Zapisano (&gt;0 pkt) <ArrowUpDown size={14} />
              </div>
            </th>
            <th
              onClick={() => onToggleSort('excludedCount')}
              className="p-3.5 font-bold text-center cursor-pointer hover:bg-blue-700"
            >
              <div className="inline-flex items-center gap-1">
                Wykluczono <ArrowUpDown size={14} />
              </div>
            </th>
            <th className="p-3.5 font-bold text-right">Akcje</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-blue-100">
          {runs.length === 0 ? (
            <tr>
              <td colSpan="9" className="p-6 text-center font-medium text-black">
                Brak zarejestrowanych pobrań.
              </td>
            </tr>
          ) : (
            runs.map((r) => {
              const checked = selectedRunIds.includes(r.id);
              const upperType = (r.sourceType || '').toUpperCase();
              const isCron = upperType.startsWith('CRON');
              const isObserved = upperType.startsWith('OBSERWOWANE');
              const isShared = upperType.startsWith('PRZESŁANE') || Boolean(r.sharedByUsername);
              const bracketMatch = r.sourceType?.match(/\[(.+)\]$/);
              const subLabel = bracketMatch ? bracketMatch[1].trim() : null;

              return (
                <tr
                  key={r.id}
                  onClick={() => onToggleSelectRun(r.id)}
                  className={`transition cursor-pointer ${
                    checked ? 'bg-blue-100/70 font-semibold' : 'hover:bg-blue-50/50'
                  }`}
                >
                  <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleSelectRun(r.id)}
                      className="w-5 h-5 accent-blue-600 cursor-pointer"
                    />
                  </td>
                  <td className="p-3.5 font-mono font-bold">#{r.id}</td>
                  <td className="p-3.5 whitespace-nowrap">
                    {r.createdAt ? new Date(r.createdAt).toLocaleString('pl-PL') : '—'}
                  </td>
                  <td className="p-3.5 align-middle">
                    {isCron ? (
                      <div className="inline-flex flex-col items-start gap-1">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-extrabold border-2 bg-amber-200 border-amber-700 text-black whitespace-nowrap">
                          CRON
                        </span>
                        {subLabel && (
                          <span
                            title={subLabel}
                            className="text-xs font-bold text-slate-700 leading-tight max-w-[160px] truncate"
                          >
                            {subLabel}
                          </span>
                        )}
                      </div>
                    ) : isObserved ? (
                      <div className="inline-flex flex-col items-start gap-1">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-extrabold border-2 bg-green-200 border-green-800 text-black whitespace-nowrap">
                          OBSERWOWANE
                        </span>
                        {subLabel && (
                          <span
                            title={subLabel}
                            className="text-xs font-bold text-slate-700 leading-tight max-w-[160px] truncate"
                          >
                            {subLabel}
                          </span>
                        )}
                      </div>
                    ) : isShared ? (
                      <div className="inline-flex flex-col items-start gap-1">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-extrabold border-2 bg-purple-200 border-purple-800 text-black whitespace-nowrap">
                          PRZESŁANE
                        </span>
                        {(r.sharedByUsername || subLabel) && (
                          <span
                            title={r.sharedNote ? `Notatka: ${r.sharedNote}` : (subLabel || `od: ${r.sharedByUsername}`)}
                            className="text-xs font-bold text-slate-700 leading-tight max-w-[180px] truncate"
                          >
                            {subLabel || `od: ${r.sharedByUsername}`}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-extrabold border-2 bg-blue-100 border-blue-600 text-black whitespace-nowrap">
                        RĘCZNE
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 text-xs">{r.sourcesSummary || '—'}</td>
                  <td className="p-3.5 text-center font-bold">{r.totalFetched}</td>
                  <td className="p-3.5 text-center">
                    <span className="px-2.5 py-0.5 rounded bg-green-300 border border-green-800 font-extrabold text-xs">
                      {r.savedCount}
                    </span>
                  </td>
                  <td className="p-3.5 text-center font-bold">{r.excludedCount}</td>
                  <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onConfirmDeleteRun(r)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-red-400 hover:bg-red-100 text-black rounded-lg font-bold text-xs cursor-pointer"
                    >
                      <Trash2 size={14} /> Usuń
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
