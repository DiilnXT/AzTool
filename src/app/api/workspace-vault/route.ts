import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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

const VAULT_FILE = path.join(process.cwd(), 'data', 'workspace-vault.json');

// In-memory cache
let inMemoryVault: ServerVaultItem[] = [];

function readVaultFromFile(): ServerVaultItem[] {
  try {
    if (fs.existsSync(VAULT_FILE)) {
      const raw = fs.readFileSync(VAULT_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        inMemoryVault = parsed;
      }
    }
  } catch (e) {
    console.error('Error reading workspace-vault file:', e);
  }
  return inMemoryVault;
}

function writeVaultToFile(items: ServerVaultItem[]) {
  try {
    const dir = path.dirname(VAULT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(VAULT_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing workspace-vault file:', e);
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    const items = readVaultFromFile();

    if (id) {
      const single = items.find(i => i.id === id);
      if (!single) {
        return NextResponse.json({ success: false, error: 'Không tìm thấy' }, { status: 404 });
      }
      return NextResponse.json({ success: true, item: single });
    }

    // Return items sorted by newest first
    const sorted = [...items].sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
    return NextResponse.json({ success: true, count: sorted.length, items: sorted });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const items = readVaultFromFile();

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

    // Prepend new item
    const updated = [newItem, ...items.filter(i => i.id !== newItem.id)];
    inMemoryVault = updated;
    writeVaultToFile(updated);

    return NextResponse.json({ success: true, item: newItem });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, isViewed } = body;

    const items = readVaultFromFile();
    const target = items.find(i => i.id === id);
    if (target) {
      target.isViewed = isViewed !== undefined ? isViewed : true;
      inMemoryVault = [...items];
      writeVaultToFile(inMemoryVault);
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

    let items = readVaultFromFile();

    if (all) {
      items = [];
    } else if (allViewed) {
      items = items.filter(i => !i.isViewed);
    } else if (Array.isArray(ids)) {
      items = items.filter(i => !ids.includes(i.id));
    }

    inMemoryVault = items;
    writeVaultToFile(items);

    return NextResponse.json({ success: true, remainingCount: items.length });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
