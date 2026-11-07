'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { UserProfile, TabPermissions } from '@/types/exam';
import { DEFAULT_MODEL_ID } from '@/lib/gemini';
import { getProtectedGoogleClientId, initClientSecurityShield } from '@/lib/security-shield';

export const SUPER_ADMIN_EMAIL = 'lenhatduy.vietnam@gmail.com';
const STORAGE_USER_KEY = 'aztool_current_user';
const STORAGE_ALL_USERS_KEY = 'aztool_user_database';
const STORAGE_SYSTEM_CONFIG = 'aztool_system_config';
const STORAGE_THEME_KEY = 'aztool_theme_mode';
const STORAGE_PERMISSIONS_KEY = 'aztool_user_permissions';
const STORAGE_DELETED_EMAILS_KEY = 'aztool_deleted_emails';

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
  canAudit: false,
  canStandardize: false,
  canMix: false,
  canPdfStudio: false,
  canThesisAudit: false,
  updatedAt: 0,
};

export const superAdminPermissions: TabPermissions = {
  canAudit: true,
  canStandardize: true,
  canMix: true,
  canPdfStudio: true,
  canThesisAudit: true,
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
  return {
    canAudit: Boolean(raw.canAudit),
    canStandardize: Boolean(raw.canStandardize),
    canMix: Boolean(raw.canMix),
    canPdfStudio: Boolean(raw.canPdfStudio),
    canThesisAudit: Boolean(raw.canThesisAudit),
    updatedAt:
      typeof raw.updatedAt === 'number' && raw.updatedAt > 0
        ? raw.updatedAt
        : fallbackUpdatedAt,
  };
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
  updateUserPermissions: (
    email: string,
    perms: TabPermissions,
    displayName?: string
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
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(defaultSystemConfig);
  const [theme, setThemeState] = useState<'light' | 'dark'>('light');
  const [isLoaded, setIsLoaded] = useState(false);

  const userRef = useRef<UserProfile | null>(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

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
   * - Fetches fresh `/api/permissions` and `/api/users` with `cache: 'no-store'`.
   * - Resolves conflicts using `updatedAt` timestamps and `deletedEmails` tombstones.
   * - For Teacher browsers, Server state is authoritative so Admin permission changes
   *   (open/lock/delete/re-add) take effect immediately on the Teacher's screen!
   * - Automatically updates `user.permissions` in React state and `localStorage`.
   */
  const refreshUsers = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      const ts = Date.now();
      const [usersRes, permsRes] = await Promise.all([
        fetch(`/api/users?t=${ts}`, { cache: 'no-store' }).catch(() => null),
        fetch(`/api/permissions?t=${ts}`, { cache: 'no-store' }).catch(() => null),
      ]);

      let serverUsers: UserProfile[] = [];
      let serverPerms: Record<string, TabPermissions> = {};
      let serverDeleted: Record<string, number> = {};

      if (usersRes && usersRes.ok) {
        const data = await usersRes.json();
        if (Array.isArray(data.users)) {
          serverUsers = data.users;
        }
        if (data.permissions && typeof data.permissions === 'object') {
          serverPerms = { ...serverPerms, ...data.permissions };
        }
        if (data.deletedEmails && typeof data.deletedEmails === 'object') {
          serverDeleted = { ...serverDeleted, ...data.deletedEmails };
        }
      }

      if (permsRes && permsRes.ok) {
        const pData = await permsRes.json();
        if (pData.permissions && typeof pData.permissions === 'object') {
          serverPerms = { ...serverPerms, ...pData.permissions };
        }
        if (Array.isArray(pData.users) && serverUsers.length === 0) {
          serverUsers = pData.users;
        }
        if (pData.deletedEmails && typeof pData.deletedEmails === 'object') {
          serverDeleted = { ...serverDeleted, ...pData.deletedEmails };
        }
      }

      // Read local storage state
      let localPerms: Record<string, TabPermissions> = {};
      try {
        const rawP = localStorage.getItem(STORAGE_PERMISSIONS_KEY);
        if (rawP) localPerms = JSON.parse(rawP);
      } catch {
        // ignore
      }

      let localDeleted: Record<string, number> = {};
      try {
        const rawD = localStorage.getItem(STORAGE_DELETED_EMAILS_KEY);
        if (rawD) localDeleted = JSON.parse(rawD);
      } catch {
        // ignore
      }

      const activeUser = userRef.current;
      const isCurrentBrowserAdmin = Boolean(
        activeUser?.email &&
          activeUser.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
      );

      // Merge deleted tombstones
      const mergedDeleted: Record<string, number> = { ...serverDeleted };
      if (isCurrentBrowserAdmin) {
        for (const [em, delTs] of Object.entries(localDeleted)) {
          const norm = em.trim().toLowerCase();
          if (!mergedDeleted[norm] || delTs > mergedDeleted[norm]) {
            mergedDeleted[norm] = delTs;
          }
        }
      }
      localStorage.setItem(STORAGE_DELETED_EMAILS_KEY, JSON.stringify(mergedDeleted));

      // Merge permissions
      const mergedPerms: Record<string, TabPermissions> = {
        [SUPER_ADMIN_EMAIL.toLowerCase()]: superAdminPermissions,
      };

      // 1. Apply server permissions first
      for (const [em, sPerm] of Object.entries(serverPerms)) {
        const norm = em.trim().toLowerCase();
        if (!norm) continue;
        const isSuper = norm === SUPER_ADMIN_EMAIL.toLowerCase();
        const normSPerm = normalizeClientPermissions(sPerm, isSuper, 1);
        const delTs = mergedDeleted[norm] || 0;
        if (!isSuper && delTs > (normSPerm.updatedAt || 0)) {
          continue;
        }
        mergedPerms[norm] = normSPerm;
      }

      // 2. Merge local permissions ONLY if newer `updatedAt` (or if Admin browser has newer edits)
      let adminHasNewerLocalData = false;
      for (const [em, lPerm] of Object.entries(localPerms)) {
        const norm = em.trim().toLowerCase();
        if (!norm || norm === SUPER_ADMIN_EMAIL.toLowerCase()) continue;
        const normLPerm = normalizeClientPermissions(lPerm, false, 0);
        const delTs = mergedDeleted[norm] || 0;
        if (delTs > (normLPerm.updatedAt || 0)) {
          continue;
        }

        const existingServerPerm = mergedPerms[norm];
        if (!existingServerPerm) {
          // If on Admin browser (or if local entry has an explicit Admin updatedAt timestamp > 0)
          if (isCurrentBrowserAdmin || (normLPerm.updatedAt || 0) > 1) {
            mergedPerms[norm] = normLPerm;
            if (isCurrentBrowserAdmin) adminHasNewerLocalData = true;
          }
        } else {
          // Both server and local have permissions for `norm`:
          // Compare `updatedAt` timestamps! If local was updated more recently by Admin, keep local;
          // otherwise Server wins!
          const lTime = normLPerm.updatedAt || 0;
          const sTime = existingServerPerm.updatedAt || 0;
          if (lTime > sTime) {
            mergedPerms[norm] = normLPerm;
            if (isCurrentBrowserAdmin) adminHasNewerLocalData = true;
          }
        }
      }

      setPermissionsMap(mergedPerms);
      localStorage.setItem(STORAGE_PERMISSIONS_KEY, JSON.stringify(mergedPerms));

      // Merge users list
      let currentLocalUsers: UserProfile[] = [];
      try {
        const rawU = localStorage.getItem(STORAGE_ALL_USERS_KEY);
        if (rawU) currentLocalUsers = JSON.parse(rawU);
      } catch {
        // ignore
      }

      const userMap = new Map<string, UserProfile>();

      for (const su of serverUsers) {
        if (!su?.email) continue;
        const norm = su.email.trim().toLowerCase();
        const isSuper = norm === SUPER_ADMIN_EMAIL.toLowerCase();
        const sPerm =
          mergedPerms[norm] || normalizeClientPermissions(su.permissions, isSuper, 1);
        const delTs = mergedDeleted[norm] || 0;
        if (!isSuper && delTs > (sPerm.updatedAt || 0)) {
          continue;
        }
        mergedPerms[norm] = sPerm;
        userMap.set(norm, {
          ...su,
          email: norm,
          permissions: sPerm,
        });
      }

      for (const lu of currentLocalUsers) {
        if (!lu?.email) continue;
        const norm = lu.email.trim().toLowerCase();
        const isSuper = norm === SUPER_ADMIN_EMAIL.toLowerCase();
        const lPerm =
          mergedPerms[norm] || normalizeClientPermissions(lu.permissions, isSuper, 0);
        const delTs = mergedDeleted[norm] || 0;
        if (!isSuper && delTs > (lPerm.updatedAt || 0)) {
          continue;
        }
        // Only keep a local-only user if they exist in mergedPerms or we are on Admin browser
        if (!userMap.has(norm) && !mergedPerms[norm] && !isCurrentBrowserAdmin) {
          continue;
        }
        const existing = userMap.get(norm);
        const finalPerm = mergedPerms[norm] || lPerm;
        mergedPerms[norm] = finalPerm;
        userMap.set(norm, {
          ...(lu || {}),
          ...(existing || {}),
          email: norm,
          displayName: existing?.displayName || lu.displayName || norm.split('@')[0],
          photoURL: existing?.photoURL || lu.photoURL,
          permissions: finalPerm,
        });
      }

      // Ensure every email in mergedPerms has a UserProfile row
      for (const [emailKey, pVal] of Object.entries(mergedPerms)) {
        const norm = emailKey.toLowerCase();
        const isSuper = norm === SUPER_ADMIN_EMAIL.toLowerCase();
        const delTs = mergedDeleted[norm] || 0;
        if (!isSuper && delTs > (pVal.updatedAt || 0)) {
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
          const u = userMap.get(norm)!;
          userMap.set(norm, {
            ...u,
            permissions: isSuper ? superAdminPermissions : pVal,
          });
        }
      }

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
        const latestPermForCurrent = isSuper
          ? superAdminPermissions
          : mergedPerms[normCurrent] || defaultUserPermissions;

        const prevPerm = currentLoggedUser.permissions;
        const hasChanged =
          !prevPerm ||
          Boolean(prevPerm.canAudit) !== Boolean(latestPermForCurrent.canAudit) ||
          Boolean(prevPerm.canStandardize) !== Boolean(latestPermForCurrent.canStandardize) ||
          Boolean(prevPerm.canMix) !== Boolean(latestPermForCurrent.canMix) ||
          Boolean(prevPerm.canPdfStudio) !== Boolean(latestPermForCurrent.canPdfStudio) ||
          Boolean(prevPerm.canThesisAudit) !== Boolean(latestPermForCurrent.canThesisAudit);

        if (hasChanged) {
          const updatedSelf: UserProfile = {
            ...currentLoggedUser,
            role: isSuper ? 'super_admin' : currentLoggedUser.role,
            permissions: latestPermForCurrent,
          };
          userRef.current = updatedSelf;
          setUser(updatedSelf);
          localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updatedSelf));
        }
      }

      // If Admin browser has newer local permissions than a cold-started server, push bulk to server
      if (isCurrentBrowserAdmin && adminHasNewerLocalData) {
        void fetch('/api/permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bulk: mergedPerms, bulkUsers: mergedList }),
        }).catch(() => null);
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
      let initialPerms: Record<string, TabPermissions> = {
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

      // 5. Current User
      const storedUser =
        localStorage.getItem(STORAGE_USER_KEY) || localStorage.getItem('deq_current_user');
      if (storedUser) {
        const parsed: UserProfile = JSON.parse(storedUser);
        const normEmail = (parsed.email || '').trim().toLowerCase();
        if (normEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
          parsed.role = 'super_admin';
          parsed.permissions = superAdminPermissions;
        } else {
          parsed.permissions = normalizeClientPermissions(
            initialPerms[normEmail] || parsed.permissions,
            false
          );
        }
        userRef.current = parsed;
        setUser(parsed);
      }

      // 6. Sync with Server immediately on mount
      void refreshUsers();
    } catch (e) {
      console.error('Error loading auth state:', e);
    } finally {
      setIsLoaded(true);
    }
  }, [refreshUsers]);

  // Real-time live sync when teacher focuses window, switches tab, or every 6s
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
        e.key === STORAGE_USER_KEY
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
    }, 6000);

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
    user?.email && user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
  );

  const hasTabAccess = (
    tab: 'ai-audit' | 'standardize' | 'mix' | 'exam-tools' | 'thesis-auditor' | 'pdf-studio'
  ): boolean => {
    if (!user) return false;
    if (isSuperAdmin) return true;
    const norm = user.email.trim().toLowerCase();
    const perms = permissionsMap[norm] || user.permissions || defaultUserPermissions;
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
          updatedAt: nowTs,
        };

    // 0. Clear deletion tombstone if this email was previously deleted
    try {
      const rawDel = localStorage.getItem(STORAGE_DELETED_EMAILS_KEY);
      if (rawDel) {
        const parsedDel = JSON.parse(rawDel);
        if (parsedDel && norm in parsedDel) {
          delete parsedDel[norm];
          localStorage.setItem(STORAGE_DELETED_EMAILS_KEY, JSON.stringify(parsedDel));
        }
      }
    } catch {
      // ignore
    }

    // 1. Update permissionsMap immediately
    let nextPermsSnapshot: Record<string, TabPermissions> = {};
    setPermissionsMap(prev => {
      const next = { ...prev, [norm]: cleanPerms };
      nextPermsSnapshot = next;
      localStorage.setItem(STORAGE_PERMISSIONS_KEY, JSON.stringify(next));
      return next;
    });

    // 2. Update or Add user in allUsers immediately
    let nextUsersSnapshot: UserProfile[] = [];
    setAllUsers(prev => {
      const exists = prev.some(u => u.email.toLowerCase() === norm);
      let nextUsers: UserProfile[];
      if (exists) {
        nextUsers = prev.map(u => {
          if (u.email.toLowerCase() === norm) {
            return {
              ...u,
              email: norm,
              displayName: displayName?.trim() || u.displayName,
              permissions: cleanPerms,
              lastActive: new Date().toISOString(),
            };
          }
          return u;
        });
      } else {
        const newUser: UserProfile = {
          id: `user-${nowTs}-${Math.random().toString(36).slice(2, 6)}`,
          email: norm,
          displayName: displayName?.trim() || norm.split('@')[0],
          photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${norm}`,
          role: isSuper ? 'super_admin' : 'free',
          permissions: cleanPerms,
          createdAt: new Date().toISOString().split('T')[0],
          lastActive: new Date().toISOString(),
          examsGeneratedCount: 0,
          mixCount: 0,
        };
        nextUsers = [...prev, newUser];
      }
      nextUsersSnapshot = nextUsers;
      localStorage.setItem(STORAGE_ALL_USERS_KEY, JSON.stringify(nextUsers));
      return nextUsers;
    });

    // 3. Update current user if matching
    if (user && user.email.toLowerCase() === norm) {
      const updatedSelf = { ...user, permissions: cleanPerms };
      userRef.current = updatedSelf;
      setUser(updatedSelf);
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updatedSelf));
    }

    // 4. Push to Server APIs immediately (both single update and bulk state to keep serverless warm)
    try {
      await Promise.all([
        fetch('/api/permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: norm,
            permissions: cleanPerms,
            displayName: displayName?.trim() || undefined,
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
      ]);

      if (Object.keys(nextPermsSnapshot).length > 0) {
        void fetch('/api/permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bulk: nextPermsSnapshot,
            bulkUsers: nextUsersSnapshot,
          }),
        }).catch(() => null);
      }
    } catch (e) {
      console.warn('Sync permissions error:', e);
    }
  };

  const grantAllPermissions = async (email: string, displayName?: string) => {
    await updateUserPermissions(
      email,
      {
        canAudit: true,
        canStandardize: true,
        canMix: true,
        canPdfStudio: true,
        canThesisAudit: true,
        updatedAt: Date.now(),
      },
      displayName
    );
  };

  const revokeAllPermissions = async (email: string) => {
    await updateUserPermissions(email, {
      canAudit: false,
      canStandardize: false,
      canMix: false,
      canPdfStudio: false,
      canThesisAudit: false,
      updatedAt: Date.now(),
    });
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

    // 1. Read latest local permissions (in case Admin edited on this same browser)
    let latestLocalPerm: TabPermissions | undefined = permissionsMap[lowerEmail];
    try {
      const rawP = localStorage.getItem(STORAGE_PERMISSIONS_KEY);
      if (rawP) {
        const parsedP = JSON.parse(rawP);
        if (parsedP && parsedP[lowerEmail]) {
          latestLocalPerm = normalizeClientPermissions(parsedP[lowerEmail], isSuper);
        }
      }
    } catch {
      // ignore
    }

    // 2. Contact server `/api/users` with `action: 'login'` so server preserves authoritative Admin permissions
    let serverPermForUser: TabPermissions | undefined;
    try {
      const loginRes = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          action: 'login',
          email: lowerEmail,
          displayName: customName,
          photoURL: customAvatar,
        }),
      });
      if (loginRes.ok) {
        const data = await loginRes.json();
        if (data.permissions && data.permissions[lowerEmail]) {
          serverPermForUser = normalizeClientPermissions(
            data.permissions[lowerEmail],
            isSuper
          );
        } else if (data.user?.permissions) {
          serverPermForUser = normalizeClientPermissions(data.user.permissions, isSuper);
        }
      }
    } catch {
      // ignore
    }

    // Pick whichever permission record has the newer `updatedAt` timestamp
    let resolvedPerms: TabPermissions;
    if (isSuper) {
      resolvedPerms = { ...superAdminPermissions };
    } else if (serverPermForUser && latestLocalPerm) {
      resolvedPerms =
        (latestLocalPerm.updatedAt || 0) > (serverPermForUser.updatedAt || 0)
          ? latestLocalPerm
          : serverPermForUser;
    } else {
      resolvedPerms = serverPermForUser || latestLocalPerm || { ...defaultUserPermissions };
    }

    setPermissionsMap(prev => {
      const next = { ...prev, [lowerEmail]: resolvedPerms };
      localStorage.setItem(STORAGE_PERMISSIONS_KEY, JSON.stringify(next));
      return next;
    });

    let existing = allUsers.find(u => u.email.toLowerCase() === lowerEmail);
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
        role: isSuper
          ? 'super_admin'
          : existing.role === 'super_admin'
          ? 'free'
          : existing.role,
        permissions: resolvedPerms,
        displayName: customName || existing.displayName,
        photoURL: customAvatar || existing.photoURL,
        lastActive: new Date().toISOString(),
      };
      const updated = allUsers.map(u =>
        u.email.toLowerCase() === lowerEmail ? existing! : u
      );
      saveAllUsers(updated);
    }

    userRef.current = existing;
    setUser(existing);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(existing));

    // Also trigger a full background refresh
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
      u => u.id === cleanInput || u.email.toLowerCase() === cleanInput.toLowerCase()
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

    // 1. Record deletion tombstone in localStorage so deleted user is not resurrected
    if (targetEmail) {
      try {
        const rawDel = localStorage.getItem(STORAGE_DELETED_EMAILS_KEY);
        const parsedDel = rawDel ? JSON.parse(rawDel) : {};
        parsedDel[targetEmail] = nowTs;
        localStorage.setItem(STORAGE_DELETED_EMAILS_KEY, JSON.stringify(parsedDel));
      } catch {
        // ignore
      }
    }

    // 2. Remove from allUsers
    setAllUsers(prev => {
      const updated = prev.filter(
        u =>
          u.id !== cleanInput &&
          (!targetEmail || u.email.toLowerCase() !== targetEmail)
      );
      localStorage.setItem(STORAGE_ALL_USERS_KEY, JSON.stringify(updated));
      return updated;
    });

    // 3. Remove from permissionsMap
    if (targetEmail) {
      setPermissionsMap(prev => {
        const next = { ...prev };
        delete next[targetEmail];
        localStorage.setItem(STORAGE_PERMISSIONS_KEY, JSON.stringify(next));
        return next;
      });
    }

    // 4. Delete from both `/api/users` and `/api/permissions` on the server
    try {
      const qs = `id=${encodeURIComponent(cleanInput)}&email=${encodeURIComponent(
        targetEmail || ''
      )}`;
      await Promise.all([
        fetch(`/api/users?${qs}`, { method: 'DELETE' }),
        fetch(`/api/permissions?${qs}`, { method: 'DELETE' }),
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
        updateUserPermissions,
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
