import { Plus } from 'lucide-react';
import {
  CATEGORY_COLOR_PRESETS,
  DEFAULT_CATEGORY_COLOR,
  getCategoryHighlightStyle,
} from './categoryColorPresets';

export default function KeywordCategoryForm({
  name,
  onNameChange,
  keywordsInput,
  onKeywordsInputChange,
  color = DEFAULT_CATEGORY_COLOR,
  onColorChange,
  lightText = false,
  onLightTextChange,
  onSubmit,
}) {
  const previewWords = keywordsInput
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean);

  const badgeStyle = getCategoryHighlightStyle(color, lightText);

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

      {/* Wybór koloru podświetlenia kategorii + opcja białego tekstu */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-blue-100">
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="inline-flex items-center gap-2 text-xs font-extrabold uppercase cursor-pointer">
            <span>Kolor kategorii:</span>
            <input
              type="color"
              value={color}
              onChange={(e) => onColorChange && onColorChange(e.target.value)}
              className="w-8 h-7 rounded cursor-pointer border border-blue-300 bg-transparent p-0.5"
            />
          </label>

          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORY_COLOR_PRESETS.map((preset) => {
              const selected = color.toLowerCase() === preset.hex.toLowerCase();
              return (
                <button
                  key={preset.hex}
                  type="button"
                  title={preset.label}
                  onClick={() => {
                    if (onColorChange) onColorChange(preset.hex);
                    if (onLightTextChange) onLightTextChange(preset.dark);
                  }}
                  style={{ backgroundColor: preset.hex }}
                  className={`w-6 h-6 rounded-md border-2 cursor-pointer transition transform hover:scale-110 ${
                    selected
                      ? 'border-blue-600 ring-2 ring-blue-500 ring-offset-1'
                      : 'border-slate-400'
                  }`}
                />
              );
            })}
          </div>

          <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-300 text-xs font-extrabold cursor-pointer select-none">
            <input
              type="checkbox"
              checked={lightText}
              onChange={(e) => onLightTextChange && onLightTextChange(e.target.checked)}
              className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
            />
            Biały tekst (dla ciemnych kolorów)
          </label>
        </div>

        <div className="inline-flex items-center gap-2 text-xs font-bold">
          <span className="opacity-75">Podgląd:</span>
          <span
            style={badgeStyle}
            className="px-2.5 py-0.5 rounded-md border font-extrabold text-xs"
          >
            {name.trim() || 'Przykładowe słowo'}
          </span>
        </div>
      </div>
    </form>
  );
}
