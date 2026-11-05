'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ToastProvider';
import { UserProfile } from '@/types/exam';
import { DEFAULT_MODEL_ID } from '@/lib/gemini';
import {
  Crown,
  Users,
  Trash2,
  UserPlus,
  Settings,
  Check,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export function AdminDashboard() {
  const {
    allUsers,
    systemConfig,
    isSuperAdmin,
    updateUserRole,
    deleteUser,
    updateSystemConfig,
  } = useAuth();
  const toast = useToast();

  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserProfile['role']>('pro');
  const [apiKeyInput, setApiKeyInput] = useState(systemConfig.defaultGeminiApiKey || '');
  const [modelIdInput, setModelIdInput] = useState(systemConfig.defaultGeminiModel || DEFAULT_MODEL_ID);
  const [announcementInput, setAnnouncementInput] = useState(systemConfig.announcement || '');

  if (!isSuperAdmin) {
    return (
      <div className="apple-glass rounded-[32px] p-8 text-center max-w-lg mx-auto">
        <Crown className="w-10 h-10 text-amber-500 mx-auto mb-2" />
        <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
          Khu Vực Hạn Chế
        </h2>
        <p className="text-xs text-neutral-400 mt-1">
          Chỉ dành riêng cho Admin Tối Thượng (lenhatduy.vietnam@gmail.com).
        </p>
      </div>
    );
  }

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    const email = newEmail.trim().toLowerCase();
    const existing = allUsers.find(u => u.email.toLowerCase() === email);
    if (existing) {
      toast.warning('Tài khoản đã tồn tại!', `Email ${email} đã có trong danh sách.`);
      return;
    }

    const newUser: UserProfile = {
      id: `user-${Date.now()}`,
      email,
      displayName: newName.trim() || `Giảng viên (${email.split('@')[0]})`,
      photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
      role: newRole,
      createdAt: new Date().toISOString().split('T')[0],
      lastActive: new Date().toISOString(),
      examsGeneratedCount: 0,
      mixCount: 0,
    };

    updateUserRole(newUser.id, newRole);
    setNewEmail('');
    setNewName('');
    toast.success('Đã thêm người dùng mới!', `Tài khoản ${email} (${newRole.toUpperCase()}) đã được kích hoạt.`);
    confetti({ particleCount: 35, spread: 45 });
  };

  const handleSaveConfig = () => {
    updateSystemConfig({
      defaultGeminiApiKey: apiKeyInput.trim(),
      defaultGeminiModel: modelIdInput.trim() || DEFAULT_MODEL_ID,
      announcement: announcementInput.trim(),
    });
    toast.success('Đã lưu cấu hình toàn hệ thống!', `Model mặc định: ${modelIdInput.trim() || DEFAULT_MODEL_ID}`);
    confetti({ particleCount: 30, spread: 40 });
  };

  const totalExams = allUsers.reduce((sum, u) => sum + (u.examsGeneratedCount || 0), 0);
  const totalMixes = allUsers.reduce((sum, u) => sum + (u.mixCount || 0), 0);

  return (
    <div className="space-y-8 py-2 max-w-4xl mx-auto">
      {/* Canva Style Hero */}
      <div className="text-center space-y-3 pt-2 sm:pt-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-xs font-bold border border-amber-200">
          <Crown className="w-3.5 h-3.5" />
          <span>Khu Vực Quản Trị Tối Thượng</span>
        </div>

        <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-neutral-900 dark:text-neutral-100">
          Quản Lý Hệ Thống Khảo Thí AzTool
        </h2>

        <p className="text-sm text-neutral-500 font-normal max-w-md mx-auto">
          Toàn quyền phân quyền người dùng, quản trị Model ID Gemini và cấu hình tài nguyên toàn bộ nền tảng.
        </p>
      </div>

      {/* Canva Grid KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="canva-card p-4 text-center border border-neutral-200/90 dark:border-neutral-800">
          <div className="text-[11px] font-bold text-neutral-400">Tổng Thành Viên</div>
          <div className="text-2xl font-black text-neutral-900 dark:text-white mt-1">
            {allUsers.length}
          </div>
        </div>

        <div className="canva-card p-4 text-center border border-neutral-200/90 dark:border-neutral-800">
          <div className="text-[11px] font-bold text-neutral-400">Tài Khoản PRO</div>
          <div className="text-2xl font-black text-amber-500 mt-1">
            {allUsers.filter(u => u.role === 'pro' || u.role === 'super_admin').length}
          </div>
        </div>

        <div className="canva-card p-4 text-center border border-neutral-200/90 dark:border-neutral-800">
          <div className="text-[11px] font-bold text-neutral-400">Đề Đã Chuẩn Hóa</div>
          <div className="text-2xl font-black text-[#7d2ae8] mt-1">
            {totalExams}
          </div>
        </div>

        <div className="canva-card p-4 text-center border border-neutral-200/90 dark:border-neutral-800">
          <div className="text-[11px] font-bold text-neutral-400">Lượt Trộn Đề</div>
          <div className="text-2xl font-black text-[#00c4cc] mt-1">
            {totalMixes}
          </div>
        </div>
      </div>

      {/* Global Config Card */}
      <div className="canva-card p-6 sm:p-7 space-y-4 shadow-xs border border-neutral-200/90 dark:border-neutral-800">
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#7d2ae8]" />
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Cấu Hình Toàn Hệ Thống (Global Settings)
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Gemini Model ID Mặc Định:
            </label>
            <input
              type="text"
              value={modelIdInput}
              onChange={e => setModelIdInput(e.target.value)}
              placeholder="gemini-2.0-flash"
              className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 font-mono font-semibold focus:ring-2 focus:ring-[#7d2ae8] outline-hidden"
            />
          </div>

          <div>
            <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Gemini API Keys Toàn Web (Xoay tua nhiều key):
            </label>
            <input
              type="text"
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              placeholder="key1, key2, key3..."
              className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 font-mono text-xs focus:ring-2 focus:ring-[#7d2ae8] outline-hidden"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Thông Báo Toàn Web (Broadcast Banner):
            </label>
            <input
              type="text"
              value={announcementInput}
              onChange={e => setAnnouncementInput(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs focus:ring-2 focus:ring-[#7d2ae8] outline-hidden"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSaveConfig}
            className="canva-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition canva-tap flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Lưu Cấu Hình Hệ Thống</span>
          </button>
        </div>
      </div>

      {/* Add User Card */}
      <div className="canva-card p-6 space-y-4 shadow-xs border border-neutral-200/90 dark:border-neutral-800">
        <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-[#7d2ae8]" />
          <span>Thêm Người Dùng &amp; Cấp Quyền</span>
        </h3>

        <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
          <input
            type="email"
            required
            placeholder="Email Google"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
          />
          <input
            type="text"
            placeholder="Tên Giảng Viên"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
          />
          <select
            value={newRole}
            onChange={e => setNewRole(e.target.value as any)}
            className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 font-semibold"
          >
            <option value="free">Miễn Phí (Free)</option>
            <option value="pro">Nâng Cấp PRO</option>
            <option value="admin">Quản Trị Viên</option>
          </select>
          <button
            type="submit"
            className="canva-btn-primary py-2.5 rounded-xl font-bold transition canva-tap"
          >
            Thêm &amp; Kích Hoạt
          </button>
        </form>
      </div>

      {/* User Table Card */}
      <div className="canva-card p-6 space-y-4 shadow-xs overflow-hidden border border-neutral-200/90 dark:border-neutral-800">
        <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <Users className="w-4 h-4 text-neutral-500" />
          <span>Danh Sách Người Dùng &amp; Phân Quyền</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 font-semibold">
                <th className="py-2.5 px-3">Thành viên</th>
                <th className="py-2.5 px-3">Email</th>
                <th className="py-2.5 px-3">Cấp Quyền</th>
                <th className="py-2.5 px-3">Hoạt động</th>
                <th className="py-2.5 px-3 text-right">Xóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {allUsers.map(u => {
                const isSuper = u.role === 'super_admin';
                return (
                  <tr key={u.id} className="hover:bg-purple-50/40 dark:hover:bg-neutral-800/40 transition">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={u.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${u.email}`}
                          alt=""
                          className="w-6 h-6 rounded-full border border-neutral-200"
                        />
                        <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                          {u.displayName}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-neutral-500">
                      {u.email}
                    </td>

                    <td className="py-3 px-3">
                      {isSuper ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white">
                          <Crown className="w-3 h-3" /> ADMIN
                        </span>
                      ) : (
                        <select
                          value={u.role}
                          onChange={e => {
                            updateUserRole(u.id, e.target.value as any);
                            toast.info('Đã cập nhật quyền', `${u.email} → ${e.target.value.toUpperCase()}`);
                          }}
                          className="text-xs font-semibold py-1 px-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                        >
                          <option value="free">Miễn Phí</option>
                          <option value="pro">PRO</option>
                          <option value="admin">Admin</option>
                        </select>
                      )}
                    </td>

                    <td className="py-3 px-3 text-neutral-400 text-[11px]">
                      {u.examsGeneratedCount || 0} đề • {u.mixCount || 0} trộn
                    </td>

                    <td className="py-3 px-3 text-right">
                      {!isSuper && (
                        <button
                          onClick={() => {
                            deleteUser(u.id);
                            toast.info('Đã xóa tài khoản', u.email);
                          }}
                          className="p-1.5 rounded-xl text-neutral-400 hover:text-rose-500 transition canva-tap"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
