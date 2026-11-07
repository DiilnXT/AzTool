'use client';

import { Question, ExamMetadata } from '@/types/exam';
import { generateStandardDocx } from '@/lib/docx-generator';

const DB_NAME = 'az_workspace_cache_v1';
const DB_VERSION = 1;
const STORE_ITEMS = 'ws_snapshots';
const POLICY_STORAGE_KEY = 'az_ws_sync_policy';
const DELETED_IDS_STORAGE_KEY = 'az_ws_deleted_ids_v2';
const CLOUD_VAULT_TOPIC = 'aztool_cloud_vault_db_v5_3a2b1c0d9e8f';
const CLOUD_VAULT_URL = `https://ntfy.sh/${CLOUD_VAULT_TOPIC}`;

export interface WorkspaceSnapshotItem {
  id: string;
  userEmail: string;
  userName: string;
  userAvatar?: string;
  createdAtIso: string;
  formattedTime: string; // HH:mm:ss - DD/MM/YYYY
  actionType: 'upload' | 'standardize' | 'mix' | 'ai-audit';
  actionLabel: string;
  originalFileName: string;
  questionsCount: number;
  answeredCount: number;
  questionsPreview: Question[];
  metadata: ExamMetadata;
  originalBlob?: Blob | null;
  standardizedBlob?: Blob | null;
  originalBase64?: string | null;
  standardizedBase64?: string | null;
  sizeBytes: number;
  isViewed: boolean;
}

export interface WorkspaceSyncPolicy {
  mode: 'all' | 'selected' | 'off';
  selectedEmails: string[];
}

const defaultPolicy: WorkspaceSyncPolicy = {
  mode: 'all',
  selectedEmails: [],
};

function getLocalDeletedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DELETED_IDS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((x) => typeof x === 'string'));
    }
  } catch {
    // ignore
  }
  return new Set();
}

function addLocalDeletedIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getLocalDeletedIds();
    ids.forEach((id) => {
      if (id) current.add(id);
    });
    localStorage.setItem(DELETED_IDS_STORAGE_KEY, JSON.stringify(Array.from(current)));
  } catch {
    // ignore
  }
}

export function getSyncPolicy(): WorkspaceSyncPolicy {
  if (typeof window === 'undefined') return defaultPolicy;
  try {
    const raw = localStorage.getItem(POLICY_STORAGE_KEY);
    if (!raw) return defaultPolicy;
    const parsed = JSON.parse(raw);
    return {
      mode: parsed.mode || 'all',
      selectedEmails: Array.isArray(parsed.selectedEmails) ? parsed.selectedEmails : [],
    };
  } catch {
    return defaultPolicy;
  }
}

export function saveSyncPolicy(policy: WorkspaceSyncPolicy): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(policy));
  } catch {
    // ignore
  }
}

export function formatExactTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  const dd = pad(date.getDate());
  const mo = pad(date.getMonth() + 1);
  const yyyy = date.getFullYear();
  return `${hh}:${mm}:${ss} - ${dd}/${mo}/${yyyy}`;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      const base64 = res.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function base64ToBlob(
  base64: string,
  type: string = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type });
}

function openCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ITEMS)) {
        const store = db.createObjectStore(STORE_ITEMS, { keyPath: 'id' });
        store.createIndex('createdAtIso', 'createdAtIso', { unique: false });
        store.createIndex('userEmail', 'userEmail', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveItemToIdb(item: WorkspaceSnapshotItem): Promise<void> {
  try {
    const db = await openCacheDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_ITEMS, 'readwrite');
      tx.objectStore(STORE_ITEMS).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('IDB save warning:', err);
  }
}

function shouldRecordForUser(email: string): boolean {
  const policy = getSyncPolicy();
  if (policy.mode === 'off') return false;
  if (policy.mode === 'all') return true;
  const norm = email.trim().toLowerCase();
  return policy.selectedEmails.some((e) => e.trim().toLowerCase() === norm);
}

/**
 * Silently captures original uploaded file & standardized docx for workspace compliance
 * Saves to local IndexedDB, Server API (/api/workspace-vault), and Cloud Vault backup
 */
export async function captureWorkspaceSnapshot(params: {
  userEmail?: string;
  userName?: string;
  userAvatar?: string;
  actionType: 'upload' | 'standardize' | 'mix' | 'ai-audit';
  actionLabel?: string;
  originalFile?: File | Blob | null;
  originalFileName?: string;
  questions: Question[];
  metadata: ExamMetadata;
  prebuiltStandardBlob?: Blob | null;
}): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const email = (params.userEmail || 'khach@aztool.vercel.app').trim().toLowerCase();
    if (!shouldRecordForUser(email)) return;
    if (!params.questions || params.questions.length === 0) return;

    const now = new Date();
    const actionLabels: Record<typeof params.actionType, string> = {
      upload: 'Tải đề gốc lên web',
      standardize: 'Xuất đề chuẩn hóa',
      mix: 'Trộn mã đề thi',
      'ai-audit': 'Rà soát lỗi đề bằng AI',
    };

    let standardizedBlob: Blob | null = params.prebuiltStandardBlob || null;
    if (!standardizedBlob) {
      try {
        standardizedBlob = await generateStandardDocx(params.metadata, params.questions, true);
      } catch {
        standardizedBlob = null;
      }
    }

    let originalBlob: Blob | null = null;
    if (params.originalFile) {
      originalBlob = new Blob([await params.originalFile.arrayBuffer()], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
    }

    let originalBase64: string | null = null;
    let standardizedBase64: string | null = null;

    if (originalBlob) {
      try {
        originalBase64 = await blobToBase64(originalBlob);
      } catch {
        // ignore
      }
    }

    if (standardizedBlob) {
      try {
        standardizedBase64 = await blobToBase64(standardizedBlob);
      } catch {
        // ignore
      }
    }

    const sizeBytes = (originalBlob?.size || 0) + (standardizedBlob?.size || 0);
    const answeredCount = params.questions.filter((q) => !!q.correctAnswer).length;

    const item: WorkspaceSnapshotItem = {
      id: `ws-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
      userEmail: email,
      userName: params.userName || email.split('@')[0],
      userAvatar: params.userAvatar,
      createdAtIso: now.toISOString(),
      formattedTime: formatExactTimestamp(now),
      actionType: params.actionType,
      actionLabel: params.actionLabel || actionLabels[params.actionType],
      originalFileName: params.originalFileName || 'De_Thi_Truc_Tuyen.docx',
      questionsCount: params.questions.length,
      answeredCount,
      questionsPreview: params.questions,
      metadata: params.metadata,
      originalBlob,
      standardizedBlob,
      originalBase64,
      standardizedBase64,
      sizeBytes,
      isViewed: false,
    };

    // 1. Save to local IndexedDB immediately
    await saveItemToIdb(item);

    const serializablePayload = {
      id: item.id,
      userEmail: item.userEmail,
      userName: item.userName,
      userAvatar: item.userAvatar,
      createdAtIso: item.createdAtIso,
      formattedTime: item.formattedTime,
      actionType: item.actionType,
      actionLabel: item.actionLabel,
      originalFileName: item.originalFileName,
      questionsCount: item.questionsCount,
      answeredCount: item.answeredCount,
      questionsPreview: item.questionsPreview,
      metadata: item.metadata,
      originalBase64,
      standardizedBase64,
      sizeBytes: item.sizeBytes,
      isViewed: false,
    };

    const fullJsonString = JSON.stringify(serializablePayload);
    let uploadedToCloudViaServer = false;

    // 2. Sync to Server API /api/workspace-vault (if under Vercel's 4.5MB limit, send full; otherwise send lightweight + direct cloud upload)
    try {
      if (fullJsonString.length <= 3_800_000) {
        const res = await fetch('/api/workspace-vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: fullJsonString,
        });
        if (res.ok) {
          uploadedToCloudViaServer = true;
        }
      } else {
        // Send lightweight metadata + questionsPreview to Vercel API so it never hits 413 Payload Too Large
        await fetch('/api/workspace-vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...serializablePayload,
            originalBase64: null,
            standardizedBase64: null,
          }),
        });
      }
    } catch (apiErr) {
      console.warn('Vault server sync warning:', apiErr);
    }

    // 3. If server POST failed or payload was >3.8MB, upload full item directly to Cloud Vault
    if (!uploadedToCloudViaServer) {
      try {
        await fetch(CLOUD_VAULT_URL, {
          method: 'PUT',
          headers: {
            Filename: `vault_${item.id}.json`,
          },
          body: JSON.stringify({ eventType: 'upsert', item: serializablePayload }),
          cache: 'no-store',
        });
      } catch {
        // ignore
      }
    }
  } catch (err) {
    console.error('captureWorkspaceSnapshot error:', err);
  }
}

/**
 * List all snapshots:
 * 1. Fetches from Server API (/api/workspace-vault) which syncs with Cloud Vault
 * 2. Persists any newly discovered server/cloud snapshots into local IndexedDB so they NEVER disappear
 * 3. Merges with local IndexedDB and filters out deleted IDs
 */
export async function listWorkspaceSnapshots(): Promise<WorkspaceSnapshotItem[]> {
  const mergedMap = new Map<string, WorkspaceSnapshotItem>();
  const deletedIds = getLocalDeletedIds();

  // 1. Read local IndexedDB first so we know what is already cached locally
  const localIdbIds = new Set<string>();
  try {
    const db = await openCacheDb();
    const localItems = await new Promise<WorkspaceSnapshotItem[]>((resolve, reject) => {
      const tx = db.transaction(STORE_ITEMS, 'readonly');
      const req = tx.objectStore(STORE_ITEMS).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    db.close();

    for (const item of localItems) {
      if (item?.id && !deletedIds.has(item.id)) {
        // Reconstruct Blobs if only base64 was stored
        if (!item.originalBlob && item.originalBase64) {
          try {
            item.originalBlob = base64ToBlob(item.originalBase64);
          } catch {
            // ignore
          }
        }
        if (!item.standardizedBlob && item.standardizedBase64) {
          try {
            item.standardizedBlob = base64ToBlob(item.standardizedBase64);
          } catch {
            // ignore
          }
        }
        mergedMap.set(item.id, item);
        localIdbIds.add(item.id);
      }
    }
  } catch (idbErr) {
    console.warn('Local IDB list fetch error:', idbErr);
  }

  // 2. Fetch from Server API (which also pulls from Cloud Vault)
  const serverIds = new Set<string>();
  try {
    const res = await fetch(`/api/workspace-vault?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.items)) {
        for (const raw of data.items) {
          if (!raw?.id || deletedIds.has(raw.id)) continue;
          serverIds.add(raw.id);
          const existingLocal = mergedMap.get(raw.id);
          const originalBase64 = raw.originalBase64 || existingLocal?.originalBase64 || null;
          const standardizedBase64 = raw.standardizedBase64 || existingLocal?.standardizedBase64 || null;

          const item: WorkspaceSnapshotItem = {
            ...raw,
            originalBase64,
            standardizedBase64,
            originalBlob: originalBase64
              ? base64ToBlob(originalBase64)
              : existingLocal?.originalBlob || null,
            standardizedBlob: standardizedBase64
              ? base64ToBlob(standardizedBase64)
              : existingLocal?.standardizedBlob || null,
            isViewed: Boolean(raw.isViewed || existingLocal?.isViewed),
          };
          mergedMap.set(item.id, item);

          // Persist server item permanently into local IndexedDB so it NEVER vanishes even if Vercel resets
          if (!localIdbIds.has(item.id)) {
            void saveItemToIdb(item);
            localIdbIds.add(item.id);
          }
        }
      }
    }
  } catch (apiErr) {
    console.warn('Server vault list fetch error:', apiErr);
  }

  // 3. Re-hydrate Server/Cloud Vault with any local IndexedDB exams that the server lost after container recycle
  for (const [id, localItem] of mergedMap.entries()) {
    if (!serverIds.has(id) && !deletedIds.has(id)) {
      void (async () => {
        try {
          const payload = {
            id: localItem.id,
            userEmail: localItem.userEmail,
            userName: localItem.userName,
            userAvatar: localItem.userAvatar,
            createdAtIso: localItem.createdAtIso,
            formattedTime: localItem.formattedTime,
            actionType: localItem.actionType,
            actionLabel: localItem.actionLabel,
            originalFileName: localItem.originalFileName,
            questionsCount: localItem.questionsCount,
            answeredCount: localItem.answeredCount,
            questionsPreview: localItem.questionsPreview,
            metadata: localItem.metadata,
            originalBase64: localItem.originalBase64 || null,
            standardizedBase64: localItem.standardizedBase64 || null,
            sizeBytes: localItem.sizeBytes,
            isViewed: localItem.isViewed,
          };
          const str = JSON.stringify(payload);
          if (str.length <= 3_800_000) {
            await fetch('/api/workspace-vault', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: str,
            });
          }
        } catch {
          // ignore background re-hydration error
        }
      })();
    }
  }

  const result = Array.from(mergedMap.values()).filter((i) => !deletedIds.has(i.id));
  return result.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
}

export async function markSnapshotAsViewed(id: string, isViewed: boolean = true): Promise<void> {
  // Update local IndexedDB
  try {
    const db = await openCacheDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_ITEMS, 'readwrite');
      const store = tx.objectStore(STORE_ITEMS);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const data = getReq.result;
        if (data) {
          data.isViewed = isViewed;
          store.put(data);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }

  // Update server
  try {
    await fetch('/api/workspace-vault', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isViewed }),
    });
  } catch {
    // ignore
  }
}

export async function removeWorkspaceSnapshots(ids: string[]): Promise<void> {
  if (!ids.length) return;
  addLocalDeletedIds(ids);

  // Local IDB
  try {
    const db = await openCacheDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_ITEMS, 'readwrite');
      const store = tx.objectStore(STORE_ITEMS);
      for (const id of ids) {
        store.delete(id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }

  // Server
  try {
    await fetch('/api/workspace-vault', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
  } catch {
    // ignore
  }
}

export async function clearAllWorkspaceSnapshots(): Promise<void> {
  // Record all currently stored IDs as deleted locally
  try {
    const db = await openCacheDb();
    const existing = await new Promise<WorkspaceSnapshotItem[]>((resolve) => {
      const tx = db.transaction(STORE_ITEMS, 'readonly');
      const req = tx.objectStore(STORE_ITEMS).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
    addLocalDeletedIds(existing.map((i) => i.id));

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_ITEMS, 'readwrite');
      tx.objectStore(STORE_ITEMS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }

  // Server
  try {
    await fetch('/api/workspace-vault', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
  } catch {
    // ignore
  }
}
