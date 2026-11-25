import { FileSpreadsheet, X } from 'lucide-react';

export default function ObservedReportBar({
  selectedTenderCount,
  selectedUpdateCount,
  reportName,
  onReportNameChange,
  creatingReport,
  reportFeedback,
  onDismissFeedback,
  onSelectLatestPerGroup,
  onSelectAllVisible,
  onClearSelection,
  onCreateReport,
}) {
  const totalSelectedCount = selectedTenderCount + selectedUpdateCount;

  return (
    <div className="bg-blue-50/80 p-4 rounded-xl border-2 border-blue-600 shadow-xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={20} className="text-blue-700 shrink-0" />
          <div className="text-xs">
            <span className="font-extrabold text-sm text-black">
              Tworzenie raportu z wybranych ({totalSelectedCount})
            </span>
            <span className="ml-2 font-semibold text-slate-700">
              Oryginały: {selectedTenderCount} • Aktualizacje: {selectedUpdateCount}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSelectLatestPerGroup}
            className="px-2.5 py-1.5 bg-white border border-blue-400 hover:bg-blue-100 rounded-lg text-xs font-bold cursor-pointer"
          >
            Zaznacz najnowsze z grup
          </button>
          <button
            type="button"
            onClick={onSelectAllVisible}
            className="px-2.5 py-1.5 bg-white border border-blue-400 hover:bg-blue-100 rounded-lg text-xs font-bold cursor-pointer"
          >
            Zaznacz wszystkie
          </button>
          <button
            type="button"
            disabled={totalSelectedCount === 0}
            onClick={onClearSelection}
            className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 rounded-lg text-xs font-bold cursor-pointer"
          >
            Odznacz
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={reportName}
          onChange={(e) => onReportNameChange(e.target.value)}
          placeholder="Opcjonalna nazwa raportu (np. Pilne oferty — listopad)"
          className="flex-1 min-w-[240px] px-3.5 py-2 bg-white border border-blue-400 rounded-lg text-xs font-semibold text-black"
        />
        <button
          type="button"
          disabled={creatingReport || totalSelectedCount === 0}
          onClick={onCreateReport}
          className="inline-flex items-center gap-2 px-5 py-2 bg-green-400 hover:bg-green-500 disabled:opacity-40 border-2 border-green-800 text-black font-extrabold rounded-lg text-xs cursor-pointer transition"
        >
          <FileSpreadsheet size={15} />
          {creatingReport
            ? 'Tworzenie raportu...'
            : `Utwórz raport w zakładce Raporty (${totalSelectedCount})`}
        </button>
      </div>

      {reportFeedback && (
        <div
          className={`px-3.5 py-2 rounded-lg border text-xs font-extrabold flex items-center justify-between gap-2 ${
            reportFeedback.success
              ? 'bg-green-100 border-green-700 text-green-950'
              : 'bg-red-100 border-red-700 text-red-950'
          }`}
        >
          <span>{reportFeedback.text}</span>
          <button
            type="button"
            onClick={onDismissFeedback}
            className="p-0.5 rounded hover:bg-black/10 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
