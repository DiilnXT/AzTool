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
      }
    } catch {
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
    <div className="min-h-screen bg-[#0d0f18] text-[#f2f4f8] flex flex-col font-sans selection:bg-[#7d2ae8] selection:text-white overflow-x-hidden">
      {/* Dynamic Background Mesh Grid & Glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-b from-[#7d2ae8]/20 via-[#00c4cc]/15 to-transparent blur-[120px]" />
        <div className="absolute bottom-1/4 right-0 w-[500px] h-[500px] bg-[#ff66c4]/10 blur-[130px]" />
        <div className="absolute top-1/3 left-0 w-[500px] h-[500px] bg-[#00c4cc]/10 blur-[130px]" />
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* Floating Top Navigation Header */}
      <header className="sticky top-0 z-50 w-full bg-[#0d0f18]/80 backdrop-blur-xl border-b border-white/10 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-18 flex items-center justify-between gap-4">
          <div className="cursor-pointer" onClick={() => scrollToSection('hero')}>
            <DeQLogo size="md" showSubtitle />
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

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2.5 rounded-xl border border-white/10 bg-white/5 text-neutral-300 hover:text-white hover:border-[#7d2ae8] transition canva-tap"
              title={theme === 'dark' ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-neutral-300" />
              )}
            </button>

            {user ? (
              <button
                type="button"
                onClick={() => onEnterWorkspace()}
                className="canva-btn-primary px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-lg canva-tap"
              >
                <span>Mở Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-2">
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
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-neutral-950 shadow-md hover:bg-neutral-100 text-xs font-black transition canva-tap"
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
                  <span>{isLoggingIn ? 'Đang kết nối...' : 'Đăng Nhập'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section
        id="hero"
        className="relative z-10 pt-16 sm:pt-24 pb-20 sm:pb-28 px-4 sm:px-8 max-w-6xl mx-auto text-center space-y-8"
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-xs font-bold text-neutral-300 shadow-sm animate-pulse">
          <Sparkles className="w-3.5 h-3.5 text-[#00c4cc]" />
          <span>Phiên Bản Quốc Tế Thế Hệ Mới • Trợ Lý Sư Phạm Số 1</span>
        </div>

        <div className="pt-1">
          <DeQLogo size="xl" showSubtitle={false} />
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] max-w-5xl mx-auto text-transparent bg-clip-text bg-gradient-to-b from-white via-neutral-100 to-neutral-400">
          Nền tảng Tự Động Hóa Đề Thi &amp; Soát Đề Án Word Chuẩn Xác 100%
        </h1>

        <p className="text-sm sm:text-base md:text-lg text-neutral-400 max-w-3xl mx-auto leading-relaxed">
          Giải phóng hoàn toàn thời gian thủ công cho Thầy Cô. Tự động nhận diện đáp án bôi đậm, gạch chân, soát lỗi đề bằng AI, trộn đề cân bằng 25% A-B-C-D và kiểm duyệt danh mục giáo trình dài hàng trăm trang.
        </p>

        {/* Hero Actions */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md sm:max-w-none mx-auto">
          {!user ? (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoggingIn}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white text-neutral-950 font-black text-sm shadow-[0_0_30px_rgba(255,255,255,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 canva-tap"
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
                <span>Đăng Nhập Với Google</span>
              </button>

              <button
                type="button"
                onClick={() => onEnterWorkspace('exam-tools')}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-[#7d2ae8] to-[#00c4cc] text-white font-black text-sm shadow-[0_0_30px_rgba(125,42,232,0.35)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 canva-tap"
              >
                <span>Vào Làm Việc Ngay</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onEnterWorkspace()}
              className="w-full sm:w-auto px-9 py-4 rounded-2xl bg-gradient-to-r from-[#7d2ae8] to-[#00c4cc] text-white font-black text-sm shadow-[0_0_35px_rgba(125,42,232,0.4)] hover:scale-[1.02] transition-all flex items-center justify-center gap-2.5 canva-tap"
            >
              <span>Mở Không Gian Làm Việc AzTool</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Feature Badges */}
        <div className="pt-6 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs font-semibold text-neutral-400">
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
      <section id="demo" className="relative z-10 max-w-5xl mx-auto px-4 sm:px-8 pb-20">
        <div className="rounded-3xl border border-white/10 bg-[#121524]/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <span className="text-[10px] font-black tracking-wider uppercase text-[#00c4cc]">
                TRẢI NGHIỆM TRỰC QUAN
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                Mô Phỏng Trực Quan Quy Trình Chuẩn Hóa
              </h2>
            </div>

            {/* Interactive Toggle Pill */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/5 border border-white/10 text-xs font-bold">
              <button
                onClick={() => setActiveInteractiveDemo('standardize')}
                className={`px-3 py-1.5 rounded-xl transition ${
                  activeInteractiveDemo === 'standardize'
                    ? 'bg-[#7d2ae8] text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                1. Chuẩn Hóa Word
              </button>
              <button
                onClick={() => setActiveInteractiveDemo('mix')}
                className={`px-3 py-1.5 rounded-xl transition ${
                  activeInteractiveDemo === 'mix'
                    ? 'bg-[#7d2ae8] text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                2. Trộn Đề 25%
              </button>
              <button
                onClick={() => setActiveInteractiveDemo('audit')}
                className={`px-3 py-1.5 rounded-xl transition ${
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            {/* Left: Input File State */}
            <div className="p-4.5 rounded-2xl bg-black/40 border border-white/10 space-y-3">
              <div className="flex items-center justify-between font-sans">
                <span className="font-bold text-neutral-400 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-amber-400" />
                  Đề Gốc Của Giáo Viên (Trước khi xử lý)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Thủ công
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-2 text-neutral-300">
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
                <div className="text-[11px] text-neutral-500 pt-1 font-sans">
                  ⚠️ Chưa có bảng đáp án tổng hợp, chưa thể trộn đề chống gian lận.
                </div>
              </div>
            </div>

            {/* Right: Output File State */}
            <div className="p-4.5 rounded-2xl bg-purple-950/20 border border-purple-500/30 space-y-3">
              <div className="flex items-center justify-between font-sans">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  AzTool Xử Lý Chuẩn Hóa Sau 1 Giây
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Chuẩn 100%
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-purple-900/40 space-y-2 text-neutral-300">
                <div className="text-[#00c4cc]">// Tự động đóng gói bản in &amp; Bảng X đỏ:</div>
                <div className="grid grid-cols-4 gap-1 text-center font-sans">
                  <div className="p-1 rounded bg-white/5 border border-white/10">1. B</div>
                  <div className="p-1 rounded bg-white/5 border border-white/10">2. A</div>
                  <div className="p-1 rounded bg-white/5 border border-white/10">3. D</div>
                  <div className="p-1 rounded bg-white/5 border border-white/10">4. C</div>
                </div>
                <div className="space-y-1 text-[11px] text-neutral-300 font-sans pt-1">
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

          <div className="flex justify-center pt-2">
            <button
              onClick={() => onEnterWorkspace('exam-tools')}
              className="canva-btn-primary px-7 py-3 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg canva-tap"
            >
              <span>Thử Nghiệm Ngay Với File Của Bạn</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Bento Grid Features Section */}
      <section id="features" className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 pb-24 space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-[#00c4cc]">
            HỆ THỐNG CÔNG CỤ SỐ ĐA NĂNG
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white">
            Bộ Giải Pháp Toàn Diện Cho Nhà Giáo &amp; Khảo Thí
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400">
            Mọi tính năng đều được tối ưu hóa cho trải nghiệm mượt mà, chính xác đến từng ký tự
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {bentoFeatures.map(f => (
            <div
              key={f.id}
              onClick={() => onEnterWorkspace(f.targetTab)}
              className={`${f.colSpan} p-7 rounded-3xl border border-white/10 bg-[#121524]/80 backdrop-blur-md hover:border-[#7d2ae8] transition-all duration-300 cursor-pointer group flex flex-col justify-between space-y-5 hover:-translate-y-1`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[#00c4cc]">
                    {f.tag}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[#7d2ae8] transition-colors">
                    <ArrowUpRight className="w-4 h-4 text-white" />
                  </div>
                </div>

                <h3 className="text-xl sm:text-2xl font-black text-white group-hover:text-[#00c4cc] transition-colors">
                  {f.title}
                </h3>

                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                  {f.desc}
                </p>

                <div className="space-y-2 pt-2 border-t border-white/10">
                  {f.bullets.map((b, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-neutral-300">
                      <CheckCircle2 className="w-4 h-4 text-[#00c4cc] shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2 text-xs font-bold text-[#00c4cc] group-hover:translate-x-1 transition-transform">
                <span>Khám phá công cụ này</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Teacher Testimonials Section */}
      <section id="testimonials" className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 pb-24 space-y-10">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-[#ff66c4]">
            ĐÁNH GIÁ TỪ CHUYÊN GIA
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Được Hàng Ngàn Thầy Cô &amp; Giảng Viên Tin Dùng
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, idx) => (
            <div
              key={idx}
              className="p-6 rounded-3xl border border-white/10 bg-[#121524]/60 backdrop-blur-md space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-1">
                  {[...Array(t.stars)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed italic">
                  "{t.comment}"
                </p>
              </div>

              <div className="border-t border-white/10 pt-3">
                <div className="font-bold text-xs text-white">{t.name}</div>
                <div className="text-[11px] text-neutral-400">{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section id="faq" className="relative z-10 max-w-4xl mx-auto px-4 sm:px-8 pb-24 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-[#00c4cc]">
            CÂU HỎI THƯỜNG GẶP
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Giải Đáp Mọi Thắc Mắc Về AzTool
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((item, idx) => {
            const isOpen = expandedFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-white/10 overflow-hidden bg-[#121524]/80 backdrop-blur-md transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setExpandedFaq(isOpen ? null : idx)}
                  className="w-full p-4.5 text-left font-bold text-xs sm:text-sm flex items-center justify-between gap-3 text-white hover:text-[#00c4cc] transition-colors"
                >
                  <span>{item.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-[#00c4cc] shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-4.5 pb-4 text-xs text-neutral-400 leading-relaxed border-t border-white/10 pt-3 font-normal">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Modern SaaS Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-[#0d0f18] py-12 text-xs text-neutral-500 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="cursor-pointer" onClick={() => scrollToSection('hero')}>
              <DeQLogo size="sm" showSubtitle />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-neutral-300">
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

          <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-neutral-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00c4cc]" />
              <span>© 2026 AzTool Studio (AzTool.vercel.app). All rights reserved.</span>
            </div>

            <div className="flex items-center gap-4">
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

      {/* Fallback Email Sign-in Modal */}
      {showEmailModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowEmailModal(false)}
          className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 modal-backdrop-enter"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="canva-card rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-white/20 modal-card-enter bg-[#121524]"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl canva-gradient-bg text-white flex items-center justify-center shadow-xs">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white">
                    Đăng Nhập Tài Khoản AzTool
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Nhập địa chỉ Gmail để tiếp tục vào không gian làm việc
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEmailModal(false)}
                className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-white/10 text-neutral-400 hover:text-white transition canva-tap"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEmailContinue} className="space-y-3.5 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-neutral-300 block">
                  Địa chỉ Email Google:
                </label>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  placeholder="tenban@gmail.com"
                  className="w-full p-3 rounded-xl border border-white/10 bg-neutral-900 text-white focus:outline-none focus:ring-2 focus:ring-[#7d2ae8]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-neutral-300 block">
                  Tên hiển thị (Tùy chọn):
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  placeholder="VD: Thầy Nguyễn Văn A"
                  className="w-full p-3 rounded-xl border border-white/10 bg-neutral-900 text-white focus:outline-none focus:ring-2 focus:ring-[#7d2ae8]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="px-4 py-2.5 rounded-xl font-semibold bg-white/5 hover:bg-white/10 text-neutral-300 canva-tap"
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
