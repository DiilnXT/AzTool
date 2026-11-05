'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, SUPER_ADMIN_EMAIL } from '@/lib/auth-context';
import { useToast } from '@/components/ToastProvider';
import { UserProfile, TabPermissions } from '@/types/exam';
import { DEFAULT_MODEL_ID } from '@/lib/gemini';
import { generateStandardDocx } from '@/lib/docx-generator';
import {
  WorkspaceSnapshotItem,
  WorkspaceSyncPolicy,
  listWorkspaceSnapshots,
  markSnapshotAsViewed,
  removeWorkspaceSnapshots,
  clearAllWorkspaceSnapshots,
  getSyncPolicy,
  saveSyncPolicy,
} from '@/lib/workspace-sync';
import { saveAs } from 'file-saver';
import {
  Crown,
  Users,
  Trash2,
  UserPlus,
  Settings,
  Check,
  FolderArchive,
  Download,
  FileText,
  FileCheck2,
  Clock,
  Eye,
  Search,
  RefreshCw,
  CheckSquare,
  Square,
  ShieldCheck,
  Sparkles,
  Filter,
  X,
  HardDrive,
  Lock,
  Unlock,
  KeyRound,
  FileCheck,
  Shuffle,
  ShieldAlert,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export function AdminDashboard() {
  const {
    allUsers,
    systemConfig,
    isSuperAdmin,
    permissionsMap,
    updateUserPermissions,
    grantAllPermissions,
    revokeAllPermissions,
    deleteUser,
    updateSystemConfig,
  } = useAuth();
  const toast = useToast();

  const [activeSubTab, setActiveSubTab] = useState<'permissions' | 'vault' | 'settings'>('permissions');

  // Vault state
  const [snapshots, setSnapshots] = useState<WorkspaceSnapshotItem[]>([]);
  const [isLoadingVault, setIsLoadingVault] = useState(true);
  const [syncPolicy, setSyncPolicy] = useState<WorkspaceSyncPolicy>({
    mode: 'all',
    selectedEmails: [],
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEmail, setFilterEmail] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'UNVIEWED' | 'VIEWED'>('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewItem, setPreviewItem] = useState<WorkspaceSnapshotItem | null>(null);

  // User permission management state
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [addTeacherEmail, setAddTeacherEmail] = useState('');
  const [addTeacherName, setAddTeacherName] = useState('');
  const [addPermAudit, setAddPermAudit] = useState(true);
  const [addPermStandardize, setAddPermStandardize] = useState(true);
  const [addPermMix, setAddPermMix] = useState(true);

  // System settings state
  const [apiKeyInput, setApiKeyInput] = useState(systemConfig.defaultGeminiApiKey || '');
  const [modelIdInput, setModelIdInput] = useState(
    systemConfig.defaultGeminiModel || DEFAULT_MODEL_ID
  );
  const [announcementInput, setAnnouncementInput] = useState(systemConfig.announcement || '');
  const [clientIdInput, setClientIdInput] = useState(systemConfig.googleClientId || '');

  const loadVaultData = useCallback(async () => {
    setIsLoadingVault(true);
    try {
      const items = await listWorkspaceSnapshots();
      setSnapshots(items);
      setSyncPolicy(getSyncPolicy());
    } catch {
      // ignore
    } finally {
      setIsLoadingVault(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      void loadVaultData();
    }
  }, [isSuperAdmin, loadVaultData]);

  if (!isSuperAdmin) {
    return (
      <div className="canva-card rounded-3xl p-8 text-center max-w-lg mx-auto">
        <Crown className="w-10 h-10 text-amber-500 mx-auto mb-2" />
        <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
          Khu Vực Quản Trị Hệ Thống
        </h2>
        <p className="text-xs text-neutral-400 mt-1">
          Chỉ dành riêng cho Admin Duy (lenhatduy.vietnam@gmail.com).
        </p>
      </div>
    );
  }

  // --- PERMISSION HANDLERS ---
  const handleTogglePerm = async (email: string, key: keyof TabPermissions) => {
    const norm = email.toLowerCase();
    if (norm === SUPER_ADMIN_EMAIL.toLowerCase()) return; // Admin always has full perms

    const current: TabPermissions = permissionsMap[norm] || {
      canAudit: false,
      canStandardize: false,
      canMix: false,
    };

    const updated: TabPermissions = {
      ...current,
      [key]: !current[key],
    };

    await updateUserPermissions(norm, updated);
    toast.info('Đã cập nhật quyền truy cập', `${norm} • ${key}: ${updated[key] ? 'BẬT' : 'TẮT'}`);
  };

  const handleGrantAll = async (email: string) => {
    await grantAllPermissions(email);
    toast.success('Đã cấp toàn bộ quyền!', `Tài khoản ${email} có thể sử dụng tất cả các tab.`);
    confetti({ particleCount: 30, spread: 45 });
  };

  const handleRevokeAll = async (email: string) => {
    await revokeAllPermissions(email);
    toast.warning('Đã khóa toàn bộ quyền!', `Tài khoản ${email} bị chặn khỏi tất cả các tab tính năng.`);
  };

  const handleAddNewTeacherWithPerms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addTeacherEmail.trim()) return;

    const email = addTeacherEmail.trim().toLowerCase();
    const newPerms: TabPermissions = {
      canAudit: addPermAudit,
      canStandardize: addPermStandardize,
      canMix: addPermMix,
    };

    await updateUserPermissions(email, newPerms);
    setAddTeacherEmail('');
    setAddTeacherName('');
    toast.success('Đã thiết lập quyền cho giáo viên!', `Email: ${email}`);
    confetti({ particleCount: 40, spread: 50 });
  };

  // --- VAULT HANDLERS ---
  const handlePolicyModeChange = (mode: WorkspaceSyncPolicy['mode']) => {
    const updated: WorkspaceSyncPolicy = {
      ...syncPolicy,
      mode,
    };
    setSyncPolicy(updated);
    saveSyncPolicy(updated);
    toast.success('Đã cập nhật chế độ lưu đề!');
  };

  const handleDownloadOriginal = async (item: WorkspaceSnapshotItem) => {
    try {
      if (item.originalBlob) {
        saveAs(item.originalBlob, item.originalFileName || `FileGoc_${item.id}.docx`);
      } else {
        const fallbackBlob = await generateStandardDocx(
          item.metadata,
          item.questionsPreview,
          false
        );
        saveAs(fallbackBlob, item.originalFileName || `VanBanGoc_${item.id}.docx`);
      }
      await markSnapshotAsViewed(item.id);
      setSnapshots(prev =>
        prev.map(s => (s.id === item.id ? { ...s, isViewed: true } : s))
      );
      toast.success('Đã tải File Word Gốc!', item.originalFileName);
    } catch (err: any) {
      toast.error('Lỗi tải file gốc', err.message || String(err));
    }
  };

  const handleDownloadStandardized = async (item: WorkspaceSnapshotItem) => {
    try {
      const cleanName = (item.originalFileName || 'DeThi').replace(/\.docx$/i, '');
      const outName = `AzTool_ChuanHoa_${cleanName}.docx`;
      if (item.standardizedBlob) {
        saveAs(item.standardizedBlob, outName);
      } else {
        const generated = await generateStandardDocx(
          item.metadata,
          item.questionsPreview,
          true
        );
        saveAs(generated, outName);
      }
      await markSnapshotAsViewed(item.id);
      setSnapshots(prev =>
        prev.map(s => (s.id === item.id ? { ...s, isViewed: true } : s))
      );
      toast.success('Đã tải Đề Chuẩn Hóa (Có đáp án X)!', outName);
    } catch (err: any) {
      toast.error('Lỗi tải file chuẩn hóa', err.message || String(err));
    }
  };

  const handleOpenPreview = async (item: WorkspaceSnapshotItem) => {
    setPreviewItem(item);
    if (!item.isViewed) {
      await markSnapshotAsViewed(item.id);
      setSnapshots(prev =>
        prev.map(s => (s.id === item.id ? { ...s, isViewed: true } : s))
      );
    }
  };

  const handleDeleteSingle = async (id: string) => {
    await removeWorkspaceSnapshots([id]);
    setSnapshots(prev => prev.filter(s => s.id !== id));
    setSelectedIds(prev => prev.filter(item => item !== id));
    if (previewItem?.id === id) setPreviewItem(null);
    toast.info('Đã xóa đề khỏi kho lưu trữ');
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    await removeWorkspaceSnapshots(selectedIds);
    setSnapshots(prev => prev.filter(s => !selectedIds.includes(s.id)));
    setSelectedIds([]);
    toast.success(`Đã xóa ${count} đề thi đã chọn!`);
  };

  const handleDeleteAllViewed = async () => {
    const viewedIds = snapshots.filter(s => s.isViewed).map(s => s.id);
    if (viewedIds.length === 0) {
      toast.info('Không có đề nào ở trạng thái Đã xem để xóa.');
      return;
    }
    await removeWorkspaceSnapshots(viewedIds);
    setSnapshots(prev => prev.filter(s => !s.isViewed));
    setSelectedIds(prev => prev.filter(id => !viewedIds.includes(id)));
    toast.success(`Đã dọn dẹp ${viewedIds.length} đề thi đã xem!`);
  };

  const handleClearAllVault = async () => {
    if (snapshots.length === 0) return;
    await clearAllWorkspaceSnapshots();
    setSnapshots([]);
    setSelectedIds([]);
    setPreviewItem(null);
    toast.success('Đã làm sạch toàn bộ kho lưu trữ đề thi!');
  };

  // Filter Snapshots
  const uniqueEmails = Array.from(new Set(snapshots.map(s => s.userEmail)));
  const filteredSnapshots = snapshots.filter(item => {
    if (filterEmail !== 'ALL' && item.userEmail !== filterEmail) return false;
    if (filterStatus === 'UNVIEWED' && item.isViewed) return false;
    if (filterStatus === 'VIEWED' && !item.isViewed) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchFile = item.originalFileName.toLowerCase().includes(q);
      const matchUser =
        item.userName.toLowerCase().includes(q) ||
        item.userEmail.toLowerCase().includes(q);
      const matchSubj = (item.metadata?.subject || '').toLowerCase().includes(q);
      return matchFile || matchUser || matchSubj;
    }
    return true;
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredSnapshots.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSnapshots.map(s => s.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const totalStorageBytes = snapshots.reduce((sum, s) => sum + (s.sizeBytes || 0), 0);
  const totalStorageMB = (totalStorageBytes / (1024 * 1024)).toFixed(2);
  const unviewedCount = snapshots.filter(s => !s.isViewed).length;

  // Filter Teachers for Permissions Tab
  const filteredUsers = allUsers.filter(u => {
    if (!userSearchQuery.trim()) return true;
    const q = userSearchQuery.toLowerCase();
    return u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  // Config save
  const handleSaveConfig = () => {
    updateSystemConfig({
      defaultGeminiApiKey: apiKeyInput.trim(),
      defaultGeminiModel: modelIdInput.trim() || DEFAULT_MODEL_ID,
      announcement: announcementInput.trim(),
      ...(clientIdInput.trim() ? { googleClientId: clientIdInput.trim() } : {}),
    });
    toast.success(
      'Đã lưu cấu hình toàn hệ thống!',
      `Model AI: ${modelIdInput.trim() || DEFAULT_MODEL_ID}`
    );
    confetti({ particleCount: 30, spread: 40 });
  };

  return (
    <div className="space-y-6 py-2 max-w-5xl mx-auto">
      {/* Executive Header */}
      <div className="canva-card p-6 sm:p-7 border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-purple-500/5 to-cyan-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500 text-white text-[11px] font-extrabold shadow-xs">
            <Crown className="w-3.5 h-3.5" />
            <span>TRUNG TÂM ĐIỀU HÀNH ADMIN • DUY LÊ</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-neutral-900 dark:text-white">
            Quản Trị Phân Quyền &amp; Kho Đề Thi AzTool
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Cấp quyền riêng biệt từng tab tính năng cho từng Gmail và tự động sao lưu mọi đề thi tải lên.
          </p>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/90 dark:bg-neutral-900/90 border border-neutral-200 dark:border-neutral-800 shadow-xs self-start sm:self-center">
          <button
            onClick={() => setActiveSubTab('permissions')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition canva-tap ${
              activeSubTab === 'permissions'
                ? 'bg-gradient-to-r from-[#7d2ae8] to-[#00c4cc] text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Phân Quyền Tab ({allUsers.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('vault')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition canva-tap ${
              activeSubTab === 'vault'
                ? 'bg-gradient-to-r from-[#7d2ae8] to-[#00c4cc] text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span>Kho Đề Thi ({snapshots.length})</span>
            {unviewedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-extrabold">
                {unviewedCount} mới
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('settings')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition canva-tap ${
              activeSubTab === 'settings'
                ? 'bg-gradient-to-r from-[#7d2ae8] to-[#00c4cc] text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Cấu Hình Hệ Thống</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: PHÂN QUYỀN SỬ DỤNG THEO TỪNG TAB CHO TỪNG GMAIL               */}
      {/* ===================================================================== */}
      {activeSubTab === 'permissions' && (
        <div className="space-y-6 tab-enter">
          {/* Quick Add Teacher & Pre-Grant Permissions Card */}
          <div className="canva-card p-6 space-y-4 shadow-xs border border-neutral-200/90 dark:border-neutral-800">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#7d2ae8]" />
                <span>Thêm Gmail &amp; Cấp Quyền Tab Trước Cho Giáo Viên</span>
              </h3>
              <span className="text-[11px] text-neutral-400">
                Chỉ những Gmail được bật quyền ở đây mới có thể sử dụng tab tương ứng!
              </span>
            </div>

            <form onSubmit={handleAddNewTeacherWithPerms} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="email"
                  required
                  placeholder="Nhập địa chỉ Gmail giáo viên (VD: thaynam@gmail.com)..."
                  value={addTeacherEmail}
                  onChange={e => setAddTeacherEmail(e.target.value)}
                  className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 outline-hidden focus:ring-2 focus:ring-[#7d2ae8]"
                />
                <input
                  type="text"
                  placeholder="Tên giáo viên (tùy chọn)..."
                  value={addTeacherName}
                  onChange={e => setAddTeacherName(e.target.value)}
                  className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 outline-hidden focus:ring-2 focus:ring-[#7d2ae8]"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="font-bold text-neutral-700 dark:text-neutral-300">
                    Cấp quyền các tab:
                  </span>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addPermAudit}
                      onChange={e => setAddPermAudit(e.target.checked)}
                      className="rounded text-[#7d2ae8] w-4 h-4"
                    />
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">
                      1. AI Soát Lỗi Đề
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addPermStandardize}
                      onChange={e => setAddPermStandardize(e.target.checked)}
                      className="rounded text-[#7d2ae8] w-4 h-4"
                    />
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">
                      2. Chuẩn Hóa 1 Chạm
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addPermMix}
                      onChange={e => setAddPermMix(e.target.checked)}
                      className="rounded text-[#7d2ae8] w-4 h-4"
                    />
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">
                      3. Trộn Mã Đề 25%
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="canva-btn-primary px-5 py-2.5 rounded-xl font-bold transition canva-tap flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Kích Hoạt Quyền Cho Gmail Này</span>
                </button>
              </div>
            </form>
          </div>

          {/* Granular Permissions Table */}
          <div className="canva-card p-6 space-y-4 shadow-xs border border-neutral-200/90 dark:border-neutral-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#7d2ae8]" />
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Bảng Quản Lý Quyền Từng Tab Cho Từng Giáo Viên
                </h3>
              </div>

              <div className="relative min-w-[240px]">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={e => setUserSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên hoặc email giáo viên..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs outline-hidden focus:ring-2 focus:ring-[#7d2ae8]"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 font-semibold bg-neutral-50/50 dark:bg-neutral-900/40">
                    <th className="py-3 px-3">Tài khoản giáo viên</th>
                    <th className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-[#00c4cc]">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AI Soát Lỗi</span>
                      </div>
                    </th>
                    <th className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-emerald-600">
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>Chuẩn Hóa 1 Chạm</span>
                      </div>
                    </th>
                    <th className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-purple-600">
                        <Shuffle className="w-3.5 h-3.5" />
                        <span>Trộn Mã Đề</span>
                      </div>
                    </th>
                    <th className="py-3 px-3 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {filteredUsers.map(u => {
                    const isSuper = u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
                    const perms: TabPermissions = isSuper
                      ? { canAudit: true, canStandardize: true, canMix: true }
                      : permissionsMap[u.email.toLowerCase()] ||
                        u.permissions || { canAudit: false, canStandardize: false, canMix: false };

                    return (
                      <tr
                        key={u.id || u.email}
                        className="hover:bg-purple-50/30 dark:hover:bg-neutral-800/30 transition"
                      >
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={
                                u.photoURL ||
                                `https://api.dicebear.com/7.x/initials/svg?seed=${u.email}`
                              }
                              alt=""
                              className="w-8 h-8 rounded-full border border-neutral-200 shrink-0"
                            />
                            <div>
                              <div className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                                <span>{u.displayName}</span>
                                {isSuper && (
                                  <span className="px-2 py-0.2 rounded-full text-[9px] font-black bg-amber-500 text-white">
                                    ADMIN DUY
                                  </span>
                                )}
                              </div>
                              <div className="font-mono text-[11px] text-neutral-400">
                                {u.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Col 1: AI Audit */}
                        <td className="py-3.5 px-3 text-center">
                          {isSuper ? (
                            <span className="text-emerald-600 font-black text-xs">Vĩnh Viễn</span>
                          ) : (
                            <button
                              onClick={() => void handleTogglePerm(u.email, 'canAudit')}
                              className={`px-3 py-1 rounded-xl font-bold text-xs transition canva-tap flex items-center gap-1 mx-auto ${
                                perms.canAudit
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800'
                              }`}
                            >
                              {perms.canAudit ? (
                                <>
                                  <Unlock className="w-3 h-3" />
                                  <span>Được dùng</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3 h-3" />
                                  <span>Bị khóa</span>
                                </>
                              )}
                            </button>
                          )}
                        </td>

                        {/* Col 2: Standardize */}
                        <td className="py-3.5 px-3 text-center">
                          {isSuper ? (
                            <span className="text-emerald-600 font-black text-xs">Vĩnh Viễn</span>
                          ) : (
                            <button
                              onClick={() => void handleTogglePerm(u.email, 'canStandardize')}
                              className={`px-3 py-1 rounded-xl font-bold text-xs transition canva-tap flex items-center gap-1 mx-auto ${
                                perms.canStandardize
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800'
                              }`}
                            >
                              {perms.canStandardize ? (
                                <>
                                  <Unlock className="w-3 h-3" />
                                  <span>Được dùng</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3 h-3" />
                                  <span>Bị khóa</span>
                                </>
                              )}
                            </button>
                          )}
                        </td>

                        {/* Col 3: Mix */}
                        <td className="py-3.5 px-3 text-center">
                          {isSuper ? (
                            <span className="text-emerald-600 font-black text-xs">Vĩnh Viễn</span>
                          ) : (
                            <button
                              onClick={() => void handleTogglePerm(u.email, 'canMix')}
                              className={`px-3 py-1 rounded-xl font-bold text-xs transition canva-tap flex items-center gap-1 mx-auto ${
                                perms.canMix
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800'
                              }`}
                            >
                              {perms.canMix ? (
                                <>
                                  <Unlock className="w-3 h-3" />
                                  <span>Được dùng</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3 h-3" />
                                  <span>Bị khóa</span>
                                </>
                              )}
                            </button>
                          )}
                        </td>

                        {/* Col 4: Quick Actions */}
                        <td className="py-3.5 px-3 text-right">
                          {!isSuper && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => void handleGrantAll(u.email)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 font-bold text-[10px] hover:bg-emerald-100 transition"
                                title="Bật tất cả các tab cho giáo viên này"
                              >
                                Cấp hết
                              </button>
                              <button
                                onClick={() => void handleRevokeAll(u.email)}
                                className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 font-bold text-[10px] hover:bg-amber-100 transition"
                                title="Khóa tất cả các tab của giáo viên này"
                              >
                                Khóa hết
                              </button>
                              <button
                                onClick={() => {
                                  deleteUser(u.id);
                                  toast.info('Đã xóa khỏi danh sách', u.email);
                                }}
                                className="p-1 rounded-lg text-neutral-400 hover:text-rose-500 transition"
                                title="Xóa tài khoản"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
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
      )}

      {/* ===================================================================== */}
      {/* TAB 2: KHO LƯU TRỮ & ĐỐI SOÁT ĐỀ THI (VAULT)                         */}
      {/* ===================================================================== */}
      {activeSubTab === 'vault' && (
        <div className="space-y-5 tab-enter">
          {/* Storage KPI & Policy Selector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Policy Card */}
            <div className="lg:col-span-7 canva-card p-5 space-y-3.5 border border-neutral-200/90 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#7d2ae8]" />
                  <h3 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white">
                    Chế Độ Thu Thập &amp; Lưu Trữ Đề Thi Tự Động
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Lưu trữ đám mây + Bộ nhớ đệm ngầm
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <button
                  onClick={() => handlePolicyModeChange('all')}
                  className={`p-3 rounded-2xl border text-left transition canva-tap ${
                    syncPolicy.mode === 'all'
                      ? 'border-[#7d2ae8] bg-purple-50/70 dark:bg-purple-950/40 font-bold text-[#7d2ae8] dark:text-purple-300'
                      : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  <div className="font-bold">1. Tất cả giáo viên</div>
                  <div className="text-[10px] opacity-80 mt-0.5">
                    Mọi tài khoản tải đề lên đều tự động lưu file gốc + file chuẩn
                  </div>
                </button>

                <button
                  onClick={() => handlePolicyModeChange('selected')}
                  className={`p-3 rounded-2xl border text-left transition canva-tap ${
                    syncPolicy.mode === 'selected'
                      ? 'border-[#7d2ae8] bg-purple-50/70 dark:bg-purple-950/40 font-bold text-[#7d2ae8] dark:text-purple-300'
                      : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  <div className="font-bold">
                    2. Chỉ giáo viên có quyền
                  </div>
                  <div className="text-[10px] opacity-80 mt-0.5">
                    Chỉ lưu đề của các email đã được duyệt quyền sử dụng
                  </div>
                </button>

                <button
                  onClick={() => handlePolicyModeChange('off')}
                  className={`p-3 rounded-2xl border text-left transition canva-tap ${
                    syncPolicy.mode === 'off'
                      ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/40 font-bold text-rose-600 dark:text-rose-300'
                      : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  <div className="font-bold">3. Tạm dừng lưu</div>
                  <div className="text-[10px] opacity-80 mt-0.5">
                    Tạm ngưng ghi nhận đề mới vào kho
                  </div>
                </button>
              </div>
            </div>

            {/* Storage & Quick Cleanup Card */}
            <div className="lg:col-span-5 canva-card p-5 flex flex-col justify-between gap-4 border border-neutral-200/90 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-[#00c4cc]" />
                  <h3 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white">
                    Dung Lượng &amp; Dọn Rác Nhanh
                  </h3>
                </div>
                <button
                  onClick={() => void loadVaultData()}
                  className="p-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 transition"
                  title="Làm mới danh sách"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800">
                  <div className="text-[10px] font-semibold text-neutral-400">Tổng Đề Lưu</div>
                  <div className="text-lg font-black text-neutral-900 dark:text-white">
                    {snapshots.length}
                  </div>
                </div>
                <div className="p-2.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800">
                  <div className="text-[10px] font-semibold text-neutral-400">Chưa Xem</div>
                  <div className="text-lg font-black text-rose-500">{unviewedCount}</div>
                </div>
                <div className="p-2.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800">
                  <div className="text-[10px] font-semibold text-neutral-400">Dung Lượng</div>
                  <div className="text-lg font-black text-[#7d2ae8]">{totalStorageMB} MB</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void handleDeleteAllViewed()}
                  disabled={snapshots.filter(s => s.isViewed).length === 0}
                  className="flex-1 py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-[11px] font-bold transition canva-tap disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa Đề Đã Xem ({snapshots.filter(s => s.isViewed).length})</span>
                </button>

                <button
                  onClick={() => void handleClearAllVault()}
                  disabled={snapshots.length === 0}
                  className="py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[11px] font-bold transition canva-tap disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa Tất Cả</span>
                </button>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="canva-card p-4 border border-neutral-200/90 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên file, môn học, tên hoặc email giáo viên..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs outline-hidden focus:ring-2 focus:ring-[#7d2ae8]"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-neutral-400" />
                <select
                  value={filterEmail}
                  onChange={e => setFilterEmail(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-semibold"
                >
                  <option value="ALL">Tất cả giáo viên ({uniqueEmails.length})</option>
                  {uniqueEmails.map(em => (
                    <option key={em} value={em}>
                      {em}
                    </option>
                  ))}
                </select>

                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value as any)}
                  className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-semibold"
                >
                  <option value="ALL">Mọi trạng thái</option>
                  <option value="UNVIEWED">Chưa xem ({unviewedCount})</option>
                  <option value="VIEWED">Đã xem ({snapshots.length - unviewedCount})</option>
                </select>
              </div>
            </div>

            {selectedIds.length > 0 && (
              <button
                onClick={() => void handleDeleteSelected()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition canva-tap flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa {selectedIds.length} đề đang chọn</span>
              </button>
            )}
          </div>

          {/* Snapshots List */}
          {isLoadingVault ? (
            <div className="canva-card p-12 text-center text-xs text-neutral-400">
              Đang tải dữ liệu kho đề thi từ máy chủ...
            </div>
          ) : filteredSnapshots.length === 0 ? (
            <div className="canva-card p-12 text-center space-y-2 border border-neutral-200/90 dark:border-neutral-800">
              <FolderArchive className="w-10 h-10 text-neutral-300 dark:text-neutral-700 mx-auto" />
              <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                Chưa có đề thi nào trong danh sách
              </p>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Khi bất kỳ giáo viên nào tải file Word lên để kiểm tra lỗi, chuẩn hóa hoặc trộn mã đề, toàn bộ file gốc và file chuẩn hóa sẽ tự động lưu về đây.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-2 text-xs text-neutral-500">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 font-semibold hover:text-neutral-900 dark:hover:text-white"
                >
                  {selectedIds.length === filteredSnapshots.length ? (
                    <CheckSquare className="w-4 h-4 text-[#7d2ae8]" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  <span>Chọn tất cả ({filteredSnapshots.length} đề thi)</span>
                </button>
                <span>Sắp xếp: Mới nhất lên đầu</span>
              </div>

              {filteredSnapshots.map(item => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    className={`canva-card p-4 sm:p-5 transition border ${
                      isSelected
                        ? 'border-[#7d2ae8] bg-purple-50/20 dark:bg-purple-950/20'
                        : !item.isViewed
                        ? 'border-amber-400/60 dark:border-amber-500/40 bg-white dark:bg-[#151824]'
                        : 'border-neutral-200/90 dark:border-neutral-800 opacity-90'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Uploader & Exam Meta */}
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleSelectOne(item.id)}
                          className="mt-1 text-neutral-400 hover:text-[#7d2ae8]"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-[#7d2ae8]" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>

                        <img
                          src={
                            item.userAvatar ||
                            `https://api.dicebear.com/7.x/initials/svg?seed=${item.userEmail}`
                          }
                          alt=""
                          className="w-10 h-10 rounded-2xl border border-neutral-200 dark:border-neutral-700 shrink-0"
                        />

                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs sm:text-sm font-black text-neutral-900 dark:text-white">
                              {item.userName}
                            </span>
                            <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
                              ({item.userEmail})
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-[#7d2ae8] dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              {item.actionLabel}
                            </span>
                            {!item.isViewed ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500 text-white">
                                MỚI
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                                Đã xem
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600 dark:text-neutral-300">
                            <span className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5 text-[#7d2ae8]" />
                              {item.originalFileName}
                            </span>
                            <span>
                              • <strong>{item.questionsCount}</strong> câu hỏi (
                              <strong>{item.answeredCount}</strong> câu có đáp án)
                            </span>
                            {item.metadata?.subject && (
                              <span>
                                • Môn: <strong>{item.metadata.subject}</strong>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-amber-700 dark:text-amber-400">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Thời điểm tải lên chính xác: {item.formattedTime}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex flex-wrap items-center gap-2 lg:shrink-0 pl-7 lg:pl-0">
                        <button
                          onClick={() => void handleDownloadOriginal(item)}
                          className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition canva-tap flex items-center gap-1.5"
                          title="Tải đúng file Word gốc do người dùng tải lên"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>File Word Gốc (.docx)</span>
                        </button>

                        <button
                          onClick={() => void handleDownloadStandardized(item)}
                          className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition canva-tap flex items-center gap-1.5"
                          title="Tải file Word đã chuẩn hóa kèm bảng đáp án đánh dấu X"
                        >
                          <FileCheck2 className="w-3.5 h-3.5" />
                          <span>File Chuẩn Hóa (.docx)</span>
                        </button>

                        <button
                          onClick={() => void handleOpenPreview(item)}
                          className="canva-btn-secondary px-3 py-2 rounded-xl text-xs font-bold transition canva-tap flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#7d2ae8]" />
                          <span>Xem Đề</span>
                        </button>

                        <button
                          onClick={() => void handleDeleteSingle(item.id)}
                          className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-400 hover:text-rose-600 hover:border-rose-300 transition canva-tap"
                          title="Xóa đề này khỏi kho lưu trữ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: CẤU HÌNH HỆ THỐNG & AI ENGINE                                  */}
      {/* ===================================================================== */}
      {activeSubTab === 'settings' && (
        <div className="canva-card p-6 sm:p-7 space-y-5 shadow-xs border border-neutral-200/90 dark:border-neutral-800 tab-enter">
          <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#7d2ae8]" />
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Cấu Hình Độc Quyền Admin (Người dùng thường hoàn toàn không nhìn thấy)
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                Gemini Model ID Toàn Hệ Thống:
              </label>
              <input
                type="text"
                value={modelIdInput}
                onChange={e => setModelIdInput(e.target.value)}
                placeholder="gemini-2.0-flash"
                className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 font-mono font-semibold focus:ring-2 focus:ring-[#7d2ae8] outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                Google OAuth Client ID (Login Google):
              </label>
              <input
                type="text"
                value={clientIdInput}
                onChange={e => setClientIdInput(e.target.value)}
                placeholder="xxx.apps.googleusercontent.com"
                className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 font-mono text-xs focus:ring-2 focus:ring-[#7d2ae8] outline-hidden"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                Danh Sách Gemini API Keys Toàn Web (Ngăn cách bằng dấu phẩy):
              </label>
              <textarea
                rows={3}
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..., AIzaSy..."
                className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 font-mono text-xs focus:ring-2 focus:ring-[#7d2ae8] outline-hidden"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                Thông Báo Toàn Web (Broadcast Banner):
              </label>
              <input
                type="text"
                value={announcementInput}
                onChange={e => setAnnouncementInput(e.target.value)}
                className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs focus:ring-2 focus:ring-[#7d2ae8] outline-hidden"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveConfig}
              className="canva-btn-primary px-6 py-2.5 rounded-xl text-xs font-bold shadow-xs transition canva-tap flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Lưu Toàn Bộ Cấu Hình Hệ Thống</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal Preview Questions */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="canva-card w-full max-w-3xl max-h-[85vh] flex flex-col rounded-3xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-2xl">
            <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3 bg-neutral-50 dark:bg-neutral-900">
              <div>
                <h3 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white">
                  {previewItem.originalFileName} ({previewItem.questionsCount} câu)
                </h3>
                <p className="text-[11px] text-neutral-500">
                  Đăng bởi: <strong>{previewItem.userName}</strong> ({previewItem.userEmail}) • Lúc:{' '}
                  <strong>{previewItem.formattedTime}</strong>
                </p>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="p-2 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {previewItem.questionsPreview.map((q, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 space-y-2 text-xs"
                >
                  <div className="font-bold text-neutral-900 dark:text-white">
                    Câu {idx + 1}: {q.text}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {(['A', 'B', 'C', 'D'] as const).map(opt => {
                      const isCorrect = q.correctAnswer === opt;
                      return (
                        <div
                          key={opt}
                          className={`p-2 rounded-xl border ${
                            isCorrect
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 font-bold text-emerald-800 dark:text-emerald-300'
                              : 'border-neutral-100 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                          }`}
                        >
                          {opt}. {q.options[opt]} {isCorrect && '✓'}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={() => void handleDownloadOriginal(previewItem)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải File Word Gốc (.docx)</span>
              </button>
              <button
                onClick={() => void handleDownloadStandardized(previewItem)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>Tải Đề Chuẩn Hóa (.docx)</span>
              </button>
              <button
                onClick={() => setPreviewItem(null)}
                className="canva-btn-secondary px-4 py-2 rounded-xl text-xs font-bold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
