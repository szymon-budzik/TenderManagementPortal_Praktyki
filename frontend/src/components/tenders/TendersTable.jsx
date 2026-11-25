import { ArrowUpDown, Clock, Eye, Trash2 } from 'lucide-react';
import {
  formatDateTimePl,
  getShortHoursBadge,
  getTenderDeadlineIso,
  getTenderScoreEntries,
  getTenderSource,
} from './tenderUtils';

export default function TendersTable({
  tenders,
  nowMs,
  currentPage,
  totalPages,
  onPageChange,
  onToggleSort,
  onSelectTender,
  onToggleStatus,
  onConfirmDelete,
}) {
  return (
    <>
      <div className="bg-white rounded-xl border border-blue-200 overflow-x-auto shadow-xs">
        <table className="w-full text-left border-collapse table-fixed min-w-[1120px]">
          <thead>
            <tr className="bg-blue-600 text-white text-xs uppercase tracking-wide select-none">
              <th
                onClick={() => onToggleSort('externalId')}
                className="px-3.5 py-4 font-bold w-24 cursor-pointer hover:bg-blue-700 whitespace-nowrap"
              >
                <div className="inline-flex items-center gap-1">
                  ID Zewn. <ArrowUpDown size={13} />
                </div>
              </th>
              <th
                onClick={() => onToggleSort('source')}
                className="px-3.5 py-4 font-bold w-40 cursor-pointer hover:bg-blue-700 whitespace-nowrap"
              >
                <div className="inline-flex items-center gap-1">
                  Źródło <ArrowUpDown size={13} />
                </div>
              </th>
              <th
                onClick={() => onToggleSort('title')}
                className="px-3.5 py-4 font-bold cursor-pointer hover:bg-blue-700 whitespace-nowrap"
              >
                <div className="inline-flex items-center gap-1">
                  Tytuł i skrót informacji <ArrowUpDown size={13} />
                </div>
              </th>
              <th
                onClick={() => onToggleSort('score')}
                className="px-3.5 py-4 font-bold w-56 text-center cursor-pointer hover:bg-blue-700 whitespace-nowrap"
              >
                <div className="inline-flex items-center gap-1">
                  Score (Kategorie / Suma) <ArrowUpDown size={13} />
                </div>
              </th>
              <th
                onClick={() => onToggleSort('publicationDate')}
                className="px-3.5 py-4 font-bold w-44 cursor-pointer hover:bg-blue-700 whitespace-nowrap"
              >
                <div className="inline-flex items-center gap-1">
                  Data / Termin <ArrowUpDown size={13} />
                </div>
              </th>
              <th
                onClick={() => onToggleSort('status')}
                className="px-3.5 py-4 font-bold w-36 text-center cursor-pointer hover:bg-blue-700 whitespace-nowrap"
              >
                <div className="inline-flex items-center gap-1">
                  Status <ArrowUpDown size={13} />
                </div>
              </th>
              <th className="px-3.5 py-4 font-bold w-28 text-center whitespace-nowrap">Akcje</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-blue-100 text-sm text-black">
            {tenders.length === 0 ? (
              <tr>
                <td colSpan="7" className="p-6 text-center font-medium text-black">
                  Brak przetargów spełniających wybrane kryteria.
                </td>
              </tr>
            ) : (
              tenders.map((t) => {
                const scoreEntries = getTenderScoreEntries(t);
                const sourceName = getTenderSource(t);
                const deadlineIso = getTenderDeadlineIso(t);
                const hoursBadge = getShortHoursBadge(deadlineIso, nowMs);

                return (
                  <tr
                    key={t.id}
                    onClick={() => onSelectTender(t)}
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
                        onClick={(e) => onToggleStatus(e, t)}
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
                            onSelectTender(t);
                          }}
                          className="inline-flex items-center justify-center gap-1 px-2.5 py-1 bg-white border border-blue-400 hover:bg-blue-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                        >
                          <Eye size={13} /> Szczegóły
                        </button>
                        <button
                          type="button"
                          onClick={(e) => onConfirmDelete(e, t)}
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

      <div className="flex items-center justify-between">
        <button
          disabled={currentPage === 0}
          onClick={() => onPageChange(Math.max(0, currentPage - 1))}
          className="px-4 py-2 bg-white border border-blue-400 rounded-lg font-bold text-black disabled:opacity-40 hover:bg-blue-50 cursor-pointer"
        >
          Poprzednia
        </button>
        <span className="font-bold text-sm text-black">
          Strona {currentPage + 1} z {totalPages}
        </span>
        <button
          disabled={currentPage + 1 >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="px-4 py-2 bg-white border border-blue-400 rounded-lg font-bold text-black disabled:opacity-40 hover:bg-blue-50 cursor-pointer"
        >
          Następna
        </button>
      </div>
    </>
  );
}
