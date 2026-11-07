import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { enforceApiSecurity, sanitizeInput } from '@/lib/security-shield';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

const CLOUD_VAULT_TOPIC = 'aztool_cloud_vault_db_v5_3a2b1c0d9e8f';
const CLOUD_VAULT_URL = `https://ntfy.sh/${CLOUD_VAULT_TOPIC}`;

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
  __azVaultDeletedIds?: Set<string>;
  __azVaultFetchedAttachments?: Map<string, ServerVaultItem>;
  __azVaultLastSyncMs?: number;
};

function getDeletedIds(): Set<string> {
  if (!globalForVault.__azVaultDeletedIds) {
    globalForVault.__azVaultDeletedIds = new Set<string>();
  }
  try {
    const delFile = getStoragePath('workspace-vault-deleted.json');
    if (fs.existsSync(delFile)) {
      const raw = JSON.parse(fs.readFileSync(delFile, 'utf-8'));
      if (Array.isArray(raw)) {
        raw.forEach((id) => {
          if (typeof id === 'string') globalForVault.__azVaultDeletedIds!.add(id);
        });
      }
    }
  } catch {
    // ignore
  }
  return globalForVault.__azVaultDeletedIds;
}

function saveDeletedIds(set: Set<string>) {
  globalForVault.__azVaultDeletedIds = set;
  try {
    const delFile = getStoragePath('workspace-vault-deleted.json');
    fs.writeFileSync(delFile, JSON.stringify(Array.from(set)), 'utf-8');
  } catch {
    // ignore
  }
}

function readLocalVault(): ServerVaultItem[] {
  if (!globalForVault.__azVault) {
    globalForVault.__azVault = [];
  }
  const deletedIds = getDeletedIds();
  try {
    const vaultFile = getStoragePath('workspace-vault.json');
    if (fs.existsSync(vaultFile)) {
      const raw = fs.readFileSync(vaultFile, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const map = new Map<string, ServerVaultItem>();
        for (const item of globalForVault.__azVault) {
          if (item?.id && !deletedIds.has(item.id)) {
            map.set(item.id, item);
          }
        }
        for (const item of parsed) {
          if (item?.id && !deletedIds.has(item.id)) {
            const existing = map.get(item.id);
            map.set(item.id, existing ? { ...item, isViewed: existing.isViewed || item.isViewed } : item);
          }
        }
        globalForVault.__azVault = Array.from(map.values());
      }
    }
  } catch {
    // ignore
  }
  return (globalForVault.__azVault || []).filter((i) => !deletedIds.has(i.id));
}

function writeLocalVault(items: ServerVaultItem[]) {
  const deletedIds = getDeletedIds();
  const filtered = items.filter((i) => i?.id && !deletedIds.has(i.id));
  globalForVault.__azVault = filtered;
  try {
    const vaultFile = getStoragePath('workspace-vault.json');
    fs.writeFileSync(vaultFile, JSON.stringify(filtered, null, 2), 'utf-8');
  } catch {
    // ignore
  }
}

async function syncVaultWithCloud(force = false): Promise<ServerVaultItem[]> {
  const localItems = readLocalVault();
  const deletedIds = getDeletedIds();
  const now = Date.now();

  if (
    !force &&
    globalForVault.__azVaultLastSyncMs &&
    now - globalForVault.__azVaultLastSyncMs < 1500 &&
    localItems.length > 0
  ) {
    return localItems;
  }

  if (!globalForVault.__azVaultFetchedAttachments) {
    globalForVault.__azVaultFetchedAttachments = new Map<string, ServerVaultItem>();
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    const res = await fetch(`${CLOUD_VAULT_URL}/json`, {
      method: 'GET',
      headers: {
        'X-Poll': '1',
        'X-Since': 'all',
        'Cache-Control': 'no-cache, no-store',
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return localItems;
    const text = await res.text();
    if (!text.trim()) {
      globalForVault.__azVaultLastSyncMs = now;
      return localItems;
    }

    const map = new Map<string, ServerVaultItem>();
    for (const item of localItems) {
      if (item?.id && !deletedIds.has(item.id)) {
        map.set(item.id, item);
      }
    }

    const lines = text.trim().split('\n');
    for (const line of lines) {
      try {
        const ev = JSON.parse(line);
        if (ev.event !== 'message') continue;

        if (ev.attachment?.url) {
          let attachedItem = globalForVault.__azVaultFetchedAttachments.get(ev.id);
          if (!attachedItem) {
            try {
              const attCtrl = new AbortController();
              const attTimer = setTimeout(() => attCtrl.abort(), 5000);
              const attRes = await fetch(ev.attachment.url, {
                cache: 'force-cache',
                signal: attCtrl.signal,
              });
              clearTimeout(attTimer);
              if (attRes.ok) {
                const parsedAtt = await attRes.json();
                const candidate: ServerVaultItem = parsedAtt?.item || parsedAtt;
                if (candidate && candidate.id) {
                  attachedItem = candidate;
                  globalForVault.__azVaultFetchedAttachments.set(ev.id, candidate);
                }
              }
            } catch {
              // ignore single attachment fetch error
            }
          }
          if (attachedItem && attachedItem.id && !deletedIds.has(attachedItem.id)) {
            const prev = map.get(attachedItem.id);
            map.set(attachedItem.id, prev ? { ...attachedItem, isViewed: prev.isViewed || attachedItem.isViewed } : attachedItem);
          }
        } else if (ev.message) {
          const payload = JSON.parse(ev.message);
          if (payload?.eventType === 'upsert' && payload.item?.id) {
            const item: ServerVaultItem = payload.item;
            if (!deletedIds.has(item.id)) {
              const prev = map.get(item.id);
              map.set(item.id, prev ? { ...item, isViewed: prev.isViewed || item.isViewed } : item);
            }
          } else if (payload?.eventType === 'view' && payload.id) {
            const existing = map.get(payload.id);
            if (existing) {
              existing.isViewed = payload.isViewed !== undefined ? Boolean(payload.isViewed) : true;
              map.set(payload.id, existing);
            }
          } else if (payload?.eventType === 'delete') {
            if (payload.all) {
              for (const k of map.keys()) deletedIds.add(k);
              map.clear();
            } else if (payload.allViewed) {
              for (const [k, v] of map.entries()) {
                if (v.isViewed) {
                  deletedIds.add(k);
                  map.delete(k);
                }
              }
            } else if (Array.isArray(payload.ids)) {
              for (const id of payload.ids) {
                if (typeof id === 'string') {
                  deletedIds.add(id);
                  map.delete(id);
                }
              }
            }
          }
        }
      } catch {
        // ignore malformed line
      }
    }

    saveDeletedIds(deletedIds);
    const merged = Array.from(map.values()).filter((i) => !deletedIds.has(i.id));
    writeLocalVault(merged);
    globalForVault.__azVaultLastSyncMs = now;
    return merged;
  } catch {
    return localItems;
  }
}

async function publishVaultItemToCloud(item: ServerVaultItem): Promise<void> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    await fetch(CLOUD_VAULT_URL, {
      method: 'PUT',
      headers: {
        Filename: `vault_${item.id}.json`,
      },
      body: JSON.stringify({ eventType: 'upsert', item }),
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch {
    // ignore network failure
  }
}

async function publishVaultControlEvent(eventPayload: Record<string, any>): Promise<void> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    await fetch(CLOUD_VAULT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
      },
      body: JSON.stringify(eventPayload),
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch {
    // ignore
  }
}

export async function GET(req: Request) {
  const blocked = enforceApiSecurity(req, { maxRequests: 120 });
  if (blocked) return blocked;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    const items = await syncVaultWithCloud(true);

    if (id) {
      const single = items.find((i) => i.id === id);
      if (!single) {
        return NextResponse.json({ success: false, error: 'Không tìm thấy' }, { status: 404 });
      }
      return NextResponse.json(
        { success: true, item: single },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      );
    }

    const sorted = [...items].sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
    return NextResponse.json(
      { success: true, count: sorted.length, items: sorted },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const blocked = enforceApiSecurity(req, { maxRequests: 50, maxBodyBytes: 25 * 1024 * 1024 });
  if (blocked) return blocked;

  try {
    const rawBody = await req.json();
    const body = sanitizeInput(rawBody);
    const items = readLocalVault();

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

    const updated = [newItem, ...items.filter((i) => i.id !== newItem.id)];
    writeLocalVault(updated);
    await publishVaultItemToCloud(newItem);

    return NextResponse.json(
      { success: true, item: newItem },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const blocked = enforceApiSecurity(req, { maxRequests: 80 });
  if (blocked) return blocked;

  try {
    const rawBody = await req.json();
    const body = sanitizeInput(rawBody);
    const { id, isViewed } = body;

    const items = await syncVaultWithCloud(false);
    const target = items.find((i) => i.id === id);
    if (target) {
      target.isViewed = isViewed !== undefined ? isViewed : true;
      writeLocalVault(items);
      await publishVaultControlEvent({
        eventType: 'view',
        id,
        isViewed: target.isViewed,
        timestamp: Date.now(),
      });
      return NextResponse.json({ success: true, item: target });
    }

    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const blocked = enforceApiSecurity(req, { maxRequests: 40 });
  if (blocked) return blocked;

  try {
    const rawBody = await req.json().catch(() => ({}));
    const body = sanitizeInput(rawBody);
    const { ids, all, allViewed } = body;

    let items = await syncVaultWithCloud(false);
    const deletedIds = getDeletedIds();

    if (all) {
      items.forEach((i) => deletedIds.add(i.id));
      items = [];
    } else if (allViewed) {
      items.filter((i) => i.isViewed).forEach((i) => deletedIds.add(i.id));
      items = items.filter((i) => !i.isViewed);
    } else if (Array.isArray(ids)) {
      ids.forEach((id: string) => {
        if (typeof id === 'string') deletedIds.add(id);
      });
      items = items.filter((i) => !ids.includes(i.id));
    }

    saveDeletedIds(deletedIds);
    writeLocalVault(items);
    await publishVaultControlEvent({
      eventType: 'delete',
      ids: Array.isArray(ids) ? ids : undefined,
      all: Boolean(all),
      allViewed: Boolean(allViewed),
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true, remainingCount: items.length });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
