import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface ServerVaultItem {
  id: string;
  userEmail: string;
  userName: string;
  userAvatar?: string;
  createdAtIso: string;
  formattedTime: string;
  actionType: 'upload' | 'standardize' | 'mix' | 'ai-audit';
  actionLabel: string;
  originalFileName: string;
  questionsCount: number;
  answeredCount: number;
  questionsPreview: any[];
  metadata: any;
  originalBase64?: string | null;
  standardizedBase64?: string | null;
  sizeBytes: number;
  isViewed: boolean;
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

const globalForVault = globalThis as unknown as {
  __azVault?: ServerVaultItem[];
};

function readVault(): ServerVaultItem[] {
  if (!globalForVault.__azVault) {
    globalForVault.__azVault = [];
  }
  try {
    const vaultFile = getStoragePath('workspace-vault.json');
    if (fs.existsSync(vaultFile)) {
      const raw = fs.readFileSync(vaultFile, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const map = new Map<string, ServerVaultItem>();
        for (const item of globalForVault.__azVault) {
          map.set(item.id, item);
        }
        for (const item of parsed) {
          if (item?.id) map.set(item.id, item);
        }
        globalForVault.__azVault = Array.from(map.values());
      }
    }
  } catch {
    // ignore
  }
  return globalForVault.__azVault;
}

function writeVault(items: ServerVaultItem[]) {
  globalForVault.__azVault = items;
  try {
    const vaultFile = getStoragePath('workspace-vault.json');
    fs.writeFileSync(vaultFile, JSON.stringify(items, null, 2), 'utf-8');
  } catch {
    // ignore
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    const items = readVault();

    if (id) {
      const single = items.find(i => i.id === id);
      if (!single) {
        return NextResponse.json({ success: false, error: 'Không tìm thấy' }, { status: 404 });
      }
      return NextResponse.json({ success: true, item: single });
    }

    const sorted = [...items].sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
    return NextResponse.json({ success: true, count: sorted.length, items: sorted });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const items = readVault();

    const newItem: ServerVaultItem = {
      id: body.id || `vault-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userEmail: body.userEmail || 'khach@aztool.vercel.app',
      userName: body.userName || 'Người dùng',
      userAvatar: body.userAvatar,
      createdAtIso: body.createdAtIso || new Date().toISOString(),
      formattedTime: body.formattedTime || new Date().toLocaleString('vi-VN'),
      actionType: body.actionType || 'upload',
      actionLabel: body.actionLabel || 'Tải đề thi lên web',
      originalFileName: body.originalFileName || 'De_Thi.docx',
      questionsCount: body.questionsCount || (body.questionsPreview?.length || 0),
      answeredCount: body.answeredCount || 0,
      questionsPreview: body.questionsPreview || [],
      metadata: body.metadata || {},
      originalBase64: body.originalBase64 || null,
      standardizedBase64: body.standardizedBase64 || null,
      sizeBytes: body.sizeBytes || 0,
      isViewed: false,
    };

    const updated = [newItem, ...items.filter(i => i.id !== newItem.id)];
    writeVault(updated);

    return NextResponse.json({ success: true, item: newItem });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, isViewed } = body;

    const items = [...readVault()];
    const target = items.find(i => i.id === id);
    if (target) {
      target.isViewed = isViewed !== undefined ? isViewed : true;
      writeVault(items);
      return NextResponse.json({ success: true, item: target });
    }

    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { ids, all, allViewed } = body;

    let items = [...readVault()];

    if (all) {
      items = [];
    } else if (allViewed) {
      items = items.filter(i => !i.isViewed);
    } else if (Array.isArray(ids)) {
      items = items.filter(i => !ids.includes(i.id));
    }

    writeVault(items);

    return NextResponse.json({ success: true, remainingCount: items.length });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
