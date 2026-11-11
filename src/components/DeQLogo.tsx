'use client';

import React from 'react';

interface DeQLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  isLoadingMode?: boolean;
}

export function DeQLogo({
  size = 'md',
  showSubtitle = true,
  isLoadingMode = false,
}: DeQLogoProps) {
  const dimensions = {
    xs: { w: 46, h: 30, title: 'text-sm', sub: 'text-[8px]' },
    sm: { w: 62, h: 38, title: 'text-lg', sub: 'text-[9px]' },
    md: { w: 78, h: 46, title: 'text-xl', sub: 'text-[10px]' },
    lg: { w: 106, h: 62, title: 'text-2xl', sub: 'text-xs' },
    xl: { w: 138, h: 80, title: 'text-3xl', sub: 'text-xs' },
  }[size];

  const strokeClass = (index: number) =>
    isLoadingMode ? `calligraphy-loop-fast-${index}` : `calligraphy-loop-${index}`;

  return (
    <div className="inline-flex items-center gap-2.5 select-none group">
      {/* Animated Calligraphy "Az" Signature SVG */}
      <div
        className={`relative flex items-center justify-center rounded-2xl p-1.5 transition-transform duration-500 ${
          isLoadingMode
            ? 'az-logo-loading-pulse bg-gradient-to-br from-[#00c4cc]/20 via-[#7d2ae8]/20 to-[#ff66c4]/20 shadow-lg shadow-purple-500/25 border border-purple-400/50'
            : 'az-logo-float bg-gradient-to-br from-[#00c4cc]/10 via-[#7d2ae8]/10 to-[#ff66c4]/10 group-hover:scale-105 border border-purple-200/50 dark:border-purple-800/40 shadow-xs'
        }`}
      >
        {/* Active Orbital Ring when Loading */}
        {isLoadingMode && (
          <div className="pointer-events-none absolute -inset-1.5 rounded-2xl overflow-hidden">
            <svg className="w-full h-full az-orbit-spin" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="az-orbit-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00c4cc" stopOpacity="1" />
                  <stop offset="50%" stopColor="#7d2ae8" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#ff66c4" stopOpacity="0" />
                </linearGradient>
              </defs>
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="url(#az-orbit-grad)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="160 140"
              />
            </svg>
          </div>
        )}

        <svg
          width={dimensions.w}
          height={dimensions.h}
          viewBox="0 0 185 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="overflow-visible relative z-10"
        >
          <defs>
            <linearGradient id="az-grad-main" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00c4cc" />
              <stop offset="50%" stopColor="#7d2ae8" />
              <stop offset="100%" stopColor="#ff66c4" />
            </linearGradient>

            <linearGradient id="az-grad-accent" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7d2ae8" />
              <stop offset="50%" stopColor="#ff66c4" />
              <stop offset="100%" stopColor="#ffb800" />
            </linearGradient>

            <filter id="az-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Subtle background guide tracks during loading so calligraphy path is always visible */}
          {isLoadingMode && (
            <g opacity="0.22">
              <path
                d="M 18 78 C 28 56, 44 20, 56 14 C 63 11, 68 24, 74 52 C 78 68, 82 77, 88 79"
                stroke="url(#az-grad-main)"
                strokeWidth="7.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M 28 53 C 46 47, 68 45, 86 50"
                stroke="url(#az-grad-accent)"
                strokeWidth="5.5"
                strokeLinecap="round"
              />
              <path
                d="M 98 38 C 114 34, 132 34, 145 36 C 128 52, 110 64, 98 76 C 114 78, 134 78, 154 71"
                stroke="url(#az-grad-main)"
                strokeWidth="6.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M 22 88 C 65 96, 122 93, 168 78 C 155 83, 132 86, 112 84"
                stroke="url(#az-grad-accent)"
                strokeWidth="3.6"
                strokeLinecap="round"
              />
            </g>
          )}

          {/* Stroke 1: Calligraphy "A" Left-to-Apex-to-Right Flourish */}
          <path
            d="M 18 78 C 28 56, 44 20, 56 14 C 63 11, 68 24, 74 52 C 78 68, 82 77, 88 79"
            pathLength={100}
            stroke="url(#az-grad-main)"
            strokeWidth="7.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#az-glow)"
            className={`calligraphy-path ${strokeClass(1)}`}
          />

          {/* Stroke 2: Calligraphy "A" Artistic Crossbar Ribbon */}
          <path
            d="M 28 53 C 46 47, 68 45, 86 50"
            pathLength={100}
            stroke="url(#az-grad-accent)"
            strokeWidth="5.5"
            strokeLinecap="round"
            className={`calligraphy-path ${strokeClass(2)}`}
          />

          {/* Stroke 3: Cursive "z" Body with Lower Loop */}
          <path
            d="M 98 38 C 114 34, 132 34, 145 36 C 128 52, 110 64, 98 76 C 114 78, 134 78, 154 71"
            pathLength={100}
            stroke="url(#az-grad-main)"
            strokeWidth="6.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#az-glow)"
            className={`calligraphy-path ${strokeClass(3)}`}
          />

          {/* Stroke 4: Master Calligraphy Underline Sweep */}
          <path
            d="M 22 88 C 65 96, 122 93, 168 78 C 155 83, 132 86, 112 84"
            pathLength={100}
            stroke="url(#az-grad-accent)"
            strokeWidth="3.6"
            strokeLinecap="round"
            className={`calligraphy-path ${strokeClass(5)}`}
          />

          {/* Sparkle Accents */}
          <circle
            cx="162"
            cy="24"
            r="3.8"
            fill="#00c4cc"
            className="calligraphy-dot-infinite"
          />
          <circle
            cx="172"
            cy="36"
            r="2.4"
            fill="#ff66c4"
            className="calligraphy-dot-infinite-delayed"
          />
        </svg>
      </div>

      {/* Brand Wordmark */}
      {showSubtitle ? (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5">
            <span className={`${dimensions.title} font-black tracking-tight canva-gradient-text whitespace-nowrap`}>
              AzTool
            </span>
            <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded-md bg-gradient-to-r from-[#00c4cc] to-[#7d2ae8] text-white shadow-2xs">
              AI
            </span>
          </div>
          <span
            className={`${dimensions.sub} hidden sm:block font-semibold text-neutral-400 dark:text-neutral-500 tracking-wide mt-0.5 whitespace-nowrap`}
          >
            Nền tảng Tài liệu &amp; Khảo thí
          </span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Full-featured Animated AzTool Calligraphy Loader for AI & Document Processing States
 */
export function AzLogoLoader({
  title,
  subtitle,
  label,
  sublabel,
  size = 'lg',
  progress,
}: {
  title?: string;
  subtitle?: string;
  label?: string;
  sublabel?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  progress?: number;
}) {
  const displayTitle = title || label || 'Hệ thống AzTool đang xử lý...';
  const displaySubtitle = subtitle ?? sublabel ?? 'Vui lòng đợi trong giây lát';
  const validProgress =
    typeof progress === 'number' && !isNaN(progress)
      ? Math.max(0, Math.min(100, Math.round(progress)))
      : undefined;

  return (
    <div className="flex flex-col items-center justify-center py-6 px-4 text-center space-y-3.5">
      <div className="relative flex items-center justify-center">
        <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-[#00c4cc]/30 via-[#7d2ae8]/30 to-[#ff66c4]/30 blur-xl animate-pulse" />
        <DeQLogo size={size} showSubtitle={false} isLoadingMode />
        {validProgress !== undefined && (
          <span className="absolute -bottom-2 -right-3 z-20 px-2 py-0.5 rounded-full text-[11px] font-black font-mono bg-gradient-to-r from-[#00c4cc] to-[#7d2ae8] text-white shadow-md border border-white/60 dark:border-neutral-900">
            {validProgress}%
          </span>
        )}
      </div>
      <div className="space-y-1 max-w-md">
        <p className="text-sm font-extrabold canva-gradient-text">{displayTitle}</p>
        {displaySubtitle && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{displaySubtitle}</p>
        )}
      </div>
      {validProgress !== undefined && (
        <div className="w-56 max-w-full space-y-1 pt-0.5">
          <div className="w-full h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden p-0.5 border border-neutral-200/60 dark:border-neutral-700/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#00c4cc] via-[#7d2ae8] to-[#ff66c4] transition-all duration-200 ease-out"
              style={{ width: `${Math.max(4, validProgress)}%` }}
            />
          </div>
          <p className="text-[10px] font-mono font-bold text-[#7d2ae8] dark:text-purple-300">
            Tiến độ hoàn thành: {validProgress}%
          </p>
        </div>
      )}
    </div>
  );
}
