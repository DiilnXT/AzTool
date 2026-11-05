import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { UserProfile, TabPermissions } from '@/types/exam';

const SUPER_ADMIN = 'lenhatduy.vietnam@gmail.com';
const USERS_FILE = path.join(process.cwd(), 'data', 'users.json');
const VAULT_FILE = path.join(process.cwd(), 'data', 'workspace-vault.json');

let inMemoryUsers: UserProfile[] = [
  {
    id: 'admin-001',
    email: SUPER_ADMIN,
    displayName: 'Lê Nhật Duy',
    photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=duy',
    role: 'super_admin',
    permissions: { canAudit: true, canStandardize: true, canMix: true },
    createdAt: '2025-01-01',
    lastActive: new Date().toISOString(),
    examsGeneratedCount: 120,
    mixCount: 85,
  },
];

function readUsersFromFile(): UserProfile[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        inMemoryUsers = parsed;
      }
    }
  } catch (e) {
    console.error('Error reading users file:', e);
  }

  // Also auto-discover any users from the vault who uploaded exams
  try {
    if (fs.existsSync(VAULT_FILE)) {
      const vRaw = fs.readFileSync(VAULT_FILE, 'utf-8');
      const vItems = JSON.parse(vRaw);
      if (Array.isArray(vItems)) {
        for (const item of vItems) {
          const em = (item.userEmail || '').trim().toLowerCase();
          if (em && !inMemoryUsers.some(u => u.email.toLowerCase() === em)) {
            inMemoryUsers.push({
              id: `discovered-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              email: em,
              displayName: item.userName || em.split('@')[0],
              photoURL: item.userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${em}`,
              role: em === SUPER_ADMIN ? 'super_admin' : 'free',
              permissions: { canAudit: false, canStandardize: false, canMix: false },
              createdAt: item.createdAtIso?.split('T')[0] || new Date().toISOString().split('T')[0],
              lastActive: item.createdAtIso || new Date().toISOString(),
              examsGeneratedCount: 1,
              mixCount: 0,
            });
          }
        }
      }
    }
  } catch (e) {
    console.error('Error auto-discovering users from vault:', e);
  }

  // Ensure super admin always exists and has full perms
  const adminIndex = inMemoryUsers.findIndex(u => u.email.toLowerCase() === SUPER_ADMIN.toLowerCase());
  if (adminIndex >= 0) {
    inMemoryUsers[adminIndex].role = 'super_admin';
    inMemoryUsers[adminIndex].permissions = { canAudit: true, canStandardize: true, canMix: true };
  } else {
    inMemoryUsers.unshift({
      id: 'admin-001',
      email: SUPER_ADMIN,
      displayName: 'Lê Nhật Duy',
      photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=duy',
      role: 'super_admin',
      permissions: { canAudit: true, canStandardize: true, canMix: true },
      createdAt: '2025-01-01',
      lastActive: new Date().toISOString(),
      examsGeneratedCount: 120,
      mixCount: 85,
    });
  }

  return inMemoryUsers;
}

function writeUsersToFile(users: UserProfile[]) {
  try {
    const dir = path.dirname(USERS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing users file:', e);
  }
}

export async function GET() {
  const users = readUsersFromFile();
  return NextResponse.json({ success: true, count: users.length, users });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { user, email, displayName, photoURL, permissions, role } = body;

    const currentUsers = readUsersFromFile();
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
      // Update existing
      currentUsers[existingIndex] = {
        ...currentUsers[existingIndex],
        displayName: displayName || user?.displayName || currentUsers[existingIndex].displayName,
        photoURL: photoURL || user?.photoURL || currentUsers[existingIndex].photoURL,
        role: isSuper ? 'super_admin' : (role || currentUsers[existingIndex].role),
        permissions: isSuper
          ? { canAudit: true, canStandardize: true, canMix: true }
          : (permissions !== undefined ? permissions : currentUsers[existingIndex].permissions),
        lastActive: new Date().toISOString(),
      };
    } else {
      // Add new
      currentUsers.push({
        id: user?.id || `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        email: targetEmail,
        displayName: displayName || user?.displayName || targetEmail.split('@')[0],
        photoURL: photoURL || user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetEmail}`,
        role: isSuper ? 'super_admin' : (role || 'free'),
        permissions: defaultPerms,
        createdAt: new Date().toISOString().split('T')[0],
        lastActive: new Date().toISOString(),
        examsGeneratedCount: 0,
        mixCount: 0,
      });
    }

    inMemoryUsers = currentUsers;
    writeUsersToFile(currentUsers);

    return NextResponse.json({ success: true, count: currentUsers.length, users: currentUsers });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email')?.toLowerCase();
    const id = searchParams.get('id');

    let currentUsers = readUsersFromFile();

    if (email && email === SUPER_ADMIN.toLowerCase()) {
      return NextResponse.json({ success: false, error: 'Không thể xóa Admin tối thượng' }, { status: 400 });
    }

    currentUsers = currentUsers.filter(u => {
      if (email && u.email.toLowerCase() === email) return false;
      if (id && u.id === id) return false;
      return true;
    });

    inMemoryUsers = currentUsers;
    writeUsersToFile(currentUsers);

    return NextResponse.json({ success: true, count: currentUsers.length, users: currentUsers });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
