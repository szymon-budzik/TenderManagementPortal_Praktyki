import { X } from 'lucide-react';

export default function ObservedCheckResultBanner({ checkResult, onClose }) {
  if (!checkResult) return null;

  return (
    <div
      className={`p-4 rounded-xl border-2 space-y-2 ${
        checkResult.error
          ? 'bg-red-50 border-red-600'
          : checkResult.updatesFound > 0
          ? 'bg-amber-50 border-amber-600'
          : 'bg-green-50 border-green-700'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-extrabold text-sm">
          {checkResult.error
            ? `Błąd sprawdzania: ${checkResult.error}`
            : checkResult.updatesFound > 0
            ? `Wykryto ${checkResult.updatesFound} nowych aktualizacji (sprawdzono ${checkResult.checkedEndpoints} aktywnych źródeł dla ${checkResult.observedTendersCount} obserwowanych).`
            : `Brak nowych aktualizacji (sprawdzono ${checkResult.checkedEndpoints} aktywnych źródeł dla ${checkResult.observedTendersCount} obserwowanych).`}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-black/10 cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>
      {checkResult.logs && checkResult.logs.length > 0 && (
        <div className="text-xs font-mono space-y-0.5 pt-1 border-t border-black/10">
          {checkResult.logs.map((l, idx) => (
            <div key={idx} className={l.success ? 'text-black' : 'text-red-800 font-bold'}>
              [{l.success ? 'OK' : 'BŁĄD'}] {l.sourceName}: {l.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
