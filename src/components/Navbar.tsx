'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { DeQLogo } from '@/components/DeQLogo';
import {
  Crown,
  Settings,
  LogIn,
  LogOut,
  Home,
  Sun,
  Moon,
  CheckCircle2,
  ShieldCheck,
  Zap,
  AlertTriangle,
  LayoutGrid,
} from 'lucide-react';

export type TopWorkspaceTab =
  | 'hub'
  | 'exam-tools'
  | 'thesis-auditor'
  | 'pdf-studio'
  | 'admin'
  | 'guide'
  | 'standardize'
  | 'mix'
  | 'ai-audit';

interface NavbarProps {
  activeTab: TopWorkspaceTab;
  setActiveTab: (tab: TopWorkspaceTab) => void;
  openSettings: () => void;
  onOpenLanding?: () => void;
  onOpenHub?: () => void;
  questionsCount?: number;
  answeredCount?: number;
}

export function Navbar({
  activeTab,
  setActiveTab,
  openSettings,
  onOpenLanding,
  onOpenHub,
  questionsCount = 0,
  answeredCount = 0,
}: NavbarProps) {
  const {
    user,
    isSuperAdmin,
    theme,
    toggleTheme,
    dailyLimit,
    dailyUsed,
    dailyRemaining,
    isDailyLimitReached,
    openLimitModal,
    loginWithRealGoogleOAuth,
    logout,
  } = useAuth();

  const handleLoginClick = async () => {
    try {
      const ok = await loginWithRealGoogleOAuth();
      if (!ok && onOpenLanding) {
        onOpenLanding();
      }
    } catch {
      if (onOpenLanding) onOpenLanding();
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 dark:bg-[#11131a]/95 backdrop-blur-xl border-b border-neutral-200/80 dark:border-neutral-800/90 shadow-2xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Left: Brand Logo & Status Pill */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => (onOpenLanding ? onOpenLanding() : setActiveTab('ai-audit'))}
            className="flex items-center gap-2 group canva-tap text-left"
            title="Về trang giới thiệu AzTool"
          >
            <DeQLogo size="sm" showSubtitle />
          </button>

          {questionsCount > 0 && (
            <div className="hidden md:flex items-center gap-1.5 ml-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>
                Đang nạp: <strong>{questionsCount}</strong> câu ({answeredCount} có đáp án)
              </span>
            </div>
          )}
        </div>

        {/* Right: Quick Controls & User Profile */}
        <div className="flex items-center gap-2">
          {/* Button: Kho Tính Năng / Hub */}
          {onOpenHub && (
            <button
              onClick={onOpenHub}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition canva-tap ${
                activeTab === 'hub'
                  ? 'border-[#7d2ae8] bg-purple-50 dark:bg-purple-950/60 text-[#7d2ae8] dark:text-purple-300 ring-2 ring-[#7d2ae8]/20'
                  : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-200 hover:border-[#7d2ae8]'
              }`}
              title="Danh mục các công cụ & tính năng"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-[#7d2ae8]" />
              <span className="hidden sm:inline">Kho Tính Năng</span>
            </button>
          )}

          {onOpenLanding && (
            <button
              onClick={onOpenLanding}
              className="hidden md:flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-200 hover:border-[#7d2ae8] text-xs font-bold transition canva-tap"
              title="Trang giới thiệu AzTool"
            >
              <Home className="w-3.5 h-3.5 text-[#00c4cc]" />
              <span>Trang Chủ</span>
            </button>
          )}

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Đổi giao diện Sáng / Tối"
            title={theme === 'dark' ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-200 hover:border-[#7d2ae8] text-xs font-bold transition canva-tap"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="hidden lg:inline">Sáng</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-indigo-600" />
                <span className="hidden lg:inline">Tối</span>
              </>
            )}
          </button>

          {/* Settings Button */}
          <button
            onClick={openSettings}
            aria-label="Mở tùy chỉnh"
            title={isSuperAdmin ? 'Cấu hình AI & Hệ thống' : 'Tùy chỉnh hiển thị cá nhân'}
            className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-600 dark:text-neutral-300 hover:text-[#7d2ae8] hover:border-[#7d2ae8] transition canva-tap"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* User Account */}
          {user ? (
            <div className="flex items-center gap-2 pl-2 border-l border-neutral-200 dark:border-neutral-800">
              {/* Live Daily Quota Pill (5 uses/day: 00h00 - 23h59) */}
              {!isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => openLimitModal('Kiểm tra hạn mức sử dụng trong ngày')}
                  title="Giới hạn 5 lượt sử dụng miễn phí / ngày (Tính từ 00h00 đến 23h59)"
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-black transition canva-tap ${
                    isDailyLimitReached
                      ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-300 animate-pulse'
                      : dailyRemaining <= 1
                      ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                      : 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800 text-[#7d2ae8] dark:text-purple-300'
                  }`}
                >
                  {isDailyLimitReached ? (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span>Hết limit: {dailyUsed}/{dailyLimit}</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>
                        Hôm nay: {dailyUsed}/{dailyLimit} lượt
                      </span>
                    </>
                  )}
                </button>
              )}

              <button
                onClick={() => (isSuperAdmin ? setActiveTab('admin') : openSettings())}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-2xl bg-neutral-100/80 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 hover:border-[#7d2ae8]/50 transition canva-tap text-left"
              >
                <img
                  src={
                    user.photoURL ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${user.email}`
                  }
                  alt={user.displayName}
                  className="w-7 h-7 rounded-xl border border-purple-300 dark:border-purple-700 object-cover"
                />
                <div className="hidden sm:block">
                  <div className="text-xs font-black text-neutral-900 dark:text-white leading-tight max-w-[130px] truncate">
                    {user.displayName}
                  </div>
                  <div className="text-[10px] font-bold flex items-center gap-1 mt-0.5">
                    {isSuperAdmin ? (
                      <span className="text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                        <Crown className="w-2.5 h-2.5" /> ADMIN TỐI THƯỢNG
                      </span>
                    ) : isDailyLimitReached ? (
                      <span className="text-rose-600 dark:text-rose-400 flex items-center gap-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" /> Hết lượt (00h-23h59)
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                        <ShieldCheck className="w-2.5 h-2.5" /> Còn {dailyRemaining}/{dailyLimit} lượt hôm nay
                      </span>
                    )}
                  </div>
                </div>
              </button>

              <button
                onClick={logout}
                aria-label="Đăng xuất"
                title="Đăng xuất tài khoản"
                className="p-2 rounded-xl text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition canva-tap"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLoginClick}
              className="canva-btn-primary flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl shadow-xs canva-tap"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Đăng Nhập</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
