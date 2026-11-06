'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile, TabPermissions } from '@/types/exam';
import { DEFAULT_MODEL_ID } from '@/lib/gemini';
import { getProtectedGoogleClientId, initClientSecurityShield } from '@/lib/security-shield';

export const SUPER_ADMIN_EMAIL = 'lenhatduy.vietnam@gmail.com';
const STORAGE_USER_KEY = 'aztool_current_user';
const STORAGE_ALL_USERS_KEY = 'aztool_user_database';
const STORAGE_SYSTEM_CONFIG = 'aztool_system_config';
const STORAGE_THEME_KEY = 'aztool_theme_mode';
const STORAGE_PERMISSIONS_KEY = 'aztool_user_permissions';

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
};

export const superAdminPermissions: TabPermissions = {
  canAudit: true,
  canStandardize: true,
  canMix: true,
  canPdfStudio: true,
  canThesisAudit: true,
};

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
  deleteUser: (userId: string) => void;
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
   * Stable, non-destructive user & permission sync.
   * Merges server users into local users without ever wiping local entries!
   */
  const refreshUsers = useCallback(async () => {
    try {
      const [usersRes, permsRes] = await Promise.all([
        fetch('/api/users').catch(() => null),
        fetch('/api/permissions').catch(() => null),
      ]);

      let serverUsers: UserProfile[] = [];
      if (usersRes && usersRes.ok) {
        const data = await usersRes.json();
        if (Array.isArray(data.users)) {
          serverUsers = data.users;
        }
      }

      let serverPerms: Record<string, TabPermissions> = {};
      if (permsRes && permsRes.ok) {
        const pData = await permsRes.json();
        if (pData.permissions && typeof pData.permissions === 'object') {
          serverPerms = pData.permissions;
        }
      }

      // Merge permissions (local takes precedence if already set in localStorage)
      let currentLocalPerms: Record<string, TabPermissions> = {};
      try {
        const rawP = localStorage.getItem(STORAGE_PERMISSIONS_KEY);
        if (rawP) currentLocalPerms = JSON.parse(rawP);
      } catch {
        // ignore
      }

      const mergedPerms: Record<string, TabPermissions> = {
        ...serverPerms,
        ...currentLocalPerms,
        [SUPER_ADMIN_EMAIL.toLowerCase()]: superAdminPermissions,
      };
      setPermissionsMap(mergedPerms);
      localStorage.setItem(STORAGE_PERMISSIONS_KEY, JSON.stringify(mergedPerms));

      // Merge users (never drop any user from local storage)
      let currentLocalUsers: UserProfile[] = [];
      try {
        const rawU = localStorage.getItem(STORAGE_ALL_USERS_KEY);
        if (rawU) currentLocalUsers = JSON.parse(rawU);
      } catch {
        // ignore
      }

      const userMap = new Map<string, UserProfile>();
      for (const su of serverUsers) {
        if (su?.email) {
          const norm = su.email.toLowerCase();
          userMap.set(norm, {
            ...su,
            permissions: mergedPerms[norm] || su.permissions || defaultUserPermissions,
          });
        }
      }
      for (const lu of currentLocalUsers) {
        if (lu?.email) {
          const norm = lu.email.toLowerCase();
          const existing = userMap.get(norm);
          userMap.set(norm, {
            ...(existing || lu),
            ...lu,
            permissions:
              mergedPerms[norm] ||
              lu.permissions ||
              existing?.permissions ||
              defaultUserPermissions,
          });
        }
      }

      // Also ensure every email in mergedPerms has a UserProfile row
      for (const [emailKey, pVal] of Object.entries(mergedPerms)) {
        const norm = emailKey.toLowerCase();
        if (!userMap.has(norm)) {
          const isSuper = norm === SUPER_ADMIN_EMAIL.toLowerCase();
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
        }
      }

      const mergedList = Array.from(userMap.values());
      setAllUsers(mergedList);
      localStorage.setItem(STORAGE_ALL_USERS_KEY, JSON.stringify(mergedList));
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
          initialPerms = { ...initialPerms, ...JSON.parse(storedPerms) };
        } catch {
          // ignore
        }
      }
      setPermissionsMap(initialPerms);

      // 3. System Config (Strictly without googleClientId in storage)
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
        if (parsed.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
          parsed.role = 'super_admin';
          parsed.permissions = superAdminPermissions;
        } else {
          parsed.permissions = initialPerms[parsed.email.toLowerCase()] || defaultUserPermissions;
        }
        setUser(parsed);
      }

      // 6. Sync with Server once on mount
      void refreshUsers();
    } catch (e) {
      console.error('Error loading auth state:', e);
    } finally {
      setIsLoaded(true);
    }
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
    const norm = user.email.toLowerCase();
    const perms = permissionsMap[norm] || user.permissions || defaultUserPermissions;
    if (tab === 'ai-audit') return Boolean(perms.canAudit);
    if (tab === 'standardize') return Boolean(perms.canStandardize);
    if (tab === 'mix') return Boolean(perms.canMix);
    if (tab === 'exam-tools') {
      return Boolean(perms.canAudit || perms.canStandardize || perms.canMix);
    }
    if (tab === 'thesis-auditor') {
      return perms.canThesisAudit !== undefined
        ? Boolean(perms.canThesisAudit)
        : Boolean(perms.canAudit || perms.canStandardize);
    }
    if (tab === 'pdf-studio') {
      return perms.canPdfStudio !== undefined
        ? Boolean(perms.canPdfStudio)
        : Boolean(perms.canStandardize);
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

    const cleanPerms: TabPermissions =
      norm === SUPER_ADMIN_EMAIL.toLowerCase()
        ? superAdminPermissions
        : {
            canAudit: Boolean(perms.canAudit),
            canStandardize: Boolean(perms.canStandardize),
            canMix: Boolean(perms.canMix),
            canPdfStudio:
              perms.canPdfStudio !== undefined
                ? Boolean(perms.canPdfStudio)
                : Boolean(perms.canStandardize),
            canThesisAudit:
              perms.canThesisAudit !== undefined
                ? Boolean(perms.canThesisAudit)
                : Boolean(perms.canAudit || perms.canStandardize),
          };

    // 1. Update permissionsMap immediately
    setPermissionsMap(prev => {
      const next = { ...prev, [norm]: cleanPerms };
      localStorage.setItem(STORAGE_PERMISSIONS_KEY, JSON.stringify(next));
      return next;
    });

    // 2. Update or Add user in allUsers immediately (never disappears!)
    setAllUsers(prev => {
      const exists = prev.some(u => u.email.toLowerCase() === norm);
      let nextUsers: UserProfile[];
      if (exists) {
        nextUsers = prev.map(u => {
          if (u.email.toLowerCase() === norm) {
            return {
              ...u,
              displayName: displayName?.trim() || u.displayName,
              permissions: cleanPerms,
              lastActive: new Date().toISOString(),
            };
          }
          return u;
        });
      } else {
        const newUser: UserProfile = {
          id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          email: norm,
          displayName: displayName?.trim() || norm.split('@')[0],
          photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${norm}`,
          role: norm === SUPER_ADMIN_EMAIL.toLowerCase() ? 'super_admin' : 'free',
          permissions: cleanPerms,
          createdAt: new Date().toISOString().split('T')[0],
          lastActive: new Date().toISOString(),
          examsGeneratedCount: 0,
          mixCount: 0,
        };
        nextUsers = [...prev, newUser];
      }
      localStorage.setItem(STORAGE_ALL_USERS_KEY, JSON.stringify(nextUsers));
      return nextUsers;
    });

    // 3. Update current user if matching
    if (user && user.email.toLowerCase() === norm) {
      const updatedSelf = { ...user, permissions: cleanPerms };
      setUser(updatedSelf);
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updatedSelf));
    }

    // 4. Push to Server API in background (do NOT overwrite state from server response)
    try {
      await Promise.all([
        fetch('/api/permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: norm, permissions: cleanPerms }),
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

    const userPerms = isSuper
      ? superAdminPermissions
      : permissionsMap[lowerEmail] || defaultUserPermissions;

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
        permissions: userPerms,
        createdAt: new Date().toISOString().split('T')[0],
        lastActive: new Date().toISOString(),
        examsGeneratedCount: 0,
        mixCount: 0,
      };
      const updated = [existing, ...allUsers];
      saveAllUsers(updated);
    } else {
      existing.role = isSuper
        ? 'super_admin'
        : existing.role === 'super_admin'
        ? 'free'
        : existing.role;
      existing.permissions = userPerms;
      if (customName) existing.displayName = customName;
      if (customAvatar) existing.photoURL = customAvatar;
      existing.lastActive = new Date().toISOString();
      saveAllUsers([...allUsers]);
    }

    setUser(existing);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(existing));

    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: existing }),
      });
    } catch {
      // ignore
    }
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
    setUser(null);
    localStorage.removeItem(STORAGE_USER_KEY);
    localStorage.removeItem('deq_current_user');
  };

  const updateDisplayName = (newName: string) => {
    if (!user || !newName.trim()) return;
    const updatedUser = { ...user, displayName: newName.trim() };
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
        setUser(updatedUser);
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updatedUser));
      }
    }
  };

  const deleteUser = async (userId: string) => {
    const target = allUsers.find(u => u.id === userId || u.email === userId);
    if (target?.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      return;
    }
    const targetEmail = target?.email.toLowerCase();
    const updated = allUsers.filter(
      u => u.id !== userId && u.email.toLowerCase() !== targetEmail
    );
    saveAllUsers(updated);

    if (targetEmail) {
      setPermissionsMap(prev => {
        const next = { ...prev };
        delete next[targetEmail];
        localStorage.setItem(STORAGE_PERMISSIONS_KEY, JSON.stringify(next));
        return next;
      });
    }

    try {
      await fetch(
        `/api/users?id=${encodeURIComponent(userId)}&email=${encodeURIComponent(
          targetEmail || ''
        )}`,
        { method: 'DELETE' }
      );
    } catch {
      // ignore
    }
  };

  const saveUserApiKey = (key: string) => {
    if (!user) return;
    const updatedUser = { ...user, customApiKey: key };
    setUser(updatedUser);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updatedUser));

    const updatedAll = allUsers.map(u => (u.id === user.id ? updatedUser : u));
    saveAllUsers(updatedAll);
  };

  const saveUserGeminiModel = (modelId: string) => {
    if (!user) return;
    const updatedUser = { ...user, customModelId: modelId };
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
