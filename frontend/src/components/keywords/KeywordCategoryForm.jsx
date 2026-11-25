import { Plus } from 'lucide-react';

export default function KeywordCategoryForm({
  name,
  onNameChange,
  keywordsInput,
  onKeywordsInputChange,
  onSubmit,
}) {
  const previewWords = keywordsInput
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean);

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white p-6 rounded-xl border border-blue-200 space-y-4 shadow-xs"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
        <div className="md:col-span-4">
          <label className="block text-xs font-bold uppercase mb-1">Nazwa kategorii</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="np. IT, Frontend, Logistyka"
            className="w-full px-3.5 py-2.5 border border-blue-300 rounded-lg text-black font-semibold focus:outline-none focus:border-blue-600"
          />
        </div>

        <div className="md:col-span-6">
          <label className="block text-xs font-bold uppercase mb-1">
            Słowa kluczowe (rozdzielone przecinkami)
          </label>
          <input
            type="text"
            required
            value={keywordsInput}
            onChange={(e) => onKeywordsInputChange(e.target.value)}
            placeholder="np. oprogramowanie, dostaw*, python"
            className="w-full px-3.5 py-2.5 border border-blue-300 rounded-lg text-black font-mono text-sm focus:outline-none focus:border-blue-600"
          />
          {previewWords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {previewWords.map((w, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-0.5 bg-slate-200 border border-slate-400 rounded text-xs font-bold text-black"
                >
                  {w}: 50
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="md:col-span-2 md:pt-5">
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer"
          >
            <Plus size={16} /> Dodaj Kategorię
          </button>
        </div>
      </div>
    </form>
  );
}
