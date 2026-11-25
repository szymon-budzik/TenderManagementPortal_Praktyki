import { Search, RotateCcw } from 'lucide-react';

export default function ObservedFilterBar({
  search,
  onSearchChange,
  sortBy,
  onSortByChange,
  onlyWithUpdates,
  onOnlyWithUpdatesChange,
  highlightEnabled,
  onHighlightEnabledChange,
  onReset,
}) {
  const hasFilters = Boolean(search || onlyWithUpdates || sortBy !== 'ORDER');

  return (
    <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-xs flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[220px]">
        <Search size={15} className="absolute left-3 top-2.5 text-blue-600" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Szukaj wśród obserwowanych i ich aktualizacji..."
          className="w-full pl-9 pr-3 py-2 border border-blue-300 rounded-lg text-xs font-semibold text-black"
        />
      </div>

      <select
        value={sortBy}
        onChange={(e) => onSortByChange(e.target.value)}
        className="px-3 py-2 border border-blue-300 rounded-lg bg-white text-xs font-bold text-black"
      >
        <option value="ORDER">Kolejność stała (grupy w miejscu)</option>
        <option value="DEADLINE">Najbliższy termin (godziny)</option>
        <option value="UPDATED">Ostatnio zaktualizowane</option>
      </select>

      <label className="inline-flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-400 rounded-lg text-xs font-extrabold cursor-pointer select-none">
        <input
          type="checkbox"
          checked={onlyWithUpdates}
          onChange={(e) => onOnlyWithUpdatesChange(e.target.checked)}
          className="w-4 h-4 accent-amber-600 cursor-pointer"
        />
        Tylko z aktualizacjami
      </label>

      <label className="inline-flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-500 rounded-lg text-xs font-extrabold cursor-pointer select-none">
        <input
          type="checkbox"
          checked={highlightEnabled}
          onChange={(e) => onHighlightEnabledChange(e.target.checked)}
          className="w-4 h-4 accent-yellow-600 cursor-pointer"
        />
        Podświetl słowa kluczowe
      </label>

      {hasFilters && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1 px-3 py-2 bg-white border border-blue-300 hover:bg-blue-50 rounded-lg text-xs font-bold cursor-pointer"
        >
          <RotateCcw size={13} /> Reset
        </button>
      )}
    </div>
  );
}
