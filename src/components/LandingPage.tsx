'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ToastProvider';
import { DeQLogo } from '@/components/DeQLogo';
import { SpotlightCard } from '@/components/SpotlightCard';
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
  User,
  Lock,
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
  Check,
  Shield,
  Star,
  Quote,
  Eye,
  Sliders,
  CheckSquare,
  HelpCircle,
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
  const [isModalOAuthLoading, setIsModalOAuthLoading] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [activeInteractiveDemo, setActiveInteractiveDemo] = useState<'standardize' | 'mix' | 'audit'>('standardize');

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
      } else {
        setShowEmailModal(true);
      }
    } catch {
      setShowEmailModal(true);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleModalGoogleOAuth = async () => {
    setIsModalOAuthLoading(true);
    try {
      const ok = await loginWithRealGoogleOAuth();
      if (ok) {
        toast.success(
          'Đăng nhập Google thành công!',
          'Chào mừng bạn đến với không gian làm việc thông minh AzTool Studio.'
        );
        confetti({ particleCount: 55, spread: 65 });
        setShowEmailModal(false);
        onEnterWorkspace();
      } else {
        toast.info(
          'Đăng nhập trực tiếp bằng Gmail',
          'Vui lòng nhập trực tiếp địa chỉ Gmail bên dưới để đăng nhập ngay vào hệ thống.'
        );
      }
    } catch {
      toast.info(
        'Đăng nhập trực tiếp bằng Gmail',
        'Vui lòng nhập trực tiếp địa chỉ Gmail bên dưới để đăng nhập ngay mà không cần mở popup.'
      );
    } finally {
      setIsModalOAuthLoading(false);
    }
  };

  const handleQuickFill = (email: string, name: string) => {
    setEmailInput(email);
    setNameInput(name);
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

  const bentoFeatures = [
    {
      id: 'exam-suite',
      tag: 'BỘ TOOL CỐT LÕI',
      title: 'Tổ Hợp Soạn Đề 3 Bước Chuẩn Sư Phạm',
      desc: 'AI Thẩm định rà soát lỗi câu hỏi • Chuẩn hóa 1 chạm nhận diện gạch chân, in đậm • Trộn mã đề phân bổ đều 25% A-B-C-D.',
      targetTab: 'exam-tools',
      gradient: 'from-[#00c4cc] via-[#7d2ae8] to-[#ff66c4]',
      colSpan: 'md:col-span-2',
      bullets: [
        'Giữ nguyên 100% công thức Toán MathType, phương trình Hóa & hình ảnh',
        'Cân bằng tỷ lệ đáp án 25% chống học sinh đánh lụi 1 phương án',
        'Tự động xuất trọn bộ đề Sinh viên, đề Giảng viên & Bảng đáp án tổng hợp',
      ],
    },
    {
      id: 'thesis-auditor',
      tag: 'CÔNG NGHỆ ĐỘC QUYỀN',
      title: 'Rà Soát Đề Án & Giáo Trình',
      desc: 'Tự động quét toàn bộ tài liệu Word hàng trăm trang để bóc tách danh mục Từ viết tắt, Bảng biểu & Hình ảnh.',
      targetTab: 'thesis-auditor',
      gradient: 'from-indigo-600 to-purple-600',
      colSpan: 'md:col-span-1',
      bullets: [
        'Phát hiện lỗi đánh số nhảy cóc (vd: Hình 2.3 nhảy sang 2.5)',
        'Sửa trực tiếp vào file Word không làm xô lệch format',
      ],
    },
    {
      id: 'pdf-studio',
      tag: 'CLIENT-SIDE BẢO MẬT',
      title: 'PDF & Cắt Tách Trang Studio',
      desc: 'Tách trang theo dải (1-5, 8, 12-20), xoay trang ngang dọc, gộp file không cần upload máy chủ ngoài.',
      targetTab: 'pdf-studio',
      gradient: 'from-rose-500 via-orange-500 to-amber-500',
      colSpan: 'md:col-span-1',
      bullets: [
        'Xử lý siêu tốc ngay trên RAM trình duyệt của bạn',
        'Bảo mật tuyệt đối, không sợ lộ đề thi ra bên ngoài',
      ],
    },
    {
      id: 'cloud-vault',
      tag: 'ĐỒNG BỘ ĐÁM MÂY',
      title: 'Hạn Mức 5 Lượt/Ngày & Quản Trị Giáo Viên',
      desc: 'Hệ thống tự động cấp 5 lượt thực thi mỗi ngày (00h00 - 23h59). Admin có dashboard theo dõi tương tác & cấp VIP không giới hạn.',
      targetTab: 'exam-tools',
      gradient: 'from-blue-600 to-cyan-500',
      colSpan: 'md:col-span-2',
      bullets: [
        'Đồng bộ tức thì xuyên Serverless & Cloud Database',
        'Phân quyền độc lập 5 module: Soát lỗi, Chuẩn hóa, Trộn đề, Đề án, PDF',
      ],
    },
  ];

  const testimonials = [
    {
      name: 'Thầy Hoàng Minh Tuấn',
      role: 'Tổ trưởng Toán - Trường THPT Chuyên',
      comment:
        'Điều tuyệt vời nhất của AzTool là không làm hỏng bất kỳ công thức MathType nào. Đề thi 50 câu chỉ cần 2 giây là chuẩn hóa và trộn 8 mã đề cân bằng hoàn hảo.',
      stars: 5,
    },
    {
      name: 'Cô Nguyễn Thị Lan Hương',
      role: 'Giảng viên Đại Học Quốc Gia',
      comment:
        'Tính năng rà soát đề án và giáo trình Word thực sự cứu cánh cho mình khi viết giáo trình 250 trang. Nó chỉ ra từng chỗ đánh số hình ảnh bị nhảy cóc cực kỳ chuẩn xác.',
      stars: 5,
    },
    {
      name: 'Thầy Lê Quốc Dũng',
      role: 'Giáo viên Vật Lý - Trưởng ban Khảo thí',
      comment:
        'Học sinh không còn chiêu đánh lụi 1 cột nữa vì thuật toán trộn đề phân bổ đúng 25% A-B-C-D. Giao diện trực quan, ai cũng dùng được ngay.',
      stars: 5,
    },
  ];

  const faqs = [
    {
      q: 'AzTool có làm mất công thức Toán MathType, hình vẽ hay bảng biểu gốc không?',
      a: 'Tuyệt đối không! AzTool được lập trình bóc tách từng phần tử XML trong tệp Word (.docx) ở tầng byte. Mọi công thức MathType, ký hiệu toán học, hình ảnh, bảng biểu và căn lề đoạn văn đều được bảo lưu 100% nguyên vẹn.',
    },
    {
      q: 'Mỗi ngày tôi được sử dụng miễn phí bao nhiêu lượt?',
      a: 'Mỗi tài khoản Google khi đăng nhập được cấp 5 lượt sử dụng miễn phí mỗi ngày (tính từ 00h00 đến 23h59). Chuẩn hóa 1 đề thi tính 1 lượt, trộn đề tính 1 lượt. Sau khi chuẩn hóa, việc tải lại file Word nhiều lần của chính đề đó hoàn toàn không bị trừ thêm lượt. Giáo viên cần dùng không giới hạn có thể liên hệ Quản trị viên để cấp VIP Unlimited.',
    },
    {
      q: 'Dữ liệu và đề thi của tôi có bị lưu lại hoặc lộ ra ngoài không?',
      a: 'Toàn bộ quy trình xử lý chuẩn hóa, bóc tách và tạo mã đề được thực thi trực tiếp trên trình duyệt của máy bạn (Client-Side). AzTool cam kết bảo mật tuyệt đối, không chia sẻ hay sử dụng đề thi của bạn vào bất kỳ mục đích nào.',
    },
    {
      q: 'Tôi có thể dùng AzTool trên điện thoại thông minh (iPhone/Android) không?',
      a: 'Có, giao diện AzTool được tối ưu hóa responsive hoàn hảo trên mọi thiết bị. Thậm chí các file tải về trên điện thoại đều được đóng gói chuẩn định dạng .docx để bạn có thể mở và chỉnh sửa trực tiếp trên app Word hoặc WPS Office trên điện thoại.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0d0f18] text-[#f2f4f8] flex flex-col font-sans selection:bg-[#7d2ae8] selection:text-white w-full max-w-full overflow-x-hidden">
      {/* Dynamic Background Mesh Grid & Glows */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] sm:w-[1000px] h-[350px] sm:h-[550px] bg-gradient-to-b from-[#7d2ae8]/20 via-[#00c4cc]/15 to-transparent blur-[80px] sm:blur-[120px]" />
        <div className="absolute bottom-1/4 right-0 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-[#ff66c4]/10 blur-[80px] sm:blur-[130px]" />
        <div className="absolute top-1/3 left-0 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-[#00c4cc]/10 blur-[80px] sm:blur-[130px]" />
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* Floating Top Navigation Header */}
      <header className="sticky top-0 z-50 w-full bg-[#0d0f18]/85 backdrop-blur-xl border-b border-white/10 transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-8 h-15 sm:h-18 flex items-center justify-between gap-2 sm:gap-4">
          <div className="cursor-pointer shrink-0" onClick={() => scrollToSection('hero')}>
            <DeQLogo size="sm" showSubtitle />
          </div>

          {/* Quick Nav Links */}
          <nav className="hidden lg:flex items-center gap-7 text-xs font-bold text-neutral-300">
            <button
              onClick={() => scrollToSection('features')}
              className="hover:text-white hover:text-[#00c4cc] transition-colors"
            >
              Tính Năng Đỉnh Cao
            </button>
            <button
              onClick={() => scrollToSection('demo')}
              className="hover:text-white hover:text-[#00c4cc] transition-colors"
            >
              Trải Nghiệm Live
            </button>
            <button
              onClick={() => scrollToSection('testimonials')}
              className="hover:text-white hover:text-[#00c4cc] transition-colors"
            >
              Đánh Giá Thầy Cô
            </button>
            <button
              onClick={() => scrollToSection('faq')}
              className="hover:text-white hover:text-[#00c4cc] transition-colors"
            >
              Hỏi Đáp (FAQ)
            </button>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 sm:p-2.5 rounded-xl border border-white/10 bg-white/5 text-neutral-300 hover:text-white hover:border-[#7d2ae8] transition canva-tap"
              title={theme === 'dark' ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-300" />
              )}
            </button>

            {user ? (
              <button
                type="button"
                onClick={() => onEnterWorkspace()}
                className="canva-btn-primary px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 sm:gap-2 shadow-lg canva-tap"
              >
                <span>Mở Workspace</span>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(true)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-neutral-300 hover:text-white hover:bg-white/5 transition canva-tap"
                >
                  <Mail className="w-3.5 h-3.5 text-[#00c4cc]" />
                  <span>Email</span>
                </button>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoggingIn}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-white text-neutral-950 shadow-md hover:bg-neutral-100 text-xs font-black transition canva-tap"
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
                  <span>{isLoggingIn ? '...' : 'Đăng Nhập'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section
        id="hero"
        className="relative z-10 pt-10 sm:pt-24 pb-14 sm:pb-28 px-3.5 sm:px-8 max-w-6xl mx-auto text-center space-y-5 sm:space-y-8 w-full overflow-hidden"
      >
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/15 backdrop-blur-md text-[10px] sm:text-xs font-bold text-neutral-200 shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00c4cc] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00c4cc]" />
          </span>
          <span>AzTool Studio 2026 • Trợ Lý Soạn Đề &amp; Đề Án Word</span>
        </div>

        <div className="pt-1">
          <DeQLogo size="lg" showSubtitle={false} />
        </div>

        <h1 className="text-2xl sm:text-5xl lg:text-7xl font-black tracking-tight leading-tight sm:leading-[1.08] max-w-5xl mx-auto text-transparent bg-clip-text bg-gradient-to-b from-white via-neutral-100 to-neutral-400">
          Tự Động Hóa Đề Thi &amp; Soát Đề Án Word Chuẩn Xác 100%
        </h1>

        <p className="text-xs sm:text-base md:text-lg text-neutral-400 max-w-2xl mx-auto leading-relaxed">
          Soát lỗi đề bằng AI, chuẩn hóa đáp án bôi đậm/gạch chân 1 chạm, trộn đề cân bằng 25% A-B-C-D và rà soát giáo trình hàng trăm trang chỉ trong vài giây.
        </p>

        {/* Hero Actions */}
        <div className="pt-2 sm:pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-md sm:max-w-none mx-auto w-full">
          {!user ? (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoggingIn}
                className="spell-shimmer-btn spell-spring w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-white text-neutral-950 font-black text-xs sm:text-sm shadow-[0_0_30px_rgba(255,255,255,0.22)] flex items-center justify-center gap-2.5 sm:gap-3 cursor-pointer"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24">
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
                <span>Đăng Nhập Với Google</span>
              </button>

              <button
                type="button"
                onClick={() => onEnterWorkspace('exam-tools')}
                className="spell-shimmer-btn spell-spring w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#7d2ae8] to-[#00c4cc] text-white font-black text-xs sm:text-sm shadow-[0_0_30px_rgba(125,42,232,0.35)] flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Vào Làm Việc Ngay</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onEnterWorkspace()}
              className="spell-shimmer-btn spell-spring w-full sm:w-auto px-7 sm:px-9 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#7d2ae8] to-[#00c4cc] text-white font-black text-xs sm:text-sm shadow-[0_0_35px_rgba(125,42,232,0.4)] flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <span>Mở Không Gian Làm Việc AzTool</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Feature Badges */}
        <div className="pt-4 sm:pt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-10 text-[11px] sm:text-xs font-semibold text-neutral-400">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#00c4cc]" />
            <span>Xử lý 50 câu chỉ trong 1.2 giây</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Giữ nguyên 100% MathType &amp; Hình ảnh</span>
          </div>
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-[#ff66c4]" />
            <span>Miễn phí 5 lượt mỗi ngày (00h00 - 23h59)</span>
          </div>
        </div>
      </section>

      {/* Interactive Live Demo Teaser Section */}
      <section id="demo" className="relative z-10 max-w-5xl mx-auto px-3.5 sm:px-8 pb-14 sm:pb-20 w-full overflow-hidden">
        <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-[#121524]/90 backdrop-blur-xl p-4 sm:p-8 shadow-2xl space-y-4 sm:space-y-6 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-white/10 pb-4 sm:pb-5">
            <div>
              <span className="text-[10px] font-black tracking-wider uppercase text-[#00c4cc]">
                TRẢI NGHIỆM TRỰC QUAN
              </span>
              <h2 className="text-lg sm:text-2xl font-black text-white">
                Mô Phỏng Trực Quan Quy Trình Chuẩn Hóa
              </h2>
            </div>

            {/* Interactive Toggle Pill */}
            <div className="w-full sm:w-auto flex items-center gap-1 p-1 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 text-[11px] sm:text-xs font-bold overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveInteractiveDemo('standardize')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg sm:rounded-xl transition shrink-0 ${
                  activeInteractiveDemo === 'standardize'
                    ? 'bg-[#7d2ae8] text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                1. Chuẩn Hóa Word
              </button>
              <button
                onClick={() => setActiveInteractiveDemo('mix')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg sm:rounded-xl transition shrink-0 ${
                  activeInteractiveDemo === 'mix'
                    ? 'bg-[#7d2ae8] text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                2. Trộn Đề 25%
              </button>
              <button
                onClick={() => setActiveInteractiveDemo('audit')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg sm:rounded-xl transition shrink-0 ${
                  activeInteractiveDemo === 'audit'
                    ? 'bg-[#7d2ae8] text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                3. Đề Án &amp; Giáo Trình
              </button>
            </div>
          </div>

          {/* Interactive Screen Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 text-xs font-mono">
            {/* Left: Input File State */}
            <div className="p-3.5 sm:p-4.5 rounded-xl sm:rounded-2xl bg-black/40 border border-white/10 space-y-2.5 sm:space-y-3">
              <div className="flex items-center justify-between font-sans">
                <span className="font-bold text-neutral-400 flex items-center gap-1.5 text-[11px] sm:text-xs">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  Đề Gốc Của Giáo Viên (Trước khi xử lý)
                </span>
                <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Thủ công
                </span>
              </div>
              <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-1.5 sm:space-y-2 text-neutral-300">
                <div className="text-neutral-400">// Câu hỏi chưa đồng nhất format:</div>
                <div className="font-sans">
                  <strong>Câu 1:</strong> Cho hàm số y = f(x)... Giá trị cực đại là?
                </div>
                <div className="space-y-1 pl-3 font-sans">
                  <div>A. 2</div>
                  <div className="font-bold underline text-amber-300">B. 5 (Giáo viên gạch chân)</div>
                  <div>C. -1</div>
                  <div>D. 0</div>
                </div>
                <div className="text-[10px] sm:text-[11px] text-neutral-500 pt-1 font-sans">
                  ⚠️ Chưa có bảng đáp án tổng hợp, chưa thể trộn đề chống gian lận.
                </div>
              </div>
            </div>

            {/* Right: Output File State */}
            <div className="p-3.5 sm:p-4.5 rounded-xl sm:rounded-2xl bg-purple-950/20 border border-purple-500/30 space-y-2.5 sm:space-y-3">
              <div className="flex items-center justify-between font-sans">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5 text-[11px] sm:text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  AzTool Xử Lý Chuẩn Hóa Sau 1 Giây
                </span>
                <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Chuẩn 100%
                </span>
              </div>
              <div className="p-3 rounded-xl bg-neutral-900/80 border border-purple-900/40 space-y-1.5 sm:space-y-2 text-neutral-300">
                <div className="text-[#00c4cc]">// Tự động đóng gói bản in &amp; Bảng X đỏ:</div>
                <div className="grid grid-cols-4 gap-1 text-center font-sans">
                  <div className="p-1 rounded bg-white/5 border border-white/10">1. B</div>
                  <div className="p-1 rounded bg-white/5 border border-white/10">2. A</div>
                  <div className="p-1 rounded bg-white/5 border border-white/10">3. D</div>
                  <div className="p-1 rounded bg-white/5 border border-white/10">4. C</div>
                </div>
                <div className="space-y-1 text-[10px] sm:text-[11px] text-neutral-300 font-sans pt-1">
                  <div className="flex items-center gap-1 text-emerald-400">
                    <Check className="w-3.5 h-3.5" /> Xuất bản Giảng viên (Có đáp án bôi đỏ)
                  </div>
                  <div className="flex items-center gap-1 text-emerald-400">
                    <Check className="w-3.5 h-3.5" /> Xuất bản Học sinh (Làm bài thi)
                  </div>
                  <div className="flex items-center gap-1 text-emerald-400">
                    <Check className="w-3.5 h-3.5" /> Giữ 100% MathType &amp; cấu trúc đề
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-1 sm:pt-2">
            <button
              onClick={() => onEnterWorkspace('exam-tools')}
              className="w-full sm:w-auto canva-btn-primary px-6 sm:px-7 py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-lg canva-tap"
            >
              <span>Thử Nghiệm Ngay Với File Của Bạn</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Bento Grid Features Section */}
      <section id="features" className="relative z-10 max-w-6xl mx-auto px-3.5 sm:px-8 pb-16 sm:pb-24 space-y-6 sm:space-y-8 w-full overflow-hidden">
        <div className="text-center max-w-2xl mx-auto space-y-1.5 sm:space-y-2">
          <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#00c4cc]">
            HỆ THỐNG CÔNG CỤ SỐ ĐA NĂNG
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white">
            Bộ Giải Pháp Toàn Diện Cho Nhà Giáo &amp; Khảo Thí
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400">
            Mọi tính năng đều được tối ưu hóa cho trải nghiệm mượt mà, chính xác đến từng ký tự
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {bentoFeatures.map(f => (
            <SpotlightCard
              key={f.id}
              onClick={() => onEnterWorkspace(f.targetTab)}
              className={`${f.colSpan} spell-spring p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-white/10 bg-[#121524]/80 backdrop-blur-md hover:border-[#7d2ae8]/80 cursor-pointer group flex flex-col justify-between space-y-4 sm:space-y-5`}
            >
              <div className="relative z-10 space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] sm:text-[10px] font-black px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[#00c4cc]">
                    {f.tag}
                  </span>
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[#7d2ae8] transition-colors">
                    <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  </div>
                </div>

                <h3 className="text-lg sm:text-2xl font-black text-white group-hover:text-[#00c4cc] transition-colors">
                  {f.title}
                </h3>

                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                  {f.desc}
                </p>

                <div className="space-y-1.5 sm:space-y-2 pt-2 border-t border-white/10">
                  {f.bullets.map((b, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] sm:text-xs text-neutral-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#00c4cc] shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative z-10 pt-2 flex items-center gap-2 text-xs font-bold text-[#00c4cc] group-hover:translate-x-1 transition-transform">
                <span>Khám phá công cụ này</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </SpotlightCard>
          ))}
        </div>
      </section>

      {/* Teacher Testimonials Section */}
      <section id="testimonials" className="relative z-10 max-w-6xl mx-auto px-3.5 sm:px-8 pb-16 sm:pb-24 space-y-6 sm:space-y-10 w-full overflow-hidden">
        <div className="text-center max-w-xl mx-auto space-y-1.5 sm:space-y-2">
          <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#ff66c4]">
            ĐÁNH GIÁ TỪ CHUYÊN GIA
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Được Hàng Ngàn Thầy Cô &amp; Giảng Viên Tin Dùng
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {testimonials.map((t, idx) => (
            <div
              key={idx}
              className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-white/10 bg-[#121524]/60 backdrop-blur-md space-y-3 sm:space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-2.5 sm:space-y-3">
                <div className="flex items-center gap-1">
                  {[...Array(t.stars)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed italic">
                  "{t.comment}"
                </p>
              </div>

              <div className="border-t border-white/10 pt-2.5 sm:pt-3">
                <div className="font-bold text-xs text-white">{t.name}</div>
                <div className="text-[10px] sm:text-[11px] text-neutral-400">{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section id="faq" className="relative z-10 max-w-4xl mx-auto px-3.5 sm:px-8 pb-16 sm:pb-24 space-y-6 sm:space-y-8 w-full overflow-hidden">
        <div className="text-center space-y-1.5 sm:space-y-2">
          <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#00c4cc]">
            CÂU HỎI THƯỜNG GẶP
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Giải Đáp Mọi Thắc Mắc Về AzTool
          </h2>
        </div>

        <div className="space-y-2.5 sm:space-y-3">
          {faqs.map((item, idx) => {
            const isOpen = expandedFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-xl sm:rounded-2xl border border-white/10 overflow-hidden bg-[#121524]/80 backdrop-blur-md transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setExpandedFaq(isOpen ? null : idx)}
                  className="w-full p-3.5 sm:p-4.5 text-left font-bold text-xs sm:text-sm flex items-center justify-between gap-3 text-white hover:text-[#00c4cc] transition-colors"
                >
                  <span>{item.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-[#00c4cc] shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-3.5 sm:px-4.5 pb-3.5 sm:pb-4 text-xs text-neutral-400 leading-relaxed border-t border-white/10 pt-2.5 sm:pt-3 font-normal">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Modern SaaS Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-[#0d0f18] py-8 sm:py-12 text-xs text-neutral-500 mt-auto w-full overflow-hidden">
        <div className="max-w-6xl mx-auto px-3.5 sm:px-8 space-y-6 sm:space-y-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
            <div className="cursor-pointer" onClick={() => scrollToSection('hero')}>
              <DeQLogo size="sm" showSubtitle />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs font-semibold text-neutral-300">
              <button
                onClick={() => onEnterWorkspace('exam-tools')}
                className="hover:text-[#00c4cc] transition-colors"
              >
                Soạn &amp; Trộn Đề
              </button>
              <button
                onClick={() => onEnterWorkspace('thesis-auditor')}
                className="hover:text-[#00c4cc] transition-colors"
              >
                Rà Soát Đề Án
              </button>
              <button
                onClick={() => onEnterWorkspace('pdf-studio')}
                className="hover:text-[#00c4cc] transition-colors"
              >
                Cắt Tách PDF
              </button>
              <button
                onClick={() => onEnterWorkspace('guide')}
                className="hover:text-[#00c4cc] transition-colors"
              >
                Quy Chuẩn Soạn Đề
              </button>
            </div>
          </div>

          <div className="border-t border-white/10 pt-4 sm:pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-neutral-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00c4cc]" />
              <span>© 2026 AzTool Studio (AzTool.vercel.app). All rights reserved.</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <a
                href="mailto:lenhatduy.vietnam@gmail.com"
                className="hover:text-[#00c4cc] transition-colors flex items-center gap-1 text-neutral-400"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Liên hệ Admin: lenhatduy.vietnam@gmail.com</span>
              </a>
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Server Online
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* Premium Login Modal (Google OAuth 1-Tap & Instant Gmail Sign-In) */}
      {showEmailModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowEmailModal(false)}
          className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-md flex items-center justify-center p-3.5 sm:p-4 modal-backdrop-enter"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl sm:rounded-3xl border border-white/15 bg-[#0f121e]/95 backdrop-blur-2xl shadow-2xl p-5 sm:p-7 space-y-4 sm:space-y-5 modal-card-enter overflow-hidden"
          >
            {/* Ambient Background Glow Orb */}
            <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full bg-gradient-to-tr from-[#7d2ae8]/30 via-[#00c4cc]/20 to-transparent blur-3xl pointer-events-none" />

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3.5 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl canva-gradient-bg text-white flex items-center justify-center shadow-lg shadow-purple-500/25 shrink-0">
                  <Lock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                    <span>Đăng Nhập Tài Khoản</span>
                    <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-[#00c4cc]/15 text-[#00c4cc] border border-[#00c4cc]/30">
                      AzTool
                    </span>
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Đăng nhập để vào không gian làm việc & nhận 5 lượt dùng/ngày
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 text-neutral-400 hover:text-white transition canva-tap shrink-0"
                aria-label="Đóng cửa sổ"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Primary Action: 1-Tap Google OAuth */}
            <div className="space-y-3 relative z-10">
              <button
                type="button"
                onClick={handleModalGoogleOAuth}
                disabled={isModalOAuthLoading}
                className="w-full py-3 px-4 rounded-xl bg-white text-neutral-900 hover:bg-neutral-100 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-md shadow-white/10 transition-all active:scale-[0.99] canva-tap border border-neutral-200"
              >
                {isModalOAuthLoading ? (
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
                    <span>Đang kết nối Google...</span>
                  </div>
                ) : (
                  <>
                    <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24">
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
                        d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.57H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.43l3.99-3.14z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.57l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                      />
                    </svg>
                    <span>Tiếp tục với Tài khoản Google (1-Chạm)</span>
                  </>
                )}
              </button>

              {/* Modern Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="h-px bg-white/10 flex-1" />
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider text-center">
                  Hoặc đăng nhập nhanh bằng Gmail
                </span>
                <div className="h-px bg-white/10 flex-1" />
              </div>

              {/* Email Form */}
              <form onSubmit={handleEmailContinue} className="space-y-3.5 text-xs">
                <div className="space-y-1.5">
                  <label className="font-bold text-neutral-200 block text-[11px] sm:text-xs">
                    Địa chỉ Email Google (Gmail): <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={emailInput}
                      onChange={e => setEmailInput(e.target.value)}
                      placeholder="tenban@gmail.com"
                      className="w-full pl-10 pr-3.5 py-2.5 sm:py-3 rounded-xl border border-white/10 bg-neutral-900/90 text-white placeholder-neutral-500 focus:outline-none focus:border-[#00c4cc] focus:ring-2 focus:ring-[#00c4cc]/20 transition text-xs sm:text-sm"
                    />
                  </div>
                </div>

                {/* Quick Auto-fill Pills */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-neutral-400 block font-semibold">
                    Đăng nhập nhanh mẫu:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickFill('lenhatduy.vietnam@gmail.com', 'Admin Lê Nhật Duy')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[11px] font-semibold transition canva-tap"
                    >
                      <span>👑</span>
                      <span>Admin (Lê Nhật Duy)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickFill('giaovien.toan@gmail.com', 'Thầy Nguyễn Văn A')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[11px] font-semibold transition canva-tap"
                    >
                      <span>👨‍🏫</span>
                      <span>Giáo viên Demo</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-neutral-200 block text-[11px] sm:text-xs">
                    Tên hiển thị (Tùy chọn):
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      placeholder="VD: Thầy Nguyễn Văn A"
                      className="w-full pl-10 pr-3.5 py-2.5 sm:py-3 rounded-xl border border-white/10 bg-neutral-900/90 text-white placeholder-neutral-500 focus:outline-none focus:border-[#7d2ae8] focus:ring-2 focus:ring-[#7d2ae8]/20 transition text-xs sm:text-sm"
                    />
                  </div>
                </div>

                {/* Quota & Sync Notice */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-[11px] text-neutral-300 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 leading-relaxed">
                    <p className="font-semibold text-white">5 lượt miễn phí mỗi ngày • Tự động kích hoạt</p>
                    <p className="text-neutral-400 text-[10px]">
                      Hệ thống tự động đồng bộ phân quyền từ Nhà trường và cập nhật mốc 5 lượt mới vào 00:00 hằng ngày.
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(false)}
                    className="px-4 py-2.5 rounded-xl font-semibold bg-white/5 hover:bg-white/10 text-neutral-300 transition canva-tap"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="canva-btn-primary px-5 sm:px-6 py-2.5 rounded-xl font-extrabold shadow-lg shadow-purple-500/20 flex items-center gap-2 canva-tap text-white"
                  >
                    <span>Vào Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
