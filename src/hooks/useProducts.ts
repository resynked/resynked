import { useEffect, useState } from 'react';
import type { Product } from '@/lib/supabase';

/**
 * De producten van het bedrijf, voor de suggesties in de prijstabel. Eén keer
 * opgehaald en daarna onthouden; de pagina Producten laat weten als er iets
 * verandert, zodat de suggesties meteen kloppen.
 */
let current: Product[] | null = null;
let loading: Promise<Product[]> | null = null;
const listeners = new Set<(products: Product[]) => void>();

function load(): Promise<Product[]> {
  if (!loading) {
    loading = fetch('/api/products')
      .then(res => (res.ok ? res.json() : []))
      .catch(() => [])
      .then((products: Product[]) => {
        current = products;
        listeners.forEach(listener => listener(products));
        return products;
      });
  }
  return loading;
}

/** Na toevoegen, bewerken of verwijderen bij Producten: de volgende keer opnieuw ophalen */
export function invalidateProducts() {
  loading = null;
  current = null;
  if (listeners.size) load();
}

/** Leeg zolang ze laden. Met enabled = false wordt er niets opgehaald */
export function useProducts(enabled = true): Product[] {
  const [products, setProducts] = useState<Product[]>(current || []);

  useEffect(() => {
    if (!enabled) return;
    listeners.add(setProducts);
    load();
    return () => {
      listeners.delete(setProducts);
    };
  }, [enabled]);

  return products;
}
