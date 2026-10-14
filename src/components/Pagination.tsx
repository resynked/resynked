import { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import Select from '@/components/Select';
import { PAGE_SIZES } from '@/hooks/usePagination';

interface PaginationProps {
  page: number;
  pageCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const sizeOptions = PAGE_SIZES.map(size => ({ value: String(size), label: String(size) }));

/**
 * Welke paginanummers er staan. Altijd de eerste en de laatste, en de pagina's
 * rond de huidige; wat ertussen valt wordt "...". Zo blijft de rij even lang,
 * of er nu vijf pagina's zijn of vijfhonderd.
 */
function pageNumbers(page: number, pageCount: number): (number | 'gap')[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  if (page <= 3) return [1, 2, 3, 4, 'gap', pageCount];
  if (page >= pageCount - 2) return [1, 'gap', pageCount - 3, pageCount - 2, pageCount - 1, pageCount];
  return [1, 'gap', page - 1, page, page + 1, 'gap', pageCount];
}

function PageButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="button icon"
      data-label={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** De balk onder een tabel: rijen per pagina, en bladeren door de pagina's. */
export default function Pagination({ page, pageCount, pageSize, onPageChange, onPageSizeChange }: PaginationProps) {
  return (
    <div className="pagination">
      <div className="page-size">
        <Select
          value={sizeOptions.find(o => o.value === String(pageSize)) || null}
          onChange={(option) => onPageSizeChange(Number(option?.value ?? PAGE_SIZES[0]))}
          options={sizeOptions}
        />
        <span>Rijen per pagina</span>
      </div>

      <div className="page-nav">
        <span>
          Pagina {page} van {pageCount}
        </span>

        <div className="pages">
          <PageButton label="Eerste pagina" disabled={page === 1} onClick={() => onPageChange(1)}>
            <ChevronsLeft size={16} />
          </PageButton>
          <PageButton label="Vorige pagina" disabled={page === 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft size={16} />
          </PageButton>

          {pageNumbers(page, pageCount).map((number, index) =>
            number === 'gap' ? (
              <span key={`gap-${index}`} className="gap">
                ...
              </span>
            ) : (
              <button
                key={number}
                type="button"
                className={number === page ? 'button' : 'button icon'}
                aria-label={`Pagina ${number}`}
                aria-current={number === page ? 'page' : undefined}
                onClick={() => onPageChange(number)}
              >
                {number}
              </button>
            )
          )}

          <PageButton label="Volgende pagina" disabled={page === pageCount} onClick={() => onPageChange(page + 1)}>
            <ChevronRight size={16} />
          </PageButton>
          <PageButton label="Laatste pagina" disabled={page === pageCount} onClick={() => onPageChange(pageCount)}>
            <ChevronsRight size={16} />
          </PageButton>
        </div>
      </div>
    </div>
  );
}
