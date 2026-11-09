'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { UserProfile, TabPermissions, UserActivityLog } from '@/types/exam';
import { DEFAULT_MODEL_ID } from '@/lib/gemini';
import { getProtectedGoogleClientId, initClientSecurityShield } from '@/lib/security-shield';

export const SUPER_ADMIN_EMAIL = 'lenhatduy.vietnam@gmail.com';
export const DAILY_USAGE_LIMIT = 5;
const STORAGE_USER_KEY = 'aztool_current_user';
const STORAGE_ALL_USERS_KEY = 'aztool_user_database';
const STORAGE_SYSTEM_CONFIG = 'aztool_system_config';
const STORAGE_THEME_KEY = 'aztool_theme_mode';
const STORAGE_PERMISSIONS_KEY = 'aztool_user_permissions';
const STORAGE_DELETED_EMAILS_KEY = 'aztool_deleted_emails';
const STORAGE_DAILY_USAGE_KEY = 'aztool_daily_usage_map_v1';
const CLOUD_PERMS_TOPIC = 'aztool_cloud_perms_db_v5_9c8d7e6f5a4b';

export function getTodayDateKey(): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const d = parts.find(p => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // fallback
  }
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export interface DailyUsageEntry {
  date: string;
  count: number;
  updatedAt: number;
}

declare global {
  interface Window {
    google?: any;
  }
}

export interface SystemConfig {
  defaultGeminiApiKey: string;
  defaultGeminiModel: string;
  announcement: string;
  maintenanceMode: boolean;
  defaultUniversity: string;
}

export const defaultUserPermissions: TabPermissions = {
  canAudit: true,
  canStandardize: true,
  canMix: true,
  canPdfStudio: true,
  canThesisAudit: true,
  isBlocked: false,
  unlimitedDailyQuota: false,
  adminConfigured: false,
  updatedAt: 0,
};

export const superAdminPermissions: TabPermissions = {
  canAudit: true,
  canStandardize: true,
  canMix: true,
  canPdfStudio: true,
  canThesisAudit: true,
  isBlocked: false,
  unlimitedDailyQuota: true,
  adminConfigured: true,
  updatedAt: 9999999999999,
};

export function normalizeClientPermissions(
  raw?: Partial<TabPermissions> | null,
  isSuper = false,
  fallbackUpdatedAt = 0
): TabPermissions {
  if (isSuper) return { ...superAdminPermissions };
  if (!raw || typeof raw !== 'object') {
    return { ...defaultUserPermissions, updatedAt: fallbackUpdatedAt };
  }
  const allFalse =
    !raw.canAudit &&
    !raw.canStandardize &&
    !raw.canMix &&
    !raw.canPdfStudio &&
    !raw.canThesisAudit;

  if (allFalse && !raw.adminConfigured && !raw.isBlocked) {
    return {
      ...defaultUserPermissions,
      isBlocked: Boolean(raw.isBlocked),
      unlimitedDailyQuota: Boolean(raw.unlimitedDailyQuota),
      updatedAt:
        typeof raw.updatedAt === 'number' && raw.updatedAt > 0
          ? raw.updatedAt
          : fallbackUpdatedAt,
    };
  }

  return {
    canAudit: Boolean(raw.canAudit),
    canStandardize: Boolean(raw.canStandardize),
    canMix: Boolean(raw.canMix),
    canPdfStudio: Boolean(raw.canPdfStudio),
    canThesisAudit: Boolean(raw.canThesisAudit),
    isBlocked: Boolean(raw.isBlocked),
    unlimitedDailyQuota: Boolean(raw.unlimitedDailyQuota),
    adminConfigured: Boolean(raw.adminConfigured),
    updatedAt:
      typeof raw.updatedAt === 'number' && raw.updatedAt > 0
        ? raw.updatedAt
        : fallbackUpdatedAt,
  };
}

async function fetchCloudPermsSnapshot(): Promise<{
  permissions?: Record<string, TabPermissions>;
  users?: UserProfile[];
  deletedEmails?: Record<string, number>;
} | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`https://ntfy.sh/${CLOUD_PERMS_TOPIC}/json`, {
      headers: {
        'X-Poll': '1',
        'X-Since': 'all',
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;

    const text = await res.text();
    const lines = text
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    const combinedPerms: Record<string, TabPermissions> = {};
    const combinedUsersMap = new Map<string, UserProfile>();
    const combinedDeleted: Record<string, number> = {};

    const applySnapshot = (snap: any) => {
      if (!snap || typeof snap !== 'object') return;
      if (snap.deletedEmails && typeof snap.deletedEmails === 'object') {
        for (const [em, ts] of Object.entries(snap.deletedEmails)) {
          const norm = em.trim().toLowerCase();
          if (!norm || norm === SUPER_ADMIN_EMAIL.toLowerCase()) continue;
          const numTs = Number(ts) || 0;
          if (!combinedDeleted[norm] || numTs > combinedDeleted[norm]) {
            combinedDeleted[norm] = numTs;
          }
          // Evict any earlier cached permission/user if deletion timestamp is newer
          if (numTs > (combinedPerms[norm]?.updatedAt || 0)) {
            delete combinedPerms[norm];
            combinedUsersMap.delete(norm);
          }
        }
      }
      if (snap.permissions && typeof snap.permissions === 'object') {
        for (const [em, pVal] of Object.entries(snap.permissions)) {
          const norm = em.trim().toLowerCase();
          if (!norm) continue;
          const isSuper = norm === SUPER_ADMIN_EMAIL.toLowerCase();
          const pNorm = normalizeClientPermissions(pVal as any, isSuper, 1);
          const delTs = combinedDeleted[norm] || 0;
          if (!isSuper && delTs > (pNorm.updatedAt || 0)) {
            delete combinedPerms[norm];
            combinedUsersMap.delete(norm);
            continue;
          }
          if (!isSuper && (pNorm.updatedAt || 0) > delTs && delTs > 0) {
            delete combinedDeleted[norm];
          }
          const prev = combinedPerms[norm];
          if (!prev || (pNorm.updatedAt || 0) >= (prev.updatedAt || 0)) {
            combinedPerms[norm] = pNorm;
          }
        }
      }
      if (Array.isArray(snap.users)) {
        for (const u of snap.users) {
          if (!u?.email) continue;
          const norm = String(u.email).trim().toLowerCase();
          const isSuper = norm === SUPER_ADMIN_EMAIL.toLowerCase();
          const uPerm = normalizeClientPermissions(u.permissions, isSuper, 1);
          const bestPerm =
            combinedPerms[norm] &&
            (combinedPerms[norm].updatedAt || 0) >= (uPerm.updatedAt || 0)
              ? combinedPerms[norm]
              : uPerm;
          const delTs = combinedDeleted[norm] || 0;
          if (!isSuper && delTs > (bestPerm.updatedAt || 0)) {
            delete combinedPerms[norm];
            combinedUsersMap.delete(norm);
            continue;
          }
          if (!isSuper && (bestPerm.updatedAt || 0) > delTs && delTs > 0) {
            delete combinedDeleted[norm];
          }
          combinedPerms[norm] = bestPerm;
          const prevUser = combinedUsersMap.get(norm);
          combinedUsersMap.set(norm, {
            ...(prevUser || {}),
            ...u,
            email: norm,
            displayName: u.displayName || prevUser?.displayName || norm.split('@')[0],
            permissions: bestPerm,
          });
        }
      }
      // Final sweep to ensure combinedUsersMap has the latest combinedPerms and no deleted emails
      for (const [norm, uObj] of Array.from(combinedUsersMap.entries())) {
        const isSuper = norm === SUPER_ADMIN_EMAIL.toLowerCase();
        const delTs = combinedDeleted[norm] || 0;
        const p = combinedPerms[norm] || uObj.permissions;
        if (!isSuper && delTs > (p?.updatedAt || 0)) {
          combinedUsersMap.delete(norm);
          delete combinedPerms[norm];
        } else if (combinedPerms[norm]) {
          combinedUsersMap.set(norm, { ...uObj, permissions: combinedPerms[norm] });
        }
      }
    };

    for (const line of lines) {
      try {
        const env = JSON.parse(line);
        if (env.event === 'message') {
          if (env.attachment?.url) {
            const attRes = await fetch(env.attachment.url, { cache: 'no-store' });
            if (attRes.ok) {
              applySnapshot(await attRes.json());
            }
          } else if (env.message) {
            applySnapshot(JSON.parse(env.message));
          }
        }
      } catch {
        // ignore
      }
    }

    if (
      Object.keys(combinedPerms).length === 0 &&
      combinedUsersMap.size === 0 &&
      Object.keys(combinedDeleted).length === 0
    ) {
      return null;
    }

    return {
      permissions: combinedPerms,
      users: Array.from(combinedUsersMap.values()),
      deletedEmails: combinedDeleted,
    };
  } catch {
    return null;
  }
}

async function publishCloudPermsSnapshot(payloadObj: {
  permissions: Record<string, TabPermissions>;
  users: UserProfile[];
  deletedEmails: Record<string, number>;
}): Promise<void> {
  try {
    const payload = JSON.stringify({
      rev: Date.now(),
      ...payloadObj,
    });
    if (payload.length < 3500) {
      await fetch(`https://ntfy.sh/${CLOUD_PERMS_TOPIC}`, {
        method: 'POST',
        body: payload,
      });
    } else {
      await fetch(`https://ntfy.sh/${CLOUD_PERMS_TOPIC}`, {
        method: 'PUT',
        headers: { Filename: 'az_perms_state.json' },
        body: payload,
      });
    }
  } catch {
    // ignore
  }
}

interface AuthContextType {
  user: UserProfile | null;
  allUsers: UserProfile[];
  systemConfig: SystemConfig;
  theme: 'light' | 'dark';
  setTheme: (mode: 'light' | 'dark') => void;
  toggleTheme: () => void;
  isLoaded: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isPro: boolean;
  permissionsMap: Record<string, TabPermissions>;
  hasTabAccess: (
    tab: 'ai-audit' | 'standardize' | 'mix' | 'exam-tools' | 'thesis-auditor' | 'pdf-studio'
  ) => boolean;
  dailyLimit: number;
  dailyUsed: number;
  dailyRemaining: number;
  isDailyLimitReached: boolean;
  isAccountBlocked: boolean;
  isUnlimitedQuota: boolean;
  todayDateKey: string;
  limitModalState: { isOpen: boolean; featureName?: string } | null;
  openLimitModal: (featureName?: string) => void;
  closeLimitModal: () => void;
  consumeDailyQuota: (
    featureName?: string,
    meta?: { type?: UserActivityLog['type']; fileName?: string }
  ) => boolean;
  resetUserDailyQuota: (email: string) => Promise<void>;
  getUserDailyUsed: (email: string) => number;
  toggleBlockUser: (email: string, blocked?: boolean) => Promise<void>;
  toggleUnlimitedQuota: (email: string, unlimited?: boolean) => Promise<void>;
  updateUserPermissions: (
    email: string,
    perms: TabPermissions,
    displayName?: string
  ) => Promise<void>;
  saveBulkPermissions: (
    bulkMap: Record<string, TabPermissions>,
    displayNames?: Record<string, string>
  ) => Promise<void>;
  grantAllPermissions: (email: string, displayName?: string) => Promise<void>;
  revokeAllPermissions: (email: string) => Promise<void>;
  refreshUsers: () => Promise<void>;
  loginWithGoogle: (
    customEmail?: string,
    customName?: string,
    customAvatar?: string
  ) => Promise<void>;
  loginWithRealGoogleOAuth: () => Promise<boolean>;
  logout: () => void;
  updateDisplayName: (newName: string) => void;
  updateUserRole: (userId: string, newRole: UserProfile['role']) => void;
  deleteUser: (userIdOrEmail: string) => Promise<void>;
  saveUserApiKey: (key: string) => void;
  saveUserGeminiModel: (modelId: string) => void;
  updateSystemConfig: (config: Partial<SystemConfig>) => void;
  incrementUsage: (type: 'standardize' | 'mix') => void;
}

const defaultSystemConfig: SystemConfig = {
  defaultGeminiApiKey: '',
  defaultGeminiModel: DEFAULT_MODEL_ID,
  announcement:
    'AzTool AI Studio • Nền tảng công cụ tự động hóa tài liệu PDF/Office, khảo thí & trợ lý AI thông minh',
  maintenanceMode: false,
  defaultUniversity: '',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [permissionsMap, setPermissionsMap] = useState<Record<string, TabPermissions>>({
    [SUPER_ADMIN_EMAIL.toLowerCase()]: superAdminPermissions,
  });
  const [dailyUsageMap, setDailyUsageMap] = useState<Record<string, DailyUsageEntry>>({});
  const [todayDateKey, setTodayDateKey] = useState<string>('');
  const [limitModalState, setLimitModalState] = useState<{
    isOpen: boolean;
    featureName?: string;
  } | null>(null);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(defaultSystemConfig);
  const [theme, setThemeState] = useState<'light' | 'dark'>('light');
  const [isLoaded, setIsLoaded] = useState(false);

  const userRef = useRef<UserProfile | null>(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const dailyUsageMapRef = useRef<Record<string, DailyUsageEntry>>({});
  useEffect(() => {
    dailyUsageMapRef.current = dailyUsageMap;
  }, [dailyUsageMap]);

  // Watch for day rollover at 00:00 so quota resets automatically at 00h00
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkDateRollover = () => {
      const latestKey = getTodayDateKey();
      setTodayDateKey(prev => (prev !== latestKey ? latestKey : prev));
    };
    checkDateRollover();
    const timer = window.setInterval(checkDateRollover, 15000);
    window.addEventListener('focus', checkDateRollover);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', checkDateRollover);
    };
  }, []);

  // Initialize Security Shield & Google Identity Services Script
  useEffect(() => {
    if (typeof window === 'undefined') return;
    initClientSecurityShield();

    const existingScript = document.getElementById('google-gsi-client');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'google-gsi-client';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }, []);

  const applyThemeToDom = (mode: 'light' | 'dark') => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  /**
   * Authoritative User & Permission Synchronization:
   * - Fetches from both `/api/permissions`, `/api/users`, and the Cloud Sync channel.
   * - For Teacher browsers (`!isCurrentBrowserAdmin`), Server/Cloud permissions are 100%
   *   authoritative and unconditionally replace any stale localStorage data!
   */
  const refreshUsers = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      const ts = Date.now();
      const [usersRes, permsRes, cloudSnap] = await Promise.all([
        fetch(`/api/users?t=${ts}`, { cache: 'no-store' }).catch(() => null),
        fetch(`/api/permissions?t=${ts}`, { cache: 'no-store' }).catch(() => null),
        fetchCloudPermsSnapshot(),
      ]);

      const serverPerms: Record<string, TabPermissions> = {};
      const serverUsersMap = new Map<string, UserProfile>();
      const serverDeleted: Record<string, number> = {};

      const mergeSource = (
        srcPerms?: Record<string, TabPermissions>,
        srcUsers?: UserProfile[],
        srcDeleted?: Record<string, number>
      ) => {
        if (srcDeleted && typeof srcDeleted === 'object') {
          for (const [em, dTs] of Object.entries(srcDeleted)) {
            const norm = em.trim().toLowerCase();
            if (!norm || norm === SUPER_ADMIN_EMAIL.toLowerCase()) continue;
            const numTs = Number(dTs) || 0;
            if (!serverDeleted[norm] || numTs > serverDeleted[norm]) {
              serverDeleted[norm] = numTs;
            }
            if (numTs > (serverPerms[norm]?.updatedAt || 0)) {
              delete serverPerms[norm];
              serverUsersMap.delete(norm);
            }
          }
        }
        if (srcPerms && typeof srcPerms === 'object') {
          for (const [em, pVal] of Object.entries(srcPerms)) {
            const norm = em.trim().toLowerCase();
            if (!norm) continue;
            const isSuper = norm === SUPER_ADMIN_EMAIL.toLowerCase();
            const pNorm = normalizeClientPermissions(pVal, isSuper, 1);
            const delTs = serverDeleted[norm] || 0;
            if (!isSuper && delTs > (pNorm.updatedAt || 0)) {
              delete serverPerms[norm];
              serverUsersMap.delete(norm);
              continue;
            }
            if (!isSuper && (pNorm.updatedAt || 0) > delTs && delTs > 0) {
              delete serverDeleted[norm];
            }
            const existing = serverPerms[norm];
            if (!existing || (pNorm.updatedAt || 0) >= (existing.updatedAt || 0)) {
              serverPerms[norm] = pNorm;
            }
          }
        }
        if (Array.isArray(srcUsers)) {
          for (const su of srcUsers) {
            if (!su?.email) continue;
            const norm = su.email.trim().toLowerCase();
            const isSuper = norm === SUPER_ADMIN_EMAIL.toLowerCase();
            const uPerm = normalizeClientPermissions(su.permissions, isSuper, 1);
            const bestPerm =
              serverPerms[norm] &&
              (serverPerms[norm].updatedAt || 0) >= (uPerm.updatedAt || 0)
                ? serverPerms[norm]
                : uPerm;
            const delTs = serverDeleted[norm] || 0;
            if (!isSuper && delTs > (bestPerm.updatedAt || 0)) {
              delete serverPerms[norm];
              serverUsersMap.delete(norm);
              continue;
            }
            if (!isSuper && (bestPerm.updatedAt || 0) > delTs && delTs > 0) {
              delete serverDeleted[norm];
            }
            serverPerms[norm] = bestPerm;
            const prevU = serverUsersMap.get(norm);
            const prevUsageTs = prevU?.dailyUsageUpdatedAt || 0;
            const incUsageTs = su.dailyUsageUpdatedAt || 0;
            let mergedUsageDate = su.dailyUsageDate || prevU?.dailyUsageDate;
            let mergedUsageCount = su.dailyUsageCount ?? prevU?.dailyUsageCount ?? 0;
            let mergedUsageTs = Math.max(prevUsageTs, incUsageTs);

            if (prevU?.dailyUsageDate && su.dailyUsageDate) {
              if (prevU.dailyUsageDate === su.dailyUsageDate) {
                if (incUsageTs > prevUsageTs && incUsageTs > 0) {
                  mergedUsageCount = su.dailyUsageCount ?? 0;
                } else if (prevUsageTs > incUsageTs && prevUsageTs > 0) {
                  mergedUsageCount = prevU.dailyUsageCount ?? 0;
                } else {
                  mergedUsageCount = Math.max(prevU.dailyUsageCount || 0, su.dailyUsageCount || 0);
                }
              } else if (prevU.dailyUsageDate > su.dailyUsageDate) {
                mergedUsageDate = prevU.dailyUsageDate;
                mergedUsageCount = prevU.dailyUsageCount ?? 0;
              } else {
                mergedUsageDate = su.dailyUsageDate;
                mergedUsageCount = su.dailyUsageCount ?? 0;
              }
            }

            // Merge recentActivities (dedup by id, newest first, up to 25)
            const actMap = new Map<string, UserActivityLog>();
            for (const act of [...(su.recentActivities || []), ...(prevU?.recentActivities || [])]) {
              if (act?.id && !actMap.has(act.id)) {
                actMap.set(act.id, act);
              }
            }
            const mergedActivities = Array.from(actMap.values())
              .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
              .slice(0, 25);

            serverUsersMap.set(norm, {
              ...(prevU || {}),
              ...su,
              email: norm,
              displayName: su.displayName || prevU?.displayName || norm.split('@')[0],
              permissions: bestPerm,
              isBlocked: isSuper ? false : Boolean(bestPerm.isBlocked ?? su.isBlocked ?? prevU?.isBlocked),
              unlimitedDailyQuota: isSuper
                ? true
                : Boolean(bestPerm.unlimitedDailyQuota ?? su.unlimitedDailyQuota ?? prevU?.unlimitedDailyQuota),
              examsGeneratedCount: Math.max(
                prevU?.examsGeneratedCount || 0,
                su.examsGeneratedCount || 0
              ),
              mixCount: Math.max(prevU?.mixCount || 0, su.mixCount || 0),
              recentActivities: mergedActivities,
              dailyUsageDate: mergedUsageDate,
              dailyUsageCount: mergedUsageCount,
              dailyUsageUpdatedAt: mergedUsageTs,
            });
          }
        }
        for (const [norm, uObj] of Array.from(serverUsersMap.entries())) {
          const isSuper = norm === SUPER_ADMIN_EMAIL.toLowerCase();
          const delTs = serverDeleted[norm] || 0;
          const p = serverPerms[norm] || uObj.permissions;
          if (!isSuper && delTs > (p?.updatedAt || 0)) {
            serverUsersMap.delete(norm);
            delete serverPerms[norm];
          } else if (serverPerms[norm]) {
            serverUsersMap.set(norm, { ...uObj, permissions: serverPerms[norm] });
          }
        }
      };

      if (usersRes && usersRes.ok) {
        const data = await usersRes.json();
        mergeSource(data.permissions, data.users, data.deletedEmails);
      }
      if (permsRes && permsRes.ok) {
        const pData = await permsRes.json();
        mergeSource(pData.permissions, pData.users, pData.deletedEmails);
      }
      if (cloudSnap) {
        mergeSource(cloudSnap.permissions, cloudSnap.users, cloudSnap.deletedEmails);
      }

      const activeUser = userRef.current;
      const isCurrentBrowserAdmin = Boolean(
        activeUser?.email &&
          activeUser.email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
      );

      // Read local storage state (deduplicated & normalized by lowercase email!)
      const localPerms: Record<string, TabPermissions> = {};
      try {
        const rawP = localStorage.getItem(STORAGE_PERMISSIONS_KEY);
        if (rawP) {
          const parsedP = JSON.parse(rawP);
          if (parsedP && typeof parsedP === 'object') {
            for (const [k, v] of Object.entries(parsedP)) {
              const norm = k.trim().toLowerCase();
              if (!norm) continue;
              const pNorm = normalizeClientPermissions(
                v as any,
                norm === SUPER_ADMIN_EMAIL.toLowerCase(),
                0
              );
              const existing = localPerms[norm];
              if (!existing || (pNorm.updatedAt || 0) >= (existing.updatedAt || 0)) {
                localPerms[norm] = pNorm;
              }
            }
          }
        }
      } catch {
        // ignore
      }

      const localDeleted: Record<string, number> = {};
      try {
        const rawD = localStorage.getItem(STORAGE_DELETED_EMAILS_KEY);
        if (rawD) {
          const parsedD = JSON.parse(rawD);
          if (parsedD && typeof parsedD === 'object') {
            for (const [k, v] of Object.entries(parsedD)) {
              localDeleted[k.trim().toLowerCase()] = Number(v) || 0;
            }
          }
        }
      } catch {
        // ignore
      }

      const mergedDeleted: Record<string, number> = { ...serverDeleted };
      if (isCurrentBrowserAdmin) {
        for (const [em, delTs] of Object.entries(localDeleted)) {
          if (!mergedDeleted[em] || delTs > mergedDeleted[em]) {
            mergedDeleted[em] = delTs;
          }
        }
      }
      localStorage.setItem(STORAGE_DELETED_EMAILS_KEY, JSON.stringify(mergedDeleted));

      const mergedPerms: Record<string, TabPermissions> = {
        ...serverPerms,
        [SUPER_ADMIN_EMAIL.toLowerCase()]: superAdminPermissions,
      };

      let adminNeedsCloudPush = false;

      // ONLY on Admin's browser do we merge localPerms into mergedPerms!
      // On a Teacher's browser (`!isCurrentBrowserAdmin`), Server/Cloud (`serverPerms`) is 100% authoritative!
      if (isCurrentBrowserAdmin) {
        for (const [norm, lPerm] of Object.entries(localPerms)) {
          if (!norm || norm === SUPER_ADMIN_EMAIL.toLowerCase()) continue;
          const delTs = mergedDeleted[norm] || 0;
          if (delTs > (lPerm.updatedAt || 0)) {
            delete mergedPerms[norm];
            continue;
          }
          const sPerm = mergedPerms[norm];
          if (!sPerm || (lPerm.updatedAt || 0) > (sPerm.updatedAt || 0)) {
            mergedPerms[norm] = lPerm;
            adminNeedsCloudPush = true;
          }
        }
      }

      // Build final users list
      const userMap = new Map<string, UserProfile>();
      for (const [norm, su] of serverUsersMap.entries()) {
        const isSuper = norm === SUPER_ADMIN_EMAIL.toLowerCase();
        const delTs = mergedDeleted[norm] || 0;
        const p = mergedPerms[norm] || su.permissions || defaultUserPermissions;
        if (!isSuper && delTs > (p.updatedAt || 0)) {
          continue;
        }
        userMap.set(norm, {
          ...su,
          email: norm,
          permissions: isSuper ? superAdminPermissions : p,
        });
      }

      if (isCurrentBrowserAdmin) {
        try {
          const rawU = localStorage.getItem(STORAGE_ALL_USERS_KEY);
          const localUsers: UserProfile[] = rawU ? JSON.parse(rawU) : [];
          for (const lu of localUsers) {
            if (!lu?.email) continue;
            const norm = lu.email.trim().toLowerCase();
            const isSuper = norm === SUPER_ADMIN_EMAIL.toLowerCase();
            const p =
              mergedPerms[norm] || normalizeClientPermissions(lu.permissions, isSuper, 0);
            const delTs = mergedDeleted[norm] || 0;
            if (!isSuper && delTs > (p.updatedAt || 0)) {
              continue;
            }
            mergedPerms[norm] = p;
            const existing = userMap.get(norm);
            userMap.set(norm, {
              ...(lu || {}),
              ...(existing || {}),
              email: norm,
              displayName: existing?.displayName || lu.displayName || norm.split('@')[0],
              photoURL: existing?.photoURL || lu.photoURL,
              permissions: isSuper ? superAdminPermissions : p,
            });
          }
        } catch {
          // ignore
        }
      }

      for (const [norm, pVal] of Object.entries(mergedPerms)) {
        const isSuper = norm === SUPER_ADMIN_EMAIL.toLowerCase();
        const delTs = mergedDeleted[norm] || 0;
        if (!isSuper && delTs > (pVal.updatedAt || 0)) {
          delete mergedPerms[norm];
          userMap.delete(norm);
          continue;
        }
        if (!userMap.has(norm)) {
          userMap.set(norm, {
            id: isSuper ? 'admin-001' : `user-${norm}`,
            email: norm,
            displayName: isSuper ? 'Lê Nhật Duy' : norm.split('@')[0],
            photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${norm}`,
            role: isSuper ? 'super_admin' : 'free',
            permissions: isSuper ? superAdminPermissions : pVal,
            createdAt: '2026-11-06',
            lastActive: '2026-11-06T00:00:00.000Z',
            examsGeneratedCount: 0,
            mixCount: 0,
          });
        } else {
          const existing = userMap.get(norm)!;
          userMap.set(norm, {
            ...existing,
            permissions: isSuper ? superAdminPermissions : pVal,
          });
        }
      }

      // Sync daily usage map (00:00 to 23:59) across local storage & server/cloud users
      const currentDayKey = getTodayDateKey();
      setTodayDateKey(currentDayKey);
      const nextDailyMap: Record<string, DailyUsageEntry> = { ...dailyUsageMapRef.current };
      try {
        const rawDaily = localStorage.getItem(STORAGE_DAILY_USAGE_KEY);
        if (rawDaily) {
          const parsedDaily = JSON.parse(rawDaily);
          if (parsedDaily && typeof parsedDaily === 'object') {
            for (const [emKey, entry] of Object.entries(parsedDaily)) {
              const normEm = emKey.trim().toLowerCase();
              const dObj = entry as DailyUsageEntry;
              if (dObj && typeof dObj.date === 'string') {
                const prev = nextDailyMap[normEm];
                if (!prev || (dObj.updatedAt || 0) >= (prev.updatedAt || 0)) {
                  nextDailyMap[normEm] = dObj;
                }
              }
            }
          }
        }
      } catch {
        // ignore
      }

      for (const [norm, uItem] of userMap.entries()) {
        const localEntry = nextDailyMap[norm];
        const serverDate = uItem.dailyUsageDate;
        const serverCount = uItem.dailyUsageCount || 0;
        const serverTs = uItem.dailyUsageUpdatedAt || 0;

        if (serverDate === currentDayKey && localEntry?.date === currentDayKey) {
          if (serverTs > (localEntry.updatedAt || 0) && serverTs > 0) {
            nextDailyMap[norm] = {
              date: currentDayKey,
              count: serverCount,
              updatedAt: serverTs,
            };
          } else {
            const bestCount = Math.max(localEntry.count || 0, serverCount);
            nextDailyMap[norm] = {
              date: currentDayKey,
              count: bestCount,
              updatedAt: Math.max(localEntry.updatedAt || 0, serverTs),
            };
          }
        } else if (serverDate === currentDayKey) {
          nextDailyMap[norm] = {
            date: currentDayKey,
            count: serverCount,
            updatedAt: serverTs || Date.now(),
          };
        }

        const resolvedDaily = nextDailyMap[norm];
        if (resolvedDaily && resolvedDaily.date === currentDayKey) {
          userMap.set(norm, {
            ...uItem,
            dailyUsageDate: currentDayKey,
            dailyUsageCount: resolvedDaily.count,
            dailyUsageUpdatedAt: resolvedDaily.updatedAt,
          });
        }
      }

      dailyUsageMapRef.current = nextDailyMap;
      setDailyUsageMap({ ...nextDailyMap });
      localStorage.setItem(STORAGE_DAILY_USAGE_KEY, JSON.stringify(nextDailyMap));

      const mergedList = Array.from(userMap.values());
      setAllUsers(mergedList);
      setPermissionsMap({ ...mergedPerms });
      localStorage.setItem(STORAGE_ALL_USERS_KEY, JSON.stringify(mergedList));
      localStorage.setItem(STORAGE_PERMISSIONS_KEY, JSON.stringify(mergedPerms));

      // CRITICAL: Immediately update the currently logged-in `user` state so tabs unlock/lock live!
      const currentLoggedUser = userRef.current;
      if (currentLoggedUser?.email) {
        const normCurrent = currentLoggedUser.email.trim().toLowerCase();
        const isSuper = normCurrent === SUPER_ADMIN_EMAIL.toLowerCase();
        const delTs = mergedDeleted[normCurrent] || 0;
        const rawPerm = mergedPerms[normCurrent];

        const latestPermForCurrent = isSuper
          ? superAdminPermissions
          : rawPerm && (rawPerm.updatedAt || 0) >= delTs
          ? rawPerm
          : defaultUserPermissions;

        const currentDaily = nextDailyMap[normCurrent];
        const latestDailyDate =
          currentDaily?.date === currentDayKey ? currentDayKey : currentLoggedUser.dailyUsageDate;
        const latestDailyCount =
          currentDaily?.date === currentDayKey ? currentDaily.count : 0;

        const prevPerm = currentLoggedUser.permissions;
        const hasChanged =
          !prevPerm ||
          Boolean(prevPerm.canAudit) !== Boolean(latestPermForCurrent.canAudit) ||
          Boolean(prevPerm.canStandardize) !== Boolean(latestPermForCurrent.canStandardize) ||
          Boolean(prevPerm.canMix) !== Boolean(latestPermForCurrent.canMix) ||
          Boolean(prevPerm.canPdfStudio) !== Boolean(latestPermForCurrent.canPdfStudio) ||
          Boolean(prevPerm.canThesisAudit) !== Boolean(latestPermForCurrent.canThesisAudit) ||
          Boolean(prevPerm.isBlocked) !== Boolean(latestPermForCurrent.isBlocked) ||
          Boolean(prevPerm.unlimitedDailyQuota) !== Boolean(latestPermForCurrent.unlimitedDailyQuota) ||
          currentLoggedUser.dailyUsageDate !== latestDailyDate ||
          (currentLoggedUser.dailyUsageCount || 0) !== latestDailyCount;

        if (hasChanged) {
          const matchedServerUser = userMap.get(normCurrent);
          const updatedSelf: UserProfile = {
            ...currentLoggedUser,
            email: normCurrent,
            role: isSuper ? 'super_admin' : currentLoggedUser.role,
            permissions: latestPermForCurrent,
            isBlocked: isSuper ? false : Boolean(latestPermForCurrent.isBlocked),
            unlimitedDailyQuota: isSuper ? true : Boolean(latestPermForCurrent.unlimitedDailyQuota),
            examsGeneratedCount: Math.max(
              currentLoggedUser.examsGeneratedCount || 0,
              matchedServerUser?.examsGeneratedCount || 0
            ),
            mixCount: Math.max(
              currentLoggedUser.mixCount || 0,
              matchedServerUser?.mixCount || 0
            ),
            recentActivities:
              matchedServerUser?.recentActivities?.length
                ? matchedServerUser.recentActivities
                : currentLoggedUser.recentActivities,
            dailyUsageDate: latestDailyDate,
            dailyUsageCount: latestDailyCount,
            dailyUsageUpdatedAt: currentDaily?.updatedAt || currentLoggedUser.dailyUsageUpdatedAt,
          };
          userRef.current = updatedSelf;
          setUser(updatedSelf);
          localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updatedSelf));
        }
      }

      if (isCurrentBrowserAdmin && adminNeedsCloudPush) {
        void fetch('/api/permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bulk: mergedPerms,
            bulkUsers: mergedList,
            bulkDeleted: mergedDeleted,
          }),
        }).catch(() => null);
        void publishCloudPermsSnapshot({
          permissions: mergedPerms,
          users: mergedList,
          deletedEmails: mergedDeleted,
        });
      }
    } catch (e) {
      console.warn('refreshUsers error:', e);
    }
  }, []);

  useEffect(() => {
    try {
      // 1. Theme
      const savedTheme = localStorage.getItem(STORAGE_THEME_KEY) as 'light' | 'dark' | null;
      const initialTheme = savedTheme === 'dark' ? 'dark' : 'light';
      setThemeState(initialTheme);
      applyThemeToDom(initialTheme);

      // 2. Permissions from localStorage
      const initialPerms: Record<string, TabPermissions> = {
        [SUPER_ADMIN_EMAIL.toLowerCase()]: superAdminPermissions,
      };
      const storedPerms = localStorage.getItem(STORAGE_PERMISSIONS_KEY);
      if (storedPerms) {
        try {
          const parsedP = JSON.parse(storedPerms);
          for (const [k, v] of Object.entries(parsedP)) {
            const norm = k.trim().toLowerCase();
            initialPerms[norm] = normalizeClientPermissions(
              v as any,
              norm === SUPER_ADMIN_EMAIL.toLowerCase()
            );
          }
        } catch {
          // ignore
        }
      }
      setPermissionsMap(initialPerms);

      // 3. System Config
      const storedConfig =
        localStorage.getItem(STORAGE_SYSTEM_CONFIG) || localStorage.getItem('deq_system_config');
      if (storedConfig) {
        const parsedCfg = JSON.parse(storedConfig);
        if (parsedCfg && 'googleClientId' in parsedCfg) {
          delete parsedCfg.googleClientId;
          localStorage.setItem(STORAGE_SYSTEM_CONFIG, JSON.stringify(parsedCfg));
        }
        setSystemConfig(prev => ({
          ...prev,
          ...parsedCfg,
        }));
      }

      // 4. All Users
      const storedAllUsers =
        localStorage.getItem(STORAGE_ALL_USERS_KEY) || localStorage.getItem('deq_user_database');
      let usersList: UserProfile[] = [];
      if (storedAllUsers) {
        usersList = JSON.parse(storedAllUsers);
      } else {
        usersList = [
          {
            id: 'admin-001',
            email: SUPER_ADMIN_EMAIL,
            displayName: 'Lê Nhật Duy',
            photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=duy',
            role: 'super_admin',
            permissions: superAdminPermissions,
            createdAt: '2025-01-01',
            lastActive: '2026-11-06T00:00:00.000Z',
            examsGeneratedCount: 120,
            mixCount: 85,
          },
        ];
        localStorage.setItem(STORAGE_ALL_USERS_KEY, JSON.stringify(usersList));
      }
      setAllUsers(usersList);

      // 4b. Daily Usage Map
      const initialDailyMap: Record<string, DailyUsageEntry> = {};
      const storedDaily = localStorage.getItem(STORAGE_DAILY_USAGE_KEY);
      if (storedDaily) {
        try {
          const parsedDaily = JSON.parse(storedDaily);
          if (parsedDaily && typeof parsedDaily === 'object') {
            for (const [emKey, val] of Object.entries(parsedDaily)) {
              initialDailyMap[emKey.trim().toLowerCase()] = val as DailyUsageEntry;
            }
          }
        } catch {
          // ignore
        }
      }
      dailyUsageMapRef.current = initialDailyMap;
      setDailyUsageMap(initialDailyMap);

      // 5. Current User
      const storedUser =
        localStorage.getItem(STORAGE_USER_KEY) || localStorage.getItem('deq_current_user');
      if (storedUser) {
        const parsed: UserProfile = JSON.parse(storedUser);
        const normEmail = (parsed.email || '').trim().toLowerCase();
        parsed.email = normEmail;
        if (normEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
          parsed.role = 'super_admin';
          parsed.permissions = superAdminPermissions;
        } else {
          parsed.permissions = normalizeClientPermissions(
            initialPerms[normEmail] || parsed.permissions,
            false
          );
          const todayKey = getTodayDateKey();
          const dEntry = initialDailyMap[normEmail];
          if (dEntry && dEntry.date === todayKey) {
            parsed.dailyUsageDate = todayKey;
            parsed.dailyUsageCount = Math.max(parsed.dailyUsageCount || 0, dEntry.count || 0);
            parsed.dailyUsageUpdatedAt = dEntry.updatedAt;
          }
        }
        userRef.current = parsed;
        setUser(parsed);
      }

      // 6. Sync with Server & Cloud immediately on mount
      void refreshUsers();
    } catch (e) {
      console.error('Error loading auth state:', e);
    } finally {
      setIsLoaded(true);
    }
  }, [refreshUsers]);

  // Real-time live sync when teacher focuses window, switches tab, or every 4s
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleFocusOrVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshUsers();
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === STORAGE_PERMISSIONS_KEY ||
        e.key === STORAGE_ALL_USERS_KEY ||
        e.key === STORAGE_USER_KEY ||
        e.key === STORAGE_DAILY_USAGE_KEY
      ) {
        void refreshUsers();
      }
    };

    window.addEventListener('focus', handleFocusOrVisibility);
    document.addEventListener('visibilitychange', handleFocusOrVisibility);
    window.addEventListener('storage', handleStorageChange);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshUsers();
      }
    }, 4000);

    return () => {
      window.removeEventListener('focus', handleFocusOrVisibility);
      document.removeEventListener('visibilitychange', handleFocusOrVisibility);
      window.removeEventListener('storage', handleStorageChange);
      window.clearInterval(intervalId);
    };
  }, [refreshUsers]);

  const setTheme = (mode: 'light' | 'dark') => {
    setThemeState(mode);
    applyThemeToDom(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_THEME_KEY, mode);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const saveAllUsers = (users: UserProfile[]) => {
    setAllUsers(users);
    localStorage.setItem(STORAGE_ALL_USERS_KEY, JSON.stringify(users));
  };

  const isSuperAdmin = Boolean(
    user?.email && user.email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
  );

  const isAccountBlocked = Boolean(
    user &&
      !isSuperAdmin &&
      (user.isBlocked ||
        user.permissions?.isBlocked ||
        permissionsMap[user.email.trim().toLowerCase()]?.isBlocked)
  );

  const isUnlimitedQuota = Boolean(
    isSuperAdmin ||
      user?.unlimitedDailyQuota ||
      user?.permissions?.unlimitedDailyQuota ||
      (user?.email &&
        permissionsMap[user.email.trim().toLowerCase()]?.unlimitedDailyQuota)
  );

  const hasTabAccess = (
    tab: 'ai-audit' | 'standardize' | 'mix' | 'exam-tools' | 'thesis-auditor' | 'pdf-studio'
  ): boolean => {
    if (!user) return false;
    if (isSuperAdmin) return true;
    const norm = user.email.trim().toLowerCase();
    const perms = permissionsMap[norm] || user.permissions || defaultUserPermissions;
    if (perms.isBlocked || user.isBlocked) return false;
    if (tab === 'ai-audit') return Boolean(perms.canAudit);
    if (tab === 'standardize') return Boolean(perms.canStandardize);
    if (tab === 'mix') return Boolean(perms.canMix);
    if (tab === 'exam-tools') {
      return Boolean(perms.canAudit || perms.canStandardize || perms.canMix);
    }
    if (tab === 'thesis-auditor') {
      return Boolean(perms.canThesisAudit);
    }
    if (tab === 'pdf-studio') {
      return Boolean(perms.canPdfStudio);
    }
    return false;
  };

  const updateUserPermissions = async (
    email: string,
    perms: TabPermissions,
    displayName?: string
  ) => {
    const norm = email.trim().toLowerCase();
    if (!norm) return;

    const nowTs = Date.now();
    const isSuper = norm === SUPER_ADMIN_EMAIL.toLowerCase();
    const cleanPerms: TabPermissions = isSuper
      ? { ...superAdminPermissions }
      : {
          canAudit: Boolean(perms.canAudit),
          canStandardize: Boolean(perms.canStandardize),
          canMix: Boolean(perms.canMix),
          canPdfStudio: Boolean(perms.canPdfStudio),
          canThesisAudit: Boolean(perms.canThesisAudit),
          isBlocked: Boolean(perms.isBlocked),
          unlimitedDailyQuota: Boolean(perms.unlimitedDailyQuota),
          adminConfigured: true,
          updatedAt: nowTs,
        };

    // 0. Clear deletion tombstone if this email was previously deleted
    let currentDeletedSnapshot: Record<string, number> = {};
    try {
      const rawDel = localStorage.getItem(STORAGE_DELETED_EMAILS_KEY);
      if (rawDel) {
        const parsedDel = JSON.parse(rawDel);
        if (parsedDel && typeof parsedDel === 'object') {
          for (const [k, v] of Object.entries(parsedDel)) {
            const kNorm = k.trim().toLowerCase();
            if (kNorm !== norm) {
              currentDeletedSnapshot[kNorm] = Number(v) || 0;
            }
          }
        }
      }
      localStorage.setItem(
        STORAGE_DELETED_EMAILS_KEY,
        JSON.stringify(currentDeletedSnapshot)
      );
    } catch {
      // ignore
    }

    // 1. Update permissionsMap immediately (cleaning any non-lowercase duplicate keys!)
    const cleanedPrevPerms: Record<string, TabPermissions> = {};
    for (const [k, v] of Object.entries(permissionsMap)) {
      cleanedPrevPerms[k.trim().toLowerCase()] = v;
    }
    const nextPermsSnapshot: Record<string, TabPermissions> = {
      ...cleanedPrevPerms,
      [norm]: cleanPerms,
    };
    setPermissionsMap(nextPermsSnapshot);
    localStorage.setItem(STORAGE_PERMISSIONS_KEY, JSON.stringify(nextPermsSnapshot));

    // 2. Update or Add user in allUsers immediately (deduplicating by lowercase email!)
    const dedupUsersMap = new Map<string, UserProfile>();
    for (const u of allUsers) {
      if (!u?.email) continue;
      const uNorm = u.email.trim().toLowerCase();
      dedupUsersMap.set(uNorm, { ...u, email: uNorm });
    }

    const existingUser = dedupUsersMap.get(norm);
    if (existingUser) {
      dedupUsersMap.set(norm, {
        ...existingUser,
        email: norm,
        displayName: displayName?.trim() || existingUser.displayName,
        permissions: cleanPerms,
        isBlocked: cleanPerms.isBlocked,
        unlimitedDailyQuota: cleanPerms.unlimitedDailyQuota,
        lastActive: new Date().toISOString(),
      });
    } else {
      dedupUsersMap.set(norm, {
        id: `user-${nowTs}-${Math.random().toString(36).slice(2, 6)}`,
        email: norm,
        displayName: displayName?.trim() || norm.split('@')[0],
        photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${norm}`,
        role: isSuper ? 'super_admin' : 'free',
        permissions: cleanPerms,
        isBlocked: cleanPerms.isBlocked,
        unlimitedDailyQuota: cleanPerms.unlimitedDailyQuota,
        createdAt: new Date().toISOString().split('T')[0],
        lastActive: new Date().toISOString(),
        examsGeneratedCount: 0,
        mixCount: 0,
      });
    }

    const nextUsersSnapshot = Array.from(dedupUsersMap.values());
    setAllUsers(nextUsersSnapshot);
    localStorage.setItem(STORAGE_ALL_USERS_KEY, JSON.stringify(nextUsersSnapshot));

    // 3. Update current user if matching
    if (user && user.email.trim().toLowerCase() === norm) {
      const updatedSelf = {
        ...user,
        email: norm,
        permissions: cleanPerms,
        isBlocked: cleanPerms.isBlocked,
        unlimitedDailyQuota: cleanPerms.unlimitedDailyQuota,
      };
      userRef.current = updatedSelf;
      setUser(updatedSelf);
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updatedSelf));
    }

    // 4. Push to Server APIs AND direct Cloud Sync channel so every device/container updates immediately!
    try {
      await Promise.all([
        fetch('/api/permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: norm,
            permissions: cleanPerms,
            displayName: displayName?.trim() || undefined,
            bulk: nextPermsSnapshot,
            bulkUsers: nextUsersSnapshot,
            bulkDeleted: currentDeletedSnapshot,
          }),
        }),
        fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: norm,
            displayName: displayName?.trim() || undefined,
            permissions: cleanPerms,
          }),
        }),
        publishCloudPermsSnapshot({
          permissions: nextPermsSnapshot,
          users: nextUsersSnapshot,
          deletedEmails: currentDeletedSnapshot,
        }),
      ]);
    } catch (e) {
      console.warn('Sync permissions error:', e);
    }
  };

  const saveBulkPermissions = async (
    bulkMap: Record<string, TabPermissions>,
    displayNames?: Record<string, string>
  ) => {
    const nowTs = Date.now();
    const cleanedPerms: Record<string, TabPermissions> = {
      [SUPER_ADMIN_EMAIL.toLowerCase()]: { ...superAdminPermissions },
    };

    for (const [k, v] of Object.entries(permissionsMap)) {
      cleanedPerms[k.trim().toLowerCase()] = v;
    }

    const updatedEmailsSet = new Set<string>();
    for (const [em, p] of Object.entries(bulkMap)) {
      const norm = em.trim().toLowerCase();
      if (!norm) continue;
      updatedEmailsSet.add(norm);
      const isSuper = norm === SUPER_ADMIN_EMAIL.toLowerCase();
      cleanedPerms[norm] = isSuper
        ? { ...superAdminPermissions }
        : {
            canAudit: Boolean(p.canAudit),
            canStandardize: Boolean(p.canStandardize),
            canMix: Boolean(p.canMix),
            canPdfStudio: Boolean(p.canPdfStudio),
            canThesisAudit: Boolean(p.canThesisAudit),
            isBlocked: Boolean(p.isBlocked),
            unlimitedDailyQuota: Boolean(p.unlimitedDailyQuota),
            adminConfigured: true,
            updatedAt: nowTs,
          };
    }

    let currentDeletedSnapshot: Record<string, number> = {};
    try {
      const rawDel = localStorage.getItem(STORAGE_DELETED_EMAILS_KEY);
      if (rawDel) {
        const parsedDel = JSON.parse(rawDel);
        if (parsedDel && typeof parsedDel === 'object') {
          for (const [k, v] of Object.entries(parsedDel)) {
            const kNorm = k.trim().toLowerCase();
            if (!updatedEmailsSet.has(kNorm)) {
              currentDeletedSnapshot[kNorm] = Number(v) || 0;
            }
          }
        }
      }
      localStorage.setItem(
        STORAGE_DELETED_EMAILS_KEY,
        JSON.stringify(currentDeletedSnapshot)
      );
    } catch {
      // ignore
    }

    setPermissionsMap(cleanedPerms);
    localStorage.setItem(STORAGE_PERMISSIONS_KEY, JSON.stringify(cleanedPerms));

    const dedupUsersMap = new Map<string, UserProfile>();
    for (const u of allUsers) {
      if (!u?.email) continue;
      const uNorm = u.email.trim().toLowerCase();
      const pRef = cleanedPerms[uNorm] || u.permissions;
      dedupUsersMap.set(uNorm, {
        ...u,
        email: uNorm,
        permissions: pRef,
        isBlocked: Boolean(pRef?.isBlocked),
        unlimitedDailyQuota: Boolean(pRef?.unlimitedDailyQuota),
      });
    }

    for (const norm of updatedEmailsSet) {
      const isSuper = norm === SUPER_ADMIN_EMAIL.toLowerCase();
      const existing = dedupUsersMap.get(norm);
      const customName = displayNames?.[norm]?.trim();
      const pRef = cleanedPerms[norm];
      if (existing) {
        dedupUsersMap.set(norm, {
          ...existing,
          email: norm,
          displayName: customName || existing.displayName,
          permissions: pRef,
          isBlocked: Boolean(pRef?.isBlocked),
          unlimitedDailyQuota: Boolean(pRef?.unlimitedDailyQuota),
          lastActive: new Date().toISOString(),
        });
      } else {
        dedupUsersMap.set(norm, {
          id: `user-${nowTs}-${Math.random().toString(36).slice(2, 6)}`,
          email: norm,
          displayName: customName || norm.split('@')[0],
          photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${norm}`,
          role: isSuper ? 'super_admin' : 'free',
          permissions: pRef,
          isBlocked: Boolean(pRef?.isBlocked),
          unlimitedDailyQuota: Boolean(pRef?.unlimitedDailyQuota),
          createdAt: new Date().toISOString().split('T')[0],
          lastActive: new Date().toISOString(),
          examsGeneratedCount: 0,
          mixCount: 0,
        });
      }
    }

    const nextUsersSnapshot = Array.from(dedupUsersMap.values());
    setAllUsers(nextUsersSnapshot);
    localStorage.setItem(STORAGE_ALL_USERS_KEY, JSON.stringify(nextUsersSnapshot));

    if (user && cleanedPerms[user.email.trim().toLowerCase()]) {
      const normSelf = user.email.trim().toLowerCase();
      const pRef = cleanedPerms[normSelf];
      const updatedSelf = {
        ...user,
        email: normSelf,
        permissions: pRef,
        isBlocked: Boolean(pRef?.isBlocked),
        unlimitedDailyQuota: Boolean(pRef?.unlimitedDailyQuota),
      };
      userRef.current = updatedSelf;
      setUser(updatedSelf);
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updatedSelf));
    }

    try {
      await Promise.all([
        fetch('/api/permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bulk: cleanedPerms,
            bulkUsers: nextUsersSnapshot,
            bulkDeleted: currentDeletedSnapshot,
          }),
        }),
        publishCloudPermsSnapshot({
          permissions: cleanedPerms,
          users: nextUsersSnapshot,
          deletedEmails: currentDeletedSnapshot,
        }),
      ]);
    } catch (e) {
      console.warn('saveBulkPermissions error:', e);
    }
  };

  const grantAllPermissions = async (email: string, displayName?: string) => {
    const norm = email.trim().toLowerCase();
    const existingPerm = permissionsMap[norm];
    await updateUserPermissions(
      email,
      {
        canAudit: true,
        canStandardize: true,
        canMix: true,
        canPdfStudio: true,
        canThesisAudit: true,
        isBlocked: false,
        unlimitedDailyQuota: Boolean(existingPerm?.unlimitedDailyQuota),
        updatedAt: Date.now(),
      },
      displayName
    );
  };

  const revokeAllPermissions = async (email: string) => {
    const norm = email.trim().toLowerCase();
    const existingPerm = permissionsMap[norm];
    await updateUserPermissions(email, {
      canAudit: false,
      canStandardize: false,
      canMix: false,
      canPdfStudio: false,
      canThesisAudit: false,
      isBlocked: Boolean(existingPerm?.isBlocked),
      unlimitedDailyQuota: Boolean(existingPerm?.unlimitedDailyQuota),
      updatedAt: Date.now(),
    });
  };

  const toggleBlockUser = async (email: string, blocked?: boolean) => {
    const norm = email.trim().toLowerCase();
    if (!norm || norm === SUPER_ADMIN_EMAIL.toLowerCase()) return;
    const uFound = allUsers.find(u => u.email.trim().toLowerCase() === norm);
    const currentPerms =
      permissionsMap[norm] || uFound?.permissions || defaultUserPermissions;
    const nextBlocked =
      typeof blocked === 'boolean' ? blocked : !Boolean(currentPerms.isBlocked);
    await updateUserPermissions(
      norm,
      {
        ...currentPerms,
        isBlocked: nextBlocked,
        updatedAt: Date.now(),
      },
      uFound?.displayName
    );
  };

  const toggleUnlimitedQuota = async (email: string, unlimited?: boolean) => {
    const norm = email.trim().toLowerCase();
    if (!norm || norm === SUPER_ADMIN_EMAIL.toLowerCase()) return;
    const uFound = allUsers.find(u => u.email.trim().toLowerCase() === norm);
    const currentPerms =
      permissionsMap[norm] || uFound?.permissions || defaultUserPermissions;
    const nextUnlimited =
      typeof unlimited === 'boolean'
        ? unlimited
        : !Boolean(currentPerms.unlimitedDailyQuota);
    await updateUserPermissions(
      norm,
      {
        ...currentPerms,
        unlimitedDailyQuota: nextUnlimited,
        updatedAt: Date.now(),
      },
      uFound?.displayName
    );
  };

  const loginWithGoogle = async (
    customEmail?: string,
    customName?: string,
    customAvatar?: string
  ) => {
    const email = (customEmail || '').trim();
    if (!email) return;

    const lowerEmail = email.toLowerCase();
    const isSuper = lowerEmail === SUPER_ADMIN_EMAIL.toLowerCase();

    // 1. Contact Server & Cloud to get the authoritative permissions set by Admin
    let serverPermForUser: TabPermissions | undefined;
    try {
      const [loginRes, cloudSnap] = await Promise.all([
        fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({
            action: 'login',
            email: lowerEmail,
            displayName: customName,
            photoURL: customAvatar,
          }),
        }).catch(() => null),
        fetchCloudPermsSnapshot(),
      ]);

      if (loginRes && loginRes.ok) {
        const data = await loginRes.json();
        if (data.permissions && data.permissions[lowerEmail]) {
          serverPermForUser = normalizeClientPermissions(
            data.permissions[lowerEmail],
            isSuper,
            1
          );
        } else if (data.user?.permissions) {
          serverPermForUser = normalizeClientPermissions(
            data.user.permissions,
            isSuper,
            1
          );
        }
      }

      if (cloudSnap?.permissions && cloudSnap.permissions[lowerEmail]) {
        const cloudPerm = normalizeClientPermissions(
          cloudSnap.permissions[lowerEmail],
          isSuper,
          1
        );
        if (
          !serverPermForUser ||
          (cloudPerm.updatedAt || 0) >= (serverPermForUser.updatedAt || 0)
        ) {
          serverPermForUser = cloudPerm;
        }
      }
    } catch {
      // ignore
    }

    const resolvedPerms: TabPermissions = isSuper
      ? { ...superAdminPermissions }
      : serverPermForUser || { ...defaultUserPermissions };

    setPermissionsMap(prev => {
      const next = { ...prev, [lowerEmail]: resolvedPerms };
      localStorage.setItem(STORAGE_PERMISSIONS_KEY, JSON.stringify(next));
      return next;
    });

    let existing = allUsers.find(u => u.email.trim().toLowerCase() === lowerEmail);
    if (!existing) {
      existing = {
        id: `user-${Date.now()}`,
        email: lowerEmail,
        displayName:
          customName || (isSuper ? 'Lê Nhật Duy' : lowerEmail.split('@')[0]),
        photoURL:
          customAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${lowerEmail}`,
        role: isSuper ? 'super_admin' : 'free',
        permissions: resolvedPerms,
        isBlocked: Boolean(resolvedPerms.isBlocked),
        unlimitedDailyQuota: Boolean(resolvedPerms.unlimitedDailyQuota),
        createdAt: new Date().toISOString().split('T')[0],
        lastActive: new Date().toISOString(),
        examsGeneratedCount: 0,
        mixCount: 0,
      };
      const updated = [existing, ...allUsers];
      saveAllUsers(updated);
    } else {
      existing = {
        ...existing,
        email: lowerEmail,
        role: isSuper
          ? 'super_admin'
          : existing.role === 'super_admin'
          ? 'free'
          : existing.role,
        permissions: resolvedPerms,
        isBlocked: Boolean(resolvedPerms.isBlocked),
        unlimitedDailyQuota: Boolean(resolvedPerms.unlimitedDailyQuota),
        displayName: customName || existing.displayName,
        photoURL: customAvatar || existing.photoURL,
        lastActive: new Date().toISOString(),
      };
      const updated = allUsers.map(u =>
        u.email.trim().toLowerCase() === lowerEmail ? existing! : u
      );
      saveAllUsers(updated);
    }

    userRef.current = existing;
    setUser(existing);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(existing));

    void refreshUsers();
  };

  const loginWithRealGoogleOAuth = async (): Promise<boolean> => {
    const activeClientId = getProtectedGoogleClientId();

    if (!activeClientId) {
      return false;
    }

    if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) {
      throw new Error(
        'Dịch vụ đăng nhập Google đang khởi tạo. Vui lòng thử lại sau 2 giây.'
      );
    }

    return new Promise<boolean>((resolve, reject) => {
      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: activeClientId,
          scope: 'openid email profile',
          callback: async (tokenResponse: any) => {
            if (tokenResponse?.error) {
              reject(new Error(`Google OAuth: ${tokenResponse.error}`));
              return;
            }
            if (!tokenResponse?.access_token) {
              reject(new Error('Không nhận được xác thực từ Google.'));
              return;
            }

            try {
              const userInfoRes = await fetch(
                'https://www.googleapis.com/oauth2/v3/userinfo',
                {
                  headers: {
                    Authorization: `Bearer ${tokenResponse.access_token}`,
                  },
                }
              );

              if (!userInfoRes.ok) {
                throw new Error('Không thể tải thông tin tài khoản Google.');
              }

              const profile = await userInfoRes.json();
              await loginWithGoogle(
                profile.email,
                profile.name || profile.given_name,
                profile.picture
              );
              resolve(true);
            } catch (fetchErr: any) {
              reject(fetchErr);
            }
          },
        });

        tokenClient.requestAccessToken({ prompt: 'select_account' });
      } catch (err: any) {
        reject(err);
      }
    });
  };

  const logout = () => {
    userRef.current = null;
    setUser(null);
    localStorage.removeItem(STORAGE_USER_KEY);
    localStorage.removeItem('deq_current_user');
  };

  const updateDisplayName = (newName: string) => {
    if (!user || !newName.trim()) return;
    const updatedUser = { ...user, displayName: newName.trim() };
    userRef.current = updatedUser;
    setUser(updatedUser);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updatedUser));
    const updatedAll = allUsers.map(u => (u.id === user.id ? updatedUser : u));
    saveAllUsers(updatedAll);
  };

  const updateUserRole = (userId: string, newRole: UserProfile['role']) => {
    const updated = allUsers.map(u => {
      if (u.id === userId) {
        if (u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
          return { ...u, role: 'super_admin' as const };
        }
        return { ...u, role: newRole };
      }
      return u;
    });
    saveAllUsers(updated);

    if (user && user.id === userId) {
      const updatedUser = updated.find(u => u.id === userId);
      if (updatedUser) {
        userRef.current = updatedUser;
        setUser(updatedUser);
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updatedUser));
      }
    }
  };

  const deleteUser = async (userIdOrEmail: string) => {
    const cleanInput = (userIdOrEmail || '').trim();
    if (!cleanInput) return;

    const target = allUsers.find(
      u => u.id === cleanInput || u.email.trim().toLowerCase() === cleanInput.toLowerCase()
    );
    const targetEmail = (
      target?.email || (cleanInput.includes('@') ? cleanInput : '')
    )
      .trim()
      .toLowerCase();

    if (targetEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
      return;
    }

    const nowTs = Date.now();
    const nextDeletedSnapshot: Record<string, number> = {};

    // 1. Record deletion tombstone in localStorage so deleted user is not resurrected
    try {
      const rawDel = localStorage.getItem(STORAGE_DELETED_EMAILS_KEY);
      if (rawDel) {
        const parsedDel = JSON.parse(rawDel);
        if (parsedDel && typeof parsedDel === 'object') {
          for (const [k, v] of Object.entries(parsedDel)) {
            nextDeletedSnapshot[k.trim().toLowerCase()] = Number(v) || 0;
          }
        }
      }
      if (targetEmail) {
        nextDeletedSnapshot[targetEmail] = nowTs;
      }
      localStorage.setItem(
        STORAGE_DELETED_EMAILS_KEY,
        JSON.stringify(nextDeletedSnapshot)
      );
    } catch {
      // ignore
    }

    // 2. Remove from allUsers (case-insensitive)
    const nextUsersSnapshot = allUsers.filter(
      u =>
        u.id !== cleanInput &&
        (!targetEmail || u.email.trim().toLowerCase() !== targetEmail)
    );
    setAllUsers(nextUsersSnapshot);
    localStorage.setItem(STORAGE_ALL_USERS_KEY, JSON.stringify(nextUsersSnapshot));

    // 3. Remove from permissionsMap (case-insensitive)
    const nextPermsSnapshot: Record<string, TabPermissions> = {};
    for (const [k, v] of Object.entries(permissionsMap)) {
      const kNorm = k.trim().toLowerCase();
      if (kNorm !== targetEmail) {
        nextPermsSnapshot[kNorm] = v;
      }
    }
    setPermissionsMap(nextPermsSnapshot);
    localStorage.setItem(STORAGE_PERMISSIONS_KEY, JSON.stringify(nextPermsSnapshot));

    // 4. Delete from Server APIs AND publish updated snapshot to Cloud Sync channel
    try {
      const qs = `id=${encodeURIComponent(cleanInput)}&email=${encodeURIComponent(
        targetEmail || ''
      )}`;
      await Promise.all([
        fetch(`/api/users?${qs}`, { method: 'DELETE' }),
        fetch(`/api/permissions?${qs}`, { method: 'DELETE' }),
        publishCloudPermsSnapshot({
          permissions: nextPermsSnapshot,
          users: nextUsersSnapshot,
          deletedEmails: nextDeletedSnapshot,
        }),
      ]);
    } catch {
      // ignore
    }
  };

  const saveUserApiKey = (key: string) => {
    if (!user) return;
    const updatedUser = { ...user, customApiKey: key };
    userRef.current = updatedUser;
    setUser(updatedUser);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updatedUser));

    const updatedAll = allUsers.map(u => (u.id === user.id ? updatedUser : u));
    saveAllUsers(updatedAll);
  };

  const saveUserGeminiModel = (modelId: string) => {
    if (!user) return;
    const updatedUser = { ...user, customModelId: modelId };
    userRef.current = updatedUser;
    setUser(updatedUser);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updatedUser));

    const updatedAll = allUsers.map(u => (u.id === user.id ? updatedUser : u));
    saveAllUsers(updatedAll);
  };

  const updateSystemConfig = (newCfg: Partial<SystemConfig>) => {
    const merged = { ...systemConfig, ...newCfg };
    setSystemConfig(merged);
    localStorage.setItem(STORAGE_SYSTEM_CONFIG, JSON.stringify(merged));
  };

  const getUserDailyUsed = useCallback(
    (email: string): number => {
      const norm = (email || '').trim().toLowerCase();
      if (!norm || !todayDateKey) return 0;
      if (norm === SUPER_ADMIN_EMAIL.toLowerCase()) return 0;
      const mapEntry = dailyUsageMap[norm];
      const uFound = allUsers.find(u => u.email.trim().toLowerCase() === norm);
      const mapCount =
        mapEntry && mapEntry.date === todayDateKey ? mapEntry.count || 0 : 0;
      const userCount =
        uFound && uFound.dailyUsageDate === todayDateKey
          ? uFound.dailyUsageCount || 0
          : 0;
      return Math.max(mapCount, userCount);
    },
    [dailyUsageMap, allUsers, todayDateKey]
  );

  const activeDayKey = todayDateKey;
  const dailyUsed = (() => {
    if (!user?.email || !activeDayKey) return 0;
    if (isSuperAdmin) return 0;
    const norm = user.email.trim().toLowerCase();
    const mapEntry = dailyUsageMap[norm];
    const mapCount = mapEntry && mapEntry.date === activeDayKey ? mapEntry.count || 0 : 0;
    const selfCount =
      user.dailyUsageDate === activeDayKey ? user.dailyUsageCount || 0 : 0;
    return Math.max(mapCount, selfCount);
  })();

  const dailyLimit = DAILY_USAGE_LIMIT;
  const dailyRemaining = isUnlimitedQuota
    ? 999999
    : Math.max(0, DAILY_USAGE_LIMIT - dailyUsed);
  const isDailyLimitReached = Boolean(
    user && !isUnlimitedQuota && dailyUsed >= DAILY_USAGE_LIMIT
  );

  const openLimitModal = useCallback((featureName?: string) => {
    setLimitModalState({ isOpen: true, featureName });
  }, []);

  const closeLimitModal = useCallback(() => {
    setLimitModalState(null);
  }, []);

  const consumeDailyQuota = useCallback(
    (
      featureName?: string,
      meta?: { type?: UserActivityLog['type']; fileName?: string }
    ): boolean => {
      const currentUser = userRef.current;
      if (!currentUser?.email) return false;
      const norm = currentUser.email.trim().toLowerCase();
      const isSuper = norm === SUPER_ADMIN_EMAIL.toLowerCase();

      // Check if blocked by Admin
      if (
        !isSuper &&
        (currentUser.isBlocked || currentUser.permissions?.isBlocked)
      ) {
        setLimitModalState({
          isOpen: true,
          featureName: featureName || 'Tài khoản đã bị tạm khóa bởi Quản trị viên',
        });
        return false;
      }

      const dayKey = getTodayDateKey();
      setTodayDateKey(dayKey);

      const mapEntry = dailyUsageMapRef.current[norm];
      const mapCount = mapEntry && mapEntry.date === dayKey ? mapEntry.count || 0 : 0;
      const selfCount =
        currentUser.dailyUsageDate === dayKey ? currentUser.dailyUsageCount || 0 : 0;
      const currentUsed = Math.max(mapCount, selfCount);

      const hasUnlimited =
        isSuper ||
        Boolean(currentUser.unlimitedDailyQuota) ||
        Boolean(currentUser.permissions?.unlimitedDailyQuota);

      if (!hasUnlimited && currentUsed >= DAILY_USAGE_LIMIT) {
        setLimitModalState({ isOpen: true, featureName });
        return false;
      }

      const nextCount = isSuper ? 0 : currentUsed + 1;
      const nowTs = Date.now();
      const nowIso = new Date().toISOString();

      const activityEntry: UserActivityLog = {
        id: `act-${nowTs}-${Math.random().toString(36).slice(2, 6)}`,
        type: meta?.type || 'other',
        label: featureName || 'Sử dụng tính năng',
        fileName: meta?.fileName,
        timestamp: nowIso,
      };

      const nextActivities = [
        activityEntry,
        ...(currentUser.recentActivities || []),
      ].slice(0, 25);

      const nextExamsGenCount =
        meta?.type === 'standardize'
          ? (currentUser.examsGeneratedCount || 0) + 1
          : currentUser.examsGeneratedCount || 0;
      const nextMixCount =
        meta?.type === 'mix'
          ? (currentUser.mixCount || 0) + 1
          : currentUser.mixCount || 0;

      if (!isSuper) {
        const nextEntry: DailyUsageEntry = {
          date: dayKey,
          count: nextCount,
          updatedAt: nowTs,
        };
        const nextMap: Record<string, DailyUsageEntry> = {
          ...dailyUsageMapRef.current,
          [norm]: nextEntry,
        };
        dailyUsageMapRef.current = nextMap;
        setDailyUsageMap(nextMap);
        localStorage.setItem(STORAGE_DAILY_USAGE_KEY, JSON.stringify(nextMap));
      }

      const updatedSelf: UserProfile = {
        ...currentUser,
        email: norm,
        dailyUsageDate: dayKey,
        dailyUsageCount: nextCount,
        dailyUsageUpdatedAt: nowTs,
        examsGeneratedCount: nextExamsGenCount,
        mixCount: nextMixCount,
        recentActivities: nextActivities,
        lastActive: nowIso,
      };
      userRef.current = updatedSelf;
      setUser(updatedSelf);
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updatedSelf));

      setAllUsers(prev => {
        const updatedList = prev.map(u =>
          u.email.trim().toLowerCase() === norm
            ? {
                ...u,
                dailyUsageDate: dayKey,
                dailyUsageCount: nextCount,
                dailyUsageUpdatedAt: nowTs,
                examsGeneratedCount: nextExamsGenCount,
                mixCount: nextMixCount,
                recentActivities: nextActivities,
                lastActive: nowIso,
              }
            : u
        );
        localStorage.setItem(STORAGE_ALL_USERS_KEY, JSON.stringify(updatedList));
        return updatedList;
      });

      void fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'consume_quota',
          email: norm,
          dateKey: dayKey,
          count: nextCount,
          activityType: meta?.type,
          activityLabel: featureName,
          fileName: meta?.fileName,
        }),
      }).catch(() => null);

      return true;
    },
    []
  );

  const resetUserDailyQuota = useCallback(
    async (email: string) => {
      const norm = (email || '').trim().toLowerCase();
      if (!norm) return;
      const dayKey = getTodayDateKey();
      const nowTs = Date.now();
      const resetEntry: DailyUsageEntry = {
        date: dayKey,
        count: 0,
        updatedAt: nowTs,
      };

      const nextMap: Record<string, DailyUsageEntry> = {
        ...dailyUsageMapRef.current,
        [norm]: resetEntry,
      };
      dailyUsageMapRef.current = nextMap;
      setDailyUsageMap(nextMap);
      localStorage.setItem(STORAGE_DAILY_USAGE_KEY, JSON.stringify(nextMap));

      const nextUsers = allUsers.map(u =>
        u.email.trim().toLowerCase() === norm
          ? {
              ...u,
              dailyUsageDate: dayKey,
              dailyUsageCount: 0,
              dailyUsageUpdatedAt: nowTs,
            }
          : u
      );
      setAllUsers(nextUsers);
      localStorage.setItem(STORAGE_ALL_USERS_KEY, JSON.stringify(nextUsers));

      if (userRef.current && userRef.current.email.trim().toLowerCase() === norm) {
        const updatedSelf: UserProfile = {
          ...userRef.current,
          dailyUsageDate: dayKey,
          dailyUsageCount: 0,
          dailyUsageUpdatedAt: nowTs,
        };
        userRef.current = updatedSelf;
        setUser(updatedSelf);
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updatedSelf));
      }

      try {
        await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reset_quota',
            email: norm,
            dateKey: dayKey,
            count: 0,
          }),
        });
      } catch {
        // ignore
      }
    },
    [allUsers]
  );

  const incrementUsage = (type: 'standardize' | 'mix') => {
    if (!user) return;
    const updatedUser = {
      ...user,
      examsGeneratedCount:
        type === 'standardize' ? user.examsGeneratedCount + 1 : user.examsGeneratedCount,
      mixCount: type === 'mix' ? user.mixCount + 1 : user.mixCount,
      lastActive: new Date().toISOString(),
    };
    userRef.current = updatedUser;
    setUser(updatedUser);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updatedUser));

    const updatedAll = allUsers.map(u => (u.id === user.id ? updatedUser : u));
    saveAllUsers(updatedAll);
  };

  const isAdmin = isSuperAdmin;
  const isPro = isSuperAdmin || user?.role === 'pro';

  return (
    <AuthContext.Provider
      value={{
        user,
        allUsers,
        systemConfig,
        theme,
        setTheme,
        toggleTheme,
        isLoaded,
        isSuperAdmin,
        isAdmin,
        isPro,
        permissionsMap,
        hasTabAccess,
        dailyLimit,
        dailyUsed,
        dailyRemaining,
        isDailyLimitReached,
        isAccountBlocked,
        isUnlimitedQuota,
        todayDateKey: activeDayKey,
        limitModalState,
        openLimitModal,
        closeLimitModal,
        consumeDailyQuota,
        resetUserDailyQuota,
        getUserDailyUsed,
        toggleBlockUser,
        toggleUnlimitedQuota,
        updateUserPermissions,
        saveBulkPermissions,
        grantAllPermissions,
        revokeAllPermissions,
        refreshUsers,
        loginWithGoogle,
        loginWithRealGoogleOAuth,
        logout,
        updateDisplayName,
        updateUserRole,
        deleteUser,
        saveUserApiKey,
        saveUserGeminiModel,
        updateSystemConfig,
        incrementUsage,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
