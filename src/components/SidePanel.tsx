import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface SidePanelProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Paneel dat vanaf de rechterkant inschuift, met de bestaande .modal-overlay
 * als achtergrond. Wordt gebruikt voor het bewerken van een blok en voor de
 * uitleg bij een instelling.
 */
export default function SidePanel({ title, onClose, children }: SidePanelProps) {
  // Escape sluit het paneel; dat is wat iemand verwacht bij iets dat overlapt
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />

      <div className="modal-container">
        <div className="header">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Paneel sluiten">
            <X size={18} />
          </button>
        </div>

        {children}
      </div>
    </>
  );
}
