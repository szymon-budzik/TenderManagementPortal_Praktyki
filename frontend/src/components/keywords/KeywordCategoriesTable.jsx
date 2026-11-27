import { ArrowUpDown, Check, Palette, Pencil, Settings, Shield, Trash2, X } from 'lucide-react';
import { RESOURCE_TYPES, getResourceAccessSummary } from '../../rolesStore';
import { parseKeywordsString } from './keywordUtils';
import { getCategoryHighlightStyle } from './categoryColorPresets';

export default function KeywordCategoriesTable({
  categories,
  selectedKeyword,
  editingCatId,
  editCatName,
  onEditCatNameChange,
  onStartEditName,
  onSaveCategoryName,
  onCancelEditName,
  addingWordCatId,
  newWordsText,
  onNewWordsTextChange,
  onToggleAddWords,
  onAddWordsToCategory,
  onCancelAddWords,
  openBulkMenuCatId,
  onToggleBulkMenu,
  onBulkUpdate,
  onOpenAccess,
  onOpenColor,
  onSelectKeyword,
  onConfirmDeleteCategory,
  onToggleSort,
}) {
  return (
    <div className="bg-white rounded-xl border border-blue-200 overflow-visible shadow-xs">
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="bg-blue-600 text-white select-none">
            <th
              onClick={() => onToggleSort('name')}
              className="p-3.5 font-bold w-64 cursor-pointer hover:bg-blue-700 rounded-tl-xl"
            >
              <div className="inline-flex items-center gap-1">
                Nazwa kategorii <ArrowUpDown size={14} />
              </div>
            </th>
            <th
              onClick={() => onToggleSort('keywords')}
              className="p-3.5 font-bold cursor-pointer hover:bg-blue-700"
            >
              <div className="inline-flex items-center gap-1">
                Słowa kluczowe (Kliknij w słowo, aby skonfigurować wagę, wildcard * lub wykluczenie){' '}
                <ArrowUpDown size={14} />
              </div>
            </th>
            <th className="p-3.5 font-bold text-right w-56 rounded-tr-xl">Akcje</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-blue-100">
          {categories.length === 0 ? (
            <tr>
              <td colSpan="3" className="p-6 text-center font-medium">
                Brak zdefiniowanych kategorii słów kluczowych.
              </td>
            </tr>
          ) : (
            categories.map((cat) => {
              const parsedList = parseKeywordsString(cat.keywords);
              const isEditingName = editingCatId === cat.id;
              const isAddingWords = addingWordCatId === cat.id;
              const isBulkMenuOpen = openBulkMenuCatId === cat.id;
              const accessSummary = getResourceAccessSummary(RESOURCE_TYPES.KEYWORD, cat.id);

              return (
                <tr key={cat.id} className="hover:bg-blue-50/40">
                  <td className="p-3.5 font-extrabold align-top">
                    {isEditingName ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editCatName}
                          onChange={(e) => onEditCatNameChange(e.target.value)}
                          className="w-full px-2.5 py-1 border border-blue-400 rounded bg-white text-black font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => onSaveCategoryName(cat)}
                          className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={onCancelEditName}
                          className="p-1.5 bg-white border border-blue-300 rounded hover:bg-blue-50 cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenColor && onOpenColor(cat)}
                          title="Kliknij, aby zmienić kolor podświetlenia tej kategorii"
                          style={getCategoryHighlightStyle(cat.color, cat.lightText)}
                          className="px-2.5 py-1 rounded-lg border font-extrabold text-sm cursor-pointer transition hover:opacity-90 text-left"
                        >
                          {cat.name}
                        </button>
                      </div>
                    )}
                  </td>

                  <td className="p-3.5 align-top space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {parsedList.map((kw, idx) => {
                        const isSelected =
                          selectedKeyword?.catId === cat.id && selectedKeyword?.wordIndex === idx;
                        const isExcludedWildcard = kw.isExcluded && kw.isWildcard;

                        let badgeStyle = 'bg-white hover:bg-blue-50 border-blue-400 text-black';
                        if (isExcludedWildcard) {
                          badgeStyle = isSelected
                            ? 'bg-rose-950 border-rose-950 text-white ring-2 ring-blue-500 ring-offset-1'
                            : 'bg-rose-900 hover:bg-rose-950 border-rose-950 text-white';
                        } else if (kw.isExcluded) {
                          badgeStyle = isSelected
                            ? 'bg-red-500 border-red-900 text-black ring-2 ring-blue-500 ring-offset-1'
                            : 'bg-red-400 hover:bg-red-500 border-red-800 text-black';
                        } else if (kw.isWildcard) {
                          badgeStyle = isSelected
                            ? 'bg-purple-600 border-purple-900 text-white'
                            : 'bg-purple-300 hover:bg-purple-400 border-purple-800 text-black';
                        } else if (isSelected) {
                          badgeStyle = 'bg-blue-600 border-blue-900 text-white';
                        }

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => onSelectKeyword(cat, idx, kw)}
                            title={
                              isExcludedWildcard
                                ? 'Wykluczone + Odmiana końcówek (WYKLUCZ*)'
                                : kw.isExcluded
                                ? 'Słowo wykluczające'
                                : kw.isWildcard
                                ? 'Odmiana końcówek (Wildcard *) — dopasowuje różne końcówki'
                                : 'Kliknij, aby skonfigurować'
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border-2 transition transform active:scale-95 cursor-pointer ${badgeStyle}`}
                          >
                            {isExcludedWildcard
                              ? `${kw.word} (WYKLUCZ*)`
                              : kw.isExcluded
                              ? `${kw.word} (WYKLUCZ)`
                              : `${kw.word}: ${kw.score}`}
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => onToggleAddWords(cat.id)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white border border-dashed border-blue-500 hover:bg-blue-50 text-black cursor-pointer"
                      >
                        + Dodaj słowo
                      </button>
                    </div>

                    {isAddingWords && (
                      <div className="flex items-center gap-2 pt-1 max-w-md">
                        <input
                          type="text"
                          value={newWordsText}
                          onChange={(e) => onNewWordsTextChange(e.target.value)}
                          placeholder="np. docker, dostaw*"
                          className="flex-1 px-2.5 py-1 border border-blue-400 rounded bg-white text-black text-xs font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => onAddWordsToCategory(cat)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-bold cursor-pointer"
                        >
                          Dodaj
                        </button>
                        <button
                          type="button"
                          onClick={onCancelAddWords}
                          className="px-2.5 py-1 bg-white border border-blue-300 rounded text-xs font-bold cursor-pointer"
                        >
                          Anuluj
                        </button>
                      </div>
                    )}
                  </td>

                  <td className="p-3.5 text-right whitespace-nowrap align-top">
                    <div className="flex items-center justify-end gap-2">
                      <div className="relative" data-bulk-menu>
                        <button
                          type="button"
                          onClick={() => onToggleBulkMenu(cat.id)}
                          title="Zbiorczo ustaw tryb dla słów w tej kategorii"
                          className={`p-1.5 rounded-lg border transition cursor-pointer ${
                            isBulkMenuOpen
                              ? 'bg-blue-600 border-blue-800 text-white'
                              : 'bg-white border-blue-400 hover:bg-blue-50 text-black'
                          }`}
                        >
                          <Settings size={15} />
                        </button>

                        {isBulkMenuOpen && (
                          <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-xl border-2 border-blue-600 shadow-xl z-40 p-1.5 text-left space-y-1">
                            <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase text-blue-700 border-b border-blue-100">
                              Ustaw słowa w kategorii jako:
                            </div>
                            <button
                              type="button"
                              onClick={() => onBulkUpdate(cat, 'NEUTRAL')}
                              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-extrabold text-black hover:bg-blue-50 cursor-pointer"
                            >
                              <span className="w-3 h-3 rounded-full bg-white border-2 border-blue-500 shrink-0" />
                              Neutralne (wszystkie)
                            </button>
                            <button
                              type="button"
                              onClick={() => onBulkUpdate(cat, 'WILDCARD')}
                              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-extrabold text-black hover:bg-purple-50 cursor-pointer"
                            >
                              <span className="w-3 h-3 rounded-full bg-purple-300 border-2 border-purple-800 shrink-0" />
                              Wildcards (tylko z *)
                            </button>
                            <button
                              type="button"
                              onClick={() => onBulkUpdate(cat, 'EXCLUDED')}
                              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-extrabold text-black hover:bg-red-50 cursor-pointer"
                            >
                              <span className="w-3 h-3 rounded-full bg-red-400 border-2 border-red-800 shrink-0" />
                              Wykluczone (wszystkie)
                            </button>
                            <button
                              type="button"
                              onClick={() => onBulkUpdate(cat, 'EXCLUDED_WILDCARD')}
                              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-extrabold text-black hover:bg-rose-50 cursor-pointer"
                            >
                              <span className="w-3 h-3 rounded-full bg-rose-900 border-2 border-rose-950 shrink-0" />
                              WYKLUCZ* (tylko z *)
                            </button>
                            {onOpenAccess && (
                              <div className="pt-1 mt-1 border-t border-blue-100">
                                <button
                                  type="button"
                                  onClick={() => onOpenAccess(cat)}
                                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-extrabold text-black hover:bg-amber-50 cursor-pointer"
                                >
                                  <Shield size={13} className="text-blue-700 shrink-0" />
                                  Dostęp dla ról...
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {onOpenColor && (
                        <button
                          type="button"
                          onClick={() => onOpenColor(cat)}
                          title="Zmień kolor kategorii i kontrast tekstu"
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-blue-400 hover:bg-blue-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                        >
                          <Palette size={14} />
                          <span
                            style={{ backgroundColor: cat.color || '#93c5fd' }}
                            className="w-3 h-3 rounded-full border border-slate-500 shrink-0"
                          />
                        </button>
                      )}

                      {onOpenAccess && (
                        <button
                          type="button"
                          onClick={() => onOpenAccess(cat)}
                          title="Ustaw, które role mają dostęp do tej kategorii słów kluczowych"
                          className={`flex items-center gap-1 px-3 py-1.5 border rounded-lg font-bold text-xs cursor-pointer transition ${
                            accessSummary.isRestricted
                              ? 'bg-amber-100 hover:bg-amber-200 border-amber-600 text-black'
                              : 'bg-white border-blue-400 hover:bg-blue-50 text-black'
                          }`}
                        >
                          <Shield size={14} />
                          {accessSummary.isRestricted
                            ? `Dostęp (${accessSummary.allowedCount}/${accessSummary.totalRoles})`
                            : 'Dostęp'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onStartEditName(cat)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-400 hover:bg-blue-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                      >
                        <Pencil size={14} /> Nazwa
                      </button>
                      <button
                        type="button"
                        onClick={() => onConfirmDeleteCategory(cat)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-300 hover:bg-red-50 text-black rounded-lg font-bold text-xs cursor-pointer"
                      >
                        <Trash2 size={14} /> Usuń
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
  );
}
