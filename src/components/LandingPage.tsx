'use client';

import React, { useState } from 'react';
import { useAuth, SUPER_ADMIN_EMAIL } from '@/lib/auth-context';
import { useToast } from '@/components/ToastProvider';
import { DeQLogo } from '@/components/DeQLogo';
import {
  Sparkles,
  FileCheck,
  Shuffle,
  ShieldCheck,
  ArrowRight,
  KeyRound,
  CheckCircle2,
  Wand2,
  ExternalLink,
  Copy,
  Check,
  Crown,
  X,
  HelpCircle,
  Layers,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface LandingPageProps {
  onEnterWorkspace: () => void;
}

export function LandingPage({ onEnterWorkspace }: LandingPageProps) {
  const {
    user,
    systemConfig,
    updateSystemConfig,
    loginWithGoogle,
    loginWithRealGoogleOAuth,
  } = useAuth();
  const toast = useToast();

  const [showGoogleGuideModal, setShowGoogleGuideModal] = useState(false);
  const [clientIdInput, setClientIdInput] = useState(systemConfig.googleClientId || '');
  const [customEmailInput, setCustomEmailInput] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [copiedOrigin, setCopiedOrigin] = useState(false);

  const currentOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const handleRealGoogleLogin = async () => {
    const activeClientId = (clientIdInput || systemConfig.googleClientId || '').trim();

    if (!activeClientId) {
      // Open the interactive Google OAuth & Quick Login dialog so the user can either paste Client ID or 1-click sign in
      setShowGoogleGuideModal(true);
      return;
    }

    setIsLoggingIn(true);
    try {
      if (clientIdInput.trim() && clientIdInput.trim() !== systemConfig.googleClientId) {
        updateSystemConfig({ googleClientId: clientIdInput.trim() });
      }
      const ok = await loginWithRealGoogleOAuth(activeClientId);
      if (ok) {
        toast.success(
          'Đăng nhập Google thành công!',
          'Chào mừng bạn đến với không gian khảo thí thông minh AzTool Studio.'
        );
        confetti({ particleCount: 60, spread: 70 });
        setShowGoogleGuideModal(false);
        onEnterWorkspace();
      }
    } catch (err: any) {
      toast.error('Lỗi xác thực Google OAuth', err.message || String(err));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleQuickAdminLogin = async (email?: string, name?: string) => {
    await loginWithGoogle(
      email || SUPER_ADMIN_EMAIL,
      name || 'Lê Nhật Duy (Admin Tối Thượng)'
    );
    toast.success(
      'Đã đăng nhập thành công!',
      `Xin chào ${email || SUPER_ADMIN_EMAIL} • Quyền hạn: Admin Tối Thượng`
    );
    confetti({ particleCount: 55, spread: 65 });
    setShowGoogleGuideModal(false);
    onEnterWorkspace();
  };

  const handleCopyOrigin = () => {
    navigator.clipboard.writeText(currentOrigin);
    setCopiedOrigin(true);
    toast.info('Đã sao chép URI!', `Đã lưu ${currentOrigin} vào bộ nhớ tạm.`);
    setTimeout(() => setCopiedOrigin(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#f7f8fd] dark:bg-[#0f1015] text-[#0e1318] dark:text-[#f2f3f7] flex flex-col font-sans selection:bg-[#7d2ae8] selection:text-white overflow-x-hidden">
      {/* Canva Top Glass Header */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#181920]/90 backdrop-blur-md border-b border-neutral-200/80 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-18 flex items-center justify-between gap-4">
          <DeQLogo size="md" showSubtitle />

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowGoogleGuideModal(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-950/40 text-[#7d2ae8] dark:text-purple-300 text-xs font-bold hover:bg-purple-100 transition canva-tap"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Cấu hình / Hướng dẫn lấy Key Google</span>
            </button>

            {user ? (
              <button
                type="button"
                onClick={onEnterWorkspace}
                className="canva-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md canva-tap"
              >
                <span>Vào Studio Làm Việc</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRealGoogleLogin}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm hover:shadow-md hover:border-[#7d2ae8] text-xs font-bold text-neutral-800 dark:text-white transition canva-tap"
              >
                {/* Official Google G SVG */}
                <svg className="w-4 h-4" viewBox="0 0 24 24">
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
            )}
          </div>
        </div>
      </header>

      {/* Hero Section with Calligraphy DeQ Animation */}
      <section className="relative overflow-hidden canva-gradient-header text-white pt-14 sm:pt-20 pb-20 sm:pb-28 px-4 sm:px-8">
        <div className="absolute -top-16 right-12 w-96 h-96 bg-[#00c4cc]/25 rounded-full blur-3xl pointer-events-none canva-ambient-glow" />
        <div className="absolute -bottom-20 left-10 w-96 h-96 bg-[#ff66c4]/20 rounded-full blur-3xl pointer-events-none canva-ambient-glow" />

        <div className="max-w-5xl mx-auto text-center relative z-10 space-y-6">
          {/* Animated Calligraphy Logo Centerpiece */}
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold text-white">
              <Sparkles className="w-3.5 h-3.5 text-[#00c4cc]" />
              <span>Nền Tảng Chuẩn Hóa &amp; Thẩm Định Đề Thi Trắc Nghiệm AI Thế Hệ Mới</span>
            </div>

            <div className="pt-2">
              <DeQLogo size="xl" showSubtitle={false} />
            </div>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight max-w-4xl mx-auto canva-gradient-text-hero">
            Thiết kế, Soát lỗi &amp; Trộn đề thi chuẩn 100% chỉ với 1 chạm
          </h1>

          <p className="text-sm sm:text-base text-purple-100/90 max-w-2xl mx-auto leading-relaxed font-normal">
            Tự động nhận diện đáp án in đậm &amp; bảng đánh dấu [X], rà soát câu hỏi sai đề / thiếu đáp án đúng bằng <strong>Google Gemini AI</strong>, giữ nguyên 100% tiêu đề gốc của <strong>Trường Đại Học Cửu Long</strong> và trộn mã đề cân bằng tỷ lệ 25% A-B-C-D.
          </p>

          {/* Primary Call to Action Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              type="button"
              onClick={handleRealGoogleLogin}
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
              <span>Tiếp Tục Với Google (OAuth 2.0 Thật)</span>
            </button>

            <button
              type="button"
              onClick={onEnterWorkspace}
              className="w-full sm:w-auto canva-btn-primary px-7 py-4 rounded-2xl text-sm font-black flex items-center justify-center gap-2 shadow-xl canva-tap border border-white/25"
            >
              <span>Mở Trình Soạn Thảo Đề Ngay</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Sub-links for Admin Quick Login & OAuth Setup Guide */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-purple-200">
            <button
              type="button"
              onClick={() => handleQuickAdminLogin()}
              className="inline-flex items-center gap-1.5 underline decoration-purple-300/60 hover:text-white font-semibold transition"
            >
              <Crown className="w-3.5 h-3.5 text-amber-300" />
              <span>Đăng nhập nhanh Admin Tối Thượng ({SUPER_ADMIN_EMAIL})</span>
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setShowGoogleGuideModal(true)}
              className="inline-flex items-center gap-1.5 underline decoration-purple-300/60 hover:text-white font-semibold transition"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#00c4cc]" />
              <span>Cách lấy mã Google Client ID trong 2 phút</span>
            </button>
          </div>
        </div>
      </section>

      {/* 3 Core Pillars Showcase */}
      <section className="max-w-6xl w-full mx-auto px-4 sm:px-8 -mt-12 pb-16 relative z-20 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="canva-card-interactive p-6 space-y-3 border border-purple-100 dark:border-purple-900/40">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00c4cc] to-[#7d2ae8] text-white flex items-center justify-center shadow-md">
              <Wand2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-neutral-900 dark:text-white">
              1. AI Quét Câu Sai Đề &amp; Thiếu Đáp Án
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Phát hiện tức thì câu hỏi chưa chọn đáp án, câu hỏi cả 4 phương án đều sai, câu chọn nhầm đáp án đúng hoặc sai kiến thức chuyên môn. Đề xuất 3 phiên bản sửa chuẩn sư phạm.
            </p>
          </div>

          <div className="canva-card-interactive p-6 space-y-3 border border-emerald-100 dark:border-emerald-900/40">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-[#00c4cc] text-white flex items-center justify-center shadow-md">
              <FileCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-neutral-900 dark:text-white">
              2. Giữ Nguyên 100% Header Mẫu Gốc
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Bảo toàn tuyệt đối phần tiêu đề của file <code>MAU_DE_THI_tracnghiem.docx</code>. Không tự ý in đậm phương án trả lời và tự động đánh dấu [X] chính xác vào bảng đáp án.
            </p>
          </div>

          <div className="canva-card-interactive p-6 space-y-3 border border-pink-100 dark:border-pink-900/40">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#ff66c4] to-[#7d2ae8] text-white flex items-center justify-center shadow-md">
              <Shuffle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-neutral-900 dark:text-white">
              3. Trộn Mã Đề Cân Bằng 25% &amp; Xuất ZIP
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Xáo trộn câu hỏi và thứ tự A, B, C, D đảm bảo phân bổ 25% đều nhau, không quá 3 câu trùng liên tiếp, đóng gói trọn bộ đề thi + bảng đáp án + ma trận Excel.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#181920] py-6 text-xs text-neutral-500 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold text-neutral-700 dark:text-neutral-300">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00c4cc]" />
            <span>AzTool Studio (AzTool.vercel.app) • Hệ Thống Khảo Thí Thông Minh Đại Học Cửu Long</span>
          </div>
          <div>
            Phát triển bởi <strong>Lê Nhật Duy</strong> ({SUPER_ADMIN_EMAIL})
          </div>
        </div>
      </footer>

      {/* Modal: Real Google Login & Step-by-Step Client ID Guide */}
      {showGoogleGuideModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowGoogleGuideModal(false)}
          className="fixed inset-0 z-[120] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 modal-backdrop-enter"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="canva-card rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 border border-purple-200 dark:border-purple-900/50 max-h-[90vh] overflow-y-auto modal-card-enter"
          >
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl canva-gradient-bg text-white flex items-center justify-center shadow-xs">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white">
                    Đăng Nhập Google OAuth 2.0 &amp; Cách Lấy Client ID
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Hỗ trợ Google Identity Services chính thức + Đăng nhập nhanh 1 chạm
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGoogleGuideModal(false)}
                className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 transition canva-tap"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Section 1: Enter Google Client ID for Real Popup */}
            <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/25 border border-purple-200/80 dark:border-purple-900/50 space-y-3">
              <label className="block text-xs font-bold text-neutral-900 dark:text-white">
                1. Nhập mã Google Client ID của bạn (để bật cửa sổ chọn tài khoản Google thật):
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={clientIdInput}
                  onChange={e => setClientIdInput(e.target.value)}
                  placeholder="VD: 1234567890-abcdefg.apps.googleusercontent.com"
                  className="flex-1 p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#7d2ae8]"
                />
                <button
                  type="button"
                  onClick={() => {
                    updateSystemConfig({ googleClientId: clientIdInput.trim() });
                    toast.success(
                      'Đã lưu Google Client ID!',
                      'Bây giờ bạn có thể nhấn nút Đăng nhập Google OAuth thật.'
                    );
                  }}
                  className="canva-btn-secondary px-4 py-2.5 rounded-xl text-xs font-bold shrink-0 canva-tap"
                >
                  Lưu Mã Key
                </button>
              </div>

              <button
                type="button"
                onClick={handleRealGoogleLogin}
                disabled={!clientIdInput.trim() || isLoggingIn}
                className="w-full canva-btn-primary py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 canva-tap"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mở Cửa Sổ Đăng Nhập Google Thật Ngay</span>
              </button>
            </div>

            {/* Section 2: Step-by-Step Guide to get Google Client ID */}
            <div className="space-y-2.5 text-xs">
              <h4 className="font-black text-neutral-900 dark:text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#7d2ae8]" />
                <span>Hướng dẫn lấy mã Google Client ID miễn phí (chỉ mất 2 phút):</span>
              </h4>

              <ol className="space-y-2 text-neutral-600 dark:text-neutral-300 list-decimal list-inside bg-neutral-50 dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 leading-relaxed">
                <li>
                  Truy cập{' '}
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#7d2ae8] dark:text-purple-400 font-bold underline inline-flex items-center gap-1"
                  >
                    Google Cloud Console → Credentials <ExternalLink className="w-3 h-3" />
                  </a>{' '}
                  và tạo 1 Project mới (hoặc chọn Project có sẵn).
                </li>
                <li>
                  Vào tab <strong>OAuth consent screen</strong> → chọn <strong>External</strong> → điền tên App là <code>AzTool Studio</code> và email của bạn → nhấn Save.
                </li>
                <li>
                  Quay lại mục <strong>Credentials</strong> → nhấn <strong>+ CREATE CREDENTIALS</strong> → chọn <strong>OAuth client ID</strong>.
                </li>
                <li>
                  Chọn Application type là <strong>Web application</strong>.
                </li>
                <li>
                  Tại mục <strong>Authorized JavaScript origins</strong>, nhấn <strong>+ ADD URI</strong> và dán đúng địa chỉ web hiện tại:
                  <div className="mt-1.5 flex items-center gap-2">
                    <code className="px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-mono text-[11px] font-bold text-[#7d2ae8]">
                      {currentOrigin}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyOrigin}
                      className="px-2.5 py-1 rounded-lg bg-purple-100 text-[#7d2ae8] text-[11px] font-bold flex items-center gap-1 canva-tap"
                    >
                      {copiedOrigin ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedOrigin ? 'Đã chép' : 'Copy URI'}</span>
                    </button>
                  </div>
                  <span className="text-[11px] text-neutral-400 block mt-1">
                    (Khi deploy lên Vercel, bạn thêm cả <code>https://aztool.vercel.app</code> vào mục này).
                  </span>
                </li>
                <li>
                  Nhấn <strong>Create</strong> → Copy mã <strong>Client ID</strong> có đuôi <code>.apps.googleusercontent.com</code> dán vào ô số 1 phía trên (hoặc thêm vào file <code>.env.local</code> biến <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID=...</code>).
                </li>
              </ol>
            </div>

            {/* Section 3: Instant Login while testing */}
            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-2.5">
              <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                Hoặc đăng nhập nhanh để vào sử dụng ngay (trong lúc chưa dán Client ID):
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickAdminLogin()}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs canva-tap"
                >
                  <Crown className="w-4 h-4" />
                  <span>Vào Ngay Quyền Admin ({SUPER_ADMIN_EMAIL})</span>
                </button>
              </div>
              <div className="flex gap-2 pt-1">
                <input
                  type="email"
                  value={customEmailInput}
                  onChange={e => setCustomEmailInput(e.target.value)}
                  placeholder="Hoặc nhập email giảng viên bất kỳ (VD: giangvien@mku.edu.vn)..."
                  className="flex-1 p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs bg-white dark:bg-neutral-900"
                />
                <button
                  type="button"
                  disabled={!customEmailInput.trim()}
                  onClick={() => handleQuickAdminLogin(customEmailInput.trim(), customEmailInput.split('@')[0])}
                  className="canva-btn-secondary px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50 canva-tap"
                >
                  Đăng Nhập Email Này
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
