import { ReactNode, useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  type?: 'modal' | 'toast';
  variant?: 'info' | 'success' | 'error' | 'warning';
  autoClose?: boolean;
  autoCloseDuration?: number;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  type = 'modal',
  variant = 'info',
  autoClose = false,
  autoCloseDuration = 5000
}: ModalProps) {
  useEffect(() => {
    if (isOpen && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDuration);

      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, autoCloseDuration, onClose]);

  if (!isOpen) return null;

  if (type === 'toast') {
    return (
      <div className={`toast toast-${variant}`}>
        <div className="toast-header">
          <h3>{title}</h3>
          <button className="toast-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="toast-body">{children}</div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
