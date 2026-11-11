'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  Layers,
  Sparkles,
  FileCheck,
  Shuffle,
  GraduationCap,
  FileSpreadsheet,
  BookOpen,
  Crown,
  ArrowRight,
  Lock,
  Unlock,
  CheckCircle2,
  Zap,
  ShieldCheck,
  ChevronRight,
  Flame,
  Star,
  Compass,
} from 'lucide-react';

export interface SkillItem {
  id: 'exam-tools' | 'thesis-auditor' | 'pdf-studio' | 'guide' | 'admin';
  title: string;
  tagline: string;
  desc: string;
  category: 'CỐT LÕI' | 'HỌC THUẬT' | 'TIỆN ÍCH' | 'TÀI LIỆU' | 'QUẢN TRỊ';
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  glowColor: string;
  badge?: string;
  badgeColor?: string;
  unlocked: boolean;
  requirePerm: boolean;
  subFeatures: string[];
  stats?: string;
}

interface SkillHubGridProps {
  onSelectSkill: (skillId: SkillItem['id']) => void;
  openAdminModal?: () => void;
}

export function SkillHubGrid({ onSelectSkill }: SkillHubGridProps) {
  const { user, isSuperAdmin, hasTabAccess } = useAuth();

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
      tagline: 'AI Soát Lỗi • Chuẩn Hóa Word • Trộn Đề 25%',
      desc: 'Quy trình 3 bước hoàn chỉnh: phát hiện lỗi đề bằng AI, chuẩn hóa đáp án bôi đậm/gạch chân sang bảng đáp án chuẩn, và hoán vị cân bằng 25% các phương án A-B-C-D.',
      category: 'CỐT LÕI',
      icon: Layers,
      gradient: 'from-[#00c4cc] via-[#7d2ae8] to-[#ff66c4]',
      glowColor: 'group-hover:shadow-[0_20px_50px_rgba(125,42,232,0.22)]',
      badge: 'Được Dùng Nhiều Nhất',
      badgeColor: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
      unlocked: canUseExamTools,
      requirePerm: true,
      subFeatures: [
        'AI Soát đề: Phát hiện lỗi sai đề, thiếu đáp án, trùng phương án',
        'Chuẩn hóa 1 chạm: Nhận diện mọi kiểu gạch chân, in đậm, bảng X',
        'Trộn mã đề: Cân bằng hoàn hảo 25% A-B-C-D kèm phiếu đáp án',
        'Bảo toàn 100% công thức MathType và hình ảnh gốc',
      ],
      stats: '⚡ Tốc độ ~1.2s / 50 câu',
    },
    {
      id: 'thesis-auditor',
      title: 'Rà Soát Đề Án & Giáo Trình',
      tagline: 'Từ Viết Tắt • Danh Mục Bảng Biểu & Hình Ảnh',
      desc: 'Công cụ chuyên sâu dành cho Luận văn, Đề án và Giáo trình dài hàng trăm trang. AI quét toàn diện, bóc tách danh mục và hỗ trợ sửa trực tiếp vào file Word không lệch dòng.',
      category: 'HỌC THUẬT',
      icon: GraduationCap,
      gradient: 'from-indigo-600 via-purple-600 to-pink-600',
      glowColor: 'group-hover:shadow-[0_20px_50px_rgba(99,102,241,0.22)]',
      badge: 'Công Nghệ Độc Quyền',
      badgeColor: 'bg-indigo-500 text-white',
      unlocked: canUseThesisAuditor,
      requirePerm: true,
      subFeatures: [
        'Bóc tách 100% danh mục từ viết tắt và vị trí xuất hiện đầu tiên',
        'Phát hiện lỗi nhảy cóc số thứ tự ảnh/bảng (vd: Hình 2.3 nhảy sang 2.5)',
        'Sửa lỗi trực tiếp vào file Word không làm xô lệch format',
        'Hỗ trợ xuất danh mục tự động đạt chuẩn thẩm định học thuật',
      ],
      stats: '🎓 Chuẩn Đề án & Luận án',
    },
    {
      id: 'pdf-studio',
      title: 'PDF & Cắt Tách Trang Studio',
      tagline: 'Cắt Theo Setting • Xoay Trang • Xóa • Gộp File',
      desc: 'Bộ tiện ích xử lý PDF siêu nhẹ chạy trực tiếp trên trình duyệt (Client-Side). Bảo mật 100% vì file không bị tải lên bất kỳ máy chủ bên thứ 3 nào.',
      category: 'TIỆN ÍCH',
      icon: FileSpreadsheet,
      gradient: 'from-rose-500 via-orange-500 to-amber-500',
      glowColor: 'group-hover:shadow-[0_20px_50px_rgba(244,63,94,0.22)]',
      badge: 'Client-Side Siêu Tốc',
      badgeColor: 'bg-emerald-500 text-white',
      unlocked: canUsePdfStudio,
      requirePerm: true,
      subFeatures: [
        'Tách dải trang tùy biến: 1-5, 8, 12-25 nhanh như chớp',
        'Xoay hướng trang ngang/dọc linh hoạt và lưu tức thì',
        'Gộp nhiều tài liệu PDF thành 1 tập thống nhất',
        'Không giới hạn dung lượng file & bảo mật tuyệt đối',
      ],
      stats: '🔒 100% xử lý tại máy bạn',
    },
    {
      id: 'guide',
      title: 'Quy Chuẩn Soạn Đề & Tài Liệu',
      tagline: 'Cú Pháp Chuẩn • File Mẫu • Mẹo Định Dạng',
      desc: 'Kho tài liệu hướng dẫn quy chuẩn soạn đề thi chuẩn sư phạm, cú pháp đánh dấu đáp án đúng, cách chèn bảng biểu tối ưu và tải các file mẫu chuẩn.',
      category: 'TÀI LIỆU',
      icon: BookOpen,
      gradient: 'from-blue-500 to-cyan-500',
      glowColor: 'group-hover:shadow-[0_20px_50px_rgba(6,182,212,0.22)]',
      badge: 'Miễn Phí Mọi Lúc',
      badgeColor: 'bg-blue-500 text-white',
      unlocked: true,
      requirePerm: false,
      subFeatures: [
        'Quy tắc gạch chân / in đậm phương án đúng chuẩn mực',
        'Mẫu đề thi trắc nghiệm chuẩn đầu ra Bộ GD&ĐT',
        'Tải file mẫu Word (.docx) về máy để dùng ngay',
        'Mẹo định dạng bảng biểu và công thức toán không lỗi',
      ],
      stats: '📖 Hướng dẫn chi tiết',
    },
  ];

  if (isSuperAdmin) {
    skills.push({
      id: 'admin',
      title: 'Trung Tâm Quản Trị Hệ Thống',
      tagline: 'Phân Quyền Giáo Viên • Giám Sát • Kho Đề Cloud',
      desc: 'Bảng điều khiển độc quyền dành cho Quản trị viên: cấp/khóa 5 quyền tính năng thời gian thực, quản lý hạn mức ngày, mở VIP không giới hạn và duyệt đề thi.',
      category: 'QUẢN TRỊ',
      icon: Crown,
      gradient: 'from-amber-400 via-orange-500 to-rose-500',
      glowColor: 'group-hover:shadow-[0_20px_50px_rgba(245,158,11,0.28)]',
      badge: 'Super Admin PRO',
      badgeColor: 'bg-amber-500 text-neutral-950 font-black',
      unlocked: true,
      requirePerm: false,
      subFeatures: [
        'Cấp / Thu hồi quyền 5 module tức thì cho từng Giáo viên',
        'Theo dõi dữ liệu tải lên, số lượt dùng và lịch sử chi tiết',
        'Khóa / Mở khóa tài khoản & cấp VIP Unlimited',
        'Đồng bộ tức thì xuyên Serverless & Cloud Database',
      ],
      stats: '👑 Quyền hạn tối cao',
    });
  }

  return (
    <div className="space-y-5 sm:space-y-8 py-1 sm:py-2 animate-in fade-in zoom-in-95 duration-300 w-full max-w-full overflow-hidden">
      {/* Header Banner introducing the Hub */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl p-4 sm:p-9 bg-gradient-to-br from-white via-purple-50/40 to-cyan-50/30 dark:from-[#151824] dark:via-[#191d2d] dark:to-[#121520] border border-neutral-200/90 dark:border-neutral-800/90 shadow-sm">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#7d2ae8]/10 dark:bg-[#7d2ae8]/20 border border-[#7d2ae8]/20 text-[10px] sm:text-[11px] font-extrabold text-[#7d2ae8] dark:text-purple-300">
              <Compass className="w-3.5 h-3.5" />
              <span>KHÔNG GIAN LÀM VIỆC TỔNG THỂ • SKILL LAUNCHER</span>
            </div>
            <h1 className="text-xl sm:text-3xl lg:text-4xl font-black text-neutral-900 dark:text-white tracking-tight leading-snug">
              Chọn chức năng bạn muốn làm việc hôm nay
            </h1>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Mỗi tính năng được tối ưu thành một module độc lập, tốc độ cao. Chọn một thẻ bên dưới để bắt đầu làm việc, bạn có thể dễ dàng chuyển đổi tính năng bất cứ lúc nào!
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="px-3.5 py-2 sm:px-4 sm:py-3 rounded-2xl bg-white dark:bg-[#12151f] border border-neutral-200 dark:border-neutral-800 shadow-2xs text-left w-full sm:w-auto">
              <div className="text-[9px] sm:text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                Tài khoản đang đăng nhập
              </div>
              <div className="text-xs font-black text-neutral-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="truncate max-w-[200px]">{user?.displayName || user?.email || 'Khách'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Wide Interactive Skill Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {skills.map(skill => {
          const Icon = skill.icon;
          return (
            <div
              key={skill.id}
              onClick={() => onSelectSkill(skill.id)}
              className={`group relative p-4.5 sm:p-7 rounded-2xl sm:rounded-3xl border-2 transition-all duration-300 cursor-pointer flex flex-col justify-between overflow-hidden bg-white dark:bg-[#151824] ${skill.glowColor} ${
                skill.unlocked
                  ? 'border-neutral-200/90 dark:border-neutral-800/90 hover:border-[#7d2ae8] dark:hover:border-purple-500 hover:-translate-y-1'
                  : 'border-amber-200/80 dark:border-amber-900/50 hover:border-amber-400 opacity-95'
              }`}
            >
              {/* Card Header */}
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                  <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                    <div
                      className={`w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br ${skill.gradient} text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300 shrink-0`}
                    >
                      <Icon className="w-5 h-5 sm:w-7 sm:h-7" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="text-[9px] sm:text-[10px] font-black tracking-wider uppercase text-neutral-400 dark:text-neutral-500">
                          {skill.category}
                        </span>
                        {skill.badge && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-black uppercase tracking-wider shadow-2xs ${
                              skill.badgeColor || 'bg-purple-100 text-[#7d2ae8]'
                            }`}
                          >
                            {skill.badge}
                          </span>
                        )}
                      </div>
                      <h2 className="text-base sm:text-xl font-black text-neutral-900 dark:text-white group-hover:text-[#7d2ae8] dark:group-hover:text-[#00c4cc] transition-colors mt-0.5 truncate">
                        {skill.title}
                      </h2>
                    </div>
                  </div>

                  {/* Lock/Unlock Badge */}
                  {skill.requirePerm && (
                    <span
                      className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl text-[9px] sm:text-[10px] font-extrabold flex items-center gap-1 shrink-0 ${
                        skill.unlocked
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      }`}
                    >
                      {skill.unlocked ? (
                        <>
                          <Unlock className="w-3 h-3 text-emerald-500" />
                          <span className="hidden sm:inline">Đã mở quyền</span>
                          <span className="sm:hidden">Mở</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3 h-3 text-amber-500" />
                          <span className="hidden sm:inline">Cần cấp quyền</span>
                          <span className="sm:hidden">Khóa</span>
                        </>
                      )}
                    </span>
                  )}
                </div>

                <div className="text-[11px] sm:text-xs font-bold text-[#7d2ae8] dark:text-purple-300">
                  {skill.tagline}
                </div>

                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  {skill.desc}
                </p>

                {/* Sub-capabilities Checklist */}
                <div className="space-y-1.5 sm:space-y-2 pt-2.5 sm:pt-3 border-t border-neutral-100 dark:border-neutral-800/90">
                  {skill.subFeatures.map((feat, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 text-[10px] sm:text-[11px] text-neutral-700 dark:text-neutral-300 leading-tight"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#00c4cc] shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card Footer Action */}
              <div className="pt-4 sm:pt-6 flex items-center justify-between border-t border-neutral-100 dark:border-neutral-800/80 mt-4 sm:mt-5">
                <span className="text-[10px] sm:text-[11px] font-bold text-neutral-500 dark:text-neutral-400">
                  {skill.stats || '🚀 Sẵn sàng sử dụng'}
                </span>

                <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-black text-[#7d2ae8] dark:text-[#00c4cc] group-hover:translate-x-1 transition-transform">
                  <span>Mở chức năng</span>
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-purple-50 dark:bg-purple-950/70 flex items-center justify-center">
                    <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
