import { Check, Trash2, X } from 'lucide-react';
import { hasWildcardSuffix } from './keywordUtils';

export default function KeywordConfigPanel({
  selectedKeyword,
  onWordChange,
  onScoreChange,
  onToggleWildcard,
  onToggleExcluded,
  onSave,
  onDelete,
  onClose,
}) {
  if (!selectedKeyword) return null;

  const selectedCanBeWildcard = hasWildcardSuffix(selectedKeyword.word);
  const selectedIsExcludedWildcard = Boolean(
    selectedKeyword.isExcluded && selectedKeyword.isWildcard && selectedCanBeWildcard
  );

  return (
    <div className="bg-white p-6 rounded-xl border-2 border-blue-600 shadow-md space-y-4">
      <div className="flex items-center justify-between border-b border-blue-100 pb-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div>
            <span className="text-xs font-extrabold uppercase text-blue-700">
              Kategoria: {selectedKeyword.catName}
            </span>
            <h3 className="text-lg font-extrabold text-black">
              Konfiguracja słowa kluczowego:{' '}
              <span className="underline">{selectedKeyword.word}</span>
            </h3>
          </div>

          <span
            className={`px-3 py-1 rounded-lg text-xs font-extrabold border-2 ${
              selectedIsExcludedWildcard
                ? 'bg-rose-900 border-rose-950 text-white'
                : selectedKeyword.isExcluded
                ? 'bg-red-400 border-red-800 text-black'
                : selectedKeyword.isWildcard && selectedCanBeWildcard
                ? 'bg-purple-300 border-purple-800 text-black'
                : 'bg-white border-blue-400 text-black'
            }`}
          >
            {selectedIsExcludedWildcard
              ? `${selectedKeyword.word.trim()} (WYKLUCZ*)`
              : selectedKeyword.isExcluded
              ? `${selectedKeyword.word.trim()} (WYKLUCZ)`
              : `${selectedKeyword.word.trim()}: ${selectedKeyword.score}`}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg border border-blue-300 hover:bg-blue-50 cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start bg-slate-50 p-4 rounded-xl border border-blue-200">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-extrabold uppercase mb-1 text-black">
              Treść słowa kluczowego
            </label>
            <input
              type="text"
              value={selectedKeyword.word}
              onChange={(e) => onWordChange(e.target.value)}
              placeholder="np. dostaw*"
              className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-black font-mono text-sm font-bold"
            />
            <p className="text-[11px] font-semibold text-slate-600 mt-1">
              Usunięcie gwiazdki <span className="font-mono font-bold">*</span> z końca automatycznie wyłącza tryb Wildcard.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                className={`text-xs font-extrabold uppercase ${
                  selectedKeyword.isExcluded ? 'text-gray-400' : 'text-black'
                }`}
              >
                Waga słowa kluczowego (1–100 pkt)
              </label>
              <span
                className={`px-3 py-1 rounded-lg text-sm font-extrabold border ${
                  selectedIsExcludedWildcard
                    ? 'bg-rose-900 border-rose-950 text-white'
                    : selectedKeyword.isExcluded
                    ? 'bg-red-400 border-red-800 text-black'
                    : selectedKeyword.isWildcard && selectedCanBeWildcard
                    ? 'bg-purple-600 border-purple-900 text-white'
                    : 'bg-blue-600 border-blue-800 text-white'
                }`}
              >
                {selectedIsExcludedWildcard
                  ? 'WYKLUCZ*'
                  : selectedKeyword.isExcluded
                  ? 'WYKLUCZ'
                  : `${selectedKeyword.score} pkt`}
              </span>
            </div>

            <input
              type="range"
              min="1"
              max="100"
              disabled={selectedKeyword.isExcluded}
              value={selectedKeyword.score}
              onChange={(e) => onScoreChange(Number(e.target.value))}
              className={`w-full h-2.5 rounded-lg appearance-none ${
                selectedKeyword.isExcluded
                  ? 'bg-gray-300 accent-gray-400 opacity-45 cursor-not-allowed'
                  : selectedKeyword.isWildcard
                  ? 'bg-purple-200 accent-purple-600 cursor-pointer'
                  : 'bg-blue-200 accent-blue-600 cursor-pointer'
              }`}
            />
            <div
              className={`flex justify-between text-xs font-bold ${
                selectedKeyword.isExcluded ? 'text-gray-400' : 'text-black'
              }`}
            >
              <span>1 pkt</span>
              <span>50 pkt</span>
              <span>100 pkt</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3">
          <label
            className={`flex items-start gap-2.5 p-3 rounded-xl border-2 select-none transition ${
              selectedCanBeWildcard
                ? 'bg-purple-50 border-purple-500 cursor-pointer'
                : 'bg-slate-100 border-slate-300 opacity-60 cursor-not-allowed'
            }`}
          >
            <input
              type="checkbox"
              disabled={!selectedCanBeWildcard}
              checked={selectedKeyword.isWildcard && selectedCanBeWildcard}
              onChange={(e) => onToggleWildcard(e.target.checked)}
              className={`w-5 h-5 mt-0.5 accent-purple-700 shrink-0 ${
                selectedCanBeWildcard ? 'cursor-pointer' : 'cursor-not-allowed'
              }`}
            />
            <div>
              <div className="font-extrabold text-sm text-black">
                Odmiana końcówek (Wildcard *)
              </div>
              <div className="text-xs font-medium text-black/80 mt-0.5">
                {selectedCanBeWildcard ? (
                  <>
                    Dopasowuje dowolne końcówki rdzenia{' '}
                    <span className="font-mono font-bold">{selectedKeyword.word.trim()}</span>.
                    W połączeniu z wykluczeniem odrzuca wszystkie odmiany (kolor bordowy,{' '}
                    <span className="font-bold">WYKLUCZ*</span>).
                  </>
                ) : (
                  <>
                    Dostępne tylko dla słów kończących się na{' '}
                    <span className="font-mono font-bold">*</span> (dopisz{' '}
                    <span className="font-mono font-bold">*</span> na końcu treści słowa, np.{' '}
                    <span className="font-mono font-bold">dostaw*</span>).
                  </>
                )}
              </div>
            </div>
          </label>

          <label
            className={`flex items-start gap-2.5 p-3 rounded-xl border-2 cursor-pointer select-none transition ${
              selectedIsExcludedWildcard
                ? 'bg-rose-50 border-rose-900'
                : 'bg-white border-red-300'
            }`}
          >
            <input
              type="checkbox"
              checked={selectedKeyword.isExcluded}
              onChange={(e) => onToggleExcluded(e.target.checked)}
              className={`w-5 h-5 mt-0.5 cursor-pointer shrink-0 ${
                selectedIsExcludedWildcard ? 'accent-rose-900' : 'accent-red-600'
              }`}
            />
            <div>
              <div className="font-extrabold text-sm text-black">
                {selectedIsExcludedWildcard
                  ? 'Wyklucz wszystkie odmiany (WYKLUCZ*)'
                  : 'Wyklucz to słowo'}
              </div>
              <div className="text-xs font-medium text-black/80 mt-0.5">
                {selectedIsExcludedWildcard
                  ? 'Kolor bordowy — odrzuca cały przetarg zawierający słowo z dowolną końcówką.'
                  : 'Oznacza słowo na czerwono i odrzuca cały przetarg zawierający to słowo.'}
              </div>
            </div>
          </label>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1 px-3.5 py-2 bg-white border border-red-400 hover:bg-red-50 text-black font-bold rounded-lg text-xs cursor-pointer"
            >
              <Trash2 size={14} /> Usuń słowo
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 bg-white border border-blue-300 hover:bg-blue-50 text-black font-bold rounded-lg text-xs cursor-pointer"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={onSave}
              className="flex items-center gap-1 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-lg text-xs cursor-pointer"
            >
              <Check size={15} /> Zapisz słowo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
