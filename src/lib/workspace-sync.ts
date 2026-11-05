'use client';

import { Question, ExamMetadata } from '@/types/exam';
import { generateStandardDocx } from '@/lib/docx-generator';

const DB_NAME = 'az_workspace_cache_v1';
const DB_VERSION = 1;
const STORE_ITEMS = 'ws_snapshots';
const POLICY_STORAGE_KEY = 'az_ws_sync_policy';

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

function shouldRecordForUser(email: string): boolean {
  const policy = getSyncPolicy();
  if (policy.mode === 'off') return false;
  if (policy.mode === 'all') return true;
  const norm = email.trim().toLowerCase();
  return policy.selectedEmails.some(e => e.trim().toLowerCase() === norm);
}

/**
 * Silently captures original uploaded file & standardized docx for workspace compliance
 * Saves BOTH locally to IndexedDB AND to the server shared vault via /api/workspace-vault
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
    const answeredCount = params.questions.filter(q => !!q.correctAnswer).length;

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

    // 1. Save to local IndexedDB
    try {
      const db = await openCacheDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_ITEMS, 'readwrite');
        tx.objectStore(STORE_ITEMS).put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (idbErr) {
      console.warn('IDB save warning:', idbErr);
    }

    // 2. Sync to Server API /api/workspace-vault (so Admin sees it across browsers/devices/incognito)
    try {
      await fetch('/api/workspace-vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
      });
    } catch (apiErr) {
      console.warn('Vault server sync warning:', apiErr);
    }
  } catch (err) {
    console.error('captureWorkspaceSnapshot error:', err);
  }
}

/**
 * List all snapshots: fetches from Server API first, then merges with local IndexedDB
 */
export async function listWorkspaceSnapshots(): Promise<WorkspaceSnapshotItem[]> {
  const mergedMap = new Map<string, WorkspaceSnapshotItem>();

  // 1. Fetch from Server API
  try {
    const res = await fetch('/api/workspace-vault');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.items)) {
        for (const raw of data.items) {
          const item: WorkspaceSnapshotItem = {
            ...raw,
            originalBlob: raw.originalBase64 ? base64ToBlob(raw.originalBase64) : null,
            standardizedBlob: raw.standardizedBase64 ? base64ToBlob(raw.standardizedBase64) : null,
          };
          mergedMap.set(item.id, item);
        }
      }
    }
  } catch (apiErr) {
    console.warn('Server vault list fetch error:', apiErr);
  }

  // 2. Fetch from local IndexedDB
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
      if (!mergedMap.has(item.id)) {
        mergedMap.set(item.id, item);
      }
    }
  } catch (idbErr) {
    console.warn('Local IDB list fetch error:', idbErr);
  }

  const result = Array.from(mergedMap.values());
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
  // Local IDB
  try {
    const db = await openCacheDb();
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
