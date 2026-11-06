'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { DeQLogo } from '@/components/DeQLogo';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  subtitle?: string;
  progress?: number;
}

interface ToastContextType {
  toast: (options: Omit<ToastItem, 'id'> & { duration?: number }) => string;
  success: (title: string, subtitle?: string) => void;
  error: (title: string, subtitle?: string) => void;
  warning: (title: string, subtitle?: string) => void;
  info: (title: string, subtitle?: string) => void;
  showLoading: (title: string, subtitle?: string, progress?: number) => void;
  hideLoading: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [activeLoading, setActiveLoading] = useState<{
    title: string;
    subtitle?: string;
    progress?: number;
  } | null>(null);
  const [displayProgress, setDisplayProgress] = useState<number>(0);

  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Smoothly creep displayProgress between milestones so % never looks frozen
  useEffect(() => {
    if (!activeLoading) {
      setDisplayProgress(0);
      return;
    }
    if (typeof activeLoading.progress === 'number') {
      setDisplayProgress(prev => Math.max(prev, Math.min(99, Math.round(activeLoading.progress!))));
    } else {
      setDisplayProgress(prev => (prev < 12 ? 12 : prev));
    }

    const interval = setInterval(() => {
      setDisplayProgress(prev => {
        const targetCap =
          typeof activeLoading.progress === 'number'
            ? Math.min(98, activeLoading.progress + 8)
            : 92;
        if (prev < targetCap) {
          return prev + 1;
        }
        return prev;
      });
    }, 320);

    return () => clearInterval(interval);
  }, [activeLoading]);

  const removeToast = useCallback((id: string) => {
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback(
    ({
      type,
      title,
      subtitle,
      progress,
      duration = 4000,
    }: Omit<ToastItem, 'id'> & { duration?: number }) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts(prev => [{ id, type, title, subtitle, progress }, ...prev.slice(0, 3)]);

      if (duration > 0) {
        timersRef.current[id] = setTimeout(() => {
          removeToast(id);
        }, duration);
      }
      return id;
    },
    [removeToast]
  );

  const success = useCallback(
    (title: string, subtitle?: string) => {
      setActiveLoading(null);
      toast({ type: 'success', title, subtitle, duration: 4000 });
    },
    [toast]
  );

  const error = useCallback(
    (title: string, subtitle?: string) => {
      setActiveLoading(null);
      toast({ type: 'error', title, subtitle, duration: 5500 });
    },
    [toast]
  );

  const warning = useCallback(
    (title: string, subtitle?: string) => {
      toast({ type: 'warning', title, subtitle, duration: 4500 });
    },
    [toast]
  );

  const info = useCallback(
    (title: string, subtitle?: string) => {
      toast({ type: 'info', title, subtitle, duration: 3800 });
    },
    [toast]
  );

  const showLoading = useCallback((title: string, subtitle?: string, progress?: number) => {
    setActiveLoading({ title, subtitle, progress });
  }, []);

  const hideLoading = useCallback(() => {
    setActiveLoading(null);
  }, []);

  return (
    <ToastContext.Provider
      value={{
        toast,
        success,
        error,
        warning,
        info,
        showLoading,
        hideLoading,
      }}
    >
      {children}

      {/* CENTERED FULLSCREEN LOADING MODAL HUD (On Laptop & Mobile) */}
      {activeLoading && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-white/95 dark:bg-[#131624]/95 border-2 border-[#7d2ae8]/50 shadow-[0_24px_80px_-12px_rgba(125,42,232,0.45)] p-7 sm:p-8 flex flex-col items-center text-center gap-4 overflow-hidden">
            {/* Ambient top glow bar */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#00c4cc] via-[#7d2ae8] to-[#ff66c4]" />

            {/* Animated Calligraphy Logo + Orbiting Ring */}
            <div className="relative flex items-center justify-center pt-1">
              <DeQLogo size="lg" showSubtitle={false} isLoadingMode />
            </div>

            {/* Big Prominent Percentage Counter */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#00c4cc] via-[#7d2ae8] to-[#ff66c4] text-white font-mono text-base sm:text-lg font-black shadow-lg shadow-purple-500/25">
              <span>ĐANG XỬ LÝ • {displayProgress}%</span>
            </div>

            {/* Title & Subtitle */}
            <div className="space-y-1.5 max-w-sm">
              <h4 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white leading-snug">
                {activeLoading.title}
              </h4>
              {activeLoading.subtitle && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {activeLoading.subtitle}
                </p>
              )}
            </div>

            {/* Wide Smooth Gradient Progress Bar */}
            <div className="w-full space-y-1.5 pt-1">
              <div className="w-full h-3 rounded-full bg-neutral-100 dark:bg-neutral-800/90 p-0.5 overflow-hidden shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#00c4cc] via-[#7d2ae8] to-[#ff66c4] transition-all duration-200 ease-out"
                  style={{
                    width: `${Math.max(6, Math.min(100, displayProgress))}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold text-neutral-400 px-1">
                <span>AzTool Pro Engine</span>
                <span className="font-mono text-[#7d2ae8] dark:text-purple-300">{displayProgress}% / 100%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top-Right Compact Notification Stack */}
      <div className="fixed top-16 right-4 z-[140] flex flex-col items-end gap-2.5 w-full max-w-sm pointer-events-none px-2 sm:px-0">
        {/* Toast Messages */}
        {toasts.map(item => {
          const styleMap = {
            success: {
              border: 'border-emerald-500/35',
              iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
              icon: <CheckCircle2 className="w-4 h-4" />,
            },
            error: {
              border: 'border-rose-500/40',
              iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
              icon: <XCircle className="w-4 h-4" />,
            },
            warning: {
              border: 'border-amber-500/40',
              iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
              icon: <AlertTriangle className="w-4 h-4" />,
            },
            info: {
              border: 'border-[#00c4cc]/40',
              iconBg: 'bg-[#00c4cc]/10 text-[#00c4cc]',
              icon: <Info className="w-4 h-4" />,
            },
            loading: {
              border: 'border-[#7d2ae8]/40',
              iconBg: 'bg-[#7d2ae8]/10 text-[#7d2ae8]',
              icon: <Info className="w-4 h-4" />,
            },
          }[item.type];

          return (
            <div
              key={item.id}
              className={`pointer-events-auto w-full rounded-2xl bg-white/95 dark:bg-[#141724]/95 backdrop-blur-xl border ${styleMap.border} shadow-xl p-3 flex items-start gap-2.5 transition-all duration-200`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${styleMap.iconBg}`}
              >
                {styleMap.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100 leading-snug">
                  {item.title}
                </p>
                {item.subtitle && (
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed mt-0.5">
                    {item.subtitle}
                  </p>
                )}
              </div>
              <button
                onClick={() => removeToast(item.id)}
                className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-1 rounded-lg transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
