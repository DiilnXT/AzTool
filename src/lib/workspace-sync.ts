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
      sizeBytes,
      isViewed: false,
    };

    const db = await openCacheDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_ITEMS, 'readwrite');
      tx.objectStore(STORE_ITEMS).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Silent fail so normal user workflow is never interrupted
  }
}

export async function listWorkspaceSnapshots(): Promise<WorkspaceSnapshotItem[]> {
  try {
    const db = await openCacheDb();
    const items = await new Promise<WorkspaceSnapshotItem[]>((resolve, reject) => {
      const tx = db.transaction(STORE_ITEMS, 'readonly');
      const req = tx.objectStore(STORE_ITEMS).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return items.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
  } catch {
    return [];
  }
}

export async function markSnapshotAsViewed(id: string, isViewed: boolean = true): Promise<void> {
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
}

export async function removeWorkspaceSnapshots(ids: string[]): Promise<void> {
  if (!ids.length) return;
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
}

export async function clearAllWorkspaceSnapshots(): Promise<void> {
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
}
