import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import Modal from '@/components/Modal';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** Rode knop, voor iets wat niet terug te draaien is, zoals verwijderen */
  negative?: boolean;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    negative: boolean;
    resolver?: (value: boolean) => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Bevestigen',
    cancelText: 'Annuleren',
    negative: false,
  });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        title: options.title || 'Bevestigen',
        message: options.message,
        confirmText: options.confirmText || 'Bevestigen',
        cancelText: options.cancelText || 'Annuleren',
        negative: !!options.negative,
        resolver: resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    confirmState.resolver?.(true);
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  }, [confirmState]);

  const handleCancel = useCallback(() => {
    confirmState.resolver?.(false);
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  }, [confirmState]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Modal
        isOpen={confirmState.isOpen}
        onClose={handleCancel}
        title={confirmState.title}
      >
        <p>{confirmState.message}</p>
        <div className="buttons">
          <button className="button cancel" onClick={handleCancel}>
            {confirmState.cancelText}
          </button>
          <button className={`button${confirmState.negative ? ' negative' : ''}`} onClick={handleConfirm}>
            {confirmState.confirmText}
          </button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}
