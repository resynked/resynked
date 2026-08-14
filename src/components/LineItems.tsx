import Link from 'next/link';
import { X } from 'lucide-react';
import Select from '@/components/Select';
import { UNITS } from '@/lib/constants';
import type { LineItem } from '@/lib/supabase';

interface LineItemsProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
}

export const emptyLineItem = (): LineItem => ({
  description: '',
  quantity: 1,
  unit: 'stuks',
  price: 0,
});

const unitOptions = UNITS.map(unit => ({ value: unit, label: unit }));

/**
 * Bewerkbare regels voor een offerte of factuur: vrije omschrijving,
 * aantal, eenheid en prijs. Geen artikelbestand nodig.
 */
export default function LineItems({ items, onChange }: LineItemsProps) {
  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    onChange(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <>
      {items.map((item, index) => (
        <div key={index} className="form-section">
          <div className="form-row invoice-product-line">
            <div className="form-group">
              <input
                type="text"
                value={item.description}
                onChange={(e) => updateItem(index, 'description', e.target.value)}
                placeholder="Omschrijving"
                required
              />
            </div>

            <div className="form-group">
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.quantity}
                onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                placeholder="Aantal"
                className="center-input"
              />
            </div>

            <Link className="action delete" href="" onClick={() => removeItem(index)}>
              <X size={16} />
            </Link>
          </div>

          <div className="form-row">
            <div className="form-group">
              <Select
                value={unitOptions.find(o => o.value === item.unit) || null}
                onChange={(option) => updateItem(index, 'unit', option?.value || 'stuks')}
                options={unitOptions}
                placeholder="Eenheid"
              />
            </div>

            <div className="form-group">
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.price}
                onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                placeholder="Prijs per eenheid"
                className="center-input"
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        className="button add-item"
        onClick={() => onChange([...items, emptyLineItem()])}
      >
        + Regel toevoegen
      </button>
    </>
  );
}
