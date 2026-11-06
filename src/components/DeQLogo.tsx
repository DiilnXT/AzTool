'use client';

import React, { useId } from 'react';

interface AzToolLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  lightText?: boolean;
  isLoadingMode?: boolean;
}

export function DeQLogo({
  size = 'md',
  showSubtitle = true,
  lightText = false,
  isLoadingMode = false,
}: AzToolLogoProps) {
  const uid = useId().replace(/:/g, '');
  const gradId = `azCalligraphyGrad_${uid}`;
  const ribbonId = `azRibbonGrad_${uid}`;
  const glowId = `azGlow_${uid}`;

  const dimensions = {
    xs: { width: 78, height: 26 },
    sm: { width: 108, height: 36 },
    md: { width: 134, height: 44 },
    lg: { width: 186, height: 60 },
    xl: { width: 248, height: 80 },
  }[size];

  return (
    <div className="inline-flex items-center gap-2.5 select-none group">
      {/* Continuously Animated Calligraphy SVG Wordmark: "AzTool" */}
      <div className={`relative flex items-center ${isLoadingMode ? 'az-logo-loading-pulse' : 'az-logo-float'}`}>
        <svg
          width={dimensions.width}
          height={dimensions.height}
          viewBox="0 0 265 84"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="overflow-visible"
          aria-label="AzTool Calligraphy Logo"
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00C4CC">
                <animate
                  attributeName="stop-color"
                  values="#00C4CC;#7D2AE8;#FF66C4;#00C4CC"
                  dur={isLoadingMode ? '1.8s' : '4.5s'}
                  repeatCount="indefinite"
                />
              </stop>
              <stop offset="50%" stopColor="#7D2AE8">
                <animate
                  attributeName="stop-color"
                  values="#7D2AE8;#FF66C4;#00C4CC;#7D2AE8"
                  dur={isLoadingMode ? '1.8s' : '4.5s'}
                  repeatCount="indefinite"
                />
              </stop>
              <stop offset="100%" stopColor="#FF66C4">
                <animate
                  attributeName="stop-color"
                  values="#FF66C4;#00C4CC;#7D2AE8;#FF66C4"
                  dur={isLoadingMode ? '1.8s' : '4.5s'}
                  repeatCount="indefinite"
                />
              </stop>
            </linearGradient>

            <linearGradient id={ribbonId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00C4CC">
                <animate
                  attributeName="stop-color"
                  values="#00C4CC;#FF66C4;#00C4CC"
                  dur={isLoadingMode ? '1.4s' : '3.5s'}
                  repeatCount="indefinite"
                />
              </stop>
              <stop offset="50%" stopColor="#8B3DFF" />
              <stop offset="100%" stopColor="#FF66C4">
                <animate
                  attributeName="stop-color"
                  values="#FF66C4;#00C4CC;#FF66C4"
                  dur={isLoadingMode ? '1.4s' : '3.5s'}
                  repeatCount="indefinite"
                />
              </stop>
            </linearGradient>

            <filter id={glowId} x="-25%" y="-25%" width="150%" height="150%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Stroke 1: Calligraphic "A" + Cursive "z" */}
          <path
            d="M 10 55 C 16 56, 26 24, 34 14 C 39 24, 44 46, 48 55 M 17 39 C 28 34, 42 34, 53 37 M 57 33 C 66 31, 74 31, 79 32 C 71 41, 63 48, 57 54 C 66 53, 75 54, 80 57 C 83 60, 77 68, 70 65 C 66 63, 73 53, 85 46"
            stroke={`url(#${gradId})`}
            strokeWidth="4.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={isLoadingMode ? 'calligraphy-loop-fast-1' : 'calligraphy-loop-1'}
            filter={`url(#${glowId})`}
          />

          {/* Stroke 2: Calligraphic Capital "T" */}
          <path
            d="M 92 20 C 105 13, 124 23, 139 16 M 115 18 C 111 32, 108 46, 110 53 C 112 58, 119 57, 125 50"
            stroke={`url(#${gradId})`}
            strokeWidth="4.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={isLoadingMode ? 'calligraphy-loop-fast-2' : 'calligraphy-loop-2'}
            filter={`url(#${glowId})`}
          />

          {/* Stroke 3: Flowing Cursive "oo" */}
          <path
            d="M 148 35 C 136 33, 130 42, 132 50 C 134 57, 144 58, 150 51 C 155 44, 152 35, 145 35 C 150 38, 158 38, 165 35 M 181 35 C 169 33, 163 42, 165 50 C 167 57, 177 58, 183 51 C 188 44, 185 35, 178 35 C 183 38, 191 38, 197 34"
            stroke={`url(#${gradId})`}
            strokeWidth="4.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={isLoadingMode ? 'calligraphy-loop-fast-3' : 'calligraphy-loop-3'}
          />

          {/* Stroke 4: Tall Calligraphic Loop "l" */}
          <path
            d="M 197 44 C 205 33, 214 18, 210 13 C 206 9, 200 18, 199 34 C 198 46, 200 55, 207 56 C 213 56, 220 50, 225 44"
            stroke={`url(#${gradId})`}
            strokeWidth="4.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={isLoadingMode ? 'calligraphy-loop-fast-4' : 'calligraphy-loop-4'}
            filter={`url(#${glowId})`}
          />

          {/* Stroke 5: Dynamic Calligraphy Brush Flourish Underline */}
          <path
            d="M 18 68 C 78 60, 168 75, 244 58 C 220 73, 136 78, 46 73"
            stroke={`url(#${ribbonId})`}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={isLoadingMode ? 'calligraphy-loop-fast-5' : 'calligraphy-loop-5'}
          />

          {/* Animated Pen Nib Sparkle Dots */}
          <circle
            cx="248"
            cy="55"
            r="3.8"
            fill="#FF66C4"
            className="calligraphy-dot-infinite"
          />
          <circle
            cx="228"
            cy="20"
            r="2.8"
            fill="#00C4CC"
            className="calligraphy-dot-infinite-delayed"
          />
        </svg>
      </div>

      {showSubtitle && (
        <div className="flex flex-col text-left border-l border-neutral-200/80 dark:border-neutral-800 pl-2.5">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                lightText
                  ? 'bg-white/20 text-white border border-white/25'
                  : 'bg-purple-100 text-[#7d2ae8] dark:bg-purple-950/70 dark:text-purple-300'
              }`}
            >
              AI Studio
            </span>
          </div>
          <span
            className={`text-[10px] font-medium mt-0.5 hidden sm:inline ${
              lightText ? 'text-purple-200' : 'text-neutral-400'
            }`}
          >
            Nền Tảng Công Cụ Thông Minh
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Dedicated Animated Logo Loading / Thinking / Processing Indicator
 * Used across all loading HUDs, AI thinking states, and file processing spinners.
 */
export function AzLogoLoader({
  size = 'md',
  label,
  sublabel,
}: {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  label?: string;
  sublabel?: string;
}) {
  return (
    <div className="inline-flex flex-col items-center justify-center gap-2 text-center">
      <div className="relative flex items-center justify-center px-3 py-1.5 rounded-2xl bg-gradient-to-r from-purple-500/10 via-cyan-500/10 to-pink-500/10 border border-purple-500/20 shadow-sm">
        <DeQLogo size={size} showSubtitle={false} isLoadingMode />
      </div>
      {label && (
        <div className="text-xs font-extrabold text-neutral-900 dark:text-white tracking-tight">
          {label}
        </div>
      )}
      {sublabel && (
        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 max-w-xs">
          {sublabel}
        </div>
      )}
    </div>
  );
}

export const AzToolLogo = DeQLogo;
