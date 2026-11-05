import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { UserProfile, TabPermissions } from '@/types/exam';

const SUPER_ADMIN = 'lenhatduy.vietnam@gmail.com';

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

const globalForUsers = globalThis as unknown as {
  __azUsers?: UserProfile[];
};

const defaultAdminUser: UserProfile = {
  id: 'admin-001',
  email: SUPER_ADMIN,
  displayName: 'Lê Nhật Duy',
  photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=duy',
  role: 'super_admin',
  permissions: { canAudit: true, canStandardize: true, canMix: true },
  createdAt: '2025-01-01',
  lastActive: '2026-11-06T00:00:00.000Z',
  examsGeneratedCount: 120,
  mixCount: 85,
};

function readUsers(): UserProfile[] {
  if (!globalForUsers.__azUsers) {
    globalForUsers.__azUsers = [defaultAdminUser];
  }

  try {
    const usersFile = getStoragePath('users.json');
    if (fs.existsSync(usersFile)) {
      const raw = fs.readFileSync(usersFile, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const mergedMap = new Map<string, UserProfile>();
        for (const u of globalForUsers.__azUsers) {
          mergedMap.set(u.email.toLowerCase(), u);
        }
        for (const u of parsed) {
          if (u?.email) {
            mergedMap.set(u.email.toLowerCase(), u);
          }
        }
        globalForUsers.__azUsers = Array.from(mergedMap.values());
      }
    }
  } catch {
    // ignore
  }

  // Also auto-discover any users from the vault
  try {
    const vaultFile = getStoragePath('workspace-vault.json');
    if (fs.existsSync(vaultFile)) {
      const vRaw = fs.readFileSync(vaultFile, 'utf-8');
      const vItems = JSON.parse(vRaw);
      if (Array.isArray(vItems)) {
        for (const item of vItems) {
          const em = (item.userEmail || '').trim().toLowerCase();
          if (em && !globalForUsers.__azUsers.some(u => u.email.toLowerCase() === em)) {
            globalForUsers.__azUsers.push({
              id: `discovered-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              email: em,
              displayName: item.userName || em.split('@')[0],
              photoURL: item.userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${em}`,
              role: em === SUPER_ADMIN ? 'super_admin' : 'free',
              permissions: { canAudit: false, canStandardize: false, canMix: false },
              createdAt: item.createdAtIso?.split('T')[0] || '2026-11-06',
              lastActive: item.createdAtIso || '2026-11-06T00:00:00.000Z',
              examsGeneratedCount: 1,
              mixCount: 0,
            });
          }
        }
      }
    }
  } catch {
    // ignore
  }

  // Ensure super admin always exists
  const adminIdx = globalForUsers.__azUsers.findIndex(
    u => u.email.toLowerCase() === SUPER_ADMIN.toLowerCase()
  );
  if (adminIdx >= 0) {
    globalForUsers.__azUsers[adminIdx].role = 'super_admin';
    globalForUsers.__azUsers[adminIdx].permissions = {
      canAudit: true,
      canStandardize: true,
      canMix: true,
    };
  } else {
    globalForUsers.__azUsers.unshift(defaultAdminUser);
  }

  return globalForUsers.__azUsers;
}

function writeUsers(users: UserProfile[]) {
  globalForUsers.__azUsers = users;
  try {
    const usersFile = getStoragePath('users.json');
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), 'utf-8');
  } catch {
    // ignore
  }
}

export async function GET() {
  const users = readUsers();
  return NextResponse.json({ success: true, count: users.length, users });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { user, email, displayName, photoURL, permissions, role } = body;

    const currentUsers = [...readUsers()];
    const targetEmail = ((user?.email || email) as string)?.trim().toLowerCase();

    if (!targetEmail) {
      return NextResponse.json({ success: false, error: 'Email là bắt buộc' }, { status: 400 });
    }

    const isSuper = targetEmail === SUPER_ADMIN.toLowerCase();
    const existingIndex = currentUsers.findIndex(u => u.email.toLowerCase() === targetEmail);

    const defaultPerms: TabPermissions = isSuper
      ? { canAudit: true, canStandardize: true, canMix: true }
      : permissions || { canAudit: false, canStandardize: false, canMix: false };

    if (existingIndex >= 0) {
      currentUsers[existingIndex] = {
        ...currentUsers[existingIndex],
        displayName:
          displayName || user?.displayName || currentUsers[existingIndex].displayName,
        photoURL: photoURL || user?.photoURL || currentUsers[existingIndex].photoURL,
        role: isSuper ? 'super_admin' : role || currentUsers[existingIndex].role,
        permissions: isSuper
          ? { canAudit: true, canStandardize: true, canMix: true }
          : permissions !== undefined
          ? permissions
          : currentUsers[existingIndex].permissions,
        lastActive: new Date().toISOString(),
      };
    } else {
      currentUsers.push({
        id: user?.id || `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        email: targetEmail,
        displayName: displayName || user?.displayName || targetEmail.split('@')[0],
        photoURL:
          photoURL ||
          user?.photoURL ||
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetEmail}`,
        role: isSuper ? 'super_admin' : role || 'free',
        permissions: defaultPerms,
        createdAt: new Date().toISOString().split('T')[0],
        lastActive: new Date().toISOString(),
        examsGeneratedCount: 0,
        mixCount: 0,
      });
    }

    writeUsers(currentUsers);

    return NextResponse.json({
      success: true,
      count: currentUsers.length,
      users: currentUsers,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email')?.toLowerCase();
    const id = searchParams.get('id');

    let currentUsers = [...readUsers()];

    if (email && email === SUPER_ADMIN.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'Không thể xóa Admin tối thượng' },
        { status: 400 }
      );
    }

    currentUsers = currentUsers.filter(u => {
      if (u.email.toLowerCase() === SUPER_ADMIN.toLowerCase()) return true;
      if (email && u.email.toLowerCase() === email) return false;
      if (id && u.id === id) return false;
      return true;
    });

    writeUsers(currentUsers);

    return NextResponse.json({
      success: true,
      count: currentUsers.length,
      users: currentUsers,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
