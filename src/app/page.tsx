'use client';

import React, { useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { ToastProvider, useToast } from '@/components/ToastProvider';
import { Navbar, TopWorkspaceTab } from '@/components/Navbar';
import { LandingPage } from '@/components/LandingPage';
import { ExamStandardizer } from '@/components/ExamStandardizer';
import { ExamMixer } from '@/components/ExamMixer';
import { AiAuditor } from '@/components/AiAuditor';
import { ThesisDocxAuditor } from '@/components/ThesisDocxAuditor';
import { PdfOfficeStudio } from '@/components/PdfOfficeStudio';
import { AdminDashboard } from '@/components/AdminDashboard';
import { UserGuide } from '@/components/UserGuide';
import { SettingsModal } from '@/components/SettingsModal';
import { Question, ExamMetadata } from '@/types/exam';
import { SAMPLE_METADATA } from '@/lib/sample-data';
import {
  Sparkles,
  FileCheck,
  Shuffle,
  FileSpreadsheet,
  Crown,
  Lock,
  Unlock,
  KeyRound,
  BookOpen,
  Mail,
  ShieldAlert,
  GraduationCap,
  Layers,
  Clock,
  Zap,
  AlertTriangle,
  X,
} from 'lucide-react';

function TabLockedView({
  tabTitle,
  onGoToGuide,
}: {
  tabTitle: string;
  onGoToGuide: () => void;
}) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText('lenhatduy.vietnam@gmail.com');
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="max-w-xl mx-auto py-10 px-4 text-center">
      <div className="canva-card p-8 sm:p-10 space-y-6 border-2 border-amber-500/40 bg-gradient-to-b from-amber-500/10 via-white to-white dark:from-amber-500/10 dark:via-[#141622] dark:to-[#141622] shadow-xl rounded-3xl">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-500 to-rose-500 text-white mx-auto flex items-center justify-center shadow-lg shadow-amber-500/25">
          <Lock className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <ShieldAlert className="w-3.5 h-3.5" /> TÍNH NĂNG CẦN CẤP QUYỀN
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white pt-1">
            {tabTitle}
          </h2>
          <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 max-w-md mx-auto leading-relaxed">
            Tài khoản Gmail{' '}
            <strong className="text-[#7d2ae8] dark:text-purple-300 font-mono">
              {user?.email}
            </strong>{' '}
            hiện chưa được Quản trị viên mở khóa phân hệ này.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/90 border border-neutral-200 dark:border-neutral-800 text-xs space-y-2.5 text-left">
          <div className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
            <KeyRound className="w-4 h-4 text-amber-500" />
            <span>Hướng dẫn mở khóa phân hệ:</span>
          </div>
          <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
            Hệ thống AzTool phân quyền riêng từng chức năng theo Gmail. Vui lòng gửi địa chỉ Gmail của bạn cho Quản trị viên để được bật quyền ngay lập tức:
          </p>
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
            <span className="font-mono font-bold text-xs text-[#7d2ae8] dark:text-purple-300">
              lenhatduy.vietnam@gmail.com
            </span>
            <button
              onClick={handleCopyEmail}
              className="canva-btn-primary px-3.5 py-1.5 rounded-lg text-[11px] font-bold"
            >
              {copied ? '✓ Đã sao chép' : 'Sao chép Email'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <a
            href={`mailto:lenhatduy.vietnam@gmail.com?subject=Yêu%20cầu%20cấp%20quyền%20AzTool&body=Xin%20chào%20Admin,%20vui%20lòng%20cấp%20quyền%20sử%20dụng%20cho%20Gmail:%20${encodeURIComponent(
              user?.email || ''
            )}`}
            className="canva-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold shadow-md canva-tap flex items-center gap-2"
          >
            <Mail className="w-4 h-4" />
            <span>Gửi Email Yêu Cầu Mở Khóa</span>
          </a>

          <button
            onClick={onGoToGuide}
            className="canva-btn-secondary px-4 py-2.5 rounded-xl text-xs font-bold canva-tap"
          >
            Xem Quy Chuẩn Soạn Đề
          </button>
        </div>
      </div>
    </div>
  );
}

function DailyLimitModal() {
  const {
    user,
    isSuperAdmin,
    dailyLimit,
    dailyUsed,
    dailyRemaining,
    isDailyLimitReached,
    todayDateKey,
    limitModalState,
    closeLimitModal,
  } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!limitModalState?.isOpen || !user || isSuperAdmin) return null;

  const handleCopyAdminEmail = () => {
    navigator.clipboard.writeText('lenhatduy.vietnam@gmail.com');
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-[#141724] border-2 border-rose-500/40 dark:border-rose-500/40 shadow-2xl p-6 sm:p-8 text-center space-y-5">
        <button
          onClick={closeLimitModal}
          className="absolute top-4 right-4 p-2 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          aria-label="Đóng thông báo"
        >
          <X className="w-4 h-4" />
        </button>

        <div
          className={`w-16 h-16 rounded-3xl mx-auto flex items-center justify-center shadow-lg ${
            isDailyLimitReached
              ? 'bg-gradient-to-br from-rose-500 to-amber-500 text-white shadow-rose-500/30'
              : 'bg-gradient-to-br from-[#7d2ae8] to-[#00c4cc] text-white shadow-purple-500/30'
          }`}
        >
          {isDailyLimitReached ? (
            <AlertTriangle className="w-8 h-8" />
          ) : (
            <Zap className="w-8 h-8" />
          )}
        </div>

        <div className="space-y-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-black border ${
              isDailyLimitReached
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                : 'bg-purple-100 text-[#7d2ae8] dark:bg-purple-950/80 dark:text-purple-300 border-purple-300 dark:border-purple-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            {isDailyLimitReached
              ? 'ĐÃ HẾT LIMIT SỬ DỤNG TRONG NGÀY (5/5 LẦN)'
              : `HẠN MỨC SỬ DỤNG TRONG NGÀY (${dailyUsed}/${dailyLimit} LẦN)`}
          </span>

          <h3 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white">
            {isDailyLimitReached
              ? 'Bạn Đã Dùng Hết 5/5 Lượt Hôm Nay!'
              : `Còn ${dailyRemaining}/${dailyLimit} Lượt Sử Dụng Hôm Nay`}
          </h3>

          {limitModalState.featureName && isDailyLimitReached && (
            <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
              Tính năng đang gọi: {limitModalState.featureName}
            </p>
          )}

          <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
            Tài khoản Google{' '}
            <strong className="text-[#7d2ae8] dark:text-purple-300 font-mono">
              {user.email}
            </strong>{' '}
            {isDailyLimitReached ? (
              <>
                đã sử dụng hết <strong>{dailyLimit}/{dailyLimit} lần</strong> trong ngày{' '}
                <strong>{todayDateKey}</strong> (tính từ <strong>00h00 đến 23h59</strong>). Khi đã dùng quá giới hạn 5 lần/ngày, bạn không thể sử dụng thêm tính năng cho đến ngày hôm sau.
              </>
            ) : (
              <>
                được sử dụng tối đa <strong>{dailyLimit} lần/ngày</strong> (tính từ{' '}
                <strong>00h00 đến 23h59</strong>). Hiện tại bạn đã dùng{' '}
                <strong>
                  {dailyUsed}/{dailyLimit} lần
                </strong>
                .
              </>
            )}
          </p>
        </div>

        {/* Visual 5-Slot Progress */}
        <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/90 border border-neutral-200 dark:border-neutral-800 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-neutral-600 dark:text-neutral-400">
              Khung giờ tính: 00h00 – 23h59 ({todayDateKey})
            </span>
            <span
              className={
                isDailyLimitReached
                  ? 'text-rose-600 dark:text-rose-400 font-black'
                  : 'text-emerald-600 dark:text-emerald-400 font-black'
              }
            >
              Đã dùng {dailyUsed}/{dailyLimit} lượt
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map(slot => {
              const used = slot <= dailyUsed;
              return (
                <div
                  key={slot}
                  className={`h-2.5 rounded-full transition-all ${
                    used
                      ? isDailyLimitReached
                        ? 'bg-gradient-to-r from-rose-500 to-amber-500'
                        : 'bg-gradient-to-r from-[#7d2ae8] to-[#00c4cc]'
                      : 'bg-neutral-200 dark:bg-neutral-800'
                  }`}
                />
              );
            })}
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
            🔄 Hạn mức sẽ tự động reset về <strong>0/5 lượt</strong> vào đúng{' '}
            <strong>00h00 ngày mai</strong>.
          </p>
        </div>

        {/* Contact Admin Box */}
        <div className="p-3.5 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-800/60 text-left space-y-2">
          <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
            Cần cấp thêm lượt sử dụng trong ngày? Liên hệ Admin:
          </div>
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <span className="font-mono font-bold text-xs text-[#7d2ae8] dark:text-purple-300">
              lenhatduy.vietnam@gmail.com
            </span>
            <button
              type="button"
              onClick={handleCopyAdminEmail}
              className="canva-btn-primary px-3 py-1 rounded-lg text-[11px] font-bold"
            >
              {copied ? '✓ Đã chép' : 'Sao chép'}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={closeLimitModal}
            className="canva-btn-primary w-full py-3 rounded-xl text-xs font-black shadow-md canva-tap"
          >
            Đã Hiểu Thông Báo Giới Hạn (00h00 – 23h59)
          </button>
        </div>
      </div>
    </div>
  );
}

function MainApp() {
  const {
    user,
    systemConfig,
    isLoaded,
    isSuperAdmin,
    hasTabAccess,
    dailyLimit,
    dailyUsed,
    dailyRemaining,
    isDailyLimitReached,
    todayDateKey,
    openLimitModal,
  } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTabState] = useState<TopWorkspaceTab>('exam-tools');
  const [examSubTab, setExamSubTabState] = useState<'ai-audit' | 'standardize' | 'mix'>('ai-audit');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showLandingPage, setShowLandingPage] = useState(false);

  // Core Exam State
  const [examMetadata, setExamMetadata] = useState<ExamMetadata>(SAMPLE_METADATA);
  const [questions, setQuestions] = useState<Question[]>([]);

  const answeredCount = questions.filter(q => !!q.correctAnswer).length;

  const setExamSubTab = (sub: 'ai-audit' | 'standardize' | 'mix') => {
    setExamSubTabState(sub);
    if (isDailyLimitReached) {
      const label =
        sub === 'ai-audit'
          ? 'AI Kiểm Định & Soát Lỗi Đề Thi'
          : sub === 'standardize'
          ? 'Chuẩn Hóa Đề Thi 1 Chạm'
          : 'Trộn Mã Đề 25%';
      toast.error(
        'Đã hết limit 5/5 lần sử dụng hôm nay!',
        'Thời gian tính từ 00h00 đến 23h59. Bạn không thể sử dụng thêm tính năng hôm nay.'
      );
      openLimitModal(label);
    }
  };

  const setActiveTab = (tab: TopWorkspaceTab) => {
    if (tab === 'ai-audit' || tab === 'standardize' || tab === 'mix') {
      setActiveTabState('exam-tools');
      setExamSubTab(tab);
    } else {
      setActiveTabState(tab);
      if (isDailyLimitReached && tab !== 'guide' && tab !== 'admin') {
        const label =
          tab === 'exam-tools'
            ? 'Tools Soạn Đề'
            : tab === 'thesis-auditor'
            ? 'Kiểm Duyệt Đề Án & Giáo Trình Word'
            : 'Cắt & Tách Trang PDF';
        toast.error(
          'Đã hết limit 5/5 lần sử dụng hôm nay!',
          'Thời gian tính từ 00h00 đến 23h59. Bạn không thể sử dụng thêm tính năng hôm nay.'
        );
        openLimitModal(label);
      }
    }
  };

  // Show LandingPage when user is not logged in OR when user clicks "Trang Giới Thiệu"
  if (isLoaded && (!user || showLandingPage)) {
    return (
      <LandingPage
        onEnterWorkspace={() => {
          setShowLandingPage(false);
        }}
      />
    );
  }

  const canUseAudit = hasTabAccess('ai-audit');
  const canUseStandardize = hasTabAccess('standardize');
  const canUseMix = hasTabAccess('mix');
  const canUseExamTools = canUseAudit || canUseStandardize || canUseMix;
  const canUseThesisAuditor = hasTabAccess('thesis-auditor');
  const canUsePdfStudio = hasTabAccess('pdf-studio');

  const navCards = [
    {
      id: 'exam-tools' as const,
      step: 'TỔ HỢP SOẠN ĐỀ (1•2•3)',
      title: 'Tools Soạn Đề',
      desc: 'AI Soát Lỗi • Chuẩn Hóa • Trộn Đề 25%',
      icon: Layers,
      gradient: 'from-[#00c4cc] via-[#7d2ae8] to-[#ff66c4]',
      activeRing: 'ring-[#7d2ae8] border-[#7d2ae8] bg-purple-50/60 dark:bg-purple-950/30',
      unlocked: canUseExamTools,
      requirePerm: true,
    },
    {
      id: 'thesis-auditor' as const,
      step: 'ĐỀ ÁN & GIÁO TRÌNH',
      title: 'Rà Soát Đề Án Word',
      desc: 'Từ viết tắt, Danh mục Bảng & Hình ảnh',
      icon: GraduationCap,
      gradient: 'from-indigo-600 via-purple-600 to-pink-600',
      activeRing: 'ring-indigo-500 border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30',
      unlocked: canUseThesisAuditor,
      requirePerm: true,
    },
    {
      id: 'pdf-studio' as const,
      step: 'CẮT & TÁCH TRANG PDF',
      title: 'Cắt & Tách PDF',
      desc: 'Cắt theo trang Setting • Xoay • Xóa',
      icon: FileSpreadsheet,
      gradient: 'from-rose-500 via-orange-500 to-amber-500',
      activeRing: 'ring-rose-500 border-rose-500 bg-rose-50/60 dark:bg-rose-950/30',
      unlocked: canUsePdfStudio,
      requirePerm: true,
    },
    {
      id: 'guide' as const,
      step: 'TÀI LIỆU',
      title: 'Quy Chuẩn Soạn Đề',
      desc: 'Cú pháp chuẩn & Mẹo định dạng',
      icon: BookOpen,
      gradient: 'from-blue-500 to-cyan-600',
      activeRing: 'ring-blue-500 border-blue-500 bg-blue-50/60 dark:bg-blue-950/30',
      unlocked: true,
      requirePerm: false,
    },
  ];

  const examSubTabs = [
    {
      id: 'ai-audit' as const,
      step: 'BƯỚC 01',
      title: '1. AI Soát Lỗi Đề Thi',
      desc: 'Tải đề Word & Quét lỗi bằng AI',
      icon: Sparkles,
      unlocked: canUseAudit,
      gradient: 'from-[#00c4cc] to-[#7d2ae8]',
    },
    {
      id: 'standardize' as const,
      step: 'BƯỚC 02',
      title: '2. Chuẩn Hóa 1 Chạm',
      desc: 'Xuất khuôn mẫu & Đánh dấu X đỏ',
      icon: FileCheck,
      unlocked: canUseStandardize,
      gradient: 'from-emerald-500 to-teal-500',
    },
    {
      id: 'mix' as const,
      step: 'BƯỚC 03',
      title: '3. Trộn Mã Đề 25%',
      desc: 'Hoán vị câu & Cân bằng A-B-C-D',
      icon: Shuffle,
      unlocked: canUseMix,
      gradient: 'from-[#ff66c4] to-[#7d2ae8]',
    },
  ];

  return (
    <div className="min-h-screen bg-[#f4f6fb] dark:bg-[#0b0d13] text-[#0e1318] dark:text-[#f2f3f7] flex flex-col font-sans selection:bg-[#7d2ae8] selection:text-white">
      {/* Broadcast Announcement Banner */}
      {systemConfig.announcement && (
        <div className="bg-gradient-to-r from-[#7d2ae8] via-[#00c4cc] to-[#ff66c4] text-white text-xs py-1.5 px-4 text-center font-bold tracking-tight flex items-center justify-center gap-2 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 shrink-0 animate-pulse text-amber-200" />
          <span className="truncate max-w-4xl">{systemConfig.announcement}</span>
        </div>
      )}

      {/* Top Clean Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openSettings={() => setIsSettingsOpen(true)}
        onOpenLanding={() => setShowLandingPage(true)}
        questionsCount={questions.length}
        answeredCount={answeredCount}
      />

      {/* High-Contrast Feature Module Dock */}
      <section className="w-full bg-white/90 dark:bg-[#12151f]/90 border-b border-neutral-200/80 dark:border-neutral-800/80 py-4 px-4 sm:px-6 shadow-xs">
        <div className="max-w-7xl mx-auto">
          <div
            className={`grid grid-cols-2 sm:grid-cols-2 ${
              isSuperAdmin ? 'xl:grid-cols-5' : 'xl:grid-cols-4'
            } gap-2.5 sm:gap-3`}
          >
            {navCards.map(card => {
              const Icon = card.icon;
              const isActive = activeTab === card.id;
              return (
                <button
                  key={card.id}
                  onClick={() => setActiveTab(card.id)}
                  className={`group relative flex items-start gap-3 p-3.5 rounded-2xl border-2 text-left transition-all duration-200 canva-tap ${
                    isActive
                      ? `${card.activeRing} ring-2 shadow-md scale-[1.01]`
                      : 'border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171a26] hover:border-purple-400/60 dark:hover:border-purple-500/50 hover:shadow-sm'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.gradient} text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-black tracking-wider text-neutral-400 dark:text-neutral-500">
                        {card.step}
                      </span>
                      {card.requirePerm && (
                        <span
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold ${
                            card.unlocked
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                          }`}
                        >
                          {card.unlocked ? (
                            <>
                              <Unlock className="w-2.5 h-2.5" /> Mở
                            </>
                          ) : (
                            <>
                              <Lock className="w-2.5 h-2.5" /> Khóa
                            </>
                          )}
                        </span>
                      )}
                    </div>

                    <div className="text-xs sm:text-sm font-black text-neutral-900 dark:text-white truncate mt-0.5">
                      {card.title}
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                      {card.desc}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Card 5: Exclusive Admin Command Center */}
            {isSuperAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`group relative flex items-start gap-3 p-3.5 rounded-2xl border-2 text-left transition-all duration-200 canva-tap col-span-2 xl:col-span-1 ${
                  activeTab === 'admin'
                    ? 'border-amber-500 ring-2 ring-amber-500 bg-amber-50/70 dark:bg-amber-950/30 shadow-md scale-[1.01]'
                    : 'border-amber-300/70 dark:border-amber-700/50 bg-gradient-to-br from-amber-50/40 via-white to-rose-50/30 dark:from-amber-950/20 dark:via-[#171a26] dark:to-rose-950/20 hover:border-amber-500 hover:shadow-sm'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-rose-500 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                  <Crown className="w-5 h-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-black tracking-wider text-amber-600 dark:text-amber-400">
                      ADMIN DUY LÊ
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-amber-500 text-white">
                      PRO
                    </span>
                  </div>

                  <div className="text-xs sm:text-sm font-black text-neutral-900 dark:text-white truncate mt-0.5">
                    Trung Tâm Quản Trị
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                    Phân quyền &amp; Kho đề thi
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 pb-20 relative z-20 space-y-5">
        {/* Daily Usage Quota Bar (5 uses/day: 00h00 - 23h59) for Logged-in Google Users */}
        {!isSuperAdmin && user && (
          <div
            className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isDailyLimitReached
                ? 'border-rose-500/80 bg-gradient-to-r from-rose-50 via-amber-50/60 to-rose-50 dark:from-rose-950/50 dark:via-amber-950/30 dark:to-rose-950/50 shadow-md'
                : 'border-purple-200/80 dark:border-purple-900/50 bg-white dark:bg-[#151823] shadow-2xs'
            }`}
          >
            <div className="flex items-start sm:items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white shadow-xs ${
                  isDailyLimitReached
                    ? 'bg-gradient-to-br from-rose-500 to-amber-500 animate-pulse'
                    : 'bg-gradient-to-br from-[#7d2ae8] to-[#00c4cc]'
                }`}
              >
                {isDailyLimitReached ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <Zap className="w-5 h-5" />
                )}
              </div>
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs sm:text-sm font-black text-neutral-900 dark:text-white">
                    {isDailyLimitReached
                      ? `🚫 Đã hết hạn mức sử dụng trong ngày (${dailyUsed}/${dailyLimit} lần)!`
                      : `Hạn mức sử dụng miễn phí hôm nay: Đã dùng ${dailyUsed}/${dailyLimit} lần (Còn ${dailyRemaining} lần)`}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                    00h00 – 23h59 • {todayDateKey}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-600 dark:text-neutral-400">
                  {isDailyLimitReached
                    ? 'Bạn đã sử dụng đủ 5/5 lần trong ngày (tính từ 00h00 đến 23h59). Không thể sử dụng thêm tính năng hôm nay; hạn mức sẽ tự động mở lại vào 00h00 ngày mai.'
                    : 'Mỗi tài khoản Google đăng nhập được sử dụng các tính năng trên web 5 lần/ngày (tính từ 00h00 đến 23h59).'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(slot => {
                  const used = slot <= dailyUsed;
                  return (
                    <span
                      key={slot}
                      className={`w-5 h-2 rounded-full transition-all ${
                        used
                          ? isDailyLimitReached
                            ? 'bg-rose-500'
                            : 'bg-[#7d2ae8]'
                          : 'bg-neutral-200 dark:bg-neutral-800'
                      }`}
                    />
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => openLimitModal('Chi tiết hạn mức 5 lần/ngày')}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition canva-tap ${
                  isDailyLimitReached
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                    : 'bg-purple-100 dark:bg-purple-950/70 text-[#7d2ae8] dark:text-purple-300 hover:bg-purple-200'
                }`}
              >
                {isDailyLimitReached ? 'Xem Thông Báo Hết Limit' : 'Chi Tiết'}
              </button>
            </div>
          </div>
        )}

        <div key={activeTab} className="tab-enter">
          {/* TAB 1: TOOLS SOẠN ĐỀ (GỘP PHÂN HỆ 1, 2, 3) */}
          {activeTab === 'exam-tools' && (
            <div className="space-y-6">
              {/* Sub-Tab Selector Bar for Phân Hệ 1, 2, 3 */}
              <div className="canva-card p-3 sm:p-4 rounded-3xl border border-purple-200/80 dark:border-purple-900/40 bg-white dark:bg-[#151823] shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {examSubTabs.map(sub => {
                    const SubIcon = sub.icon;
                    const isSubActive = examSubTab === sub.id;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setExamSubTab(sub.id)}
                        className={`flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all canva-tap ${
                          isSubActive
                            ? 'border-[#7d2ae8] bg-purple-50/80 dark:bg-purple-950/40 shadow-sm ring-2 ring-[#7d2ae8]/20'
                            : 'border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/60 hover:border-purple-300'
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl bg-gradient-to-br ${sub.gradient} text-white flex items-center justify-center shrink-0 shadow-xs`}
                        >
                          <SubIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-black text-[#7d2ae8] dark:text-purple-300">
                              {sub.step}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                sub.unlocked
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {sub.unlocked ? 'Đã mở' : 'Khóa'}
                            </span>
                          </div>
                          <div className="text-xs sm:text-sm font-black text-neutral-900 dark:text-white truncate">
                            {sub.title}
                          </div>
                          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                            {sub.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Exam Sub-Tool Content */}
              {examSubTab === 'ai-audit' &&
                (canUseAudit ? (
                  <AiAuditor
                    examMetadata={examMetadata}
                    setExamMetadata={setExamMetadata}
                    questions={questions}
                    setQuestions={setQuestions}
                    openSettings={() => setIsSettingsOpen(true)}
                    onGoToStandardize={() => setExamSubTab('standardize')}
                    onGoToMixer={() => setExamSubTab('mix')}
                  />
                ) : (
                  <TabLockedView
                    tabTitle="Tools Soạn Đề • Bước 1: AI Kiểm Định & Soát Lỗi Đề Thi"
                    onGoToGuide={() => setActiveTab('guide')}
                  />
                ))}

              {examSubTab === 'standardize' &&
                (canUseStandardize ? (
                  <ExamStandardizer
                    examMetadata={examMetadata}
                    setExamMetadata={setExamMetadata}
                    questions={questions}
                    setQuestions={setQuestions}
                    onGoToMixer={() => setExamSubTab('mix')}
                    onGoToAiAudit={() => setExamSubTab('ai-audit')}
                  />
                ) : (
                  <TabLockedView
                    tabTitle="Tools Soạn Đề • Bước 2: Chuẩn Hóa Đề Thi & Bảng Đáp Án 1 Chạm"
                    onGoToGuide={() => setActiveTab('guide')}
                  />
                ))}

              {examSubTab === 'mix' &&
                (canUseMix ? (
                  <ExamMixer
                    examMetadata={examMetadata}
                    questions={questions}
                    onGoToAiAudit={() => setExamSubTab('ai-audit')}
                  />
                ) : (
                  <TabLockedView
                    tabTitle="Tools Soạn Đề • Bước 3: Trộn Mã Đề 25% Cân Bằng Đáp Án"
                    onGoToGuide={() => setActiveTab('guide')}
                  />
                ))}
            </div>
          )}

          {/* TAB 2: KIỂM DUYỆT ĐỀ ÁN & GIÁO TRÌNH WORD */}
          {activeTab === 'thesis-auditor' &&
            (canUseThesisAuditor ? (
              <ThesisDocxAuditor />
            ) : (
              <TabLockedView
                tabTitle="Kiểm Duyệt Đề Án & Giáo Trình (Từ viết tắt, Danh mục Bảng & Hình ảnh)"
                onGoToGuide={() => setActiveTab('guide')}
              />
            ))}

          {/* TAB 3: PDF & OFFICE STUDIO (20 CÔNG CỤ PRO) */}
          {activeTab === 'pdf-studio' &&
            (canUsePdfStudio ? (
              <PdfOfficeStudio />
            ) : (
              <TabLockedView
                tabTitle="Cắt & Tách Trang PDF Theo Trang Setting"
                onGoToGuide={() => setActiveTab('guide')}
              />
            ))}

          {/* TAB 4: TRUNG TÂM QUẢN TRỊ ADMIN */}
          {activeTab === 'admin' && isSuperAdmin && <AdminDashboard />}

          {/* TAB 5: HƯỚNG DẪN & QUY CHUẨN */}
          {activeTab === 'guide' && <UserGuide />}
        </div>
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Daily Limit Notification Modal (5 uses/day: 00h00 - 23h59) */}
      <DailyLimitModal />

      {/* SaaS Clean Footer */}
      <footer className="w-full border-t border-neutral-200/80 dark:border-neutral-800/80 bg-white/80 dark:bg-[#11131a]/80 backdrop-blur-md py-5 px-4 sm:px-6 transition-colors mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-neutral-700 dark:text-neutral-200">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00c4cc]" />
            <span>© 2026 AzTool Studio (AzTool.vercel.app). All rights reserved.</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 text-[11px] text-neutral-400">
            <button
              onClick={() => setActiveTab('guide')}
              className="hover:text-[#7d2ae8] transition font-medium"
            >
              Quy Chuẩn Soạn Đề
            </button>
            <span>•</span>
            <span>Điều Khoản Dịch Vụ</span>
            <span>•</span>
            <span>Chính Sách Bảo Mật</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Hệ Thống Hoạt Động 100%
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <ToastProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ToastProvider>
  );
}
