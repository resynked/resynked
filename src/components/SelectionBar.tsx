import { ReactNode } from 'react';
import { X } from 'lucide-react';
import ToolButton from '@/components/ToolButton';

interface SelectionBarProps {
  count: number;
  /** Wat er geselecteerd is, enkelvoud en meervoud: ['offerte', 'offertes'] */
  noun: [string, string];
  onClear: () => void;
  /** De acties voor de selectie; verwijderen hoort als laatste */
  children: ReactNode;
}

/**
 * De balk die onderin opduikt zodra je in een lijst iets aanvinkt, met wat je
 * met de selectie kunt doen. Dezelfde balk als bij het bewerken van een offerte.
 */
export default function SelectionBar({ count, noun, onClear, children }: SelectionBarProps) {
  if (count === 0) return null;

  return (
    <div className="island-bar rich-editor">
      <div className="toolbar">
        <div className="group">
          <ToolButton title="Selectie opheffen" onClick={onClear}>
            <X size={15} />
          </ToolButton>
        </div>

        <div className="group selection-count">
          <span className="count">{count}</span>
          <span>
            {count === 1 ? noun[0] : noun[1]} geselecteerd
          </span>
        </div>

        <div className="group">{children}</div>
      </div>
    </div>
  );
}
