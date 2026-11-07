'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { downloadFileMobileSafe } from '@/lib/mobile-download';
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
  CheckCircle2,
  Mail,
  UserCheck,
  FileSpreadsheet,
  Save,
  Cloud,
  CheckCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { DeQLogo, AzLogoLoader } from '@/components/DeQLogo';

export function AdminDashboard() {
  const {
    allUsers,
    systemConfig,
    isSuperAdmin,
    permissionsMap,
    updateUserPermissions,
    saveBulkPermissions,
    grantAllPermissions,
    revokeAllPermissions,
    refreshUsers,
    deleteUser,
    updateSystemConfig,
  } = useAuth();
  const toast = useToast();

  const [activeSubTab, setActiveSubTab] = useState<'permissions' | 'vault' | 'settings'>('permissions');

  // Vault state
  const [snapshots, setSnapshots] = useState<WorkspaceSnapshotItem[]>([]);
  const [isLoadingVault, setIsLoadingVault] = useState(true);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [syncPolicy, setSyncPolicy] = useState<WorkspaceSyncPolicy>({
    mode: 'all',
    selectedEmails: [],
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEmail, setFilterEmail] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'UNVIEWED' | 'VIEWED'>('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewItem, setPreviewItem] = useState<WorkspaceSnapshotItem | null>(null);
  const [previewSearch, setPreviewSearch] = useState('');

  // User permission management state
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [teacherStatusFilter, setTeacherStatusFilter] = useState<
    'ALL' | 'AUTHORIZED' | 'LOCKED' | 'UNSAVED'
  >('ALL');
  const [draftPermissionsMap, setDraftPermissionsMap] = useState<Record<string, TabPermissions>>({});
  const [unsavedEmails, setUnsavedEmails] = useState<Record<string, boolean>>({});
  const [savingEmail, setSavingEmail] = useState<string | null>(null);
  const [isSavingAllPerms, setIsSavingAllPerms] = useState(false);
  const [recentlySavedEmails, setRecentlySavedEmails] = useState<Record<string, number>>({});

  const [addTeacherEmail, setAddTeacherEmail] = useState('');
  const [addTeacherName, setAddTeacherName] = useState('');
  const [addPermAudit, setAddPermAudit] = useState(true);
  const [addPermStandardize, setAddPermStandardize] = useState(true);
  const [addPermMix, setAddPermMix] = useState(true);
  const [addPermPdfStudio, setAddPermPdfStudio] = useState(true);
  const [addPermThesisAudit, setAddPermThesisAudit] = useState(true);

  // System settings state (Google OAuth Key is permanently hidden in Security Vault)
  const [apiKeyInput, setApiKeyInput] = useState(systemConfig.defaultGeminiApiKey || '');
  const [modelIdInput, setModelIdInput] = useState(
    systemConfig.defaultGeminiModel || DEFAULT_MODEL_ID
  );
  const [announcementInput, setAnnouncementInput] = useState(systemConfig.announcement || '');

  const hasLoadedOnceRef = useRef(false);

  const loadAllAdminData = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setIsRefreshingAll(true);
      setIsLoadingVault(true);
    }
    try {
      await Promise.all([
        refreshUsers(),
        (async () => {
          const items = await listWorkspaceSnapshots();
          setSnapshots(items);
          setSyncPolicy(getSyncPolicy());
        })(),
      ]);
    } catch (e) {
      console.warn('loadAllAdminData error:', e);
    } finally {
      setIsLoadingVault(false);
      setIsRefreshingAll(false);
    }
  }, [refreshUsers]);

  useEffect(() => {
    if (isSuperAdmin && !hasLoadedOnceRef.current) {
      hasLoadedOnceRef.current = true;
      void loadAllAdminData(true);
    }
  }, [isSuperAdmin, loadAllAdminData]);

  // Combine users from `allUsers`, `permissionsMap`, and `snapshots` while respecting deleted tombstones
  const combinedTeachers = useMemo(() => {
    const map = new Map<string, UserProfile>();

    let deletedEmailsMap: Record<string, number> = {};
    if (typeof window !== 'undefined') {
      try {
        const rawDel = localStorage.getItem('aztool_deleted_emails');
        if (rawDel) deletedEmailsMap = JSON.parse(rawDel);
      } catch {
        // ignore
      }
    }

    const toFivePerms = (raw?: Partial<TabPermissions> | null): TabPermissions => ({
      canAudit: Boolean(raw?.canAudit),
      canStandardize: Boolean(raw?.canStandardize),
      canMix: Boolean(raw?.canMix),
      canPdfStudio: Boolean(raw?.canPdfStudio),
      canThesisAudit: Boolean(raw?.canThesisAudit),
      updatedAt: raw?.updatedAt || 0,
    });

    for (const u of allUsers) {
      const norm = u.email.trim().toLowerCase();
      const p = toFivePerms(permissionsMap[norm] || u.permissions);
      const delTs = deletedEmailsMap[norm] || 0;
      if (norm !== SUPER_ADMIN_EMAIL.toLowerCase() && delTs > (p.updatedAt || 0) && !permissionsMap[norm]) {
        continue;
      }
      map.set(norm, {
        ...u,
        email: norm,
        permissions: p,
      });
    }

    // Also include any email present in permissionsMap even if not yet in allUsers
    for (const [emailKey, perms] of Object.entries(permissionsMap)) {
      const norm = emailKey.trim().toLowerCase();
      if (!map.has(norm)) {
        map.set(norm, {
          id: `perm-${norm}`,
          email: norm,
          displayName: norm.split('@')[0],
          photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${norm}`,
          role: norm === SUPER_ADMIN_EMAIL.toLowerCase() ? 'super_admin' : 'free',
          permissions: toFivePerms(perms),
          createdAt: '2026-01-01',
          lastActive: new Date().toISOString(),
          examsGeneratedCount: 0,
          mixCount: 0,
        });
      }
    }

    // Also auto-discover any teacher who uploaded an exam in snapshots (if not deleted)
    for (const s of snapshots) {
      const email = s.userEmail.trim().toLowerCase();
      if (!map.has(email)) {
        const delTs = deletedEmailsMap[email] || 0;
        const snapTs = s.createdAtIso ? new Date(s.createdAtIso).getTime() : 0;
        if (email !== SUPER_ADMIN_EMAIL.toLowerCase() && delTs > 0 && delTs >= snapTs && !permissionsMap[email]) {
          continue;
        }
        map.set(email, {
          id: `discovered-${s.id}`,
          email: email,
          displayName: s.userName || s.userEmail.split('@')[0],
          photoURL: s.userAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${s.userEmail}`,
          role: email === SUPER_ADMIN_EMAIL.toLowerCase() ? 'super_admin' : 'free',
          permissions: toFivePerms(permissionsMap[email]),
          createdAt: s.createdAtIso?.split('T')[0] || '2026-01-01',
          lastActive: s.createdAtIso || new Date().toISOString(),
          examsGeneratedCount: 1,
          mixCount: 0,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) return -1;
      if (b.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) return 1;
      return a.email.localeCompare(b.email);
    });
  }, [allUsers, permissionsMap, snapshots]);

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
  const getEffectiveTeacherPerms = (normEmail: string, fallback?: TabPermissions): TabPermissions => {
    const norm = normEmail.trim().toLowerCase();
    if (norm === SUPER_ADMIN_EMAIL.toLowerCase()) {
      return {
        canAudit: true,
        canStandardize: true,
        canMix: true,
        canPdfStudio: true,
        canThesisAudit: true,
        updatedAt: 9999999999999,
      };
    }
    const raw = draftPermissionsMap[norm] || permissionsMap[norm] || fallback;
    return {
      canAudit: Boolean(raw?.canAudit),
      canStandardize: Boolean(raw?.canStandardize),
      canMix: Boolean(raw?.canMix),
      canPdfStudio: Boolean(raw?.canPdfStudio),
      canThesisAudit: Boolean(raw?.canThesisAudit),
      updatedAt: raw?.updatedAt || 0,
    };
  };

  const handleTogglePerm = async (
    email: string,
    key: 'canAudit' | 'canStandardize' | 'canMix' | 'canPdfStudio' | 'canThesisAudit',
    displayName?: string
  ) => {
    const norm = email.trim().toLowerCase();
    if (norm === SUPER_ADMIN_EMAIL.toLowerCase()) return;

    const existingUser = combinedTeachers.find(u => u.email.toLowerCase() === norm);
    const current = getEffectiveTeacherPerms(norm, existingUser?.permissions);

    const updated: TabPermissions = {
      ...current,
      [key]: !current[key],
      updatedAt: Date.now(),
    };

    setDraftPermissionsMap(prev => ({ ...prev, [norm]: updated }));
    setUnsavedEmails(prev => ({ ...prev, [norm]: true }));

    // Auto-sync immediately in background AND allow explicit Save confirmation button
    await updateUserPermissions(norm, updated, displayName || existingUser?.displayName);
    const labelMap: Record<string, string> = {
      canAudit: '1. AI Soát Lỗi Đề',
      canStandardize: '2. Chuẩn Hóa 1 Chạm',
      canMix: '3. Trộn Mã Đề 25%',
      canPdfStudio: '4. Dịch PDF Pro & Cắt PDF',
      canThesisAudit: '5. Rà Soát Đề Án Word',
    };
    toast.info(
      `${updated[key] ? 'Đã BẬT' : 'Đã KHÓA'}: ${labelMap[key]}`,
      `Bấm nút "Lưu Quyền" ở dòng ${norm} để khóa xác nhận đồng bộ Cloud!`
    );
  };

  const handleSaveTeacherPerms = async (email: string, displayName?: string) => {
    const norm = email.trim().toLowerCase();
    if (!norm || norm === SUPER_ADMIN_EMAIL.toLowerCase()) return;

    setSavingEmail(norm);
    try {
      const existingUser = combinedTeachers.find(u => u.email.toLowerCase() === norm);
      const current = getEffectiveTeacherPerms(norm, existingUser?.permissions);
      const finalPerms: TabPermissions = {
        canAudit: Boolean(current.canAudit),
        canStandardize: Boolean(current.canStandardize),
        canMix: Boolean(current.canMix),
        canPdfStudio: Boolean(current.canPdfStudio),
        canThesisAudit: Boolean(current.canThesisAudit),
        updatedAt: Date.now(),
      };

      await updateUserPermissions(norm, finalPerms, displayName || existingUser?.displayName);
      setDraftPermissionsMap(prev => {
        const next = { ...prev };
        delete next[norm];
        return next;
      });
      setUnsavedEmails(prev => {
        const next = { ...prev };
        delete next[norm];
        return next;
      });
      setRecentlySavedEmails(prev => ({ ...prev, [norm]: Date.now() }));

      toast.success(
        'Đã Lưu & Đồng Bộ Phân Quyền Lên Cloud!',
        `Tài khoản ${norm} đã cập nhật quyền mở/khóa thời gian thực.`
      );
      confetti({ particleCount: 35, spread: 50 });
    } finally {
      setSavingEmail(null);
    }
  };

  const handleSaveAllPermissions = async () => {
    setIsSavingAllPerms(true);
    try {
      const bulkMap: Record<string, TabPermissions> = {};
      const displayNames: Record<string, string> = {};
      const nowSaved: Record<string, number> = {};

      for (const u of combinedTeachers) {
        const norm = u.email.trim().toLowerCase();
        if (norm === SUPER_ADMIN_EMAIL.toLowerCase()) continue;
        bulkMap[norm] = getEffectiveTeacherPerms(norm, u.permissions);
        displayNames[norm] = u.displayName;
        nowSaved[norm] = Date.now();
      }

      await saveBulkPermissions(bulkMap, displayNames);
      setDraftPermissionsMap({});
      setUnsavedEmails({});
      setRecentlySavedEmails(prev => ({ ...prev, ...nowSaved }));

      toast.success(
        'Đã Lưu Toàn Bộ Bảng Phân Quyền Lên Cloud!',
        `Đã đồng bộ ${Object.keys(bulkMap).length} tài khoản giáo viên xuyên suốt mọi thiết bị.`
      );
      confetti({ particleCount: 55, spread: 65 });
    } finally {
      setIsSavingAllPerms(false);
    }
  };

  const handleGrantAll = async (email: string, displayName?: string) => {
    const norm = email.trim().toLowerCase();
    setSavingEmail(norm);
    try {
      const allOpen: TabPermissions = {
        canAudit: true,
        canStandardize: true,
        canMix: true,
        canPdfStudio: true,
        canThesisAudit: true,
        updatedAt: Date.now(),
      };
      await updateUserPermissions(norm, allOpen, displayName);
      setDraftPermissionsMap(prev => {
        const next = { ...prev };
        delete next[norm];
        return next;
      });
      setUnsavedEmails(prev => {
        const next = { ...prev };
        delete next[norm];
        return next;
      });
      setRecentlySavedEmails(prev => ({ ...prev, [norm]: Date.now() }));
      toast.success('Đã Mở Toàn Quyền & Lưu Cloud!', `Tài khoản ${norm} đã mở cả 5 tính năng.`);
      confetti({ particleCount: 30, spread: 45 });
    } finally {
      setSavingEmail(null);
    }
  };

  const handleRevokeAll = async (email: string, displayName?: string) => {
    const norm = email.trim().toLowerCase();
    setSavingEmail(norm);
    try {
      const allLocked: TabPermissions = {
        canAudit: false,
        canStandardize: false,
        canMix: false,
        canPdfStudio: false,
        canThesisAudit: false,
        updatedAt: Date.now(),
      };
      await updateUserPermissions(norm, allLocked, displayName);
      setDraftPermissionsMap(prev => {
        const next = { ...prev };
        delete next[norm];
        return next;
      });
      setUnsavedEmails(prev => {
        const next = { ...prev };
        delete next[norm];
        return next;
      });
      setRecentlySavedEmails(prev => ({ ...prev, [norm]: Date.now() }));
      toast.warning('Đã Khóa Toàn Bộ & Lưu Cloud!', `Tài khoản ${norm} hiện đang bị khóa cả 5 tab.`);
    } finally {
      setSavingEmail(null);
    }
  };

  const handleAddNewTeacherWithPerms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addTeacherEmail.trim()) return;

    const email = addTeacherEmail.trim().toLowerCase();
    const name = addTeacherName.trim() || email.split('@')[0];
    setSavingEmail(email);
    try {
      const newPerms: TabPermissions = {
        canAudit: addPermAudit,
        canStandardize: addPermStandardize,
        canMix: addPermMix,
        canPdfStudio: addPermPdfStudio,
        canThesisAudit: addPermThesisAudit,
        updatedAt: Date.now(),
      };

      await updateUserPermissions(email, newPerms, name);
      setDraftPermissionsMap(prev => {
        const next = { ...prev };
        delete next[email];
        return next;
      });
      setUnsavedEmails(prev => {
        const next = { ...prev };
        delete next[email];
        return next;
      });
      setRecentlySavedEmails(prev => ({ ...prev, [email]: Date.now() }));
      setAddTeacherEmail('');
      setAddTeacherName('');
      toast.success('Đã thêm & lưu quyền giáo viên lên Cloud!', `${name} (${email})`);
      confetti({ particleCount: 40, spread: 50 });
    } finally {
      setSavingEmail(null);
    }
  };

  // --- VAULT HANDLERS ---
  const handlePolicyModeChange = (mode: WorkspaceSyncPolicy['mode']) => {
    const updated: WorkspaceSyncPolicy = {
      ...syncPolicy,
      mode,
    };
    setSyncPolicy(updated);
    saveSyncPolicy(updated);
    toast.success('Đã cập nhật chế độ tự động lưu đề!');
  };

  const handleDownloadOriginal = async (item: WorkspaceSnapshotItem) => {
    try {
      if (item.originalBlob) {
        await downloadFileMobileSafe(item.originalBlob, item.originalFileName || `FileGoc_${item.id}.docx`);
      } else {
        const fallbackBlob = await generateStandardDocx(
          item.metadata,
          item.questionsPreview,
          false
        );
        await downloadFileMobileSafe(fallbackBlob, item.originalFileName || `VanBanGoc_${item.id}.docx`);
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
        await downloadFileMobileSafe(item.standardizedBlob, outName);
      } else {
        const generated = await generateStandardDocx(
          item.metadata,
          item.questionsPreview,
          true
        );
        await downloadFileMobileSafe(generated, outName);
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
    setPreviewSearch('');
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

  const authorizedCount = combinedTeachers.filter(u => {
    const norm = u.email.toLowerCase();
    const isSuper = norm === SUPER_ADMIN_EMAIL.toLowerCase();
    if (isSuper) return true;
    const p = getEffectiveTeacherPerms(norm, u.permissions);
    return p.canAudit || p.canStandardize || p.canMix || p.canPdfStudio || p.canThesisAudit;
  }).length;

  const lockedCount = Math.max(0, combinedTeachers.length - authorizedCount);
  const unsavedCount = Object.keys(unsavedEmails).length;

  // Filter Teachers for Permissions Tab
  const filteredTeachers = combinedTeachers.filter(u => {
    const norm = u.email.toLowerCase();
    const isSuper = norm === SUPER_ADMIN_EMAIL.toLowerCase();
    const p = getEffectiveTeacherPerms(norm, u.permissions);
    const hasAnyPerm =
      isSuper || p.canAudit || p.canStandardize || p.canMix || p.canPdfStudio || p.canThesisAudit;

    if (teacherStatusFilter === 'AUTHORIZED' && !hasAnyPerm) return false;
    if (teacherStatusFilter === 'LOCKED' && hasAnyPerm) return false;
    if (teacherStatusFilter === 'UNSAVED' && !unsavedEmails[norm]) return false;

    if (!userSearchQuery.trim()) return true;
    const q = userSearchQuery.toLowerCase();
    return u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  // Filter questions inside preview modal
  const filteredPreviewQuestions = useMemo(() => {
    if (!previewItem) return [];
    if (!previewSearch.trim()) return previewItem.questionsPreview;
    const q = previewSearch.toLowerCase();
    return previewItem.questionsPreview.filter(
      item =>
        item.text.toLowerCase().includes(q) ||
        Object.values(item.options).some(v => (v || '').toLowerCase().includes(q))
    );
  }, [previewItem, previewSearch]);

  // Config save
  const handleSaveConfig = () => {
    updateSystemConfig({
      defaultGeminiApiKey: apiKeyInput.trim(),
      defaultGeminiModel: modelIdInput.trim() || DEFAULT_MODEL_ID,
      announcement: announcementInput.trim(),
    });
    toast.success(
      'Đã lưu cấu hình toàn hệ thống!',
      `Model AI: ${modelIdInput.trim() || DEFAULT_MODEL_ID}`
    );
    confetti({ particleCount: 30, spread: 40 });
  };

  return (
    <div className="space-y-6 py-2 max-w-6xl mx-auto">
      {/* Executive Command Center Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#1a1333] via-[#26174a] to-[#0f293a] p-6 sm:p-7 text-white shadow-xl border border-amber-400/30">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-neutral-950 text-[11px] font-black flex items-center gap-1.5 shadow-sm">
                <Crown className="w-3.5 h-3.5" />
                <span>TRUNG TÂM QUẢN TRỊ TỐI THƯỢNG • ADMIN DUY LÊ</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-amber-300 text-xs font-mono border border-white/10">
                lenhatduy.vietnam@gmail.com
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Điều Hành Phân Quyền Giáo Viên &amp; Kho Đề Thi Tập Trung
            </h2>
            <p className="text-xs sm:text-sm text-purple-200/80 max-w-2xl">
              Cấp quyền đóng/mở từng tính năng theo thời gian thực cho từng Gmail giáo viên và kiểm tra, tải xuống mọi file đề gốc hoặc đề chuẩn hóa.
            </p>
          </div>

          {/* Right Quick Status & Sync */}
          <div className="flex items-center gap-3 self-start md:self-center">
            <div className="hidden sm:flex items-center gap-4 px-4 py-2.5 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md">
              <div className="text-center">
                <div className="text-[10px] font-bold uppercase text-purple-200">Giáo viên</div>
                <div className="text-base font-black text-white">{combinedTeachers.length}</div>
              </div>
              <div className="w-px h-7 bg-white/15" />
              <div className="text-center">
                <div className="text-[10px] font-bold uppercase text-emerald-300">Đã mở quyền</div>
                <div className="text-base font-black text-emerald-400">{authorizedCount}</div>
              </div>
              <div className="w-px h-7 bg-white/15" />
              <div className="text-center">
                <div className="text-[10px] font-bold uppercase text-amber-300">Kho đề thi</div>
                <div className="text-base font-black text-amber-300">{snapshots.length}</div>
              </div>
            </div>

            <button
              onClick={() => void loadAllAdminData(true)}
              disabled={isRefreshingAll}
              className="px-4 py-3 rounded-2xl bg-white text-neutral-900 hover:bg-amber-50 transition canva-tap flex items-center gap-2 text-xs font-black shadow-lg"
              title="Đồng bộ dữ liệu mới nhất"
            >
              {isRefreshingAll ? (
                <DeQLogo size="xs" showSubtitle={false} isLoadingMode />
              ) : (
                <RefreshCw className="w-4 h-4 text-[#7d2ae8]" />
              )}
              <span>{isRefreshingAll ? 'Đang đồng bộ...' : 'Làm Mới Dữ Liệu'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* High-Contrast 3-Card Sub-Tab Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => setActiveSubTab('permissions')}
          className={`flex items-center justify-between p-4 rounded-2xl border-2 text-left transition-all canva-tap ${
            activeSubTab === 'permissions'
              ? 'border-[#7d2ae8] bg-white dark:bg-[#191b26] shadow-md ring-4 ring-purple-500/10'
              : 'border-neutral-200/80 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/60 hover:bg-white dark:hover:bg-neutral-900'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                activeSubTab === 'permissions'
                  ? 'bg-gradient-to-br from-[#7d2ae8] to-indigo-600 text-white shadow-md'
                  : 'bg-purple-100 dark:bg-purple-950/60 text-[#7d2ae8] dark:text-purple-300'
              }`}
            >
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-black text-neutral-900 dark:text-white">
                1. Phân Quyền Giáo Viên
              </div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Thêm Gmail &amp; bật/tắt 4 tab
              </div>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-purple-100 dark:bg-purple-950 text-[#7d2ae8] dark:text-purple-300">
            {combinedTeachers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('vault')}
          className={`flex items-center justify-between p-4 rounded-2xl border-2 text-left transition-all canva-tap ${
            activeSubTab === 'vault'
              ? 'border-emerald-600 bg-white dark:bg-[#191b26] shadow-md ring-4 ring-emerald-500/10'
              : 'border-neutral-200/80 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/60 hover:bg-white dark:hover:bg-neutral-900'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                activeSubTab === 'vault'
                  ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md'
                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-black text-neutral-900 dark:text-white flex items-center gap-1.5">
                <span>2. Kho Đề Thi Đã Lưu</span>
                {unviewedCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-500 text-white">
                    +{unviewedCount} mới
                  </span>
                )}
              </div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Xem đề, tải file gốc &amp; file chuẩn
              </div>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
            {snapshots.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('settings')}
          className={`flex items-center justify-between p-4 rounded-2xl border-2 text-left transition-all canva-tap ${
            activeSubTab === 'settings'
              ? 'border-amber-500 bg-white dark:bg-[#191b26] shadow-md ring-4 ring-amber-500/10'
              : 'border-neutral-200/80 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/60 hover:bg-white dark:hover:bg-neutral-900'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                activeSubTab === 'settings'
                  ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md'
                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
              }`}
            >
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-black text-neutral-900 dark:text-white">
                3. Cấu Hình Hệ Thống
              </div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                API Key Gemini, Model &amp; Thông báo
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* SUB-TAB 1: QUẢN LÝ GIÁO VIÊN & PHÂN QUYỀN (PERMISSIONS & USERS)       */}
      {/* ===================================================================== */}
      {activeSubTab === 'permissions' && (
        <div className="space-y-6 tab-enter">
          {/* 4 KPI EXECUTIVE OVERVIEW CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="canva-card p-4 rounded-2xl border border-purple-200/80 dark:border-purple-900/50 bg-gradient-to-br from-purple-50/80 to-white dark:from-purple-950/30 dark:to-[#151821]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                  Tổng Tài Khoản
                </span>
                <Users className="w-4 h-4 text-[#7d2ae8]" />
              </div>
              <div className="text-2xl font-black text-neutral-900 dark:text-white mt-1.5">
                {combinedTeachers.length}
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                Giáo viên &amp; Quản trị viên
              </p>
            </div>

            <div className="canva-card p-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50/80 to-white dark:from-emerald-950/30 dark:to-[#151821]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Đã Cấp Quyền
                </span>
                <Unlock className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5">
                {authorizedCount}
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                Đang mở ít nhất 1 tính năng
              </p>
            </div>

            <div className="canva-card p-4 rounded-2xl border border-rose-200/80 dark:border-rose-900/50 bg-gradient-to-br from-rose-50/80 to-white dark:from-rose-950/30 dark:to-[#151821]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                  Đang Tạm Khóa
                </span>
                <Lock className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1.5">
                {lockedCount}
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                Chưa mở quyền hoặc đã thu hồi
              </p>
            </div>

            <div className="canva-card p-4 rounded-2xl border border-cyan-200/80 dark:border-cyan-900/50 bg-gradient-to-br from-cyan-50/80 to-white dark:from-cyan-950/30 dark:to-[#151821]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
                  Đồng Bộ Cloud v5
                </span>
                <Cloud className="w-4 h-4 text-cyan-600" />
              </div>
              <div className="text-sm sm:text-base font-black text-cyan-700 dark:text-cyan-300 mt-2 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Realtime 100%</span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                Tự lưu bền vững xuyên Vercel
              </p>
            </div>
          </div>

          {/* ALWAYS-VISIBLE QUICK ADD & GRANT CARD */}
          <div className="canva-card p-6 rounded-3xl border-2 border-[#7d2ae8]/25 bg-gradient-to-br from-purple-50/60 via-white to-cyan-50/40 dark:from-purple-950/20 dark:via-[#151821] dark:to-cyan-950/10 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#7d2ae8] to-[#00c4cc] text-white flex items-center justify-center shadow-sm">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white">
                    Thêm Giáo Viên Mới Hoặc Cấp Lại Quyền Theo Gmail
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Nhập địa chỉ Gmail giáo viên (kể cả giáo viên từng thêm hoặc đã xóa trước đó) và bấm <strong>Thêm &amp; Lưu Quyền Ngay</strong> để áp dụng tức thì.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setAddPermAudit(true);
                    setAddPermStandardize(true);
                    setAddPermMix(true);
                    setAddPermPdfStudio(true);
                    setAddPermThesisAudit(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-extrabold hover:bg-emerald-200 transition"
                >
                  Chọn cả 5 quyền
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddPermAudit(false);
                    setAddPermStandardize(false);
                    setAddPermMix(false);
                    setAddPermPdfStudio(false);
                    setAddPermThesisAudit(false);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-neutral-200/70 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-[11px] font-bold hover:bg-neutral-300 transition"
                >
                  Bỏ chọn hết
                </button>
              </div>
            </div>

            <form onSubmit={handleAddNewTeacherWithPerms} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-6 relative">
                  <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="Nhập Gmail giáo viên (VD: giaovien@gmail.com)..."
                    value={addTeacherEmail}
                    onChange={e => setAddTeacherEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white outline-hidden focus:ring-2 focus:ring-[#7d2ae8]"
                  />
                </div>
                <div className="md:col-span-6 relative">
                  <UserCheck className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Họ và tên hiển thị (VD: Cô Nguyễn Thị A)..."
                    value={addTeacherName}
                    onChange={e => setAddTeacherName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white outline-hidden focus:ring-2 focus:ring-[#7d2ae8]"
                  />
                </div>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-2 border-t border-neutral-200/70 dark:border-neutral-800">
                <div className="flex flex-wrap items-center gap-2.5 text-xs">
                  <span className="font-extrabold text-neutral-700 dark:text-neutral-300 mr-1">
                    Cấp quyền 5 phân hệ:
                  </span>
                  <label
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer font-bold transition ${
                      addPermAudit
                        ? 'border-cyan-500 bg-cyan-50/90 dark:bg-cyan-950/60 text-cyan-900 dark:text-cyan-200 shadow-2xs'
                        : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={addPermAudit}
                      onChange={e => setAddPermAudit(e.target.checked)}
                      className="rounded text-[#7d2ae8] w-4 h-4"
                    />
                    <span>1. AI Soát Lỗi Đề</span>
                  </label>

                  <label
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer font-bold transition ${
                      addPermStandardize
                        ? 'border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 shadow-2xs'
                        : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={addPermStandardize}
                      onChange={e => setAddPermStandardize(e.target.checked)}
                      className="rounded text-[#7d2ae8] w-4 h-4"
                    />
                    <span>2. Chuẩn Hóa 1 Chạm</span>
                  </label>

                  <label
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer font-bold transition ${
                      addPermMix
                        ? 'border-purple-500 bg-purple-50/90 dark:bg-purple-950/60 text-purple-900 dark:text-purple-200 shadow-2xs'
                        : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={addPermMix}
                      onChange={e => setAddPermMix(e.target.checked)}
                      className="rounded text-[#7d2ae8] w-4 h-4"
                    />
                    <span>3. Trộn Mã Đề 25%</span>
                  </label>

                  <label
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer font-bold transition ${
                      addPermPdfStudio
                        ? 'border-rose-500 bg-rose-50/90 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 shadow-2xs'
                        : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={addPermPdfStudio}
                      onChange={e => setAddPermPdfStudio(e.target.checked)}
                      className="rounded text-[#7d2ae8] w-4 h-4"
                    />
                    <span>4. Dịch PDF Pro &amp; Cắt PDF</span>
                  </label>

                  <label
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer font-bold transition ${
                      addPermThesisAudit
                        ? 'border-indigo-500 bg-indigo-50/90 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 shadow-2xs'
                        : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={addPermThesisAudit}
                      onChange={e => setAddPermThesisAudit(e.target.checked)}
                      className="rounded text-[#7d2ae8] w-4 h-4"
                    />
                    <span>5. Rà Soát Đề Án Word</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={savingEmail !== null}
                  className="canva-btn-primary px-6 py-3 rounded-xl text-xs sm:text-sm font-black shadow-md canva-tap flex items-center justify-center gap-2 shrink-0"
                >
                  <Save className="w-4 h-4" />
                  <span>+ Thêm &amp; Lưu Quyền Lên Cloud</span>
                </button>
              </div>
            </form>
          </div>

          {/* Teacher Permissions Matrix Card */}
          <div className="canva-card p-6 space-y-5 rounded-3xl border border-neutral-200/90 dark:border-neutral-800 shadow-xs bg-white dark:bg-[#151821]">
            {/* Top Header & Global Save Action */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-neutral-200/80 dark:border-neutral-800">
              <div>
                <h3 className="text-sm sm:text-base font-black text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#7d2ae8]" />
                  <span>
                    Bảng Quản Lý &amp; Phân Quyền Giáo Viên ({filteredTeachers.length}/{combinedTeachers.length})
                  </span>
                  {unsavedCount > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-[11px] font-black animate-pulse">
                      {unsavedCount} tài khoản vừa chỉnh sửa
                    </span>
                  )}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Bật/tắt công tắc từng tính năng và bấm nút <strong>&ldquo;Lưu Quyền&rdquo;</strong> trên dòng giáo viên (hoặc nút <strong>&ldquo;Lưu &amp; Đồng Bộ Tất Cả&rdquo;</strong> bên phải) để khóa quyền lên Cloud.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void loadAllAdminData(true)}
                  disabled={isRefreshingAll}
                  className="px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 text-xs font-extrabold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingAll ? 'animate-spin' : ''}`} />
                  <span>Tải Lại Cloud</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleSaveAllPermissions()}
                  disabled={isSavingAllPerms}
                  className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black shadow-md canva-tap flex items-center gap-2 transition ${
                    unsavedCount > 0
                      ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white ring-2 ring-emerald-400/60 animate-pulse'
                      : 'bg-gradient-to-r from-[#7d2ae8] to-[#00c4cc] text-white hover:opacity-95'
                  }`}
                >
                  <Save className={`w-4 h-4 ${isSavingAllPerms ? 'animate-spin' : ''}`} />
                  <span>
                    {isSavingAllPerms
                      ? 'Đang Lưu Lên Cloud...'
                      : unsavedCount > 0
                      ? `Lưu & Đồng Bộ Tất Cả (${unsavedCount} thay đổi)`
                      : 'Lưu & Đồng Bộ Tất Cả Phân Quyền'}
                  </span>
                </button>
              </div>
            </div>

            {/* Filter Pills & Search Input */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTeacherStatusFilter('ALL')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition ${
                    teacherStatusFilter === 'ALL'
                      ? 'bg-[#7d2ae8] text-white shadow-xs'
                      : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/70'
                  }`}
                >
                  Tất cả ({combinedTeachers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTeacherStatusFilter('AUTHORIZED')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition ${
                    teacherStatusFilter === 'AUTHORIZED'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                  }`}
                >
                  Đã cấp quyền ({authorizedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setTeacherStatusFilter('LOCKED')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition ${
                    teacherStatusFilter === 'LOCKED'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
                  }`}
                >
                  Đang khóa ({lockedCount})
                </button>
                {unsavedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setTeacherStatusFilter('UNSAVED')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition ${
                      teacherStatusFilter === 'UNSAVED'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    Cần bấm lưu ({unsavedCount})
                  </button>
                )}
              </div>

              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={e => setUserSearchQuery(e.target.value)}
                  placeholder="Tìm nhanh theo tên hoặc Gmail giáo viên..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-xs font-semibold outline-hidden focus:ring-2 focus:ring-[#7d2ae8]"
                />
              </div>
            </div>

            {/* Permissions Matrix Table */}
            <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 font-extrabold bg-neutral-100/90 dark:bg-neutral-900/90">
                    <th className="py-3.5 px-4 min-w-[240px]">Giáo Viên / Tài Khoản Gmail</th>
                    <th className="py-3.5 px-2.5 text-center">
                      <div className="inline-flex items-center gap-1.5 text-cyan-700 dark:text-cyan-400">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>1. AI Soát Lỗi</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-2.5 text-center">
                      <div className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>2. Chuẩn Hóa</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-2.5 text-center">
                      <div className="inline-flex items-center gap-1.5 text-purple-700 dark:text-purple-400">
                        <Shuffle className="w-3.5 h-3.5" />
                        <span>3. Trộn Đề</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-2.5 text-center">
                      <div className="inline-flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>4. PDF &amp; Office</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-2.5 text-center">
                      <div className="inline-flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400">
                        <FileText className="w-3.5 h-3.5" />
                        <span>5. Đề Án Word</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-4 text-right min-w-[270px]">Lưu &amp; Thao Tác Nhanh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
                  {filteredTeachers.map(u => {
                    const normEmail = u.email.toLowerCase();
                    const isSuper = normEmail === SUPER_ADMIN_EMAIL.toLowerCase();
                    const perms = getEffectiveTeacherPerms(normEmail, u.permissions);
                    const isUnsaved = Boolean(unsavedEmails[normEmail]);
                    const isSavingRow = savingEmail === normEmail;
                    const wasRecentlySaved =
                      Boolean(recentlySavedEmails[normEmail]) && !isUnsaved;

                    const userSavedCount = snapshots.filter(
                      s => s.userEmail.toLowerCase() === normEmail
                    ).length;

                    const activeTabsCount =
                      (perms.canAudit ? 1 : 0) +
                      (perms.canStandardize ? 1 : 0) +
                      (perms.canMix ? 1 : 0) +
                      (perms.canPdfStudio ? 1 : 0) +
                      (perms.canThesisAudit ? 1 : 0);

                    return (
                      <tr
                        key={normEmail}
                        className={`transition ${
                          isUnsaved
                            ? 'bg-amber-50/70 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                            : 'hover:bg-purple-50/40 dark:hover:bg-neutral-800/40'
                        }`}
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={
                                u.photoURL ||
                                `https://api.dicebear.com/7.x/initials/svg?seed=${u.email}`
                              }
                              alt=""
                              className="w-10 h-10 rounded-2xl border border-neutral-200 dark:border-neutral-700 shrink-0 shadow-2xs"
                            />
                            <div>
                              <div className="font-black text-xs sm:text-sm text-neutral-900 dark:text-white flex flex-wrap items-center gap-2">
                                <span>{u.displayName}</span>
                                {isSuper ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500 text-white">
                                    ADMIN TỐI THƯỢNG
                                  </span>
                                ) : activeTabsCount > 0 ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                                    Đang mở {activeTabsCount}/5 quyền
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-300">
                                    Đang khóa hết
                                  </span>
                                )}
                                {isUnsaved && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white">
                                    Vừa sửa • Bấm Lưu
                                  </span>
                                )}
                                {wasRecentlySaved && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 inline-flex items-center gap-1">
                                    <CheckCheck className="w-3 h-3" />
                                    Đã lưu Cloud
                                  </span>
                                )}
                              </div>
                              <div className="font-mono text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                                {u.email}
                              </div>
                              <div className="text-[11px] text-neutral-400 mt-0.5">
                                Đã đẩy lên <strong>{userSavedCount}</strong> đề trong Kho Đề Thi
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Col 1: AI Audit Switch */}
                        <td className="py-4 px-2 text-center">
                          {isSuper ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Toàn Quyền
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleTogglePerm(u.email, 'canAudit', u.displayName)}
                              className={`px-3 py-1.5 rounded-xl font-extrabold text-[11px] transition-all canva-tap inline-flex items-center gap-1.5 border ${
                                perms.canAudit
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:border-neutral-400'
                              }`}
                            >
                              {perms.canAudit ? (
                                <>
                                  <Unlock className="w-3 h-3" />
                                  <span>ĐANG MỞ</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3 h-3" />
                                  <span>ĐANG KHÓA</span>
                                </>
                              )}
                            </button>
                          )}
                        </td>

                        {/* Col 2: Standardize Switch */}
                        <td className="py-4 px-2 text-center">
                          {isSuper ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Toàn Quyền
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                void handleTogglePerm(u.email, 'canStandardize', u.displayName)
                              }
                              className={`px-3 py-1.5 rounded-xl font-extrabold text-[11px] transition-all canva-tap inline-flex items-center gap-1.5 border ${
                                perms.canStandardize
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:border-neutral-400'
                              }`}
                            >
                              {perms.canStandardize ? (
                                <>
                                  <Unlock className="w-3 h-3" />
                                  <span>ĐANG MỞ</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3 h-3" />
                                  <span>ĐANG KHÓA</span>
                                </>
                              )}
                            </button>
                          )}
                        </td>

                        {/* Col 3: Mix Switch */}
                        <td className="py-4 px-2 text-center">
                          {isSuper ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Toàn Quyền
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleTogglePerm(u.email, 'canMix', u.displayName)}
                              className={`px-3 py-1.5 rounded-xl font-extrabold text-[11px] transition-all canva-tap inline-flex items-center gap-1.5 border ${
                                perms.canMix
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:border-neutral-400'
                              }`}
                            >
                              {perms.canMix ? (
                                <>
                                  <Unlock className="w-3 h-3" />
                                  <span>ĐANG MỞ</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3 h-3" />
                                  <span>ĐANG KHÓA</span>
                                </>
                              )}
                            </button>
                          )}
                        </td>

                        {/* Col 4: PDF & Office Studio Switch */}
                        <td className="py-4 px-2 text-center">
                          {isSuper ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Toàn Quyền
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                void handleTogglePerm(u.email, 'canPdfStudio', u.displayName)
                              }
                              className={`px-3 py-1.5 rounded-xl font-extrabold text-[11px] transition-all canva-tap inline-flex items-center gap-1.5 border ${
                                perms.canPdfStudio
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:border-neutral-400'
                              }`}
                            >
                              {perms.canPdfStudio ? (
                                <>
                                  <Unlock className="w-3 h-3" />
                                  <span>ĐANG MỞ</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3 h-3" />
                                  <span>ĐANG KHÓA</span>
                                </>
                              )}
                            </button>
                          )}
                        </td>

                        {/* Col 5: Thesis Word Auditor Switch */}
                        <td className="py-4 px-2 text-center">
                          {isSuper ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Toàn Quyền
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                void handleTogglePerm(u.email, 'canThesisAudit', u.displayName)
                              }
                              className={`px-3 py-1.5 rounded-xl font-extrabold text-[11px] transition-all canva-tap inline-flex items-center gap-1.5 border ${
                                perms.canThesisAudit
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:border-neutral-400'
                              }`}
                            >
                              {perms.canThesisAudit ? (
                                <>
                                  <Unlock className="w-3 h-3" />
                                  <span>ĐANG MỞ</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3 h-3" />
                                  <span>ĐANG KHÓA</span>
                                </>
                              )}
                            </button>
                          )}
                        </td>

                        {/* Col 6: Save Button + Quick Actions */}
                        <td className="py-4 px-4 text-right">
                          {!isSuper && (
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => void handleSaveTeacherPerms(u.email, u.displayName)}
                                disabled={isSavingRow}
                                className={`px-3.5 py-1.5 rounded-xl font-black text-[11px] transition-all canva-tap inline-flex items-center gap-1.5 shadow-xs ${
                                  isUnsaved
                                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white ring-2 ring-emerald-400/70 animate-pulse'
                                    : 'bg-[#7d2ae8] hover:bg-[#681ed0] text-white'
                                }`}
                                title="Lưu & Đồng bộ quyền của giáo viên này lên Cloud"
                              >
                                <Save className={`w-3.5 h-3.5 ${isSavingRow ? 'animate-spin' : ''}`} />
                                <span>{isSavingRow ? 'Đang lưu...' : 'Lưu Quyền'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => void handleGrantAll(u.email, u.displayName)}
                                disabled={isSavingRow}
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 font-extrabold text-[11px] hover:bg-emerald-200 transition canva-tap"
                                title="Mở khóa toàn bộ 5 tính năng và Lưu ngay"
                              >
                                Mở hết
                              </button>

                              <button
                                type="button"
                                onClick={() => void handleRevokeAll(u.email, u.displayName)}
                                disabled={isSavingRow}
                                className="px-2.5 py-1.5 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 font-extrabold text-[11px] hover:bg-amber-200 transition canva-tap"
                                title="Khóa cả 5 tab của giáo viên này và Lưu ngay"
                              >
                                Khóa hết
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  void deleteUser(u.email);
                                  setDraftPermissionsMap(prev => {
                                    const next = { ...prev };
                                    delete next[normEmail];
                                    return next;
                                  });
                                  setUnsavedEmails(prev => {
                                    const next = { ...prev };
                                    delete next[normEmail];
                                    return next;
                                  });
                                  toast.info('Đã xóa khỏi danh sách & đồng bộ Cloud', u.email);
                                }}
                                className="p-1.5 rounded-xl text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                                title="Xóa tài khoản giáo viên"
                              >
                                <Trash2 className="w-4 h-4" />
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
      {/* SUB-TAB 2: KHO ĐỀ THI & ĐỐI SOÁT ĐỀ (VAULT)                         */}
      {/* ===================================================================== */}
      {activeSubTab === 'vault' && (
        <div className="space-y-5 tab-enter">
          {/* Storage KPI & Policy Selector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 canva-card p-5 space-y-3.5 rounded-3xl border border-neutral-200/90 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#7d2ae8]" />
                  <h3 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white">
                    Chế Độ Thu Thập &amp; Lưu Trữ Đề Thi Tự Động
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Hoạt động ngầm 100%
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
                    Mọi đề thi tải lên đều tự động lưu file gốc + file chuẩn
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
                  <div className="font-bold">2. Chỉ giáo viên chọn</div>
                  <div className="text-[10px] opacity-80 mt-0.5">
                    Chỉ lưu đề của các email được đánh dấu
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

            <div className="lg:col-span-5 canva-card p-5 flex flex-col justify-between gap-4 rounded-3xl border border-neutral-200/90 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-[#00c4cc]" />
                  <h3 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white">
                    Dung Lượng &amp; Dọn Rác Nhanh
                  </h3>
                </div>
                <button
                  onClick={() => void loadAllAdminData(true)}
                  className="p-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 text-neutral-500 transition"
                  title="Làm mới kho đề"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800">
                  <div className="text-[10px] font-semibold text-neutral-400">Tổng Đề Lưu</div>
                  <div className="text-lg font-black text-neutral-900 dark:text-white">
                    {snapshots.length}
                  </div>
                </div>
                <div className="p-2 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800">
                  <div className="text-[10px] font-semibold text-neutral-400">Chưa Xem</div>
                  <div className="text-lg font-black text-rose-500">{unviewedCount}</div>
                </div>
                <div className="p-2 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800">
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
          <div className="canva-card p-4 rounded-2xl border border-neutral-200/90 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
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
            <div className="canva-card p-10 text-center rounded-3xl border border-neutral-200/90 dark:border-neutral-800">
              <AzLogoLoader
                size="md"
                label="Đang đồng bộ dữ liệu kho đề thi..."
                sublabel="Tải danh sách đề thi và lịch sử hoạt động từ máy chủ bảo mật"
              />
            </div>
          ) : filteredSnapshots.length === 0 ? (
            <div className="canva-card p-12 text-center space-y-2 rounded-3xl border border-neutral-200/90 dark:border-neutral-800">
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
                    className={`canva-card p-4 sm:p-5 rounded-3xl transition border ${
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
                          className="canva-btn-secondary px-3.5 py-2 rounded-xl text-xs font-bold transition canva-tap flex items-center gap-1.5"
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
      {/* SUB-TAB 3: CẤU HÌNH AI & HỆ THỐNG (SETTINGS)                          */}
      {/* ===================================================================== */}
      {activeSubTab === 'settings' && (
        <div className="canva-card p-6 sm:p-7 space-y-5 rounded-3xl border border-neutral-200/90 dark:border-neutral-800 shadow-xs tab-enter">
          <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#7d2ae8]" />
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Cấu Hình Toàn Hệ Thống (Chỉ Admin Mới Nhìn Thấy)
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
                Trạng Thái Bảo Mật &amp; Khóa Đăng Nhập Google:
              </label>
              <div className="w-full p-3 rounded-xl border border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Đã Ẩn &amp; Khóa Cứng 100% (Chống Lộ Key / Chống DDoS / Chống XSS)</span>
              </div>
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

      {/* ===================================================================== */}
      {/* ULTRA-LUXURIOUS REDESIGNED PREVIEW MODAL                              */}
      {/* ===================================================================== */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md tab-enter">
          <div className="canva-card w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl overflow-hidden border border-neutral-200/90 dark:border-neutral-800 shadow-2xl bg-white dark:bg-[#121319]">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-neutral-200 dark:border-neutral-800 bg-gradient-to-r from-purple-500/10 via-transparent to-cyan-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-[#7d2ae8] to-[#00c4cc] text-white">
                    CHI TIẾT ĐỀ THI
                  </span>
                  <span className="text-xs font-mono text-neutral-400">
                    ID: {previewItem.id}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-[#7d2ae8] dark:bg-purple-950/70 dark:text-purple-300">
                    {previewItem.actionLabel}
                  </span>
                </div>

                <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#7d2ae8]" />
                  <span>{previewItem.originalFileName}</span>
                </h3>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600 dark:text-neutral-300">
                  <span>
                    Giảng viên: <strong>{previewItem.userName}</strong> (
                    <span className="font-mono">{previewItem.userEmail}</span>)
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-mono font-bold">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{previewItem.formattedTime}</span>
                  </span>
                  <span>•</span>
                  <span>
                    Tổng cộng: <strong>{previewItem.questionsCount}</strong> câu (
                    <strong className="text-emerald-600">{previewItem.answeredCount}</strong> có đáp án)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  onClick={() => setPreviewItem(null)}
                  className="p-2 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 transition canva-tap"
                  title="Đóng cửa sổ (ESC)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* In-Modal Search Bar */}
            <div className="px-5 py-3 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/60 dark:bg-neutral-900/40 flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={previewSearch}
                  onChange={e => setPreviewSearch(e.target.value)}
                  placeholder="Lọc nội dung câu hỏi hoặc phương án..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs outline-hidden focus:ring-2 focus:ring-[#7d2ae8]"
                />
              </div>
              <span className="text-xs text-neutral-400 shrink-0">
                Hiển thị {filteredPreviewQuestions.length}/{previewItem.questionsPreview.length} câu
              </span>
            </div>

            {/* Questions List Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 bg-neutral-50/30 dark:bg-black/20">
              {filteredPreviewQuestions.map((q, idx) => (
                <div
                  key={q.id || idx}
                  className="p-4 sm:p-5 rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-[#181a24] space-y-3 shadow-xs hover:border-[#7d2ae8]/40 transition"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#7d2ae8] to-[#00c4cc] text-white text-xs font-black flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="font-bold text-xs sm:text-sm text-neutral-900 dark:text-white leading-relaxed flex-1">
                      {q.text}
                    </div>
                  </div>

                  {/* 4 Options Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                    {(['A', 'B', 'C', 'D'] as const).map(opt => {
                      const isCorrect = q.correctAnswer === opt;
                      return (
                        <div
                          key={opt}
                          className={`p-3 rounded-xl border transition flex items-start gap-2.5 ${
                            isCorrect
                              ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 font-semibold shadow-2xs'
                              : 'border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 text-neutral-700 dark:text-neutral-300'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-full text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5 ${
                              isCorrect
                                ? 'bg-emerald-600 text-white'
                                : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                            }`}
                          >
                            {opt}
                          </span>
                          <span className="flex-1 leading-relaxed">
                            {q.options[opt]}
                          </span>
                          {isCorrect && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white shrink-0">
                              ĐÁP ÁN ĐÚNG
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Sticky Footer Bar */}
            <div className="p-4 sm:p-5 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121319] flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-neutral-400 hidden sm:block">
                Tải trực tiếp đúng file gốc giảng viên tải lên hoặc xuất file chuẩn hóa có bảng đáp án.
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => void handleDownloadOriginal(previewItem)}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition canva-tap flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải File Word Gốc (.docx)</span>
                </button>

                <button
                  onClick={() => void handleDownloadStandardized(previewItem)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition canva-tap flex items-center gap-2"
                >
                  <FileCheck2 className="w-4 h-4" />
                  <span>Tải Đề Chuẩn Hóa (.docx)</span>
                </button>

                <button
                  onClick={() => setPreviewItem(null)}
                  className="canva-btn-secondary px-4 py-2.5 rounded-xl text-xs font-bold canva-tap"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
