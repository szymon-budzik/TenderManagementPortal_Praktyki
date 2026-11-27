import { useState } from 'react';
import { Palette, Check, X } from 'lucide-react';
import {
  CATEGORY_COLOR_PRESETS,
  DEFAULT_CATEGORY_COLOR,
  getCategoryHighlightStyle,
} from './categoryColorPresets';

export default function KeywordColorModal(props) {
  if (!props.category) return null;
  return <KeywordColorModalInner key={props.category.id} {...props} />;
}

function KeywordColorModalInner({ category, saving, onSave, onClose }) {
  const [color, setColor] = useState(category.color || DEFAULT_CATEGORY_COLOR);
  const [lightText, setLightText] = useState(Boolean(category.lightText));

  const previewStyle = getCategoryHighlightStyle(color, lightText);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border-2 border-blue-600 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-black"
      >
        <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Palette size={19} className="shrink-0" />
            <div className="min-w-0">
              <h3 className="text-base font-extrabold truncate">
                Kolor kategorii: {category.name}
              </h3>
              <p className="text-xs text-blue-100 font-semibold">
                Używany na liście kategorii oraz w podświetlaniu słów w szczegółach przetargu
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 cursor-pointer shrink-0"
            aria-label="Zamknij"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Podgląd na żywo */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-blue-200 space-y-2">
            <div className="text-[11px] font-extrabold uppercase text-black opacity-75">
              Podgląd podświetlenia w treści przetargu:
            </div>
            <p className="text-xs font-medium text-black leading-relaxed">
              Przedmiotem zamówienia jest{' '}
              <mark
                style={previewStyle}
                className="px-1.5 py-0.5 rounded border font-extrabold"
              >
                {category.name}
              </mark>{' '}
              wraz z usługą wdrożenia.
            </p>
          </div>

          {/* Wybór dowolnego koloru + checkbox biały tekst */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2.5 text-xs font-extrabold cursor-pointer">
              <span>Własny kolor:</span>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-8 rounded cursor-pointer border border-blue-300 bg-transparent p-0.5"
              />
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 border border-blue-200">
                {color}
              </span>
            </label>

            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-300 text-xs font-extrabold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={lightText}
                onChange={(e) => setLightText(e.target.checked)}
                className="w-4 h-4 accent-blue-600 cursor-pointer"
              />
              Biały tekst
            </label>
          </div>

          {/* Szybkie presety */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-extrabold uppercase text-black opacity-75">
              Gotowe kolory (ciemne automatycznie sugerują biały tekst):
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLOR_PRESETS.map((preset) => {
                const isSelected = color.toLowerCase() === preset.hex.toLowerCase();
                return (
                  <button
                    key={preset.hex}
                    type="button"
                    title={preset.label}
                    onClick={() => {
                      setColor(preset.hex);
                      setLightText(preset.dark);
                    }}
                    style={{ backgroundColor: preset.hex }}
                    className={`w-8 h-8 rounded-lg border-2 cursor-pointer transition transform hover:scale-110 ${
                      isSelected
                        ? 'border-blue-600 ring-2 ring-blue-500 ring-offset-1'
                        : 'border-slate-400'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-blue-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-blue-300 hover:bg-blue-50 text-black font-bold rounded-lg text-xs cursor-pointer"
          >
            Anuluj
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(category, color, lightText)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold rounded-lg text-xs cursor-pointer"
          >
            <Check size={14} /> {saving ? 'Zapisywanie...' : 'Zapisz kolor'}
          </button>
        </div>
      </div>
    </div>
  );
}
