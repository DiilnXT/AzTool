import fs from 'fs';
import path from 'path';
import os from 'os';
import { UserProfile, TabPermissions, UserActivityLog } from '@/types/exam';

export const SUPER_ADMIN_EMAIL = 'lenhatduy.vietnam@gmail.com';
export const DAILY_USAGE_LIMIT = 5;
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

export const SUPER_PERMS: TabPermissions = {
  canAudit: true,
  canStandardize: true,
  canMix: true,
  canPdfStudio: true,
  canThesisAudit: true,
  adminConfigured: true,
  updatedAt: 9999999999999,
};

export const DEFAULT_USER_PERMS: TabPermissions = {
  canAudit: true,
  canStandardize: true,
  canMix: true,
  canPdfStudio: true,
  canThesisAudit: true,
  adminConfigured: false,
  updatedAt: 0,
};

export function normalizePermissions(
  raw?: Partial<TabPermissions> | null,
  isSuper = false,
  fallbackUpdatedAt = 0
): TabPermissions {
  if (isSuper) return { ...SUPER_PERMS };
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_USER_PERMS, updatedAt: fallbackUpdatedAt };
  }
  const allFalse =
    !raw.canAudit &&
    !raw.canStandardize &&
    !raw.canMix &&
    !raw.canPdfStudio &&
    !raw.canThesisAudit;

  // If this was an auto-created default record before the 5/day Google login update (not explicitly locked by Admin),
  // enable all features by default so the Google user can use their 5 free uses/day!
  if (allFalse && !raw.adminConfigured && !raw.isBlocked) {
    return {
      ...DEFAULT_USER_PERMS,
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
    adminConfigured: Boolean(raw.adminConfigured),
    isBlocked: Boolean(raw.isBlocked),
    unlimitedDailyQuota: Boolean(raw.unlimitedDailyQuota),
    updatedAt:
      typeof raw.updatedAt === 'number' && raw.updatedAt > 0
        ? raw.updatedAt
        : fallbackUpdatedAt,
  };
}

function getStoragePath(filename: string): string {
  const localDir = path.join(process.cwd(), 'data');
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const testFile = path.join(localDir, '.write-test');
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    return path.join(localDir, filename);
  } catch {
    return path.join(os.tmpdir(), filename);
  }
}

export interface UnifiedStoreState {
  rev: number;
  users: UserProfile[];
  permissions: Record<string, TabPermissions>;
  deletedEmails: Record<string, number>;
}

const defaultAdminUser: UserProfile = {
  id: 'admin-001',
  email: SUPER_ADMIN_EMAIL,
  displayName: 'Lê Nhật Duy',
  photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=duy',
  role: 'super_admin',
  permissions: SUPER_PERMS,
  createdAt: '2025-01-01',
  lastActive: '2026-11-06T00:00:00.000Z',
  examsGeneratedCount: 120,
  mixCount: 85,
};

const globalForStore = globalThis as unknown as {
  __azUnifiedStore?: UnifiedStoreState;
  __azLastCloudSyncMs?: number;
};

/**
 * Merges an incoming state snapshot (from disk or cloud) into the target state
 * using per-email `updatedAt` and `deletedEmails` timestamps so the newest action
 * (whether grant, revoke, delete, or re-add) always wins across all containers!
 */
function mergeIntoState(target: UnifiedStoreState, incoming: Partial<UnifiedStoreState>): void {
  if (!incoming || typeof incoming !== 'object') return;

  if (typeof incoming.rev === 'number' && incoming.rev > target.rev) {
    target.rev = incoming.rev;
  }

  // 1. Merge deletedEmails tombstones
  if (incoming.deletedEmails && typeof incoming.deletedEmails === 'object') {
    for (const [em, ts] of Object.entries(incoming.deletedEmails)) {
      const norm = em.trim().toLowerCase();
      if (!norm || norm === SUPER_ADMIN_EMAIL) continue;
      const numTs = Number(ts) || 0;
      if (!target.deletedEmails[norm] || numTs > target.deletedEmails[norm]) {
        target.deletedEmails[norm] = numTs;
      }
    }
  }

  // 2. Merge permissions
  if (incoming.permissions && typeof incoming.permissions === 'object') {
    for (const [em, pVal] of Object.entries(incoming.permissions)) {
      const norm = em.trim().toLowerCase();
      if (!norm) continue;
      const isSuper = norm === SUPER_ADMIN_EMAIL;
      const normIncoming = normalizePermissions(pVal as any, isSuper, 1);
      const delTs = target.deletedEmails[norm] || 0;

      if (!isSuper && delTs > (normIncoming.updatedAt || 0)) {
        delete target.permissions[norm];
        continue;
      }
      if (!isSuper && (normIncoming.updatedAt || 0) > delTs && delTs > 0) {
        delete target.deletedEmails[norm];
      }

      const existing = target.permissions[norm];
      if (!existing || (normIncoming.updatedAt || 0) >= (existing.updatedAt || 0)) {
        target.permissions[norm] = normIncoming;
      }
    }
  }

  // 3. Merge users
  const userMap = new Map<string, UserProfile>();
  for (const u of target.users) {
    if (u?.email) {
      const norm = u.email.trim().toLowerCase();
      if (norm !== SUPER_ADMIN_EMAIL) {
        const delTs = target.deletedEmails[norm] || 0;
        const pTs = target.permissions[norm]?.updatedAt || u.permissions?.updatedAt || 0;
        if (delTs > pTs) continue;
      }
      userMap.set(norm, { ...u, email: norm });
    }
  }

  if (Array.isArray(incoming.users)) {
    for (const u of incoming.users) {
      if (!u?.email) continue;
      const norm = String(u.email).trim().toLowerCase();
      const isSuper = norm === SUPER_ADMIN_EMAIL;
      const uPerm = normalizePermissions(u.permissions, isSuper, 1);
      const bestPerm =
        target.permissions[norm] &&
        (target.permissions[norm].updatedAt || 0) >= (uPerm.updatedAt || 0)
          ? target.permissions[norm]
          : uPerm;

      const delTs = target.deletedEmails[norm] || 0;
      if (!isSuper && delTs > (bestPerm.updatedAt || 0)) {
        userMap.delete(norm);
        delete target.permissions[norm];
        continue;
      }
      if (!isSuper && (bestPerm.updatedAt || 0) > delTs && delTs > 0) {
        delete target.deletedEmails[norm];
      }

      target.permissions[norm] = bestPerm;
      const prevUser = userMap.get(norm);
      const prevUsageTs = prevUser?.dailyUsageUpdatedAt || 0;
      const incUsageTs = u.dailyUsageUpdatedAt || 0;
      let mergedUsageDate = u.dailyUsageDate || prevUser?.dailyUsageDate;
      let mergedUsageCount = u.dailyUsageCount ?? prevUser?.dailyUsageCount ?? 0;
      let mergedUsageTs = Math.max(prevUsageTs, incUsageTs);

      if (prevUser?.dailyUsageDate && u.dailyUsageDate) {
        if (prevUser.dailyUsageDate === u.dailyUsageDate) {
          if (incUsageTs > prevUsageTs && incUsageTs > 0) {
            mergedUsageCount = u.dailyUsageCount ?? 0;
          } else if (prevUsageTs > incUsageTs && prevUsageTs > 0) {
            mergedUsageCount = prevUser.dailyUsageCount ?? 0;
          } else {
            mergedUsageCount = Math.max(prevUser.dailyUsageCount || 0, u.dailyUsageCount || 0);
          }
        } else if (prevUser.dailyUsageDate > u.dailyUsageDate) {
          mergedUsageDate = prevUser.dailyUsageDate;
          mergedUsageCount = prevUser.dailyUsageCount ?? 0;
        } else {
          mergedUsageDate = u.dailyUsageDate;
          mergedUsageCount = u.dailyUsageCount ?? 0;
        }
      }

      // Merge recentActivities (dedup by id, newest first, max 25)
      const actMap = new Map<string, UserActivityLog>();
      for (const act of [...(u.recentActivities || []), ...(prevUser?.recentActivities || [])]) {
        if (act?.id && !actMap.has(act.id)) {
          actMap.set(act.id, act);
        }
      }
      const mergedActivities = Array.from(actMap.values())
        .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
        .slice(0, 25);

      userMap.set(norm, {
        ...(prevUser || u),
        ...u,
        email: norm,
        displayName: u.displayName || prevUser?.displayName || norm.split('@')[0],
        photoURL: u.photoURL || prevUser?.photoURL,
        role: isSuper ? 'super_admin' : u.role || prevUser?.role || 'free',
        permissions: bestPerm,
        isBlocked: isSuper ? false : Boolean(bestPerm.isBlocked ?? u.isBlocked ?? prevUser?.isBlocked),
        unlimitedDailyQuota: isSuper
          ? true
          : Boolean(bestPerm.unlimitedDailyQuota ?? u.unlimitedDailyQuota ?? prevUser?.unlimitedDailyQuota),
        examsGeneratedCount: Math.max(u.examsGeneratedCount || 0, prevUser?.examsGeneratedCount || 0),
        mixCount: Math.max(u.mixCount || 0, prevUser?.mixCount || 0),
        dailyUsageDate: mergedUsageDate,
        dailyUsageCount: mergedUsageCount,
        dailyUsageUpdatedAt: mergedUsageTs,
        recentActivities: mergedActivities,
      });
    }
  }

  // 4. Ensure every email in target.permissions is present in userMap and clean up deleted ones
  for (const [norm, perm] of Object.entries(target.permissions)) {
    const isSuper = norm === SUPER_ADMIN_EMAIL;
    const delTs = target.deletedEmails[norm] || 0;
    if (!isSuper && delTs > (perm.updatedAt || 0)) {
      delete target.permissions[norm];
      userMap.delete(norm);
      continue;
    }
    const existing = userMap.get(norm);
    if (existing) {
      existing.permissions = normalizePermissions(perm, isSuper);
      userMap.set(norm, existing);
    } else {
      userMap.set(norm, {
        id: isSuper ? 'admin-001' : `user-${norm}`,
        email: norm,
        displayName: isSuper ? 'Lê Nhật Duy' : norm.split('@')[0],
        photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${norm}`,
        role: isSuper ? 'super_admin' : 'free',
        permissions: normalizePermissions(perm, isSuper),
        createdAt: '2026-11-06',
        lastActive: '2026-11-06T00:00:00.000Z',
        examsGeneratedCount: 0,
        mixCount: 0,
      });
    }
  }

  // Always enforce super admin
  target.permissions[SUPER_ADMIN_EMAIL] = { ...SUPER_PERMS };
  const adminExisting = userMap.get(SUPER_ADMIN_EMAIL) || defaultAdminUser;
  userMap.set(SUPER_ADMIN_EMAIL, {
    ...adminExisting,
    email: SUPER_ADMIN_EMAIL,
    role: 'super_admin',
    permissions: { ...SUPER_PERMS },
  });

  target.users = Array.from(userMap.values());
}

export function readUnifiedStoreSync(): UnifiedStoreState {
  if (!globalForStore.__azUnifiedStore) {
    globalForStore.__azUnifiedStore = {
      rev: 1,
      users: [defaultAdminUser],
      permissions: { [SUPER_ADMIN_EMAIL]: { ...SUPER_PERMS } },
      deletedEmails: {},
    };
  }

  const state = globalForStore.__azUnifiedStore;

  try {
    const delFile = getStoragePath('deleted-users.json');
    const permFile = getStoragePath('permissions.json');
    const usersFile = getStoragePath('users.json');

    const diskIncoming: Partial<UnifiedStoreState> = {};
    if (fs.existsSync(delFile)) {
      diskIncoming.deletedEmails = JSON.parse(fs.readFileSync(delFile, 'utf-8'));
    }
    if (fs.existsSync(permFile)) {
      diskIncoming.permissions = JSON.parse(fs.readFileSync(permFile, 'utf-8'));
    }
    if (fs.existsSync(usersFile)) {
      diskIncoming.users = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
    }
    mergeIntoState(state, diskIncoming);
  } catch {
    // ignore
  }

  return state;
}

export function writeUnifiedStoreSync(state: UnifiedStoreState): void {
  globalForStore.__azUnifiedStore = state;
  try {
    fs.writeFileSync(
      getStoragePath('permissions.json'),
      JSON.stringify(state.permissions, null, 2),
      'utf-8'
    );
  } catch {
    // ignore
  }
  try {
    fs.writeFileSync(
      getStoragePath('users.json'),
      JSON.stringify(state.users, null, 2),
      'utf-8'
    );
  } catch {
    // ignore
  }
  try {
    fs.writeFileSync(
      getStoragePath('deleted-users.json'),
      JSON.stringify(state.deletedEmails, null, 2),
      'utf-8'
    );
  } catch {
    // ignore
  }
}

/**
 * Pulls latest permissions/users state from the shared Cloud Channel (`ntfy.sh`)
 * so all Vercel Serverless instances and cold-started containers stay 100% in sync!
 */
export async function readUnifiedStore(forceCloudPull = true): Promise<UnifiedStoreState> {
  const state = readUnifiedStoreSync();
  const now = Date.now();

  if (
    !forceCloudPull &&
    globalForStore.__azLastCloudSyncMs &&
    now - globalForStore.__azLastCloudSyncMs < 800
  ) {
    return state;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`https://ntfy.sh/${CLOUD_PERMS_TOPIC}/json`, {
      headers: {
        'X-Poll': '1',
        'X-Since': 'all',
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const text = await res.text();
      const lines = text
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);

      for (const line of lines) {
        try {
          const env = JSON.parse(line);
          if (env.event === 'message') {
            if (env.attachment?.url) {
              const attRes = await fetch(env.attachment.url, { cache: 'no-store' });
              if (attRes.ok) {
                const attData = await attRes.json();
                mergeIntoState(state, attData);
              }
            } else if (env.message) {
              const msgData = JSON.parse(env.message);
              mergeIntoState(state, msgData);
            }
          }
        } catch {
          // ignore malformed line
        }
      }
      globalForStore.__azLastCloudSyncMs = Date.now();
      writeUnifiedStoreSync(state);
    }
  } catch {
    // fallback to local memory/disk if offline
  }

  return state;
}

/**
 * Writes state to local memory/disk AND pushes to the shared Cloud Channel (`ntfy.sh`)
 * so every other Vercel Lambda container immediately sees the change!
 */
export async function writeUnifiedStore(state: UnifiedStoreState): Promise<void> {
  state.rev = (state.rev || 1) + 1;
  writeUnifiedStoreSync(state);
  globalForStore.__azLastCloudSyncMs = Date.now();

  const payload = JSON.stringify({
    rev: state.rev,
    permissions: state.permissions,
    users: state.users,
    deletedEmails: state.deletedEmails,
  });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    if (payload.length < 3500) {
      await fetch(`https://ntfy.sh/${CLOUD_PERMS_TOPIC}`, {
        method: 'POST',
        body: payload,
        signal: controller.signal,
      });
    } else {
      await fetch(`https://ntfy.sh/${CLOUD_PERMS_TOPIC}`, {
        method: 'PUT',
        headers: { Filename: 'az_perms_state.json' },
        body: payload,
        signal: controller.signal,
      });
    }
    clearTimeout(timer);
  } catch {
    // ignore cloud network warning
  }
}

export async function upsertAdminPermission(
  email: string,
  perms: Partial<TabPermissions>,
  displayName?: string,
  photoURL?: string
): Promise<UnifiedStoreState> {
  const state = await readUnifiedStore(true);
  const norm = email.trim().toLowerCase();
  if (!norm) return state;

  const isSuper = norm === SUPER_ADMIN_EMAIL;
  const nowTs = Date.now();
  const cleanPerms = normalizePermissions({ ...perms, adminConfigured: true }, isSuper, nowTs);
  cleanPerms.adminConfigured = true;
  cleanPerms.updatedAt = isSuper ? SUPER_PERMS.updatedAt : nowTs;

  // Clear any deletion tombstone so re-adding a deleted teacher always works 100%!
  delete state.deletedEmails[norm];
  state.permissions[norm] = cleanPerms;

  const idx = state.users.findIndex(u => u.email.toLowerCase() === norm);
  if (idx >= 0) {
    state.users[idx] = {
      ...state.users[idx],
      email: norm,
      displayName: displayName?.trim() || state.users[idx].displayName,
      photoURL: photoURL || state.users[idx].photoURL,
      role: isSuper ? 'super_admin' : state.users[idx].role,
      permissions: cleanPerms,
      lastActive: new Date().toISOString(),
    };
  } else {
    state.users.push({
      id: isSuper ? 'admin-001' : `user-${nowTs}-${Math.random().toString(36).slice(2, 6)}`,
      email: norm,
      displayName: displayName?.trim() || norm.split('@')[0],
      photoURL: photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${norm}`,
      role: isSuper ? 'super_admin' : 'free',
      permissions: cleanPerms,
      createdAt: new Date().toISOString().split('T')[0],
      lastActive: new Date().toISOString(),
      examsGeneratedCount: 0,
      mixCount: 0,
    });
  }

  await writeUnifiedStore(state);
  return state;
}

export async function syncBulkAdminPermissions(
  bulkPerms: Record<string, TabPermissions>,
  bulkUsers?: UserProfile[],
  bulkDeleted?: Record<string, number>
): Promise<UnifiedStoreState> {
  const state = await readUnifiedStore(true);

  mergeIntoState(state, {
    permissions: bulkPerms,
    users: bulkUsers,
    deletedEmails: bulkDeleted,
  });

  await writeUnifiedStore(state);
  return state;
}

export async function recordTeacherLogin(params: {
  email: string;
  displayName?: string;
  photoURL?: string;
  id?: string;
}): Promise<{ state: UnifiedStoreState; user: UserProfile }> {
  const state = await readUnifiedStore(true);
  const norm = params.email.trim().toLowerCase();
  const isSuper = norm === SUPER_ADMIN_EMAIL;

  const existingUserIdx = state.users.findIndex(u => u.email.toLowerCase() === norm);
  const delTs = state.deletedEmails[norm] || 0;
  const rawExistingPerm =
    state.permissions[norm] ||
    (existingUserIdx >= 0 ? state.users[existingUserIdx].permissions : undefined);
  const existingPerm =
    rawExistingPerm && (rawExistingPerm.updatedAt || 0) >= delTs
      ? rawExistingPerm
      : undefined;

  if (!isSuper && delTs > 0 && !existingPerm) {
    delete state.deletedEmails[norm];
  }

  const authoritativePerm = isSuper
    ? { ...SUPER_PERMS }
    : existingPerm
    ? normalizePermissions(existingPerm, false, existingPerm.updatedAt || Date.now())
    : { ...DEFAULT_USER_PERMS, updatedAt: Date.now() };

  state.permissions[norm] = authoritativePerm;

  const loginActivity: UserActivityLog = {
    id: `act-login-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    type: 'login',
    label: 'Đăng nhập hệ thống bằng Google',
  };

  let finalUser: UserProfile;
  if (existingUserIdx >= 0) {
    const prevActs = state.users[existingUserIdx].recentActivities || [];
    finalUser = {
      ...state.users[existingUserIdx],
      email: norm,
      displayName: params.displayName?.trim() || state.users[existingUserIdx].displayName,
      photoURL: params.photoURL || state.users[existingUserIdx].photoURL,
      role: isSuper ? 'super_admin' : state.users[existingUserIdx].role,
      permissions: authoritativePerm,
      isBlocked: isSuper ? false : Boolean(authoritativePerm.isBlocked ?? state.users[existingUserIdx].isBlocked),
      unlimitedDailyQuota: isSuper
        ? true
        : Boolean(authoritativePerm.unlimitedDailyQuota ?? state.users[existingUserIdx].unlimitedDailyQuota),
      lastActive: new Date().toISOString(),
      recentActivities: [loginActivity, ...prevActs].slice(0, 25),
    };
    state.users[existingUserIdx] = finalUser;
  } else {
    finalUser = {
      id: params.id || `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      email: norm,
      displayName: params.displayName?.trim() || norm.split('@')[0],
      photoURL: params.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${norm}`,
      role: isSuper ? 'super_admin' : 'free',
      permissions: authoritativePerm,
      isBlocked: false,
      unlimitedDailyQuota: isSuper,
      createdAt: new Date().toISOString().split('T')[0],
      lastActive: new Date().toISOString(),
      examsGeneratedCount: 0,
      mixCount: 0,
      recentActivities: [loginActivity],
    };
    state.users.push(finalUser);
  }

  await writeUnifiedStore(state);
  return { state, user: finalUser };
}

export async function deleteTeacherFromStore(
  idOrEmail: string,
  explicitEmail?: string
): Promise<UnifiedStoreState> {
  const state = await readUnifiedStore(true);
  const targetById = state.users.find(
    u => u.id === idOrEmail || u.email.toLowerCase() === idOrEmail.toLowerCase()
  );
  const normEmail = (explicitEmail || targetById?.email || idOrEmail || '').trim().toLowerCase();

  if (normEmail === SUPER_ADMIN_EMAIL) {
    return state;
  }

  const nowTs = Date.now();
  if (normEmail && normEmail.includes('@')) {
    state.deletedEmails[normEmail] = nowTs;
    delete state.permissions[normEmail];
  }

  state.users = state.users.filter(u => {
    const uNorm = u.email.toLowerCase();
    if (uNorm === SUPER_ADMIN_EMAIL) return true;
    if (normEmail && uNorm === normEmail) return false;
    if (idOrEmail && u.id === idOrEmail) return false;
    return true;
  });

  await writeUnifiedStore(state);
  return state;
}

export async function recordUserDailyUsage(params: {
  email: string;
  dateKey?: string;
  count?: number;
  reset?: boolean;
  activityType?: UserActivityLog['type'];
  activityLabel?: string;
  fileName?: string;
}): Promise<{ state: UnifiedStoreState; user?: UserProfile }> {
  const state = await readUnifiedStore(true);
  const norm = params.email.trim().toLowerCase();
  if (!norm) return { state };

  const isSuper = norm === SUPER_ADMIN_EMAIL;
  const todayKey = params.dateKey || getTodayDateKey();
  const nowTs = Date.now();

  const idx = state.users.findIndex(u => u.email.toLowerCase() === norm);
  let targetUser: UserProfile;

  if (idx >= 0) {
    const prev = state.users[idx];
    const currentCountForToday =
      prev.dailyUsageDate === todayKey ? prev.dailyUsageCount || 0 : 0;
    const nextCount = params.reset
      ? 0
      : typeof params.count === 'number'
      ? Math.max(currentCountForToday, params.count)
      : currentCountForToday + 1;

    const newAct: UserActivityLog | null =
      !params.reset && params.activityLabel
        ? {
            id: `act-${nowTs}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: new Date().toISOString(),
            type: params.activityType || 'standardize',
            label: params.activityLabel,
            fileName: params.fileName,
            dailySlot: `${nextCount}/${DAILY_USAGE_LIMIT}`,
          }
        : null;

    targetUser = {
      ...prev,
      email: norm,
      examsGeneratedCount:
        params.activityType === 'standardize'
          ? (prev.examsGeneratedCount || 0) + 1
          : prev.examsGeneratedCount || 0,
      mixCount:
        params.activityType === 'mix'
          ? (prev.mixCount || 0) + 1
          : prev.mixCount || 0,
      dailyUsageDate: todayKey,
      dailyUsageCount: isSuper ? 0 : nextCount,
      dailyUsageUpdatedAt: nowTs,
      lastActive: new Date().toISOString(),
      recentActivities: newAct
        ? [newAct, ...(prev.recentActivities || [])].slice(0, 25)
        : prev.recentActivities || [],
    };
    state.users[idx] = targetUser;
  } else {
    const perm = state.permissions[norm] || { ...DEFAULT_USER_PERMS, updatedAt: nowTs };
    state.permissions[norm] = perm;
    const initialCount = isSuper ? 0 : params.reset ? 0 : params.count ?? 1;
    const newAct: UserActivityLog | null =
      !params.reset && params.activityLabel
        ? {
            id: `act-${nowTs}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: new Date().toISOString(),
            type: params.activityType || 'standardize',
            label: params.activityLabel,
            fileName: params.fileName,
            dailySlot: `${initialCount}/${DAILY_USAGE_LIMIT}`,
          }
        : null;

    targetUser = {
      id: isSuper ? 'admin-001' : `user-${nowTs}-${Math.random().toString(36).slice(2, 6)}`,
      email: norm,
      displayName: norm.split('@')[0],
      photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${norm}`,
      role: isSuper ? 'super_admin' : 'free',
      permissions: perm,
      createdAt: todayKey,
      lastActive: new Date().toISOString(),
      examsGeneratedCount: params.activityType === 'standardize' ? 1 : 0,
      mixCount: params.activityType === 'mix' ? 1 : 0,
      dailyUsageDate: todayKey,
      dailyUsageCount: initialCount,
      dailyUsageUpdatedAt: nowTs,
      recentActivities: newAct ? [newAct] : [],
    };
    state.users.push(targetUser);
  }

  await writeUnifiedStore(state);
  return { state, user: targetUser };
}
