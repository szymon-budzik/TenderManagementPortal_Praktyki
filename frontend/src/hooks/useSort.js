import { useState, useMemo, useCallback } from 'react';

export function useSort(items, initialConfig = { key: 'id', dir: 'asc' }, getValue) {
  const [sortConfig, setSortConfig] = useState(initialConfig);

  const toggleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const sortedItems = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      const { key, dir } = sortConfig;
      const mult = dir === 'asc' ? 1 : -1;
      const valA = getValue ? getValue(a, key) : (a[key] ?? '');
      const valB = getValue ? getValue(b, key) : (b[key] ?? '');
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * mult;
      }
      if (typeof valA === 'boolean' && typeof valB === 'boolean') {
        return (valA === valB ? 0 : valA ? -1 : 1) * mult;
      }
      return String(valA).localeCompare(String(valB), 'pl') * mult;
    });
    return copy;
  }, [items, sortConfig, getValue]);

  return { sortConfig, toggleSort, sortedItems };
}
