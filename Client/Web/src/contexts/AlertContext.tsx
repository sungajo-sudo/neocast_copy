/**
 * Global Alert & Confirm Context
 * Provides a centralized non-blocking dialog system to replace window.alert() / window.confirm()
 */

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface AlertOptions {
  title?: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  confirmText?: string;
  onConfirm?: () => void;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  type?: 'info' | 'warning' | 'error';
  confirmText?: string;
  cancelText?: string;
}

interface AlertState extends AlertOptions {
  isOpen: boolean;
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
}

interface AlertContextValue {
  showAlert: (options: AlertOptions | string) => void;
  hideAlert: () => void;
  showConfirm: (options: ConfirmOptions | string) => Promise<boolean>;
}

const AlertContext = createContext<AlertContextValue | null>(null);

export const useAlert = (): AlertContextValue => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within AlertProvider');
  }
  return context;
};

interface AlertProviderProps {
  children: ReactNode;
}

export const AlertProvider: React.FC<AlertProviderProps> = ({ children }) => {
  const { t } = useTranslation();

  // Alert state
  const [alertState, setAlertState] = useState<AlertState>({
    isOpen: false,
    message: '',
  });

  // Confirm state
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    message: '',
  });

  // Confirm resolver ref (Promise resolve callback)
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);

  // =====================
  // Alert (OK only)
  // =====================

  const showAlert = useCallback((options: AlertOptions | string) => {
    if (typeof options === 'string') {
      setAlertState({
        isOpen: true,
        message: options,
      });
    } else {
      setAlertState({
        isOpen: true,
        ...options,
      });
    }
  }, []);

  const hideAlert = useCallback(() => {
    const onConfirm = alertState.onConfirm;
    setAlertState((prev) => ({ ...prev, isOpen: false }));
    if (onConfirm) {
      onConfirm();
    }
  }, [alertState.onConfirm]);

  // =====================
  // Confirm (OK / Cancel)
  // =====================

  const showConfirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    // 이전 pending confirm이 있으면 reject
    if (confirmResolverRef.current) {
      confirmResolverRef.current(false);
    }

    return new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
      if (typeof options === 'string') {
        setConfirmState({
          isOpen: true,
          message: options,
        });
      } else {
        setConfirmState({
          isOpen: true,
          ...options,
        });
      }
    });
  }, []);

  const handleConfirmOk = useCallback(() => {
    setConfirmState((prev) => ({ ...prev, isOpen: false }));
    if (confirmResolverRef.current) {
      confirmResolverRef.current(true);
      confirmResolverRef.current = null;
    }
  }, []);

  const handleConfirmCancel = useCallback(() => {
    setConfirmState((prev) => ({ ...prev, isOpen: false }));
    if (confirmResolverRef.current) {
      confirmResolverRef.current(false);
      confirmResolverRef.current = null;
    }
  }, []);

  // =====================
  // Styling helpers
  // =====================

  const getTypeStyles = (type?: string) => {
    switch (type) {
      case 'error':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          icon: 'text-red-500',
          title: 'text-red-800',
        };
      case 'warning':
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          icon: 'text-amber-500',
          title: 'text-amber-800',
        };
      case 'success':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          icon: 'text-green-500',
          title: 'text-green-800',
        };
      default:
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          icon: 'text-blue-500',
          title: 'text-blue-800',
        };
    }
  };

  const getIcon = (type?: string) => {
    switch (type) {
      case 'error':
        return (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'success':
        return (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const alertStyles = getTypeStyles(alertState.type);
  const confirmStyles = getTypeStyles(confirmState.type ?? 'warning');

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert, showConfirm }}>
      {children}

      {/* Alert Modal (OK only) */}
      {alertState.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={hideAlert}
          />
          <div
            className={`relative z-10 w-full max-w-sm mx-4 rounded-xl shadow-2xl ${alertStyles.bg} ${alertStyles.border} border overflow-hidden`}
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 ${alertStyles.icon}`}>
                  {getIcon(alertState.type)}
                </div>
                <div className="flex-1 min-w-0">
                  {alertState.title && (
                    <h3 className={`text-lg font-semibold mb-1 ${alertStyles.title}`}>
                      {alertState.title}
                    </h3>
                  )}
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {alertState.message}
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={hideAlert}
                  className="px-6 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  {alertState.confirmText ?? t('common.ok')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal (OK + Cancel) */}
      {confirmState.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={handleConfirmCancel}
          />
          <div
            className={`relative z-10 w-full max-w-sm mx-4 rounded-xl shadow-2xl ${confirmStyles.bg} ${confirmStyles.border} border overflow-hidden`}
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 ${confirmStyles.icon}`}>
                  {getIcon(confirmState.type ?? 'warning')}
                </div>
                <div className="flex-1 min-w-0">
                  {confirmState.title && (
                    <h3 className={`text-lg font-semibold mb-1 ${confirmStyles.title}`}>
                      {confirmState.title}
                    </h3>
                  )}
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {confirmState.message}
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={handleConfirmCancel}
                  className="px-5 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                >
                  {confirmState.cancelText ?? t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={handleConfirmOk}
                  className="px-5 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  {confirmState.confirmText ?? t('common.ok')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
};
