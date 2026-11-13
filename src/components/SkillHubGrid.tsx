'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { SpotlightCard } from '@/components/SpotlightCard';
import {
  Layers,
  GraduationCap,
  FileSpreadsheet,
  BookOpen,
  Crown,
  ArrowRight,
  Lock,
  Unlock,
  Search,
  Sparkles,
} from 'lucide-react';

export interface SkillItem {
  id: 'exam-tools' | 'thesis-auditor' | 'pdf-studio' | 'guide' | 'admin';
  title: string;
  desc: string;
  category: 'CỐT LÕI' | 'HỌC THUẬT' | 'TIỆN ÍCH' | 'TÀI LIỆU' | 'QUẢN TRỊ';
  filterGroup: 'exam' | 'academic' | 'utility' | 'admin';
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  badge?: string;
  badgeColor?: string;
  unlocked: boolean;
  requirePerm: boolean;
  tags: string[];
  stats: string;
}

interface SkillHubGridProps {
  onSelectSkill: (skillId: SkillItem['id']) => void;
  onOpenCommandPalette?: () => void;
}

export function SkillHubGrid({ onSelectSkill, onOpenCommandPalette }: SkillHubGridProps) {
  const { user, isSuperAdmin, hasTabAccess } = useAuth();
  const [filter, setFilter] = useState<'all' | 'exam' | 'academic' | 'utility'>('all');

  const canUseAudit = hasTabAccess('ai-audit');
  const canUseStandardize = hasTabAccess('standardize');
  const canUseMix = hasTabAccess('mix');
  const canUseExamTools = canUseAudit || canUseStandardize || canUseMix;
  const canUseThesisAuditor = hasTabAccess('thesis-auditor');
  const canUsePdfStudio = hasTabAccess('pdf-studio');

  const skills: SkillItem[] = [
    {
      id: 'exam-tools',
      title: 'Tổ Hợp Soạn & Trộn Đề Thi',
      desc: 'Quy trình 3 bước chuẩn sư phạm: AI rà soát lỗi câu hỏi, chuẩn hóa gạch chân/in đậm 1 chạm và trộn đề cân bằng 25% A-B-C-D.',
      category: 'CỐT LÕI',
      filterGroup: 'exam',
      icon: Layers,
      gradient: 'from-[#00c4cc] via-[#7d2ae8] to-[#ff66c4]',
      badge: 'Phổ biến nhất',
      badgeColor: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
      unlocked: canUseExamTools,
      requirePerm: true,
      tags: ['AI Soát Đề', 'Chuẩn Hóa 1 Chạm', 'Trộn 25% A-B-C-D', 'Giữ MathType'],
      stats: '⚡ ~1.2s / 50 câu',
    },
    {
      id: 'thesis-auditor',
      title: 'Rà Soát Đề Án & Giáo Trình',
      desc: 'Quét tài liệu Word hàng trăm trang: bóc tách danh mục từ viết tắt, phát hiện nhảy số hình/bảng và sửa trực tiếp không lệch dòng.',
      category: 'HỌC THUẬT',
      filterGroup: 'academic',
      icon: GraduationCap,
      gradient: 'from-indigo-600 via-purple-600 to-pink-600',
      badge: 'Độc quyền',
      badgeColor: 'bg-indigo-500 text-white',
      unlocked: canUseThesisAuditor,
      requirePerm: true,
      tags: ['Từ Viết Tắt', 'Bảng & Hình Ảnh', 'Sửa Word Gốc'],
      stats: '🎓 Chuẩn Luận án',
    },
    {
      id: 'pdf-studio',
      title: 'PDF & Cắt Tách Trang Studio',
      desc: 'Tách dải trang tùy biến (1-5, 8, 12-25), xoay hướng trang, xóa trang thừa và gộp file PDF siêu tốc ngay trên trình duyệt.',
      category: 'TIỆN ÍCH',
      filterGroup: 'utility',
      icon: FileSpreadsheet,
      gradient: 'from-rose-500 via-orange-500 to-amber-500',
      badge: 'Client-Side',
      badgeColor: 'bg-emerald-500 text-white',
      unlocked: canUsePdfStudio,
      requirePerm: true,
      tags: ['Cắt Dải Trang', 'Xoay & Xóa', 'Gộp PDF'],
      stats: '🔒 Bảo mật tại máy',
    },
    {
      id: 'guide',
      title: 'Quy Chuẩn Soạn Đề & File Mẫu',
      desc: 'Hướng dẫn cú pháp đánh dấu đáp án đúng, mẹo định dạng bảng biểu không lỗi và tải nhanh các file Word mẫu chuẩn Bộ GD&ĐT.',
      category: 'TÀI LIỆU',
      filterGroup: 'utility',
      icon: BookOpen,
      gradient: 'from-blue-500 to-cyan-500',
      unlocked: true,
      requirePerm: false,
      tags: ['Cú Pháp Chuẩn', 'File Word Mẫu', 'Mẹo Định Dạng'],
      stats: '📖 Miễn phí 100%',
    },
  ];

  if (isSuperAdmin) {
    skills.push({
      id: 'admin',
      title: 'Trung Tâm Quản Trị Hệ Thống',
      desc: 'Cấp hoặc khóa 5 quyền tính năng thời gian thực, giám sát lượt dùng hàng ngày của giáo viên, mở VIP và duyệt kho đề Cloud.',
      category: 'QUẢN TRỊ',
      filterGroup: 'admin',
      icon: Crown,
      gradient: 'from-amber-400 via-orange-500 to-rose-500',
      badge: 'Super Admin',
      badgeColor: 'bg-amber-500 text-neutral-950 font-black',
      unlocked: true,
      requirePerm: false,
      tags: ['Phân Quyền 5 Tab', 'Theo Dõi Hạn Mức', 'Kho Đề Cloud'],
      stats: '👑 Toàn quyền',
    });
  }

  const visibleSkills =
    filter === 'all'
      ? skills
      : skills.filter(s => s.filterGroup === filter);

  const filterTabs: { id: typeof filter; label: string }[] = [
    { id: 'all', label: 'Tất cả' },
    { id: 'exam', label: 'Soạn & Trộn đề' },
    { id: 'academic', label: 'Đề án Word' },
    { id: 'utility', label: 'PDF & Tài liệu' },
  ];

  return (
    <div className="space-y-5 sm:space-y-6 py-1 w-full max-w-full">
      {/* Compact, Clean Header + Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-neutral-200/80 dark:border-neutral-800/80">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-950/60 border border-purple-200/70 dark:border-purple-800/60 text-[10px] font-extrabold text-[#7d2ae8] dark:text-purple-300">
            <Sparkles className="w-3 h-3" />
            <span>KHÔNG GIAN LÀM VIỆC AZTOOL</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
            Chào {user?.displayName || 'Thầy/Cô'}, hôm nay mình xử lý gì?
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Chọn một công cụ bên dưới để bắt đầu — gọn gàng, tốc độ cao, không rườm rà.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented Filter Pills */}
          <div className="inline-flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 overflow-x-auto no-scrollbar max-w-full">
            {filterTabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                  filter === tab.id
                    ? 'bg-white dark:bg-[#1b1f30] text-[#7d2ae8] dark:text-[#00c4cc] shadow-xs'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Quick Command Trigger */}
          {onOpenCommandPalette && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#151824] text-xs font-semibold text-neutral-500 dark:text-neutral-400 hover:border-[#7d2ae8] hover:text-[#7d2ae8] dark:hover:text-[#00c4cc] transition spell-spring cursor-pointer"
              title="Mở bảng tìm nhanh tính năng (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Tìm nhanh</span>
              <kbd className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px] font-mono">
                ⌘K
              </kbd>
            </button>
          )}
        </div>
      </div>

      {/* Grid of Sleek, Spotlight-Enabled Skill Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {visibleSkills.map((skill, idx) => {
          const Icon = skill.icon;
          return (
            <SpotlightCard
              key={skill.id}
              onClick={() => onSelectSkill(skill.id)}
              style={{ animationDelay: `${idx * 55}ms` }}
              className={`spell-reveal spell-spring group p-5 sm:p-6 rounded-2xl sm:rounded-3xl border cursor-pointer flex flex-col justify-between bg-white dark:bg-[#151824] ${
                skill.unlocked
                  ? 'border-neutral-200/90 dark:border-neutral-800/90 hover:border-[#7d2ae8]/70 dark:hover:border-[#00c4cc]/60 hover:shadow-[0_14px_34px_-10px_rgba(125,42,232,0.18)]'
                  : 'border-amber-200/80 dark:border-amber-900/50 hover:border-amber-400 opacity-95'
              }`}
            >
              <div className="relative z-10 space-y-3.5">
                {/* Top Row: Icon + Title + Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br ${skill.gradient} text-white flex items-center justify-center shadow-md group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300 shrink-0`}
                    >
                      <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] font-black tracking-wider uppercase text-neutral-400 dark:text-neutral-500">
                          {skill.category}
                        </span>
                        {skill.badge && (
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide ${
                              skill.badgeColor || 'bg-purple-100 text-[#7d2ae8]'
                            }`}
                          >
                            {skill.badge}
                          </span>
                        )}
                      </div>
                      <h2 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white group-hover:text-[#7d2ae8] dark:group-hover:text-[#00c4cc] transition-colors mt-0.5 truncate">
                        {skill.title}
                      </h2>
                    </div>
                  </div>

                  {skill.requirePerm && (
                    <span
                      className={`px-2 py-1 rounded-xl text-[10px] font-extrabold flex items-center gap-1 shrink-0 ${
                        skill.unlocked
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70'
                          : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70'
                      }`}
                    >
                      {skill.unlocked ? (
                        <>
                          <Unlock className="w-3 h-3 text-emerald-500" />
                          <span className="hidden sm:inline">Đã mở</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3 h-3 text-amber-500" />
                          <span className="hidden sm:inline">Khóa</span>
                        </>
                      )}
                    </span>
                  )}
                </div>

                {/* Concise Description */}
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed line-clamp-2">
                  {skill.desc}
                </p>

                {/* Compact Capability Pills */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {skill.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-neutral-100/90 dark:bg-white/[0.05] text-neutral-700 dark:text-neutral-300 border border-neutral-200/60 dark:border-white/[0.06]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Card Footer */}
              <div className="relative z-10 pt-3.5 mt-4 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between">
                <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400">
                  {skill.stats}
                </span>

                <div className="inline-flex items-center gap-1.5 text-xs font-black text-[#7d2ae8] dark:text-[#00c4cc]">
                  <span>Mở công cụ</span>
                  <div className="w-6 h-6 rounded-full bg-purple-50 dark:bg-purple-950/70 flex items-center justify-center group-hover:translate-x-1 group-hover:bg-[#7d2ae8] group-hover:text-white dark:group-hover:bg-[#00c4cc] dark:group-hover:text-neutral-950 transition-all">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </SpotlightCard>
          );
        })}
      </div>
    </div>
  );
}
