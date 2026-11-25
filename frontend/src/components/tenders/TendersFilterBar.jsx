import { Search, RotateCcw } from 'lucide-react';
import { STATUSES } from './tenderUtils';

export default function TendersFilterBar({
  filters,
  onFilterChange,
  availableSources,
  categories,
  matchedCount,
  onReset,
}) {
  return (
    <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-xs space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-xs font-bold uppercase mb-1 text-black">
            Szukaj frazy
          </label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-blue-600" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => onFilterChange('search', e.target.value)}
              placeholder="Tytuł, ID, zamawiający..."
              className="w-full pl-9 pr-3 py-2 border border-blue-300 rounded-lg text-black focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase mb-1 text-black">Źródło</label>
          <select
            value={filters.sourceFilter}
            onChange={(e) => onFilterChange('sourceFilter', e.target.value)}
            className="w-full px-3 py-2 border border-blue-300 rounded-lg text-black bg-white font-semibold"
          >
            <option value="">Wszystkie źródła</option>
            {availableSources.map((src) => (
              <option key={src} value={src}>
                {src}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase mb-1 text-black">
            Kategoria (Score)
          </label>
          <select
            value={filters.categoryFilter}
            onChange={(e) => onFilterChange('categoryFilter', e.target.value)}
            className="w-full px-3 py-2 border border-blue-300 rounded-lg text-black bg-white font-semibold"
          >
            <option value="">Wszystkie kategorie</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase mb-1 text-black">
            Min. pkt w kategorii
          </label>
          <input
            type="number"
            value={filters.minCategoryScore}
            onChange={(e) => onFilterChange('minCategoryScore', e.target.value)}
            placeholder={filters.categoryFilter ? `Min. w ${filters.categoryFilter}` : 'np. 50'}
            className="w-full px-3 py-2 border border-blue-300 rounded-lg text-black"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase mb-1 text-black">
            Min. Suma Punktów
          </label>
          <input
            type="number"
            value={filters.minTotalScore}
            onChange={(e) => onFilterChange('minTotalScore', e.target.value)}
            placeholder="np. 100"
            className="w-full px-3 py-2 border border-blue-300 rounded-lg text-black"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end pt-2 border-t border-blue-100">
        <div>
          <label className="block text-xs font-bold uppercase mb-1 text-black">Status</label>
          <select
            value={filters.statusFilter}
            onChange={(e) => onFilterChange('statusFilter', e.target.value)}
            className="w-full px-3 py-1.5 border border-blue-300 rounded-lg text-black bg-white text-xs font-semibold"
          >
            <option value="">Wszystkie</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase mb-1 text-black">Data od</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onFilterChange('dateFrom', e.target.value)}
            className="w-full px-3 py-1.5 border border-blue-300 rounded-lg text-black text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase mb-1 text-black">Data do</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => onFilterChange('dateTo', e.target.value)}
            className="w-full px-3 py-1.5 border border-blue-300 rounded-lg text-black text-xs"
          />
        </div>

        <div className="md:col-span-3 flex items-center justify-between md:justify-end gap-3">
          <span className="text-xs font-extrabold text-black">
            Znaleziono przetargów: {matchedCount}
          </span>
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 py-2 px-4 bg-white border border-blue-300 hover:bg-blue-50 text-black font-bold rounded-lg transition cursor-pointer text-xs"
          >
            <RotateCcw size={14} />
            Wyczyść filtry
          </button>
        </div>
      </div>
    </div>
  );
}
