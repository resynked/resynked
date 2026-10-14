import { useState } from 'react';

/** Hoeveel rijen er per pagina kunnen staan. */
export const PAGE_SIZES = [10, 25, 50, 100];

/**
 * Een lange lijst in pagina's. Wordt de lijst korter, bijvoorbeeld na het
 * verwijderen van de laatste rij op de laatste pagina, dan schuift de pagina
 * mee terug in plaats van leeg te blijven staan.
 */
export function usePagination<T>(items: T[], initialPageSize = PAGE_SIZES[0]) {
  const [requestedPage, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(requestedPage, 1), pageCount);
  const pageItems = items.slice((page - 1) * pageSize, page * pageSize);

  // Met een andere paginagrootte begin je weer bovenaan
  const setPageSize = (size: number) => {
    setPageSizeState(size);
    setPage(1);
  };

  return { page, pageCount, pageSize, pageItems, setPage, setPageSize, total: items.length };
}
