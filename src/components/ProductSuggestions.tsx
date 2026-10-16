import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Product } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';

/** De producten waarvan de naam het getypte bevat; pas vanaf twee letters */
export function matchProducts(products: Product[], query: string): Product[] {
  const term = query.trim().toLowerCase();
  if (term.length < 2) return [];
  return products
    .filter(product => product.name.toLowerCase().includes(term) && product.name.toLowerCase() !== term)
    .slice(0, 6);
}

/**
 * Suggesties onder een regel in de prijstabel terwijl je typt. Ze zweven los
 * op de pagina en niet op het papier: dat is geschaald en snijdt alles af wat
 * buiten het vel valt. De opmaak is die van het menu van een keuzelijst.
 */
export default function ProductSuggestions({
  anchor,
  products,
  active,
  onPick,
}: {
  /** Het veld waaronder de suggesties komen */
  anchor: HTMLElement | null;
  products: Product[];
  active: number;
  onPick: (product: Product) => void;
}) {
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  // Meeschuiven met scrollen en een ander venster
  useLayoutEffect(() => {
    if (!anchor) return;
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      setPosition({ top: rect.bottom, left: rect.left, width: Math.max(rect.width, 260) });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [anchor]);

  if (!anchor || !position || products.length === 0) return null;

  return createPortal(
    <div
      className="select product-suggestions"
      style={{ top: position.top, left: position.left, width: position.width }}
    >
      <div className="menu" role="listbox">
        {products.map((product, index) => (
          <div
            key={product.id}
            role="option"
            aria-selected={index === active}
            className={`option${index === active ? ' selected' : ''}`}
            // Niet de focus uit het veld halen, anders sluit de lijst voor de klik
            onMouseDown={(event) => {
              event.preventDefault();
              onPick(product);
            }}
          >
            {product.name}{' '}
            <span className="placeholder">
              {formatCurrency(Number(product.price))}
              {product.unit ? ` per ${product.unit}` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
}
