import { parseCategoryQuery } from './categoryQueryUtils';

export default function CategoryQueryTags({
  query,
  tokens: providedTokens,
  categories = [],
  interactive = false,
  compact = false,
  onToggleTermMode,
  onToggleOperator,
  onRemoveToken,
}) {
  const tokens =
    providedTokens || parseCategoryQuery(query, categories).tokens;

  if (!tokens || tokens.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tokens.map((tok, idx) => {
        if (tok.type === 'LPAREN' || tok.type === 'RPAREN') {
          return (
            <span
              key={idx}
              className={`inline-flex items-center gap-1 bg-slate-200 border border-slate-500 rounded-md font-mono font-extrabold text-black ${
                compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs'
              }`}
            >
              <span>{tok.value}</span>
              {interactive && onRemoveToken && (
                <button
                  type="button"
                  onClick={() => onRemoveToken(idx)}
                  title="Usuń nawias"
                  className="hover:text-red-700 font-extrabold cursor-pointer leading-none"
                >
                  ×
                </button>
              )}
            </span>
          );
        }

        if (tok.type === 'OP') {
          const isAnd = tok.value === 'AND';
          const cls = isAnd
            ? 'bg-purple-300 border-purple-800 hover:bg-purple-400 text-black'
            : 'bg-blue-200 border-blue-700 hover:bg-blue-300 text-black';

          if (interactive && onToggleOperator) {
            return (
              <span key={idx} className="inline-flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onToggleOperator(idx)}
                  title={`Kliknij, aby zmienić operator na ${isAnd ? 'OR' : 'AND'}`}
                  className={`inline-flex items-center gap-1 border-2 rounded-md font-extrabold cursor-pointer transition ${cls} ${
                    compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
                  }`}
                >
                  {tok.value}
                </button>
                {onRemoveToken && (
                  <button
                    type="button"
                    onClick={() => onRemoveToken(idx)}
                    title="Usuń operator"
                    className="px-1 text-xs font-extrabold text-slate-600 hover:text-red-700 cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </span>
            );
          }

          return (
            <span
              key={idx}
              className={`inline-flex items-center border-2 rounded-md font-extrabold ${
                isAnd
                  ? 'bg-purple-300 border-purple-800 text-black'
                  : 'bg-blue-200 border-blue-700 text-black'
              } ${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'}`}
            >
              {tok.value}
            </span>
          );
        }

        // TERM — szary tag z nazwą kategorii i kolorowym znacznikiem OR/AND w środku
        const hasError = !tok.known || Boolean(tok.modeInvalid);
        const isAnd = tok.mode === 'AND';

        return (
          <span
            key={idx}
            title={
              tok.modeInvalid
                ? `Nieprawidłowy tryb "${tok.modeInvalid}" (użyj ;OR lub ;AND)`
                : !tok.known
                ? `Nieznana kategoria: "${tok.categoryName}"`
                : `Kategoria "${tok.categoryName}" — tryb słów: ${tok.mode}`
            }
            className={`inline-flex items-center gap-1.5 rounded-md border font-bold text-black ${
              hasError
                ? 'bg-red-100 border-red-600'
                : 'bg-slate-200 border-slate-400'
            } ${compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'}`}
          >
            <span className="truncate max-w-[200px]">
              {tok.categoryName || '(brak nazwy)'}
            </span>

            {interactive && onToggleTermMode ? (
              <button
                type="button"
                onClick={() => onToggleTermMode(idx)}
                title={`Tryb słów w kategorii (kliknij, aby przełączyć na ${isAnd ? 'OR' : 'AND'})`}
                className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold border cursor-pointer transition ${
                  tok.modeInvalid
                    ? 'bg-red-300 border-red-800 text-black'
                    : isAnd
                    ? 'bg-purple-300 hover:bg-purple-400 border-purple-800 text-black'
                    : 'bg-blue-200 hover:bg-blue-300 border-blue-700 text-black'
                }`}
              >
                {tok.modeInvalid ? tok.modeInvalid : tok.mode}
              </button>
            ) : (
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold border ${
                  tok.modeInvalid
                    ? 'bg-red-300 border-red-800 text-black'
                    : isAnd
                    ? 'bg-purple-300 border-purple-800 text-black'
                    : 'bg-blue-200 border-blue-700 text-black'
                }`}
              >
                {tok.modeInvalid ? tok.modeInvalid : tok.mode}
              </span>
            )}

            {interactive && onRemoveToken && (
              <button
                type="button"
                onClick={() => onRemoveToken(idx)}
                title="Usuń z zapytania"
                className="hover:text-red-700 font-extrabold cursor-pointer leading-none ml-0.5"
              >
                ×
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}
