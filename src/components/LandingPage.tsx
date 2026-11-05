'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ToastProvider';
import { DeQLogo } from '@/components/DeQLogo';
import {
  Sparkles,
  FileCheck,
  Shuffle,
  ArrowRight,
  Wand2,
  Layers,
  Sun,
  Moon,
  ShieldCheck,
  Zap,
  LayoutGrid,
  FileSpreadsheet,
  Presentation,
  Bot,
  Mail,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface LandingPageProps {
  onEnterWorkspace: () => void;
}

export function LandingPage({ onEnterWorkspace }: LandingPageProps) {
  const {
    user,
    theme,
    toggleTheme,
    loginWithGoogle,
    loginWithRealGoogleOAuth,
  } = useAuth();
  const toast = useToast();

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');

  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    try {
      const ok = await loginWithRealGoogleOAuth();
      if (ok) {
        toast.success(
          'Đăng nhập thành công!',
          'Chào mừng bạn đến với không gian làm việc thông minh AzTool Studio.'
        );
        confetti({ particleCount: 55, spread: 65 });
        onEnterWorkspace();
      }
    } catch {
      // If browser blocks third-party popup or origin not yet propagated, show clean Google Email Sign-In dialog
      setShowEmailModal(true);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    await loginWithGoogle(emailInput.trim(), nameInput.trim() || undefined);
    toast.success(
      'Đăng nhập thành công!',
      `Xin chào ${nameInput.trim() || emailInput.trim()}`
    );
    confetti({ particleCount: 50, spread: 60 });
    setShowEmailModal(false);
    onEnterWorkspace();
  };

  return (
    <div className="min-h-screen bg-[#f7f8fd] dark:bg-[#0f1015] text-[#0e1318] dark:text-[#f2f3f7] flex flex-col font-sans selection:bg-[#7d2ae8] selection:text-white overflow-x-hidden">
      {/* Top Glass Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#181920]/90 backdrop-blur-md border-b border-neutral-200/80 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 sm:h-18 flex items-center justify-between gap-3">
          <DeQLogo size="md" showSubtitle />

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 hover:border-[#7d2ae8] transition canva-tap"
              title={theme === 'dark' ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-neutral-600" />
              )}
            </button>

            {user ? (
              <button
                type="button"
                onClick={onEnterWorkspace}
                className="canva-btn-primary px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md canva-tap"
              >
                <span>Mở Không Gian Làm Việc</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoggingIn}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm hover:shadow-md hover:border-[#7d2ae8] text-xs font-bold text-neutral-800 dark:text-white transition canva-tap"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                  />
                </svg>
                <span>Đăng Nhập</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section with Calligraphy AzTool Animation */}
      <section className="relative overflow-hidden canva-gradient-header text-white pt-12 sm:pt-18 pb-20 sm:pb-28 px-4 sm:px-8">
        <div className="absolute -top-16 right-12 w-96 h-96 bg-[#00c4cc]/25 rounded-full blur-3xl pointer-events-none canva-ambient-glow" />
        <div className="absolute -bottom-20 left-10 w-96 h-96 bg-[#ff66c4]/20 rounded-full blur-3xl pointer-events-none canva-ambient-glow" />

        <div className="max-w-5xl mx-auto text-center relative z-10 space-y-6">
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold text-white">
              <Sparkles className="w-3.5 h-3.5 text-[#00c4cc]" />
              <span>Hệ Sinh Thái Công Cụ Số &amp; Trí Tuệ Nhân Tạo Đa Năng</span>
            </div>

            <div className="pt-2">
              <DeQLogo size="xl" showSubtitle={false} />
            </div>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight max-w-4xl mx-auto canva-gradient-text-hero">
            Nền tảng tự động hóa tài liệu, khảo thí &amp; trợ lý AI thế hệ mới
          </h1>

          <p className="text-xs sm:text-base text-purple-100/90 max-w-2xl mx-auto leading-relaxed font-normal px-2">
            Tối ưu hóa quy trình biên soạn, rà soát lỗi chuyên môn bằng AI, chuẩn hóa tài liệu Word chỉ với 1 chạm và mở rộng không giới hạn cùng kho công cụ thông minh trên <strong>AzTool</strong>.
          </p>

          {/* Primary Call to Action Buttons */}
          <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-lg sm:max-w-none mx-auto">
            {!user ? (
              <>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoggingIn}
                  className="w-full sm:w-auto flex items-center justify-center gap-3 px-7 py-4 rounded-2xl bg-white text-neutral-900 font-black text-sm shadow-2xl hover:scale-[1.02] transition canva-tap"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                    />
                  </svg>
                  <span>Đăng Nhập Bằng Google</span>
                </button>

                <button
                  type="button"
                  onClick={onEnterWorkspace}
                  className="w-full sm:w-auto canva-btn-primary px-7 py-4 rounded-2xl text-sm font-black flex items-center justify-center gap-2 shadow-xl canva-tap border border-white/25"
                >
                  <span>Trải Nghiệm Ngay</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onEnterWorkspace}
                className="w-full sm:w-auto canva-btn-primary px-8 py-4 rounded-2xl text-sm font-black flex items-center justify-center gap-2.5 shadow-2xl canva-tap border border-white/25"
              >
                <span>Vào Không Gian Làm Việc AzTool</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Trust & Platform Badges */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs text-purple-200/85">
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-[#00c4cc]" />
              <span>Xử lý tức thì trên trình duyệt</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Bảo toàn 100% định dạng tài liệu gốc</span>
            </div>
            <div className="flex items-center gap-1.5">
              <LayoutGrid className="w-4 h-4 text-[#ff66c4]" />
              <span>Tương thích hoàn hảo Laptop &amp; Điện thoại</span>
            </div>
          </div>
        </div>
      </section>

      {/* AzTool Multi-App Ecosystem Section */}
      <section className="max-w-6xl w-full mx-auto px-4 sm:px-8 -mt-12 pb-16 relative z-20 space-y-10">
        {/* Active Suite Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div
            onClick={onEnterWorkspace}
            className="canva-card-interactive p-6 space-y-3 border border-purple-100 dark:border-purple-900/40 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00c4cc] to-[#7d2ae8] text-white flex items-center justify-center shadow-md">
                <Wand2 className="w-6 h-6" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                Đang Hoạt Động
              </span>
            </div>
            <h3 className="text-base font-black text-neutral-900 dark:text-white">
              AI Thẩm Định &amp; Soát Lỗi Đề Thi
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Tự động phát hiện câu hỏi sai đề, câu thiếu đáp án đúng, câu chọn nhầm đáp án hoặc trùng lặp phương án. Đề xuất 3 phiên bản sửa chuẩn sư phạm chỉ với 1 chạm.
            </p>
          </div>

          <div
            onClick={onEnterWorkspace}
            className="canva-card-interactive p-6 space-y-3 border border-emerald-100 dark:border-emerald-900/40 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-[#00c4cc] text-white flex items-center justify-center shadow-md">
                <FileCheck className="w-6 h-6" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                Đang Hoạt Động
              </span>
            </div>
            <h3 className="text-base font-black text-neutral-900 dark:text-white">
              Chuẩn Hóa Đề Word 1 Chạm
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Nhận diện đáp án thông minh từ mọi định dạng (in đậm, gạch chân, bảng đáp án X). Tự động xuất bản Sinh viên và bản Giảng viên giữ nguyên 100% tiêu đề gốc.
            </p>
          </div>

          <div
            onClick={onEnterWorkspace}
            className="canva-card-interactive p-6 space-y-3 border border-pink-100 dark:border-pink-900/40 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#ff66c4] to-[#7d2ae8] text-white flex items-center justify-center shadow-md">
                <Shuffle className="w-6 h-6" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                Đang Hoạt Động
              </span>
            </div>
            <h3 className="text-base font-black text-neutral-900 dark:text-white">
              Trộn Mã Đề Cân Bằng 25%
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Thuật toán hoán vị thông minh phân bổ đều 25% đáp án A-B-C-D, tự động điền mã đề, đánh dấu phiếu trả lời và đóng gói trọn bộ file nén ZIP.
            </p>
          </div>
        </div>

        {/* Upcoming Modules in AzTool Ecosystem */}
        <div className="canva-card p-6 sm:p-8 border border-neutral-200/80 dark:border-neutral-800 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#7d2ae8] dark:text-purple-400">
                Hệ Sinh Thái Mở Rộng
              </span>
              <h2 className="text-lg sm:text-xl font-black text-neutral-900 dark:text-white">
                Kho Công Cụ Thông Minh AzTool Sắp Ra Mắt
              </h2>
            </div>
            <span className="text-xs text-neutral-500">
              Liên tục cập nhật các tiện ích tự động hóa mới
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-neutral-50/80 dark:bg-neutral-900/60 border border-neutral-200/70 dark:border-neutral-800 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-[#7d2ae8] dark:text-purple-300 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <span>Tạo Đề Từ Giáo Trình PDF</span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-100 text-[#7d2ae8] dark:bg-purple-950 dark:text-purple-300">
                    Sắp mở
                  </span>
                </div>
                <p className="text-neutral-500 leading-relaxed">
                  Tải giáo trình PDF/Word để AI tự động trích xuất ngân hàng câu hỏi theo ma trận mức độ nhận thức.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-50/80 dark:bg-neutral-900/60 border border-neutral-200/70 dark:border-neutral-800 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <span>Chấm Phiếu &amp; Thống Kê Điểm</span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
                    Sắp mở
                  </span>
                </div>
                <p className="text-neutral-500 leading-relaxed">
                  Tự động đối chiếu bảng đáp án các mã đề, xuất báo cáo phổ điểm và phân tích độ khó từng câu hỏi.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-50/80 dark:bg-neutral-900/60 border border-neutral-200/70 dark:border-neutral-800 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-pink-100 dark:bg-pink-950/60 text-pink-600 dark:text-pink-300 flex items-center justify-center shrink-0">
                <Presentation className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <span>AzTool Slide &amp; Docx Studio</span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-pink-100 text-pink-600 dark:bg-pink-950 dark:text-pink-300">
                    Sắp mở
                  </span>
                </div>
                <p className="text-neutral-500 leading-relaxed">
                  Chuyển đổi tài liệu thô sang bài thuyết trình chuyên nghiệp và chuẩn hóa văn bản hành chính tự động.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Clean, Professional SaaS Footer */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#181920] py-8 text-xs text-neutral-500 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 font-bold text-neutral-800 dark:text-neutral-200">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00c4cc]" />
            <span>© 2026 AzTool Studio (AzTool.vercel.app). All rights reserved.</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-5 text-[11px] text-neutral-400">
            <span className="hover:text-[#7d2ae8] cursor-pointer transition">Điều khoản dịch vụ</span>
            <span className="hover:text-[#7d2ae8] cursor-pointer transition">Chính sách bảo mật</span>
            <span className="hover:text-[#7d2ae8] cursor-pointer transition">Hướng dẫn sử dụng</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Hệ thống hoạt động ổn định
            </span>
          </div>
        </div>
      </footer>

      {/* Fallback Clean Google Account Sign-In Dialog (No keys or technical info exposed) */}
      {showEmailModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowEmailModal(false)}
          className="fixed inset-0 z-[120] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 modal-backdrop-enter"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="canva-card rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-purple-200 dark:border-purple-900/50 modal-card-enter"
          >
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl canva-gradient-bg text-white flex items-center justify-center shadow-xs">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white">
                    Đăng Nhập Tài Khoản AzTool
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Nhập địa chỉ Gmail của bạn để tiếp tục vào không gian làm việc
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEmailModal(false)}
                className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 transition canva-tap"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEmailContinue} className="space-y-3.5 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block">
                  Địa chỉ Email Google:
                </label>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  placeholder="tenban@gmail.com"
                  className="w-full p-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7d2ae8]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block">
                  Tên hiển thị (Tùy chọn):
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  placeholder="VD: Nguyễn Văn A"
                  className="w-full p-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7d2ae8]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="canva-btn-secondary px-4 py-2.5 rounded-xl font-semibold canva-tap"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="canva-btn-primary px-6 py-2.5 rounded-xl font-bold shadow-sm canva-tap"
                >
                  Tiếp Tục
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
