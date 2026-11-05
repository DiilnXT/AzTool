'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '@/types/exam';
import { DEFAULT_MODEL_ID } from '@/lib/gemini';

export const SUPER_ADMIN_EMAIL = 'lenhatduy.vietnam@gmail.com';
const STORAGE_USER_KEY = 'deq_current_user';
const STORAGE_ALL_USERS_KEY = 'deq_user_database';
const STORAGE_SYSTEM_CONFIG = 'deq_system_config';

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
  isLoaded: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isPro: boolean;
  loginWithGoogle: (customEmail?: string, customName?: string, customAvatar?: string) => Promise<void>;
  loginWithRealGoogleOAuth: (overrideClientId?: string) => Promise<boolean>;
  logout: () => void;
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
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
  announcement: 'Chào mừng quý thầy cô đến với AzTool Studio • Chuẩn hóa & Trộn đề thi trắc nghiệm ĐH Cửu Long',
  maintenanceMode: false,
  defaultUniversity: 'TRƯỜNG ĐẠI HỌC CỬU LONG',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(defaultSystemConfig);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load Google Identity Services Script (https://accounts.google.com/gsi/client)
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

  useEffect(() => {
    try {
      const storedConfig = localStorage.getItem(STORAGE_SYSTEM_CONFIG);
      if (storedConfig) {
        const parsedCfg = JSON.parse(storedConfig);
        setSystemConfig(prev => ({
          ...prev,
          ...parsedCfg,
          googleClientId: parsedCfg.googleClientId || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
        }));
      }

      const storedAllUsers = localStorage.getItem(STORAGE_ALL_USERS_KEY);
      let usersList: UserProfile[] = [];
      if (storedAllUsers) {
        usersList = JSON.parse(storedAllUsers);
      } else {
        usersList = [
          {
            id: 'admin-001',
            email: SUPER_ADMIN_EMAIL,
            displayName: 'Lê Nhật Duy (Admin Tối Thượng)',
            photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=duy',
            role: 'super_admin',
            createdAt: '2024-01-01',
            lastActive: new Date().toISOString(),
            examsGeneratedCount: 120,
            mixCount: 85,
          },
          {
            id: 'user-002',
            email: 'gv_toan@mku.edu.vn',
            displayName: 'Thầy Nguyễn Văn Toàn',
            photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=toan',
            role: 'pro',
            createdAt: '2024-02-15',
            lastActive: new Date().toISOString(),
            examsGeneratedCount: 34,
            mixCount: 20,
          },
        ];
        localStorage.setItem(STORAGE_ALL_USERS_KEY, JSON.stringify(usersList));
      }
      setAllUsers(usersList);

      const storedUser = localStorage.getItem(STORAGE_USER_KEY);
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

  const saveAllUsers = (users: UserProfile[]) => {
    setAllUsers(users);
    localStorage.setItem(STORAGE_ALL_USERS_KEY, JSON.stringify(users));
  };

  const loginWithGoogle = async (
    customEmail?: string,
    customName?: string,
    customAvatar?: string
  ) => {
    const email = customEmail || SUPER_ADMIN_EMAIL;
    if (!email) return;

    const lowerEmail = email.trim().toLowerCase();
    const isSuper = lowerEmail === SUPER_ADMIN_EMAIL.toLowerCase();

    let existing = allUsers.find(u => u.email.toLowerCase() === lowerEmail);
    if (!existing) {
      existing = {
        id: `user-${Date.now()}`,
        email: lowerEmail,
        displayName:
          customName ||
          (isSuper
            ? 'Lê Nhật Duy (Admin Tối Thượng)'
            : `Giảng viên (${lowerEmail.split('@')[0]})`),
        photoURL:
          customAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${lowerEmail}`,
        role: isSuper ? 'super_admin' : 'pro',
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        examsGeneratedCount: 0,
        mixCount: 0,
      };
      const updated = [existing, ...allUsers];
      saveAllUsers(updated);
    } else {
      if (isSuper) existing.role = 'super_admin';
      if (customName) existing.displayName = customName;
      if (customAvatar) existing.photoURL = customAvatar;
      existing.lastActive = new Date().toISOString();
      saveAllUsers([...allUsers]);
    }

    setUser(existing);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(existing));
  };

  /**
   * Real Google OAuth 2.0 Login via Google Identity Services (https://accounts.google.com/gsi/client)
   */
  const loginWithRealGoogleOAuth = async (overrideClientId?: string): Promise<boolean> => {
    const activeClientId = (
      overrideClientId ||
      systemConfig.googleClientId ||
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      ''
    ).trim();

    if (!activeClientId) {
      return false;
    }

    if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) {
      throw new Error(
        'Thư viện Google Identity Services đang tải. Vui lòng thử lại sau 2 giây hoặc kiểm tra kết nối mạng.'
      );
    }

    return new Promise<boolean>((resolve, reject) => {
      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: activeClientId,
          scope: 'openid email profile',
          callback: async (tokenResponse: any) => {
            if (tokenResponse?.error) {
              reject(new Error(`Google OAuth Error: ${tokenResponse.error}`));
              return;
            }
            if (!tokenResponse?.access_token) {
              reject(new Error('Không nhận được access_token từ Google.'));
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
                throw new Error('Không thể lấy thông tin tài khoản từ Google API.');
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
      alert('Không thể xóa tài khoản Admin Tối Thượng!');
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
    user?.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() ||
    user?.role === 'super_admin';
  const isAdmin = isSuperAdmin || user?.role === 'admin';
  const isPro = isSuperAdmin || isAdmin || user?.role === 'pro';

  return (
    <AuthContext.Provider
      value={{
        user,
        allUsers,
        systemConfig,
        isLoaded,
        isSuperAdmin,
        isAdmin,
        isPro,
        loginWithGoogle,
        loginWithRealGoogleOAuth,
        logout,
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
