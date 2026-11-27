import { useMemo } from 'react';
import { HelpCircle, CheckCircle2, AlertCircle, Plus, Eraser } from 'lucide-react';
import CategoryQueryTags from './CategoryQueryTags';
import { parseCategoryQuery, serializeCategoryQueryTokens } from './categoryQueryUtils';

export default function CategoryQueryEditor({
  value,
  onChange,
  categories = [],
  compact = false,
}) {
  const parsed = useMemo(() => parseCategoryQuery(value, categories), [value, categories]);

  const appendCategory = (catName, mode = 'OR') => {
    const needsQuotes = /\b(AND|OR)\b/i.test(catName);
    const formatted = `${needsQuotes ? `"${catName}"` : catName};${mode}`;
    const trimmed = (value || '').trim();
    if (!trimmed) {
      onChange(formatted);
      return;
    }
    const lastTok = parsed.tokens[parsed.tokens.length - 1];
    const needsOp = lastTok && (lastTok.type === 'TERM' || lastTok.type === 'RPAREN');
    onChange(needsOp ? `${trimmed} OR ${formatted}` : `${trimmed} ${formatted}`);
  };

  const appendToken = (tokStr) => {
    const trimmed = (value || '').trim();
    if (!trimmed) {
      onChange(tokStr);
      return;
    }
    onChange(`${trimmed} ${tokStr}`);
  };

  const handleToggleTermMode = (idx) => {
    const next = parsed.tokens.map((t, i) =>
      i === idx && t.type === 'TERM'
        ? { ...t, mode: t.mode === 'AND' ? 'OR' : 'AND', modeInvalid: null }
        : t
    );
    onChange(serializeCategoryQueryTokens(next));
  };

  const handleToggleOperator = (idx) => {
    const next = parsed.tokens.map((t, i) =>
      i === idx && t.type === 'OP'
        ? { ...t, value: t.value === 'AND' ? 'OR' : 'AND' }
        : t
    );
    onChange(serializeCategoryQueryTokens(next));
  };

  const handleRemoveToken = (idx) => {
    const next = parsed.tokens.filter((_, i) => i !== idx);
    onChange(serializeCategoryQueryTokens(next));
  };

  return (
    <div className="space-y-3">
      {/* Nagłówek + pomoc */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-extrabold uppercase text-blue-700">
            Zapytanie logiczne na kategoriach
          </label>
          <div className="relative group inline-flex items-center">
            <HelpCircle size={15} className="text-blue-600 hover:text-blue-800 cursor-help" />
            <div className="hidden group-hover:block absolute left-0 top-6 z-40 w-80 p-3.5 bg-slate-900 text-white text-xs rounded-xl shadow-xl border border-blue-400 space-y-1.5 leading-relaxed">
              <div className="font-extrabold text-blue-300 uppercase text-[11px]">
                Składnia zapytań kategorii
              </div>
              <div>
                <span className="font-mono font-bold text-amber-300">Nazwa;OR</span> — wystarczy 1 słowo z tej kategorii
              </div>
              <div>
                <span className="font-mono font-bold text-amber-300">Nazwa;AND</span> — muszą wystąpić wszystkie słowa z tej kategorii
              </div>
              <div>
                <span className="font-mono font-bold text-sky-300">OR</span> /{' '}
                <span className="font-mono font-bold text-purple-300">AND</span> pomiędzy kategoriami oraz nawiasy{' '}
                <span className="font-mono font-bold text-white">( )</span>
              </div>
              <div className="pt-1 border-t border-slate-700 text-[11px] text-slate-300">
                Przykład: <span className="font-mono">IT;OR AND Chmura;AND OR Budowlanka;OR</span>
              </div>
            </div>
          </div>
        </div>

        {value && value.trim().length > 0 && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-black hover:underline cursor-pointer"
          >
            <Eraser size={12} /> Wyczyść
          </button>
        )}
      </div>

      {/* Pole tekstowe zapytania */}
      <textarea
        rows={compact ? 2 : 2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="np. IT;OR OR Budownictwo;AND   albo   (IT;OR OR Chmura;OR) AND Bezpieczeństwo;AND"
        className={`w-full px-3.5 py-2.5 border-2 rounded-xl bg-white text-black font-mono text-sm resize-y transition ${
          parsed.empty
            ? 'border-blue-300'
            : parsed.valid
            ? 'border-green-600'
            : 'border-red-500'
        }`}
      />

      {/* Podgląd w formie szarych tagów z kolorowymi OR/AND */}
      {parsed.tokens.length > 0 && (
        <div className="p-3 rounded-xl bg-slate-50 border border-blue-200 space-y-1.5">
          <div className="text-[10px] font-extrabold uppercase text-black opacity-75">
            Podgląd zapytania (kliknij OR / AND, aby przełączyć):
          </div>
          <CategoryQueryTags
            tokens={parsed.tokens}
            categories={categories}
            interactive={true}
            compact={compact}
            onToggleTermMode={handleToggleTermMode}
            onToggleOperator={handleToggleOperator}
            onRemoveToken={handleRemoveToken}
          />
        </div>
      )}

      {/* Status walidacji */}
      {!parsed.empty && (
        <div
          className={`flex items-center gap-1.5 text-xs font-extrabold ${
            parsed.valid ? 'text-green-700' : 'text-red-700'
          }`}
        >
          {parsed.valid ? (
            <>
              <CheckCircle2 size={14} className="shrink-0" />
              <span>Poprawne zapytanie (użyte kategorie: {parsed.referencedCount})</span>
            </>
          ) : (
            <>
              <AlertCircle size={14} className="shrink-0" />
              <span>{parsed.error}</span>
            </>
          )}
        </div>
      )}

      {/* Pasek szybkiego wstawiania operatorów i dostępnych kategorii */}
      <div className="space-y-2 pt-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-extrabold uppercase text-black opacity-75 mr-1">
            Operatory:
          </span>
          <button
            type="button"
            onClick={() => appendToken('OR')}
            className="px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-blue-200 hover:bg-blue-300 border-2 border-blue-700 text-black cursor-pointer"
          >
            + OR
          </button>
          <button
            type="button"
            onClick={() => appendToken('AND')}
            className="px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-purple-300 hover:bg-purple-400 border-2 border-purple-800 text-black cursor-pointer"
          >
            + AND
          </button>
          <button
            type="button"
            onClick={() => appendToken('(')}
            className="px-2.5 py-1 rounded-md text-[11px] font-mono font-extrabold bg-slate-200 hover:bg-slate-300 border border-slate-500 text-black cursor-pointer"
          >
            (
          </button>
          <button
            type="button"
            onClick={() => appendToken(')')}
            className="px-2.5 py-1 rounded-md text-[11px] font-mono font-extrabold bg-slate-200 hover:bg-slate-300 border border-slate-500 text-black cursor-pointer"
          >
            )
          </button>
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-extrabold uppercase text-black opacity-75 mr-1">
              Wstaw kategorię:
            </span>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => appendCategory(cat.name, 'OR')}
                title={`Kliknij, aby dodać "${cat.name};OR" do zapytania`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-white hover:bg-blue-50 border border-blue-300 text-black cursor-pointer transition"
              >
                <Plus size={12} className="text-blue-600" />
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
