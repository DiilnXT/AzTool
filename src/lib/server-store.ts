import fs from 'fs';
import path from 'path';
import os from 'os';
import { UserProfile, TabPermissions } from '@/types/exam';

export const SUPER_ADMIN_EMAIL = 'lenhatduy.vietnam@gmail.com';

export const SUPER_PERMS: TabPermissions = {
  canAudit: true,
  canStandardize: true,
  canMix: true,
  canPdfStudio: true,
  canThesisAudit: true,
  updatedAt: 9999999999999,
};

export const DEFAULT_USER_PERMS: TabPermissions = {
  canAudit: false,
  canStandardize: false,
  canMix: false,
  canPdfStudio: false,
  canThesisAudit: false,
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
  return {
    canAudit: Boolean(raw.canAudit),
    canStandardize: Boolean(raw.canStandardize),
    canMix: Boolean(raw.canMix),
    canPdfStudio: Boolean(raw.canPdfStudio),
    canThesisAudit: Boolean(raw.canThesisAudit),
    updatedAt: typeof raw.updatedAt === 'number' && raw.updatedAt > 0 ? raw.updatedAt : fallbackUpdatedAt,
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

interface UnifiedStoreState {
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
};

export function readUnifiedStore(): UnifiedStoreState {
  if (!globalForStore.__azUnifiedStore) {
    globalForStore.__azUnifiedStore = {
      users: [defaultAdminUser],
      permissions: { [SUPER_ADMIN_EMAIL]: { ...SUPER_PERMS } },
      deletedEmails: {},
    };
  }

  const state = globalForStore.__azUnifiedStore;

  // 1. Read deletedEmails tombstones
  try {
    const delFile = getStoragePath('deleted-users.json');
    if (fs.existsSync(delFile)) {
      const parsedDel = JSON.parse(fs.readFileSync(delFile, 'utf-8'));
      if (parsedDel && typeof parsedDel === 'object') {
        for (const [em, ts] of Object.entries(parsedDel)) {
          const norm = em.trim().toLowerCase();
          const numTs = Number(ts) || 0;
          if (!state.deletedEmails[norm] || numTs > state.deletedEmails[norm]) {
            state.deletedEmails[norm] = numTs;
          }
        }
      }
    }
  } catch {
    // ignore
  }

  // 2. Read permissions.json
  try {
    const permFile = getStoragePath('permissions.json');
    if (fs.existsSync(permFile)) {
      const parsedPerms = JSON.parse(fs.readFileSync(permFile, 'utf-8'));
      if (parsedPerms && typeof parsedPerms === 'object') {
        for (const [em, pVal] of Object.entries(parsedPerms)) {
          const norm = em.trim().toLowerCase();
          if (!norm) continue;
          const isSuper = norm === SUPER_ADMIN_EMAIL;
          const incoming = normalizePermissions(pVal as any, isSuper, 1);
          const deletedAt = state.deletedEmails[norm] || 0;
          if (!isSuper && deletedAt > (incoming.updatedAt || 0)) {
            continue;
          }
          const existing = state.permissions[norm];
          if (!existing || (incoming.updatedAt || 0) >= (existing.updatedAt || 0)) {
            state.permissions[norm] = incoming;
          }
        }
      }
    }
  } catch {
    // ignore
  }

  // 3. Read users.json
  const userMap = new Map<string, UserProfile>();
  for (const u of state.users) {
    if (u?.email) {
      const norm = u.email.trim().toLowerCase();
      userMap.set(norm, { ...u, email: norm });
    }
  }

  try {
    const usersFile = getStoragePath('users.json');
    if (fs.existsSync(usersFile)) {
      const parsedUsers = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
      if (Array.isArray(parsedUsers)) {
        for (const u of parsedUsers) {
          if (!u?.email) continue;
          const norm = String(u.email).trim().toLowerCase();
          const isSuper = norm === SUPER_ADMIN_EMAIL;
          const uPerm = normalizePermissions(u.permissions, isSuper, 1);
          const deletedAt = state.deletedEmails[norm] || 0;
          if (!isSuper && deletedAt > (uPerm.updatedAt || 0)) {
            userMap.delete(norm);
            continue;
          }
          const prevUser = userMap.get(norm);
          const prevPerm = state.permissions[norm] || prevUser?.permissions;
          const chosenPerm =
            prevPerm && (prevPerm.updatedAt || 0) > (uPerm.updatedAt || 0)
              ? normalizePermissions(prevPerm, isSuper)
              : uPerm;

          state.permissions[norm] = chosenPerm;
          userMap.set(norm, {
            ...(prevUser || u),
            ...u,
            email: norm,
            role: isSuper ? 'super_admin' : u.role || prevUser?.role || 'free',
            permissions: chosenPerm,
          });
        }
      }
    }
  } catch {
    // ignore
  }

  // 4. Ensure every email in state.permissions has a synchronized entry in userMap
  for (const [norm, perm] of Object.entries(state.permissions)) {
    const isSuper = norm === SUPER_ADMIN_EMAIL;
    const deletedAt = state.deletedEmails[norm] || 0;
    if (!isSuper && deletedAt > (perm.updatedAt || 0)) {
      delete state.permissions[norm];
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

  // 5. Auto-discover from workspace-vault.json ONLY if not deleted after snapshot creation
  try {
    const vaultFile = getStoragePath('workspace-vault.json');
    if (fs.existsSync(vaultFile)) {
      const vItems = JSON.parse(fs.readFileSync(vaultFile, 'utf-8'));
      if (Array.isArray(vItems)) {
        for (const item of vItems) {
          const norm = String(item.userEmail || '').trim().toLowerCase();
          if (!norm || userMap.has(norm)) continue;
          const snapTime = item.createdAtIso ? new Date(item.createdAtIso).getTime() : 0;
          const deletedAt = state.deletedEmails[norm] || 0;
          if (deletedAt > 0 && deletedAt >= snapTime) {
            continue;
          }
          const isSuper = norm === SUPER_ADMIN_EMAIL;
          const perm = state.permissions[norm] || normalizePermissions(null, isSuper, 1);
          state.permissions[norm] = perm;
          userMap.set(norm, {
            id: `discovered-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            email: norm,
            displayName: item.userName || norm.split('@')[0],
            photoURL: item.userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${norm}`,
            role: isSuper ? 'super_admin' : 'free',
            permissions: perm,
            createdAt: item.createdAtIso?.split('T')[0] || '2026-11-06',
            lastActive: item.createdAtIso || '2026-11-06T00:00:00.000Z',
            examsGeneratedCount: 1,
            mixCount: 0,
          });
        }
      }
    }
  } catch {
    // ignore
  }

  // Always enforce super admin
  state.permissions[SUPER_ADMIN_EMAIL] = { ...SUPER_PERMS };
  const adminExisting = userMap.get(SUPER_ADMIN_EMAIL) || defaultAdminUser;
  userMap.set(SUPER_ADMIN_EMAIL, {
    ...adminExisting,
    email: SUPER_ADMIN_EMAIL,
    role: 'super_admin',
    permissions: { ...SUPER_PERMS },
  });

  state.users = Array.from(userMap.values());
  return state;
}

export function writeUnifiedStore(state: UnifiedStoreState): void {
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

export function upsertAdminPermission(
  email: string,
  perms: Partial<TabPermissions>,
  displayName?: string,
  photoURL?: string
): UnifiedStoreState {
  const state = readUnifiedStore();
  const norm = email.trim().toLowerCase();
  if (!norm) return state;

  const isSuper = norm === SUPER_ADMIN_EMAIL;
  const nowTs = Date.now();
  const cleanPerms = normalizePermissions(perms, isSuper, nowTs);
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

  writeUnifiedStore(state);
  return state;
}

export function syncBulkAdminPermissions(
  bulkPerms: Record<string, TabPermissions>,
  bulkUsers?: UserProfile[]
): UnifiedStoreState {
  const state = readUnifiedStore();

  if (bulkPerms && typeof bulkPerms === 'object') {
    for (const [em, pVal] of Object.entries(bulkPerms)) {
      const norm = em.trim().toLowerCase();
      if (!norm) continue;
      const isSuper = norm === SUPER_ADMIN_EMAIL;
      const incoming = normalizePermissions(pVal, isSuper, Date.now());
      const deletedAt = state.deletedEmails[norm] || 0;
      if (!isSuper && deletedAt > (incoming.updatedAt || 0)) {
        continue;
      }
      const existing = state.permissions[norm];
      if (!existing || (incoming.updatedAt || 0) >= (existing.updatedAt || 0)) {
        state.permissions[norm] = incoming;
      }
    }
  }

  if (Array.isArray(bulkUsers)) {
    for (const u of bulkUsers) {
      if (!u?.email) continue;
      const norm = u.email.trim().toLowerCase();
      const isSuper = norm === SUPER_ADMIN_EMAIL;
      const deletedAt = state.deletedEmails[norm] || 0;
      const perm = state.permissions[norm] || normalizePermissions(u.permissions, isSuper, 1);
      if (!isSuper && deletedAt > (perm.updatedAt || 0)) {
        continue;
      }
      state.permissions[norm] = perm;
      const idx = state.users.findIndex(item => item.email.toLowerCase() === norm);
      if (idx >= 0) {
        state.users[idx] = {
          ...state.users[idx],
          displayName: u.displayName || state.users[idx].displayName,
          photoURL: u.photoURL || state.users[idx].photoURL,
          permissions: perm,
        };
      } else {
        state.users.push({
          ...u,
          email: norm,
          role: isSuper ? 'super_admin' : u.role || 'free',
          permissions: perm,
        });
      }
    }
  }

  writeUnifiedStore(state);
  return state;
}

export function recordTeacherLogin(params: {
  email: string;
  displayName?: string;
  photoURL?: string;
  id?: string;
}): { state: UnifiedStoreState; user: UserProfile } {
  const state = readUnifiedStore();
  const norm = params.email.trim().toLowerCase();
  const isSuper = norm === SUPER_ADMIN_EMAIL;

  // Preserve existing server permissions set by Admin! Never overwrite them on teacher login!
  const existingUserIdx = state.users.findIndex(u => u.email.toLowerCase() === norm);
  const existingPerm =
    state.permissions[norm] ||
    (existingUserIdx >= 0 ? state.users[existingUserIdx].permissions : undefined);

  const authoritativePerm = isSuper
    ? { ...SUPER_PERMS }
    : existingPerm
    ? normalizePermissions(existingPerm, false, existingPerm.updatedAt || 1)
    : { ...DEFAULT_USER_PERMS, updatedAt: 1 };

  delete state.deletedEmails[norm];
  state.permissions[norm] = authoritativePerm;

  let finalUser: UserProfile;
  if (existingUserIdx >= 0) {
    finalUser = {
      ...state.users[existingUserIdx],
      email: norm,
      displayName: params.displayName?.trim() || state.users[existingUserIdx].displayName,
      photoURL: params.photoURL || state.users[existingUserIdx].photoURL,
      role: isSuper ? 'super_admin' : state.users[existingUserIdx].role,
      permissions: authoritativePerm,
      lastActive: new Date().toISOString(),
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
      createdAt: new Date().toISOString().split('T')[0],
      lastActive: new Date().toISOString(),
      examsGeneratedCount: 0,
      mixCount: 0,
    };
    state.users.push(finalUser);
  }

  writeUnifiedStore(state);
  return { state, user: finalUser };
}

export function deleteTeacherFromStore(idOrEmail: string, explicitEmail?: string): UnifiedStoreState {
  const state = readUnifiedStore();
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

  writeUnifiedStore(state);
  return state;
}
