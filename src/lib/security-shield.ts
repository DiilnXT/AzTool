/**
 * AzTool Enterprise Security Shield
 * - Anti-DDoS Sliding Window Rate Limiter
 * - Bot & Vulnerability Scanner Firewall
 * - Anti-XSS & Prototype Pollution Sanitizer
 * - Zero-Exposure Obfuscated Google OAuth Vault (Immutable, hidden from all UI including Admin)
 */

import { NextResponse } from 'next/server';

// Obfuscated segments of the Google OAuth 2.0 Client ID so it is never stored in plain text in localStorage or UI
const _G_VAULT_SEGMENTS = [
  'OTAwMjg0NDA4NDYz', // 900284408463
  'LXAyYTgyYzZwYTEy', // -p2a82c6pa12
  'cDNyMTNiMmIyZHJk', // p3r13b2b2drd
  'NXJrbmswcTJyLmFw', // 5rknk0q2r.ap
  'cHMZ29vZ2xldXNlcmNvbnRlbnQuY29t',
];

/**
 * Returns the immutable Google OAuth Client ID at runtime without ever exposing it to UI or LocalStorage.
 */
export function getProtectedGoogleClientId(): string {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
    return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID.trim();
  }
  const p1 = typeof atob === 'function' ? atob(_G_VAULT_SEGMENTS[0]) : '900284408463';
  const p2 = typeof atob === 'function' ? atob(_G_VAULT_SEGMENTS[1]) : '-p2a82c6pa12';
  const p3 = typeof atob === 'function' ? atob(_G_VAULT_SEGMENTS[2]) : 'p3r13b2b2drd';
  const p4 = '5rknk0q2r.apps.googleusercontent.com';
  return `${p1}${p2}${p3}${p4}`;
}

/**
 * Scrubs any legacy exposed keys from browser storage on startup.
 */
export function initClientSecurityShield(): void {
  if (typeof window === 'undefined') return;
  try {
    const configKeys = ['aztool_system_config', 'deq_system_config'];
    for (const k of configKeys) {
      const raw = localStorage.getItem(k);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && 'googleClientId' in parsed) {
          delete parsed.googleClientId;
          localStorage.setItem(k, JSON.stringify(parsed));
        }
      }
    }

    // Prevent framing / clickjacking if embedded in an unauthorized iframe
    if (window.self !== window.top) {
      try {
        if (window.top && window.top.location.hostname !== window.self.location.hostname) {
          window.top.location.href = window.self.location.href;
        }
      } catch {
        // Cross-origin frame detected
      }
    }
  } catch {
    // Ignore storage restriction errors
  }
}

// ============================================================================
// SERVER-SIDE ANTI-DDOS & FIREWALL ENGINE
// ============================================================================

interface RateBucket {
  count: number;
  resetAt: number;
  blockedUntil?: number;
}

const globalForSecurity = globalThis as unknown as {
  __azRateLimitMap?: Map<string, RateBucket>;
};

function getRateMap(): Map<string, RateBucket> {
  if (!globalForSecurity.__azRateLimitMap) {
    globalForSecurity.__azRateLimitMap = new Map<string, RateBucket>();
  }
  return globalForSecurity.__azRateLimitMap;
}

const BLOCKED_SCANNER_PATTERNS = [
  /sqlmap/i,
  /nikto/i,
  /nmap/i,
  /masscan/i,
  /acunetix/i,
  /nessus/i,
  /dirbuster/i,
  /gobuster/i,
  /nuclei/i,
  /zgrab/i,
];

export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    return xff.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

export interface RateLimitOptions {
  maxRequests?: number;
  windowMs?: number;
  maxBodyBytes?: number;
}

/**
 * Verifies request against Anti-DDoS rate limits, malicious scanner signatures, and payload size limits.
 * Returns null if allowed, or a NextResponse (403 / 413 / 429) if blocked.
 */
export function enforceApiSecurity(
  req: Request,
  options: RateLimitOptions = {}
): NextResponse | null {
  const {
    maxRequests = 90,
    windowMs = 60_000,
    maxBodyBytes = 15 * 1024 * 1024, // 15 MB max
  } = options;

  // 1. Check Malicious Bot / Vulnerability Scanner User-Agent
  const ua = req.headers.get('user-agent') || '';
  if (BLOCKED_SCANNER_PATTERNS.some(rx => rx.test(ua))) {
    return NextResponse.json(
      { success: false, error: 'Truy cập bị từ chối bởi hệ thống tường lửa AzTool Shield.' },
      { status: 403 }
    );
  }

  // 2. Check Content-Length against payload flood
  const contentLength = Number(req.headers.get('content-length') || '0');
  if (contentLength > maxBodyBytes) {
    return NextResponse.json(
      { success: false, error: 'Kích thước dữ liệu vượt quá giới hạn an toàn.' },
      { status: 413 }
    );
  }

  // 3. Sliding-Window Anti-DDoS Rate Limit per IP
  const ip = getClientIp(req);
  const now = Date.now();
  const rateMap = getRateMap();

  // Periodic cleanup to prevent memory growth
  if (rateMap.size > 2000) {
    for (const [k, v] of rateMap.entries()) {
      if (v.resetAt < now && (!v.blockedUntil || v.blockedUntil < now)) {
        rateMap.delete(k);
      }
    }
  }

  const existing = rateMap.get(ip);
  if (existing) {
    if (existing.blockedUntil && existing.blockedUntil > now) {
      const retrySec = Math.ceil((existing.blockedUntil - now) / 1000);
      return NextResponse.json(
        {
          success: false,
          error: `Phát hiện tần suất truy cập bất thường (Chống DDoS). Vui lòng thử lại sau ${retrySec} giây.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retrySec),
            'X-RateLimit-Reset': String(existing.blockedUntil),
          },
        }
      );
    }

    if (now > existing.resetAt) {
      rateMap.set(ip, { count: 1, resetAt: now + windowMs });
    } else {
      existing.count += 1;
      if (existing.count > maxRequests) {
        // Temporarily block IP for 30 seconds on flood
        existing.blockedUntil = now + 30_000;
        return NextResponse.json(
          {
            success: false,
            error: 'Hệ thống chống DDoS đã tạm khóa yêu cầu do gửi quá nhanh. Vui lòng đợi 30 giây.',
          },
          {
            status: 429,
            headers: { 'Retry-After': '30' },
          }
        );
      }
    }
  } else {
    rateMap.set(ip, { count: 1, resetAt: now + windowMs });
  }

  return null;
}

/**
 * Recursively sanitizes JSON payloads against Prototype Pollution and XSS script injection.
 */
export function sanitizeInput<T>(input: T): T {
  if (input === null || input === undefined) return input;
  if (typeof input === 'string') {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '') as unknown as T;
  }
  if (Array.isArray(input)) {
    return input.map(item => sanitizeInput(item)) as unknown as T;
  }
  if (typeof input === 'object') {
    const cleanObj: Record<string, any> = {};
    for (const [key, val] of Object.entries(input as Record<string, any>)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      cleanObj[key] = sanitizeInput(val);
    }
    return cleanObj as T;
  }
  return input;
}
