import { StickyNote, X, Save } from 'lucide-react';

export default function EndpointNoteModal({
  noteModal,
  savingNote,
  onChangeText,
  onSave,
  onClose,
}) {
  if (!noteModal) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl border-2 border-blue-600 max-w-2xl w-full p-6 shadow-xl space-y-4 text-black"
      >
        <div className="flex items-start justify-between gap-4 border-b border-blue-100 pb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <StickyNote size={18} className="text-blue-600 shrink-0" />
              <span className="text-xs font-extrabold uppercase tracking-wide text-blue-700">
                Notatka obsługi źródła
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-extrabold bg-blue-100 border border-blue-400">
                {noteModal.endpoint.httpMethod}
              </span>
            </div>
            <h3 className="text-lg font-extrabold text-black truncate mt-1">
              {noteModal.endpoint.name}
            </h3>
            <div className="text-xs font-mono text-slate-600 truncate">
              {noteModal.endpoint.url}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-blue-300 hover:bg-blue-50 cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-extrabold uppercase text-black">
            Instrukcja / uwagi dotyczące konfiguracji tego endpointu
          </label>
          <textarea
            rows={8}
            autoFocus
            value={noteModal.text}
            onChange={(e) => onChangeText(e.target.value)}
            placeholder="Zapisz np. wymagane parametry w URL, format dat, strukturę JSON dla POST, działające selektory CSS, limity zapytań..."
            className="w-full p-3.5 border-2 border-blue-300 focus:border-blue-600 focus:outline-none rounded-xl bg-slate-50 text-black text-sm leading-relaxed"
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-blue-100">
          <button
            type="button"
            onClick={() => onChangeText('')}
            disabled={!noteModal.text}
            className="px-3.5 py-2 bg-white border border-red-300 hover:bg-red-50 disabled:opacity-40 text-black font-bold rounded-xl text-xs cursor-pointer"
          >
            Wyczyść notatkę
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-blue-300 hover:bg-blue-50 text-black font-bold rounded-xl text-xs cursor-pointer"
            >
              Anuluj
            </button>
            <button
              type="button"
              disabled={savingNote}
              onClick={onSave}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs cursor-pointer"
            >
              <Save size={14} />
              {savingNote ? 'Zapisywanie...' : 'Zapisz notatkę'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
