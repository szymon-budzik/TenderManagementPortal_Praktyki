import { useState, useMemo } from 'react';

export function usePagination(items, pageSize = 10) {
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);

  const paginatedItems = useMemo(
    () => items.slice(currentPage * pageSize, currentPage * pageSize + pageSize),
    [items, currentPage, pageSize]
  );

  return {
    page,
    setPage,
    totalPages,
    currentPage,
    paginatedItems,
    pageSize,
  };
}
