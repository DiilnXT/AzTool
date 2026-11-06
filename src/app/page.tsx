'use client';

import React, { useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { ToastProvider } from '@/components/ToastProvider';
import { Navbar } from '@/components/Navbar';
import { LandingPage } from '@/components/LandingPage';
import { ExamStandardizer } from '@/components/ExamStandardizer';
import { ExamMixer } from '@/components/ExamMixer';
import { AiAuditor } from '@/components/AiAuditor';
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
  CheckCircle2,
  ShieldAlert,
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

function MainApp() {
  const { user, systemConfig, isLoaded, isSuperAdmin, hasTabAccess } = useAuth();
  const [activeTab, setActiveTab] = useState<
    'standardize' | 'mix' | 'ai-audit' | 'pdf-studio' | 'admin' | 'guide'
  >('ai-audit');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showLandingPage, setShowLandingPage] = useState(false);

  // Core Exam State
  const [examMetadata, setExamMetadata] = useState<ExamMetadata>(SAMPLE_METADATA);
  const [questions, setQuestions] = useState<Question[]>([]);

  const answeredCount = questions.filter(q => !!q.correctAnswer).length;

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
  const canUsePdfStudio = hasTabAccess('pdf-studio');

  const navCards = [
    {
      id: 'ai-audit' as const,
      step: 'PHÂN HỆ 01',
      title: 'AI Soát Lỗi Đề Thi',
      desc: 'Tải đề Word & Quét lỗi bằng AI',
      icon: Sparkles,
      gradient: 'from-[#00c4cc] to-[#7d2ae8]',
      activeRing: 'ring-[#7d2ae8] border-[#7d2ae8] bg-purple-50/60 dark:bg-purple-950/30',
      unlocked: canUseAudit,
      requirePerm: true,
    },
    {
      id: 'standardize' as const,
      step: 'PHÂN HỆ 02',
      title: 'Chuẩn Hóa 1 Chạm',
      desc: 'Xuất khuôn mẫu & Đánh dấu X đỏ',
      icon: FileCheck,
      gradient: 'from-emerald-500 to-teal-500',
      activeRing: 'ring-emerald-500 border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30',
      unlocked: canUseStandardize,
      requirePerm: true,
    },
    {
      id: 'mix' as const,
      step: 'PHÂN HỆ 03',
      title: 'Trộn Mã Đề 25%',
      desc: 'Hoán vị câu & Cân bằng A-B-C-D',
      icon: Shuffle,
      gradient: 'from-[#ff66c4] to-[#7d2ae8]',
      activeRing: 'ring-purple-500 border-purple-500 bg-purple-50/60 dark:bg-purple-950/30',
      unlocked: canUseMix,
      requirePerm: true,
    },
    {
      id: 'pdf-studio' as const,
      step: 'PHÂN HỆ 04',
      title: 'PDF & Office Studio',
      desc: 'Đổi PDF/Word/Excel/PPT & Sửa PDF',
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
      gradient: 'from-blue-500 to-indigo-600',
      activeRing: 'ring-blue-500 border-blue-500 bg-blue-50/60 dark:bg-blue-950/30',
      unlocked: true,
      requirePerm: false,
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
            className={`grid grid-cols-2 sm:grid-cols-3 ${
              isSuperAdmin ? 'xl:grid-cols-6' : 'xl:grid-cols-5'
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
                className={`group relative flex items-start gap-3 p-3.5 rounded-2xl border-2 text-left transition-all duration-200 canva-tap col-span-2 lg:col-span-1 ${
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
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 pb-20 relative z-20">
        <div key={activeTab} className="tab-enter">
          {activeTab === 'ai-audit' &&
            (canUseAudit ? (
              <AiAuditor
                examMetadata={examMetadata}
                setExamMetadata={setExamMetadata}
                questions={questions}
                setQuestions={setQuestions}
                openSettings={() => setIsSettingsOpen(true)}
                onGoToStandardize={() => setActiveTab('standardize')}
                onGoToMixer={() => setActiveTab('mix')}
              />
            ) : (
              <TabLockedView
                tabTitle="Phân Hệ 01: AI Kiểm Định & Soát Lỗi Đề Thi"
                onGoToGuide={() => setActiveTab('guide')}
              />
            ))}

          {activeTab === 'standardize' &&
            (canUseStandardize ? (
              <ExamStandardizer
                examMetadata={examMetadata}
                setExamMetadata={setExamMetadata}
                questions={questions}
                setQuestions={setQuestions}
                onGoToMixer={() => setActiveTab('mix')}
                onGoToAiAudit={() => setActiveTab('ai-audit')}
              />
            ) : (
              <TabLockedView
                tabTitle="Phân Hệ 02: Chuẩn Hóa Đề Thi & Bảng Đáp Án 1 Chạm"
                onGoToGuide={() => setActiveTab('guide')}
              />
            ))}

          {activeTab === 'mix' &&
            (canUseMix ? (
              <ExamMixer
                examMetadata={examMetadata}
                questions={questions}
                onGoToAiAudit={() => setActiveTab('ai-audit')}
              />
            ) : (
              <TabLockedView
                tabTitle="Phân Hệ 03: Trộn Mã Đề 25% Cân Bằng Đáp Án"
                onGoToGuide={() => setActiveTab('guide')}
              />
            ))}

          {activeTab === 'pdf-studio' &&
            (canUsePdfStudio ? (
              <PdfOfficeStudio />
            ) : (
              <TabLockedView
                tabTitle="Phân Hệ 04: PDF & Office Studio (14 Công Cụ Chuyển Đổi & Chỉnh Sửa PDF)"
                onGoToGuide={() => setActiveTab('guide')}
              />
            ))}

          {activeTab === 'admin' && isSuperAdmin && <AdminDashboard />}

          {activeTab === 'guide' && <UserGuide />}
        </div>
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

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
