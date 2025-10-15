import { ReactNode, useEffect } from 'react';
import { CircleCheck, CircleX, CircleAlert, CircleQuestionMark } from 'lucide-react';

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
      <div className={`toast ${variant}`}>
        {variant === 'success' && <CircleCheck size={16} />}
        {variant === 'error' && <CircleX size={16} />}
        {variant === 'warning' && <CircleAlert size={16} />}
        {variant === 'info' && <CircleQuestionMark size={16} />}
        <div className="toast-content">
            <div className="toast-title">{title}</div>
            <div className="toast-description">{children}</div>
        </div>
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
