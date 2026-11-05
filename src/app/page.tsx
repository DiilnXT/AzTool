'use client';

import React, { useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { ToastProvider } from '@/components/ToastProvider';
import { Navbar } from '@/components/Navbar';
import { LandingPage } from '@/components/LandingPage';
import { ExamStandardizer } from '@/components/ExamStandardizer';
import { ExamMixer } from '@/components/ExamMixer';
import { AiAuditor } from '@/components/AiAuditor';
import { AdminDashboard } from '@/components/AdminDashboard';
import { UserGuide } from '@/components/UserGuide';
import { SettingsModal } from '@/components/SettingsModal';
import { Question, ExamMetadata } from '@/types/exam';
import { SAMPLE_METADATA } from '@/lib/sample-data';
import {
  Sparkles,
  FileCheck,
  Shuffle,
  Crown,
  Lock,
  KeyRound,
  BookOpen,
  Mail,
  CheckCircle2,
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
    <div className="max-w-xl mx-auto py-12 px-4 text-center">
      <div className="canva-card p-8 sm:p-10 space-y-6 border-2 border-amber-500/30 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent shadow-xl rounded-3xl">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center border border-amber-500/20 shadow-inner">
          <Lock className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200">
            CHƯA ĐƯỢC CẤP QUYỀN
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white">
            {tabTitle}
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto leading-relaxed">
            Tài khoản <strong className="text-neutral-900 dark:text-neutral-100">{user?.email}</strong> hiện chưa được Quản trị viên kích hoạt quyền sử dụng phân hệ này.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-neutral-100/70 dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 text-xs space-y-2 text-left">
          <div className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
            <KeyRound className="w-4 h-4 text-amber-500" />
            <span>Cách kích hoạt quyền sử dụng:</span>
          </div>
          <p className="text-neutral-500 dark:text-neutral-400 text-[11px] leading-relaxed">
            Vui lòng gửi email đến Quản trị viên hệ thống AzTool kèm địa chỉ Gmail của bạn để được cấp quyền mở khóa phân hệ này.
          </p>
          <div className="pt-1 flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
            <span className="font-mono font-bold text-xs text-[#7d2ae8]">
              lenhatduy.vietnam@gmail.com
            </span>
            <button
              onClick={handleCopyEmail}
              className="canva-btn-primary px-3 py-1 rounded-lg text-[10px] font-bold"
            >
              {copied ? 'Đã chép!' : 'Sao chép'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <a
            href="mailto:lenhatduy.vietnam@gmail.com?subject=Yêu%20cầu%20cấp%20quyền%20sử%20dụng%20AzTool&body=Kính%20gửi%20Admin%20Duy,%0A%0ATôi%20muốn%20được%20cấp%20quyền%20sử%20dụng%20các%20phân%20hệ%20AzTool%20cho%20tài%20khoản%20Gmail:%20"
            className="canva-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold shadow-md canva-tap flex items-center gap-2"
          >
            <Mail className="w-4 h-4" />
            <span>Gửi Email Yêu Cầu Cấp Quyền</span>
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
  const [activeTab, setActiveTab] = useState<'standardize' | 'mix' | 'ai-audit' | 'admin' | 'guide'>('ai-audit');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showLandingPage, setShowLandingPage] = useState(false);

  // Core Exam State
  const [examMetadata, setExamMetadata] = useState<ExamMetadata>(SAMPLE_METADATA);
  const [questions, setQuestions] = useState<Question[]>([]);

  const answeredCount = questions.filter(q => !!q.correctAnswer).length;

  // Show LandingPage when user is not logged in OR when user clicks "Trang Chủ"
  if (isLoaded && (!user || showLandingPage)) {
    return (
      <LandingPage
        onEnterWorkspace={() => {
          setShowLandingPage(false);
        }}
      />
    );
  }

  // Permission checks
  const canUseAudit = hasTabAccess('ai-audit');
  const canUseStandardize = hasTabAccess('standardize');
  const canUseMix = hasTabAccess('mix');

  return (
    <div className="min-h-screen bg-[#f8f9fc] dark:bg-[#0c0d12] text-[#0e1318] dark:text-[#f2f3f7] flex flex-col font-sans selection:bg-[#7d2ae8] selection:text-white">
      {/* Broadcast Announcement Banner */}
      {systemConfig.announcement && (
        <div className="bg-gradient-to-r from-[#7d2ae8] via-[#00c4cc] to-[#ff66c4] text-white text-[11px] py-1.5 px-4 text-center font-bold tracking-tight flex items-center justify-center gap-2 shadow-xs">
          <Sparkles className="w-3 h-3 shrink-0 animate-pulse text-amber-200" />
          <span className="truncate max-w-3xl">{systemConfig.announcement}</span>
        </div>
      )}

      {/* Main Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openSettings={() => setIsSettingsOpen(true)}
        onOpenLanding={() => setShowLandingPage(true)}
        questionsCount={questions.length}
        answeredCount={answeredCount}
      />

      {/* Sleek, Compact Workspace Control Bar (No giant distracting banner) */}
      <div className="w-full bg-white dark:bg-[#12141c] border-b border-neutral-200/80 dark:border-neutral-800/80 px-4 sm:px-6 py-2.5 shadow-2xs sticky top-16 z-30">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left: Tab Switcher */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
            {/* Tab 1: AI Soát Lỗi */}
            <button
              onClick={() => setActiveTab('ai-audit')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition canva-tap whitespace-nowrap ${
                activeTab === 'ai-audit'
                  ? 'bg-white dark:bg-neutral-800 text-[#7d2ae8] dark:text-purple-300 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#00c4cc]" />
              <span>1. Tải Đề &amp; AI Soát Lỗi</span>
              {!canUseAudit && <Lock className="w-3 h-3 text-amber-500" />}
            </button>

            {/* Tab 2: Chuẩn Hóa 1 Chạm */}
            <button
              onClick={() => setActiveTab('standardize')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition canva-tap whitespace-nowrap ${
                activeTab === 'standardize'
                  ? 'bg-white dark:bg-neutral-800 text-[#7d2ae8] dark:text-purple-300 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>2. Chuẩn Hóa 1 Chạm</span>
              {!canUseStandardize && <Lock className="w-3 h-3 text-amber-500" />}
            </button>

            {/* Tab 3: Trộn Mã Đề */}
            <button
              onClick={() => setActiveTab('mix')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition canva-tap whitespace-nowrap ${
                activeTab === 'mix'
                  ? 'bg-white dark:bg-neutral-800 text-[#7d2ae8] dark:text-purple-300 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Shuffle className="w-3.5 h-3.5 text-purple-600" />
              <span>3. Trộn Mã Đề 25%</span>
              {!canUseMix && <Lock className="w-3 h-3 text-amber-500" />}
            </button>

            {/* Tab 4: Hướng Dẫn */}
            <button
              onClick={() => setActiveTab('guide')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition canva-tap whitespace-nowrap ${
                activeTab === 'guide'
                  ? 'bg-white dark:bg-neutral-800 text-[#7d2ae8] dark:text-purple-300 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-neutral-500" />
              <span>4. Hướng Dẫn Soạn Đề</span>
            </button>

            {/* Tab 5: Admin */}
            {isSuperAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition canva-tap whitespace-nowrap ${
                  activeTab === 'admin'
                    ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-xs'
                    : 'text-amber-600 hover:text-amber-700 dark:text-amber-400'
                }`}
              >
                <Crown className="w-3.5 h-3.5" />
                <span>👑 Quản Trị Hệ Thống</span>
              </button>
            )}
          </div>

          {/* Right: Quick Status */}
          <div className="flex items-center gap-2 text-xs">
            {questions.length > 0 && (
              <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{questions.length} câu ({answeredCount} có đáp án)</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 pb-20 relative z-20">
        <div key={activeTab} className="tab-enter">
          {activeTab === 'ai-audit' && (
            canUseAudit ? (
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
                tabTitle="Phân Hệ: AI Kiểm Định & Soát Lỗi Đề Thi"
                onGoToGuide={() => setActiveTab('guide')}
              />
            )
          )}

          {activeTab === 'standardize' && (
            canUseStandardize ? (
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
                tabTitle="Phân Hệ: Chuẩn Hóa Đề Thi & Bảng Đáp Án 1 Chạm"
                onGoToGuide={() => setActiveTab('guide')}
              />
            )
          )}

          {activeTab === 'mix' && (
            canUseMix ? (
              <ExamMixer
                examMetadata={examMetadata}
                questions={questions}
                onGoToAiAudit={() => setActiveTab('ai-audit')}
              />
            ) : (
              <TabLockedView
                tabTitle="Phân Hệ: Trộn Mã Đề 25% Cân Bằng Đáp Án"
                onGoToGuide={() => setActiveTab('guide')}
              />
            )
          )}

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
      <footer className="w-full border-t border-neutral-200/80 dark:border-neutral-800/80 bg-white/70 dark:bg-neutral-950/70 backdrop-blur-md py-6 px-4 sm:px-6 transition-colors mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-neutral-700 dark:text-neutral-200">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00c4cc]" />
            <span>© 2026 AzTool Studio (AzTool.vercel.app). All rights reserved.</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 text-[11px] text-neutral-400">
            <button
              onClick={() => setActiveTab('guide')}
              className="hover:text-[#7d2ae8] transition"
            >
              Quy Chuẩn Soạn Đề
            </button>
            <span>•</span>
            <span className="text-neutral-400">Điều Khoản Dịch Vụ</span>
            <span>•</span>
            <span className="text-neutral-400">Chính Sách Bảo Mật</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
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
