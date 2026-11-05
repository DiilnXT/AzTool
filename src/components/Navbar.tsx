'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { DeQLogo } from '@/components/DeQLogo';
import {
  FileText,
  Shuffle,
  Sparkles,
  Crown,
  Settings,
  LogIn,
  LogOut,
  BookOpen,
  Plus,
  Home,
  Sun,
  Moon,
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'standardize' | 'mix' | 'ai-audit' | 'admin' | 'guide';
  setActiveTab: (tab: 'standardize' | 'mix' | 'ai-audit' | 'admin' | 'guide') => void;
  openSettings: () => void;
  onOpenLanding?: () => void;
  questionsCount?: number;
  answeredCount?: number;
}

export function Navbar({
  activeTab,
  setActiveTab,
  openSettings,
  onOpenLanding,
  questionsCount = 0,
  answeredCount = 0,
}: NavbarProps) {
  const { user, isSuperAdmin, theme, toggleTheme, loginWithRealGoogleOAuth, logout } = useAuth();

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
    <>
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 w-full bg-white/95 dark:bg-[#181920]/95 backdrop-blur-md border-b border-neutral-200/80 dark:border-neutral-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-3">
          {/* Left: Animated Calligraphy AzTool Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => (onOpenLanding ? onOpenLanding() : setActiveTab('ai-audit'))}
              className="flex items-center gap-2 group canva-tap text-left"
              title="Về trang chủ AzTool"
            >
              <DeQLogo size="sm" showSubtitle />
            </button>

            {/* Desktop Navigation Tabs */}
            <nav
              aria-label="Menu chính"
              className="hidden lg:flex items-center gap-1 ml-3 pl-3 border-l border-neutral-200 dark:border-neutral-800 text-xs font-semibold"
            >
              <button
                onClick={() => setActiveTab('ai-audit')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all duration-200 canva-tap ${
                  activeTab === 'ai-audit'
                    ? 'bg-purple-100/80 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 shadow-2xs'
                    : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>1. Tải Đề &amp; AI Soát Lỗi</span>
                {questionsCount > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      answeredCount === questionsCount
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {answeredCount}/{questionsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('standardize')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all duration-200 canva-tap ${
                  activeTab === 'standardize'
                    ? 'bg-purple-100/80 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 shadow-2xs'
                    : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>2. Xuất Khuôn Chuẩn</span>
              </button>

              <button
                onClick={() => setActiveTab('mix')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all duration-200 canva-tap ${
                  activeTab === 'mix'
                    ? 'bg-purple-100/80 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 shadow-2xs'
                    : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <Shuffle className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>3. Trộn Mã Đề</span>
              </button>

              <button
                onClick={() => setActiveTab('guide')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all duration-200 canva-tap ${
                  activeTab === 'guide'
                    ? 'bg-purple-100/80 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300'
                    : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <BookOpen className="w-4 h-4 text-neutral-500" />
                <span>Hướng Dẫn</span>
              </button>

              {isSuperAdmin && (
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all duration-200 canva-tap ${
                    activeTab === 'admin'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                  }`}
                >
                  <Crown className="w-4 h-4" />
                  <span>Quản Trị</span>
                </button>
              )}
            </nav>
          </div>

          {/* Right: Actions + Theme + Settings + User Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {onOpenLanding && (
              <button
                onClick={onOpenLanding}
                className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200/90 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold transition canva-tap"
                title="Trang giới thiệu AzTool"
              >
                <Home className="w-3.5 h-3.5 text-[#7d2ae8]" />
                <span>Trang Chủ</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('ai-audit')}
              className="canva-btn-primary px-3.5 sm:px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md canva-tap"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nạp Đề Mới</span>
              <span className="sm:hidden">Nạp Đề</span>
            </button>

            {/* Quick Light / Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-neutral-200/90 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition canva-tap"
              title={theme === 'dark' ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-neutral-600" />
              )}
            </button>

            {/* Personal Settings Button */}
            <button
              onClick={openSettings}
              className="p-2 rounded-xl border border-neutral-200/90 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition canva-tap"
              title="Tùy chỉnh tên hiển thị & giao diện"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* User Profile / Sign-in */}
            {user ? (
              <div className="flex items-center gap-2 pl-1">
                <button
                  onClick={openSettings}
                  className="flex items-center gap-2 rounded-full pr-1 sm:pr-2 py-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition canva-tap"
                  title="Đổi tên hiển thị & giao diện"
                >
                  <img
                    src={
                      user.photoURL ||
                      `https://api.dicebear.com/7.x/initials/svg?seed=${user.email}`
                    }
                    alt=""
                    className="w-8 h-8 rounded-full border-2 border-purple-500 object-cover"
                  />
                  <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 hidden xl:inline max-w-[120px] truncate">
                    {user.displayName}
                  </span>
                </button>
                <button
                  onClick={logout}
                  className="p-1.5 rounded-xl text-neutral-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition canva-tap"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleLoginClick}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 text-neutral-700 dark:text-neutral-200 dark:border-neutral-800 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition canva-tap"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Đăng Nhập</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Dock */}
      <nav
        aria-label="Điều hướng di động"
        className="lg:hidden fixed bottom-3 left-3 right-3 z-50 bg-white/95 dark:bg-[#181920]/95 backdrop-blur-md rounded-2xl p-1.5 border border-neutral-200 dark:border-neutral-800 shadow-xl flex items-center justify-around gap-1 text-[11px] font-semibold"
      >
        <button
          onClick={() => setActiveTab('ai-audit')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-xl transition canva-tap ${
            activeTab === 'ai-audit'
              ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
              : 'text-neutral-500'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span className="text-[9px] mt-0.5">Soát Lỗi</span>
        </button>

        <button
          onClick={() => setActiveTab('standardize')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-xl transition canva-tap ${
            activeTab === 'standardize'
              ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
              : 'text-neutral-500'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span className="text-[9px] mt-0.5">Chuẩn Hóa</span>
        </button>

        <button
          onClick={() => setActiveTab('mix')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-xl transition canva-tap ${
            activeTab === 'mix'
              ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
              : 'text-neutral-500'
          }`}
        >
          <Shuffle className="w-4 h-4" />
          <span className="text-[9px] mt-0.5">Trộn Đề</span>
        </button>

        <button
          onClick={() => setActiveTab('guide')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-xl transition canva-tap ${
            activeTab === 'guide'
              ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
              : 'text-neutral-500'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span className="text-[9px] mt-0.5">Hướng Dẫn</span>
        </button>

        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-xl transition canva-tap ${
              activeTab === 'admin'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                : 'text-neutral-500'
            }`}
          >
            <Crown className="w-4 h-4" />
            <span className="text-[9px] mt-0.5">Quản Trị</span>
          </button>
        )}
      </nav>
    </>
  );
}
