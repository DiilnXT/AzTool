'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Sparkles,
  FileCheck,
  Shuffle,
  GraduationCap,
  FileSpreadsheet,
  BookOpen,
  Crown,
  LayoutGrid,
  Sun,
  Moon,
  Settings,
  Home,
  ArrowRight,
  X,
  Command,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { TopWorkspaceTab } from '@/components/Navbar';

interface CommandItem {
  id: string;
  label: string;
  desc: string;
  group: 'CÔNG CỤ' | 'SOẠN ĐỀ' | 'HỆ THỐNG';
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: TopWorkspaceTab) => void;
  setExamSubTab?: (sub: 'ai-audit' | 'standardize' | 'mix') => void;
  openSettings: () => void;
  onOpenLanding?: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  setActiveTab,
  setExamSubTab,
  openSettings,
  onOpenLanding,
}: CommandPaletteProps) {
  const { isSuperAdmin, theme, toggleTheme } = useAuth();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  const commands: CommandItem[] = [
    {
      id: 'hub',
      label: 'Kho Tính Năng (Skill Hub)',
      desc: 'Xem toàn bộ danh mục công cụ gọn gàng',
      group: 'CÔNG CỤ',
      icon: LayoutGrid,
      iconBg: 'from-[#7d2ae8] to-[#00c4cc]',
      action: () => setActiveTab('hub'),
    },
    {
      id: 'ai-audit',
      label: 'AI Soát Lỗi Đề Thi',
      desc: 'Kiểm tra đáp án, trùng phương án & chính tả',
      group: 'SOẠN ĐỀ',
      icon: Sparkles,
      iconBg: 'from-[#7d2ae8] to-indigo-600',
      action: () => {
        setActiveTab('exam-tools');
        setExamSubTab?.('ai-audit');
      },
    },
    {
      id: 'standardize',
      label: 'Chuẩn Hóa Đề Word 1 Chạm',
      desc: 'Tự nhận diện gạch chân, in đậm & xuất bảng đáp án',
      group: 'SOẠN ĐỀ',
      icon: FileCheck,
      iconBg: 'from-[#00c4cc] to-blue-600',
      action: () => {
        setActiveTab('exam-tools');
        setExamSubTab?.('standardize');
      },
    },
    {
      id: 'mix',
      label: 'Trộn Mã Đề Cân Bằng 25%',
      desc: 'Hoán vị câu hỏi & phân bổ đều A-B-C-D',
      group: 'SOẠN ĐỀ',
      icon: Shuffle,
      iconBg: 'from-fuchsia-600 to-pink-500',
      action: () => {
        setActiveTab('exam-tools');
        setExamSubTab?.('mix');
      },
    },
    {
      id: 'thesis-auditor',
      label: 'Rà Soát Đề Án & Giáo Trình',
      desc: 'Quét từ viết tắt, danh mục bảng biểu & hình ảnh',
      group: 'CÔNG CỤ',
      icon: GraduationCap,
      iconBg: 'from-indigo-600 to-purple-600',
      action: () => setActiveTab('thesis-auditor'),
    },
    {
      id: 'pdf-studio',
      label: 'PDF & Cắt Tách Trang Studio',
      desc: 'Cắt trang, xoay, xóa & gộp PDF siêu tốc tại máy',
      group: 'CÔNG CỤ',
      icon: FileSpreadsheet,
      iconBg: 'from-rose-500 to-amber-500',
      action: () => setActiveTab('pdf-studio'),
    },
    {
      id: 'guide',
      label: 'Quy Chuẩn Soạn Đề & File Mẫu',
      desc: 'Hướng dẫn định dạng chuẩn & tải mẫu Word',
      group: 'CÔNG CỤ',
      icon: BookOpen,
      iconBg: 'from-blue-500 to-cyan-500',
      action: () => setActiveTab('guide'),
    },
    ...(isSuperAdmin
      ? [
          {
            id: 'admin',
            label: 'Trung Tâm Quản Trị (Super Admin)',
            desc: 'Phân quyền giáo viên, hạn mức ngày & kho đề',
            group: 'HỆ THỐNG' as const,
            icon: Crown,
            iconBg: 'from-amber-400 to-rose-500',
            action: () => setActiveTab('admin'),
          },
        ]
      : []),
    {
      id: 'theme',
      label: theme === 'dark' ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối',
      desc: 'Đổi chế độ hiển thị Sáng / Tối tức thì',
      group: 'HỆ THỐNG',
      icon: theme === 'dark' ? Sun : Moon,
      iconBg: 'from-neutral-600 to-neutral-800',
      action: () => toggleTheme(),
    },
    {
      id: 'settings',
      label: 'Tùy Chỉnh & Cấu Hình',
      desc: 'Cài đặt hiển thị và cấu hình cá nhân',
      group: 'HỆ THỐNG',
      icon: Settings,
      iconBg: 'from-slate-600 to-slate-800',
      action: () => openSettings(),
    },
    ...(onOpenLanding
      ? [
          {
            id: 'landing',
            label: 'Về Trang Giới Thiệu (Landing Page)',
            desc: 'Xem trang chủ giới thiệu AzTool Studio',
            group: 'HỆ THỐNG' as const,
            icon: Home,
            iconBg: 'from-emerald-500 to-teal-600',
            action: () => onOpenLanding(),
          },
        ]
      : []),
  ];

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? commands.filter(
        c =>
          c.label.toLowerCase().includes(normalizedQuery) ||
          c.desc.toLowerCase().includes(normalizedQuery) ||
          c.group.toLowerCase().includes(normalizedQuery)
      )
    : commands;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (filtered.length ? (prev + 1) % filtered.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (filtered.length ? (prev - 1 + filtered.length) % filtered.length : 0));
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault();
        filtered[selectedIndex].action();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mở nhanh tính năng"
      onClick={onClose}
      className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-md flex items-start justify-center pt-[10vh] sm:pt-[14vh] p-3.5 modal-backdrop-enter"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-xl rounded-2xl sm:rounded-3xl bg-white/95 dark:bg-[#121524]/95 backdrop-blur-2xl border border-neutral-200 dark:border-white/15 shadow-[0_25px_70px_rgba(0,0,0,0.4)] overflow-hidden modal-card-enter"
      >
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-neutral-200/80 dark:border-white/10">
          <Search className="w-4.5 h-4.5 text-[#7d2ae8] dark:text-[#00c4cc] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Tìm nhanh công cụ (VD: Trộn đề, Chuẩn hóa, PDF, Đề án...)"
            className="flex-1 bg-transparent text-sm text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[55vh] overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-xs text-neutral-400">
              Không tìm thấy chức năng phù hợp với &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-purple-50 dark:bg-white/10 ring-1 ring-[#7d2ae8]/40 dark:ring-[#00c4cc]/40'
                      : 'hover:bg-neutral-50 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl bg-gradient-to-br ${item.iconBg} text-white flex items-center justify-center shrink-0 shadow-xs`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white truncate">
                          {item.label}
                        </span>
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-white/10 text-neutral-500 dark:text-neutral-400 shrink-0">
                          {item.group}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                  <ArrowRight
                    className={`w-4 h-4 shrink-0 transition-transform ${
                      isSelected
                        ? 'text-[#7d2ae8] dark:text-[#00c4cc] translate-x-0.5 opacity-100'
                        : 'text-neutral-300 opacity-0'
                    }`}
                  />
                </button>
              );
            })
          )}
        </div>

        {/* Footer Hint */}
        <div className="px-4 py-2.5 border-t border-neutral-200/80 dark:border-white/10 bg-neutral-50/80 dark:bg-white/[0.02] flex items-center justify-between text-[10px] text-neutral-400">
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-white/10 border border-neutral-200 dark:border-white/10 font-mono text-[9px]">
                ↑↓
              </kbd>
              Di chuyển
            </span>
            <span className="hidden sm:inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-white/10 border border-neutral-200 dark:border-white/10 font-mono text-[9px]">
                Enter
              </kbd>
              Mở ngay
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-white/10 border border-neutral-200 dark:border-white/10 font-mono text-[9px]">
                Esc
              </kbd>
              Đóng
            </span>
          </div>
          <span className="inline-flex items-center gap-1 font-semibold text-[#7d2ae8] dark:text-[#00c4cc]">
            <Command className="w-3 h-3" />
            <span>AzTool Quick Jump</span>
          </span>
        </div>
      </div>
    </div>
  );
}
