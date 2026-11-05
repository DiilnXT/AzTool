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
  Cpu,
} from 'lucide-react';

function MainApp() {
  const { user, systemConfig, isLoaded } = useAuth();
  const [activeTab, setActiveTab] = useState<'standardize' | 'mix' | 'ai-audit' | 'admin' | 'guide'>('ai-audit');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showLandingPage, setShowLandingPage] = useState(false);

  // Core Exam State — Initialized to EMPTY [] so no sample questions clutter the screen on load!
  const [examMetadata, setExamMetadata] = useState<ExamMetadata>(SAMPLE_METADATA);
  const [questions, setQuestions] = useState<Question[]>([]);

  const answeredCount = questions.filter(q => !!q.correctAnswer).length;

  // Show LandingPage when user is not logged in OR when user clicks "Trang Chủ" / Logo
  if (isLoaded && (!user || showLandingPage)) {
    return (
      <LandingPage
        onEnterWorkspace={() => {
          setShowLandingPage(false);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fd] dark:bg-[#0f1015] text-[#0e1318] dark:text-[#f2f3f7] flex flex-col font-sans selection:bg-[#7d2ae8] selection:text-white">
      {/* Broadcast Announcement Banner */}
      {systemConfig.announcement && (
        <div className="canva-gradient-bg text-white text-[11px] py-2 px-4 text-center font-bold tracking-tight flex items-center justify-center gap-2 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 shrink-0 animate-pulse text-amber-200" />
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

      {/* Canva Iconic Hero Banner: "Hôm nay bạn muốn soạn đề thi gì?" */}
      <section className="relative overflow-hidden canva-gradient-header text-white pt-10 sm:pt-14 pb-16 sm:pb-20 px-4 sm:px-6">
        {/* Canva Colorful Ambient Aurora Blobs */}
        <div className="absolute top-0 right-10 w-96 h-96 bg-[#00c4cc]/20 rounded-full blur-3xl pointer-events-none canva-ambient-glow" />
        <div className="absolute -bottom-10 left-10 w-96 h-96 bg-[#ff66c4]/15 rounded-full blur-3xl pointer-events-none canva-ambient-glow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-64 bg-[#7d2ae8]/30 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10 space-y-5">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold text-white shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#00c4cc] animate-pulse" />
            <span>Khảo Thí ĐH Cửu Long • Chuẩn 100% Khuôn Mẫu Gốc</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight canva-gradient-text-hero">
            Hôm nay bạn muốn soạn đề thi gì?
          </h1>

          <p className="text-xs sm:text-sm text-purple-200/90 font-normal max-w-2xl mx-auto leading-relaxed">
            Hệ thống tự động đọc đáp án in đậm &amp; bảng đánh dấu [X], chuẩn hóa 1 chạm theo đúng quy chuẩn ĐH Cửu Long, kiểm tra lỗi bằng Gemini AI và trộn mã đề cân bằng tỷ lệ 25%.
          </p>

          {/* Canva Signature Quick Apps Feature Carousel / Pills */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3 max-w-4xl mx-auto">
            {/* Quick App 1: AI Soát Lỗi */}
            <button
              onClick={() => setActiveTab('ai-audit')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition shadow-sm canva-tap ${
                activeTab === 'ai-audit'
                  ? 'bg-white text-[#7d2ae8] shadow-lg shadow-purple-900/40 scale-105'
                  : 'bg-white/15 hover:bg-white/25 text-white backdrop-blur-md border border-white/15'
              }`}
            >
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#00c4cc] to-[#7d2ae8] text-white flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span>1. AI Soát Lỗi Đề</span>
            </button>

            {/* Quick App 2: Xuất Khuôn Chuẩn */}
            <button
              onClick={() => setActiveTab('standardize')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition shadow-sm canva-tap ${
                activeTab === 'standardize'
                  ? 'bg-white text-[#7d2ae8] shadow-lg shadow-purple-900/40 scale-105'
                  : 'bg-white/15 hover:bg-white/25 text-white backdrop-blur-md border border-white/15'
              }`}
            >
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#10b981] to-[#00c4cc] text-white flex items-center justify-center">
                <FileCheck className="w-3.5 h-3.5" />
              </div>
              <span>2. Xuất Khuôn Mẫu Gốc</span>
            </button>

            {/* Quick App 3: Trộn Mã Đề */}
            <button
              onClick={() => setActiveTab('mix')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition shadow-sm canva-tap ${
                activeTab === 'mix'
                  ? 'bg-white text-[#7d2ae8] shadow-lg shadow-purple-900/40 scale-105'
                  : 'bg-white/15 hover:bg-white/25 text-white backdrop-blur-md border border-white/15'
              }`}
            >
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#ff66c4] to-[#7d2ae8] text-white flex items-center justify-center">
                <Shuffle className="w-3.5 h-3.5" />
              </div>
              <span>3. Trộn Mã Đề 25%</span>
            </button>

            {/* Quick App 4: Cài Đặt Gemini */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition bg-white/15 hover:bg-white/25 text-white backdrop-blur-md border border-white/15 shadow-sm canva-tap"
            >
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-400 to-rose-500 text-white flex items-center justify-center">
                <Cpu className="w-3.5 h-3.5" />
              </div>
              <span>Cài Đặt Gemini Model</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 -mt-8 sm:-mt-10 pb-28 sm:pb-14 relative z-20">
        <div key={activeTab} className="tab-enter">
          {activeTab === 'ai-audit' && (
            <AiAuditor
              examMetadata={examMetadata}
              setExamMetadata={setExamMetadata}
              questions={questions}
              setQuestions={setQuestions}
              openSettings={() => setIsSettingsOpen(true)}
              onGoToStandardize={() => setActiveTab('standardize')}
              onGoToMixer={() => setActiveTab('mix')}
            />
          )}

          {activeTab === 'standardize' && (
            <ExamStandardizer
              examMetadata={examMetadata}
              setExamMetadata={setExamMetadata}
              questions={questions}
              setQuestions={setQuestions}
              onGoToMixer={() => setActiveTab('mix')}
              onGoToAiAudit={() => setActiveTab('ai-audit')}
            />
          )}

          {activeTab === 'mix' && (
            <ExamMixer
              examMetadata={examMetadata}
              questions={questions}
              onGoToAiAudit={() => setActiveTab('ai-audit')}
            />
          )}

          {activeTab === 'admin' && <AdminDashboard />}

          {activeTab === 'guide' && <UserGuide />}
        </div>
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Canva Style Footer */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#181920] py-8 text-center text-xs text-neutral-500 mt-auto">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00c4cc]" />
            <span>AzTool Studio (AzTool.vercel.app) • Chuẩn Hóa &amp; Khảo Thí Đại học Cửu Long</span>
          </div>

          <div className="flex items-center gap-1 text-[11px]">
            <span>
              Admin Tối Thượng:{' '}
              <strong className="text-purple-600 dark:text-purple-400">
                lenhatduy.vietnam@gmail.com
              </strong>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <ToastProvider>
        <MainApp />
      </ToastProvider>
    </AuthProvider>
  );
}
