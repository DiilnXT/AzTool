import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface TabPermissions {
  canAudit: boolean;
  canStandardize: boolean;
  canMix: boolean;
}

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

const globalForPerms = globalThis as unknown as {
  __azPermissions?: Record<string, TabPermissions>;
};

function readPermissions(): Record<string, TabPermissions> {
  if (!globalForPerms.__azPermissions) {
    globalForPerms.__azPermissions = {
      [SUPER_ADMIN]: { canAudit: true, canStandardize: true, canMix: true },
    };
  }
  try {
    const filePath = getStoragePath('permissions.json');
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      globalForPerms.__azPermissions = {
        ...globalForPerms.__azPermissions,
        ...parsed,
        [SUPER_ADMIN]: { canAudit: true, canStandardize: true, canMix: true },
      };
    }
  } catch {
    // ignore
  }
  return globalForPerms.__azPermissions || {
    [SUPER_ADMIN]: { canAudit: true, canStandardize: true, canMix: true },
  };
}

function writePermissions(data: Record<string, TabPermissions>) {
  globalForPerms.__azPermissions = data;
  try {
    const filePath = getStoragePath('permissions.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // ignore
  }
}

export async function GET() {
  const perms = readPermissions();
  return NextResponse.json({ success: true, permissions: perms });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, permissions, bulk } = body;

    const perms = { ...readPermissions() };

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

    perms[SUPER_ADMIN] = { canAudit: true, canStandardize: true, canMix: true };
    writePermissions(perms);

    return NextResponse.json({ success: true, permissions: perms });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Lỗi cập nhật quyền' },
      { status: 500 }
    );
  }
}
