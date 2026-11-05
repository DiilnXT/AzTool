import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export interface TabPermissions {
  canAudit: boolean;
  canStandardize: boolean;
  canMix: boolean;
}

const SUPER_ADMIN = 'lenhatduy.vietnam@gmail.com';
const DATA_FILE = path.join(process.cwd(), 'data', 'permissions.json');

// In-memory fallback
let inMemoryPermissions: Record<string, TabPermissions> = {
  [SUPER_ADMIN]: {
    canAudit: true,
    canStandardize: true,
    canMix: true,
  },
};

function readPermissionsFromFile(): Record<string, TabPermissions> {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      inMemoryPermissions = {
        ...inMemoryPermissions,
        ...parsed,
        [SUPER_ADMIN]: { canAudit: true, canStandardize: true, canMix: true },
      };
    }
  } catch (e) {
    console.error('Error reading permissions file:', e);
  }
  return inMemoryPermissions;
}

function writePermissionsToFile(data: Record<string, TabPermissions>) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing permissions file:', e);
  }
}

export async function GET() {
  const perms = readPermissionsFromFile();
  return NextResponse.json({ success: true, permissions: perms });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, permissions, bulk } = body;

    const perms = readPermissionsFromFile();

    if (bulk && typeof bulk === 'object') {
      Object.assign(perms, bulk);
    } else if (email && permissions) {
      const norm = email.trim().toLowerCase();
      perms[norm] = {
        canAudit: Boolean(permissions.canAudit),
        canStandardize: Boolean(permissions.canStandardize),
        canMix: Boolean(permissions.canMix),
      };
    }

    // Always enforce super admin rights
    perms[SUPER_ADMIN] = { canAudit: true, canStandardize: true, canMix: true };

    inMemoryPermissions = perms;
    writePermissionsToFile(perms);

    return NextResponse.json({ success: true, permissions: perms });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Lỗi cập nhật quyền' },
      { status: 500 }
    );
  }
}
