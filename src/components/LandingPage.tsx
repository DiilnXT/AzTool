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
  GraduationCap,
  Presentation,
  Bot,
  Mail,
  X,
  CheckCircle2,
  Cpu,
  BookOpen,
  FolderLock,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  Award,
  Users,
  Compass,
  ArrowUpRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface LandingPageProps {
  onEnterWorkspace: (targetTab?: string) => void;
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
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

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

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const features = [
    {
      id: 'exam-tools',
      step: 'BỘ TOOL SỐ 01',
      title: 'Tổ Hợp Soạn Đề (1 • 2 • 3)',
      desc: 'AI Thẩm định rà soát lỗi đề thi, Chuẩn hóa đề Word giữ nguyên 100% định dạng, Trộn đề trắc nghiệm hoán vị chuẩn 25% với đầy đủ bảng đáp án.',
      badge: 'Bộ Công Cụ Cốt Lõi',
      badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      icon: Wand2,
      gradient: 'from-[#00c4cc] via-[#7d2ae8] to-[#ff66c4]',
      capabilities: [
        'AI Soát lỗi: phát hiện sai đề, thiếu đáp án, trùng phương án',
        'Chuẩn hóa 1 chạm: nhận diện in đậm, gạch chân, bảng X đỏ',
        'Trộn mã đề: hoán vị ngẫu nhiên, cân bằng 25% tỷ lệ A-B-C-D',
        'Xuất file bản Giáo viên & Học sinh độc lập, chuẩn in ấn',
      ],
      targetTab: 'exam-tools',
    },
    {
      id: 'thesis-auditor',
      step: 'BỘ TOOL SỐ 02',
      title: 'Rà Soát Đề Án & Giáo Trình',
      desc: 'Trợ lý học thuật tự động quét toàn diện tài liệu Word dài hàng trăm trang: danh mục từ viết tắt, bảng biểu, sơ đồ hình ảnh.',
      badge: 'Công Nghệ Độc Quyền',
      badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      icon: GraduationCap,
      gradient: 'from-indigo-600 via-purple-600 to-pink-600',
      capabilities: [
        'Bóc tách tự động 100% từ viết tắt và vị trí xuất hiện đầu tiên',
        'Phát hiện lỗi đánh số nhảy cóc hình ảnh (vd: Hình 2.3 nhảy sang 2.5)',
        'Sửa lỗi trực tiếp vào file Word không làm xô lệch format',
        'Đồng bộ danh mục bảng, biểu đồ theo chuẩn luận án Tiến sĩ/Thạc sĩ',
      ],
      targetTab: 'thesis-auditor',
    },
    {
      id: 'pdf-studio',
      step: 'BỘ TOOL SỐ 03',
      title: 'PDF & Cắt Tách Trang Studio',
      desc: 'Xử lý file PDF dung lượng lớn siêu tốc ngay trên trình duyệt mà không cần cài đặt phần mềm nặng máy hay tải lên server trung gian.',
      badge: 'Bảo Mật Client-Side',
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      icon: Layers,
      gradient: 'from-rose-500 via-orange-500 to-amber-500',
      capabilities: [
        'Tách dải trang theo cấu hình tùy chọn (vd: 1-5, 8, 12-20)',
        'Xoay trang ngang/dọc 90° - 180° - 270° nhanh như chớp',
        'Gộp nhiều tài liệu PDF thành 1 file duy nhất chuẩn hóa',
        'Tối ưu hóa dung lượng & trích xuất văn bản nguyên gốc',
      ],
      targetTab: 'pdf-studio',
    },
  ];

  const faqs = [
    {
      q: 'AzTool có làm mất công thức Toán MathType, hình vẽ hay bảng biểu gốc không?',
      a: 'Tuyệt đối không! AzTool được lập trình bóc tách từng phần tử XML trong tệp Word (.docx) ở tầng byte. Mọi công thức MathType, ký hiệu toán học, hình ảnh, bảng biểu và căn lề đoạn văn đều được bảo lưu 100% nguyên vẹn.',
    },
    {
      q: 'Giới hạn sử dụng miễn phí hàng ngày được tính như thế nào?',
      a: 'Mỗi tài khoản Google khi đăng nhập được cấp 5 lượt thực thi mỗi ngày (tính từ 00h00 đến 23h59). Chuẩn hóa 1 đề thi tính 1 lượt, trộn đề tính 1 lượt. Sau khi chuẩn hóa, việc tải lại file Word nhiều lần của chính đề đó hoàn toàn không bị trừ thêm lượt. Giáo viên cần dùng không giới hạn có thể liên hệ Quản trị viên để cấp VIP Unlimited.',
    },
    {
      q: 'Dữ liệu và đề thi của tôi có bị lộ ra ngoài không?',
      a: 'Toàn bộ quy trình xử lý chuẩn hóa, bóc tách và tạo mã đề được thực thi trực tiếp trên trình duyệt của máy bạn (Client-Side). AzTool cam kết bảo mật tuyệt đối, không chia sẻ hay sử dụng đề thi của bạn vào bất kỳ mục đích nào.',
    },
    {
      q: 'Tôi có thể dùng AzTool trên điện thoại thông minh (iPhone/Android) không?',
      a: 'Có, giao diện AzTool được tối ưu hóa responsive hoàn hảo trên mọi thiết bị. Thậm chí các file tải về trên điện thoại đều được đóng gói chuẩn định dạng .docx để bạn có thể mở và chỉnh sửa trực tiếp trên app Word hoặc WPS Office trên điện thoại.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#f7f8fd] dark:bg-[#0b0d13] text-[#0e1318] dark:text-[#f2f3f7] flex flex-col font-sans selection:bg-[#7d2ae8] selection:text-white overflow-x-hidden">
      {/* Top Glass Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/85 dark:bg-[#12151f]/85 backdrop-blur-xl border-b border-neutral-200/80 dark:border-neutral-800/80 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 sm:h-20 flex items-center justify-between gap-3">
          <div className="cursor-pointer" onClick={() => scrollToSection('hero')}>
            <DeQLogo size="md" showSubtitle />
          </div>

          {/* Quick Nav Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-bold text-neutral-600 dark:text-neutral-300">
            <button
              onClick={() => scrollToSection('features')}
              className="hover:text-[#7d2ae8] dark:hover:text-[#00c4cc] transition-colors"
            >
              Tính Năng Nổi Bật
            </button>
            <button
              onClick={() => scrollToSection('workflow')}
              className="hover:text-[#7d2ae8] dark:hover:text-[#00c4cc] transition-colors"
            >
              Quy Trình 3 Bước
            </button>
            <button
              onClick={() => scrollToSection('roadmap')}
              className="hover:text-[#7d2ae8] dark:hover:text-[#00c4cc] transition-colors"
            >
              Hệ Sinh Thái
            </button>
            <button
              onClick={() => scrollToSection('faq')}
              className="hover:text-[#7d2ae8] dark:hover:text-[#00c4cc] transition-colors"
            >
              Hỏi Đáp (FAQ)
            </button>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 hover:border-[#7d2ae8] transition-all canva-tap"
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
                onClick={() => onEnterWorkspace()}
                className="canva-btn-primary px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md canva-tap"
              >
                <span>Mở Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(true)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition canva-tap"
                >
                  <Mail className="w-3.5 h-3.5 text-[#7d2ae8]" />
                  <span>Email</span>
                </button>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoggingIn}
                  className="flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm hover:shadow-md hover:border-[#7d2ae8] text-xs font-bold text-neutral-800 dark:text-white transition canva-tap"
                >
                  {isLoggingIn ? (
                    <DeQLogo size="xs" showSubtitle={false} isLoadingMode />
                  ) : (
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
                  )}
                  <span>{isLoggingIn ? 'Đang xác thực...' : 'Đăng Nhập'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section with Calligraphy AzTool Branding & Glow */}
      <section
        id="hero"
        className="relative overflow-hidden canva-gradient-header text-white pt-14 sm:pt-20 pb-24 sm:pb-32 px-4 sm:px-8"
      >
        <div className="absolute -top-24 right-10 w-[500px] h-[500px] bg-[#00c4cc]/20 rounded-full blur-3xl pointer-events-none canva-ambient-glow" />
        <div className="absolute -bottom-24 left-10 w-[500px] h-[500px] bg-[#ff66c4]/20 rounded-full blur-3xl pointer-events-none canva-ambient-glow" />

        <div className="max-w-5xl mx-auto text-center relative z-10 space-y-6">
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold text-white shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-[#00c4cc] animate-pulse" />
              <span>Nền Tảng Trợ Lý Sư Phạm &amp; Khảo Thí 4.0</span>
            </div>

            <div className="pt-2">
              <DeQLogo size="xl" showSubtitle={false} />
            </div>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight max-w-4xl mx-auto canva-gradient-text-hero">
            Tự động hóa soạn đề thi, rà soát đề án &amp; xử lý tài liệu thông minh
          </h1>

          <p className="text-xs sm:text-base text-purple-100/90 max-w-2xl mx-auto leading-relaxed font-normal px-2">
            Giải phóng 90% thời gian thủ công cho Thầy Cô và Chuyên gia. Tự động soát lỗi đề bằng AI, chuẩn hóa Word 1 chạm, trộn đề phân bổ đều 25% đáp án và kiểm tra cấu trúc giáo trình chuyên sâu.
          </p>

          {/* Primary Action Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-lg sm:max-w-none mx-auto">
            {!user ? (
              <>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoggingIn}
                  className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-white text-neutral-900 font-black text-sm shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all canva-tap group"
                >
                  {isLoggingIn ? (
                    <DeQLogo size="xs" showSubtitle={false} isLoadingMode />
                  ) : (
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
                  )}
                  <span>{isLoggingIn ? 'Đang xác thực...' : 'Đăng Nhập Với Google'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onEnterWorkspace('exam-tools')}
                  className="w-full sm:w-auto canva-btn-primary px-8 py-4 rounded-2xl text-sm font-black flex items-center justify-center gap-2.5 shadow-xl canva-tap border border-white/25 hover:border-white/50 transition-all"
                >
                  <span>Dùng Ngay Không Cần Chờ</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onEnterWorkspace()}
                className="w-full sm:w-auto canva-btn-primary px-9 py-4 rounded-2xl text-sm font-black flex items-center justify-center gap-3 shadow-2xl canva-tap border border-white/25 hover:scale-[1.02] transition-all"
              >
                <span>Mở Không Gian Làm Việc AzTool</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Metrics & Trust Badges */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs text-purple-200/90">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#00c4cc]" />
              <span>Xử lý 100 câu trắc nghiệm chỉ mất 1.5 giây</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Giữ 100% MathType &amp; định dạng gốc</span>
            </div>
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#ff66c4]" />
              <span>5 lượt miễn phí mỗi ngày (00h00 - 23h59)</span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Section: 3 Deep Core Modules */}
      <section id="features" className="max-w-6xl w-full mx-auto px-4 sm:px-8 -mt-14 pb-16 relative z-20 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map(f => {
            const Icon = f.icon;
            return (
              <div
                key={f.id}
                onClick={() => onEnterWorkspace(f.targetTab)}
                className="canva-card-interactive p-6 sm:p-7 space-y-4 border border-neutral-200/80 dark:border-neutral-800 bg-white/95 dark:bg-[#151824]/95 backdrop-blur-md rounded-3xl cursor-pointer group flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-13 h-13 rounded-2xl bg-gradient-to-br ${f.gradient} text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${f.badgeColor}`}
                    >
                      {f.badge}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider">
                      {f.step}
                    </span>
                    <h3 className="text-lg font-black text-neutral-900 dark:text-white group-hover:text-[#7d2ae8] dark:group-hover:text-[#00c4cc] transition-colors flex items-center justify-between">
                      <span>{f.title}</span>
                      <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </h3>
                  </div>

                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    {f.desc}
                  </p>

                  <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
                    {f.capabilities.map((cap, i) => (
                      <div key={i} className="flex items-start gap-2 text-[11px] text-neutral-700 dark:text-neutral-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#00c4cc] shrink-0 mt-0.5" />
                        <span>{cap}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onEnterWorkspace(f.targetTab);
                    }}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-neutral-100 dark:bg-neutral-800 hover:bg-[#7d2ae8] hover:text-white dark:hover:bg-[#7d2ae8] transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>Mở Công Cụ Này</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Workflow Showcase: 3 Step Process */}
        <div id="workflow" className="canva-card p-6 sm:p-10 border border-neutral-200/80 dark:border-neutral-800 space-y-8 rounded-3xl">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#7d2ae8] dark:text-purple-400">
              Quy Trình Siêu Đơn Giản
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white">
              Chuẩn Hóa &amp; Trộn Đề Thi Chỉ Trong 3 Bước
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500">
              Không cần cài đặt phức tạp, thực hiện toàn bộ ngay trên trình duyệt máy tính hoặc điện thoại
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            <div className="p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800 space-y-3 relative">
              <div className="w-8 h-8 rounded-xl bg-purple-600 text-white font-black text-sm flex items-center justify-center shadow-sm">
                1
              </div>
              <h4 className="font-bold text-sm text-neutral-900 dark:text-white">
                Tải File Đề Thi Lên
              </h4>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Hệ thống nhận diện mọi dạng đề Word (.docx) dù đáp án được bôi đậm, gạch chân hoặc nằm trong bảng đáp án chữ cái.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800 space-y-3 relative">
              <div className="w-8 h-8 rounded-xl bg-[#00c4cc] text-white font-black text-sm flex items-center justify-center shadow-sm">
                2
              </div>
              <h4 className="font-bold text-sm text-neutral-900 dark:text-white">
                AI Soát Lỗi &amp; Chuẩn Hóa
              </h4>
              <p className="text-xs text-neutral-500 leading-relaxed">
                AI phát hiện câu sai ngữ pháp, thiếu đáp án hoặc câu trùng. Bạn có thể sửa ngay và xuất bản chuẩn có bảng đáp án đỏ.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800 space-y-3 relative">
              <div className="w-8 h-8 rounded-xl bg-[#ff66c4] text-white font-black text-sm flex items-center justify-center shadow-sm">
                3
              </div>
              <h4 className="font-bold text-sm text-neutral-900 dark:text-white">
                Trộn Đề 25% &amp; Đóng Gói
              </h4>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Chọn số mã đề (từ 2 đến 24 đề), thuật toán hoán vị cân bằng 25% các phương án và tự động xuất file ZIP kèm đáp án chi tiết.
              </p>
            </div>
          </div>

          <div className="flex justify-center pt-2">
            <button
              onClick={() => onEnterWorkspace('exam-tools')}
              className="canva-btn-primary px-8 py-3 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md canva-tap"
            >
              <span>Trải Nghiệm Trộn Đề Ngay</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Roadmap & Upcoming Ecosystem */}
        <div id="roadmap" className="canva-card p-6 sm:p-8 border border-neutral-200/80 dark:border-neutral-800 space-y-6 rounded-3xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#7d2ae8] dark:text-purple-400">
                Hệ Sinh Thái Mở Rộng
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white">
                Kho Công Cụ Thông Minh Đang Phát Triển
              </h2>
            </div>
            <span className="text-xs text-neutral-500">
              Liên tục cập nhật phục vụ giảng dạy &amp; nghiên cứu
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-neutral-50/80 dark:bg-neutral-900/60 border border-neutral-200/70 dark:border-neutral-800 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-[#7d2ae8] dark:text-purple-300 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <span>Tạo Đề Từ Sách &amp; Giáo Trình PDF</span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-100 text-[#7d2ae8] dark:bg-purple-950 dark:text-purple-300">
                    Sắp ra mắt
                  </span>
                </div>
                <p className="text-neutral-500 leading-relaxed">
                  Tải giáo trình PDF hoặc dàn ý bài giảng để AI sinh bộ câu hỏi trắc nghiệm theo 4 mức độ nhận thức.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-50/80 dark:bg-neutral-900/60 border border-neutral-200/70 dark:border-neutral-800 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <span>Chấm Thi &amp; Phổ Điểm Thông Minh</span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
                    Sắp ra mắt
                  </span>
                </div>
                <p className="text-neutral-500 leading-relaxed">
                  Tự động so khớp bảng đáp án các mã đề, thống kê phổ điểm và xuất file kết quả tích hợp app chấm thi TnMaker.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-50/80 dark:bg-neutral-900/60 border border-neutral-200/70 dark:border-neutral-800 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-pink-100 dark:bg-pink-950/60 text-pink-600 dark:text-pink-300 flex items-center justify-center shrink-0">
                <Presentation className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <span>Trắc Nghiệm GDPT 2018 Mới</span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-pink-100 text-pink-600 dark:bg-pink-950 dark:text-pink-300">
                    Sắp ra mắt
                  </span>
                </div>
                <p className="text-neutral-500 leading-relaxed">
                  Hỗ trợ trọn gói định dạng đề thi mới: Trắc nghiệm Đúng/Sai 4 ý và Câu hỏi trả lời ngắn điền số.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Accordion Section */}
        <div id="faq" className="canva-card p-6 sm:p-10 border border-neutral-200/80 dark:border-neutral-800 space-y-6 rounded-3xl">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#7d2ae8] dark:text-purple-400">
              Giải Đáp Thắc Mắc
            </span>
            <h2 className="text-2xl font-black text-neutral-900 dark:text-white">
              Câu Hỏi Thường Gặp (FAQ)
            </h2>
          </div>

          <div className="space-y-3 max-w-3xl mx-auto">
            {faqs.map((item, idx) => {
              const isOpen = expandedFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 overflow-hidden transition-colors bg-white dark:bg-[#151824]"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedFaq(isOpen ? null : idx)}
                    className="w-full p-4.5 text-left font-bold text-xs sm:text-sm flex items-center justify-between gap-3 text-neutral-900 dark:text-white hover:text-[#7d2ae8] transition-colors"
                  >
                    <span>{item.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-[#7d2ae8] shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-4.5 pb-4 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed border-t border-neutral-100 dark:border-neutral-800/80 pt-3">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Professional SaaS Footer */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#12151f] py-10 text-xs text-neutral-500 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="cursor-pointer" onClick={() => scrollToSection('hero')}>
              <DeQLogo size="sm" showSubtitle />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
              <button
                onClick={() => onEnterWorkspace('exam-tools')}
                className="hover:text-[#7d2ae8] transition-colors"
              >
                Soạn Đề Thi
              </button>
              <button
                onClick={() => onEnterWorkspace('thesis-auditor')}
                className="hover:text-[#7d2ae8] transition-colors"
              >
                Rà Soát Đề Án
              </button>
              <button
                onClick={() => onEnterWorkspace('pdf-studio')}
                className="hover:text-[#7d2ae8] transition-colors"
              >
                Cắt Tách PDF
              </button>
              <button
                onClick={() => onEnterWorkspace('guide')}
                className="hover:text-[#7d2ae8] transition-colors"
              >
                Quy Chuẩn Soạn Đề
              </button>
            </div>
          </div>

          <div className="border-t border-neutral-100 dark:border-neutral-800/80 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-neutral-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00c4cc]" />
              <span>© 2026 AzTool Studio (AzTool.vercel.app). All rights reserved.</span>
            </div>

            <div className="flex items-center gap-4">
              <a
                href="mailto:lenhatduy.vietnam@gmail.com"
                className="hover:text-[#7d2ae8] transition-colors flex items-center gap-1 text-neutral-500 dark:text-neutral-400"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Liên hệ Admin: lenhatduy.vietnam@gmail.com</span>
              </a>
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Server Online
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* Clean Email Sign-In Dialog */}
      {showEmailModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowEmailModal(false)}
          className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 modal-backdrop-enter"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="canva-card rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-purple-200 dark:border-purple-900/50 modal-card-enter bg-white dark:bg-[#151824]"
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
                    Nhập địa chỉ Gmail để tiếp tục vào không gian làm việc
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
                  placeholder="VD: Thầy Nguyễn Văn A"
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
