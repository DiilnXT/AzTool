'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '@/types/exam';
import { DEFAULT_MODEL_ID } from '@/lib/gemini';

export const SUPER_ADMIN_EMAIL = 'lenhatduy.vietnam@gmail.com';
const STORAGE_USER_KEY = 'aztool_current_user';
const STORAGE_ALL_USERS_KEY = 'aztool_user_database';
const STORAGE_SYSTEM_CONFIG = 'aztool_system_config';
const STORAGE_THEME_KEY = 'aztool_theme_mode';

declare global {
  interface Window {
    google?: any;
  }
}

export interface SystemConfig {
  defaultGeminiApiKey: string;
  defaultGeminiModel: string;
  googleClientId: string;
  announcement: string;
  maintenanceMode: boolean;
  defaultUniversity: string;
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
  loginWithGoogle: (customEmail?: string, customName?: string, customAvatar?: string) => Promise<void>;
  loginWithRealGoogleOAuth: (overrideClientId?: string) => Promise<boolean>;
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
  googleClientId:
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    '900284408463-p2a82c6pa12p3r13b2b2drd5rknk0q2r.apps.googleusercontent.com',
  announcement: 'AzTool AI Studio • Nền tảng công cụ tự động hóa tài liệu, khảo thí & trợ lý AI thông minh',
  maintenanceMode: false,
  defaultUniversity: '',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(defaultSystemConfig);
  const [theme, setThemeState] = useState<'light' | 'dark'>('light');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load Google Identity Services Script
  useEffect(() => {
    if (typeof window === 'undefined') return;
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

  useEffect(() => {
    try {
      // Load theme preference
      const savedTheme = localStorage.getItem(STORAGE_THEME_KEY) as 'light' | 'dark' | null;
      const initialTheme = savedTheme === 'dark' ? 'dark' : 'light';
      setThemeState(initialTheme);
      applyThemeToDom(initialTheme);

      // Load system config (fallback to legacy key if exists)
      const storedConfig =
        localStorage.getItem(STORAGE_SYSTEM_CONFIG) || localStorage.getItem('deq_system_config');
      if (storedConfig) {
        const parsedCfg = JSON.parse(storedConfig);
        setSystemConfig(prev => ({
          ...prev,
          ...parsedCfg,
          googleClientId:
            parsedCfg.googleClientId ||
            process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
            '900284408463-p2a82c6pa12p3r13b2b2drd5rknk0q2r.apps.googleusercontent.com',
        }));
      }

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
            createdAt: '2025-01-01',
            lastActive: new Date().toISOString(),
            examsGeneratedCount: 120,
            mixCount: 85,
          },
        ];
        localStorage.setItem(STORAGE_ALL_USERS_KEY, JSON.stringify(usersList));
      }
      setAllUsers(usersList);

      const storedUser =
        localStorage.getItem(STORAGE_USER_KEY) || localStorage.getItem('deq_current_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
          parsed.role = 'super_admin';
        }
        setUser(parsed);
      }
    } catch (e) {
      console.error('Error loading auth state:', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

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

  const loginWithGoogle = async (
    customEmail?: string,
    customName?: string,
    customAvatar?: string
  ) => {
    const email = (customEmail || '').trim();
    if (!email) return;

    const lowerEmail = email.toLowerCase();
    const isSuper = lowerEmail === SUPER_ADMIN_EMAIL.toLowerCase();

    let existing = allUsers.find(u => u.email.toLowerCase() === lowerEmail);
    if (!existing) {
      existing = {
        id: `user-${Date.now()}`,
        email: lowerEmail,
        displayName:
          customName ||
          (isSuper ? 'Lê Nhật Duy' : lowerEmail.split('@')[0]),
        photoURL:
          customAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${lowerEmail}`,
        role: isSuper ? 'super_admin' : 'free',
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        examsGeneratedCount: 0,
        mixCount: 0,
      };
      const updated = [existing, ...allUsers];
      saveAllUsers(updated);
    } else {
      existing.role = isSuper ? 'super_admin' : existing.role === 'super_admin' ? 'free' : existing.role;
      if (customName) existing.displayName = customName;
      if (customAvatar) existing.photoURL = customAvatar;
      existing.lastActive = new Date().toISOString();
      saveAllUsers([...allUsers]);
    }

    setUser(existing);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(existing));
  };

  const loginWithRealGoogleOAuth = async (overrideClientId?: string): Promise<boolean> => {
    const activeClientId = (
      overrideClientId ||
      systemConfig.googleClientId ||
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      '900284408463-p2a82c6pa12p3r13b2b2drd5rknk0q2r.apps.googleusercontent.com'
    ).trim();

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

  const deleteUser = (userId: string) => {
    const target = allUsers.find(u => u.id === userId);
    if (target?.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      return;
    }
    const updated = allUsers.filter(u => u.id !== userId);
    saveAllUsers(updated);
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

  const isSuperAdmin =
    Boolean(user?.email && user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase());
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
