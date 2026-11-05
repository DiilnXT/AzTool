'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  Sparkles,
  Loader2,
} from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

export interface LoadingHudState {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  progress?: number;
}

interface ToastContextType {
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  showLoading: (title: string, subtitle?: string, progress?: number) => void;
  updateLoading: (title: string, subtitle?: string, progress?: number) => void;
  hideLoading: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [loadingHud, setLoadingHud] = useState<LoadingHudState>({
    isOpen: false,
    title: '',
    subtitle: '',
  });

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, message, duration = 4200 }: Omit<ToastItem, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts(prev => [...prev.slice(-3), { id, type, title, message, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback(
    (title: string, message?: string) => showToast({ type: 'success', title, message }),
    [showToast]
  );

  const error = useCallback(
    (title: string, message?: string) => showToast({ type: 'error', title, message, duration: 5500 }),
    [showToast]
  );

  const warning = useCallback(
    (title: string, message?: string) => showToast({ type: 'warning', title, message }),
    [showToast]
  );

  const info = useCallback(
    (title: string, message?: string) => showToast({ type: 'info', title, message }),
    [showToast]
  );

  const showLoading = useCallback((title: string, subtitle?: string, progress?: number) => {
    setLoadingHud({ isOpen: true, title, subtitle, progress });
  }, []);

  const updateLoading = useCallback((title: string, subtitle?: string, progress?: number) => {
    setLoadingHud(prev => ({ ...prev, title, subtitle, progress }));
  }, []);

  const hideLoading = useCallback(() => {
    setLoadingHud(prev => ({ ...prev, isOpen: false }));
  }, []);

  return (
    <ToastContext.Provider
      value={{
        showToast,
        success,
        error,
        warning,
        info,
        showLoading,
        updateLoading,
        hideLoading,
      }}
    >
      {children}

      {/* Dynamic Island Floating Toast Stack */}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 left-4 sm:left-auto sm:w-[400px] z-[100] flex flex-col gap-2.5 pointer-events-none"
      >
        {toasts.map(t => {
          const iconMap = {
            success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
            error: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />,
            warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
            info: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
          };

          const borderMap = {
            success: 'border-emerald-500/30 dark:border-emerald-400/25',
            error: 'border-rose-500/30 dark:border-rose-400/25',
            warning: 'border-amber-500/30 dark:border-amber-400/25',
            info: 'border-blue-500/30 dark:border-blue-400/25',
          };

          const glowMap = {
            success: 'from-emerald-500/10 to-transparent',
            error: 'from-rose-500/10 to-transparent',
            warning: 'from-amber-500/10 to-transparent',
            info: 'from-blue-500/10 to-transparent',
          };

          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto relative overflow-hidden canva-card rounded-2xl p-3.5 px-4 shadow-xl border ${borderMap[t.type]} toast-enter flex items-start gap-3`}
            >
              <div className={`absolute inset-0 bg-gradient-to-r ${glowMap[t.type]} pointer-events-none`} />
              <div className="relative z-10 mt-0.5">{iconMap[t.type]}</div>
              <div className="relative z-10 flex-1 min-w-0">
                <p className="text-xs font-bold text-neutral-900 dark:text-white leading-snug">
                  {t.title}
                </p>
                {t.message && (
                  <p className="text-[11px] text-neutral-600 dark:text-neutral-300 mt-0.5 leading-relaxed break-words">
                    {t.message}
                  </p>
                )}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                aria-label="Đóng thông báo"
                className="relative z-10 p-1 rounded-xl text-neutral-400 hover:text-neutral-800 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition canva-tap"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Global Full-Screen Canva Loading HUD */}
      {loadingHud.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-busy="true"
          className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-md flex items-center justify-center p-4 modal-backdrop-enter"
        >
          <div className="relative overflow-hidden canva-card rounded-3xl max-w-sm w-full p-7 text-center shadow-2xl border border-purple-200 dark:border-purple-900/50 modal-card-enter space-y-4">
            {/* Animated Canva Gradient Orbital Spinner */}
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-purple-200 dark:border-purple-900/40" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#7d2ae8] border-r-[#00c4cc] animate-spin" />
              <div className="w-10 h-10 rounded-2xl canva-gradient-bg text-white flex items-center justify-center shadow-lg shadow-purple-500/30">
                <Sparkles className="w-5 h-5 animate-pulse text-amber-200" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white tracking-tight">
                {loadingHud.title}
              </h3>
              {loadingHud.subtitle && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {loadingHud.subtitle}
                </p>
              )}
            </div>

            {/* Shimmer Progress Bar */}
            <div className="w-full h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
              {typeof loadingHud.progress === 'number' ? (
                <div
                  className="h-full canva-gradient-bg rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(8, Math.min(100, loadingHud.progress))}%` }}
                />
              ) : (
                <div className="h-full w-1/2 canva-gradient-bg rounded-full loading-shimmer-bar" />
              )}
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
