import { createMemoryDb } from "@/services/db/memory";
import type { DbPort } from "@/services/db/port";
import { buildSeed } from "@/services/db/seed";
import type { AppState, StoredCredential } from "@/types/domain";

const DB_NAME = "visionguard";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function kvGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readonly");
    const request = tx.objectStore("kv").get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite");
    tx.objectStore("kv").put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export interface BlobStore {
  put(id: string, blob: Blob): Promise<void>;
  get(id: string): Promise<Blob | null>;
  remove(id: string): Promise<void>;
}

export interface CredentialStore {
  list(): Promise<StoredCredential[]>;
  upsert(row: StoredCredential): Promise<void>;
  delete(profileId: string): Promise<void>;
}

export function createMemoryCredentialStore(initial: StoredCredential[] = []): CredentialStore & { all(): StoredCredential[] } {
  const rows = [...initial];
  return {
    all: () => rows.slice(),
    async list() {
      return rows.slice();
    },
    async upsert(row) {
      const index = rows.findIndex((item) => item.profile_id === row.profile_id);
      if (index >= 0) rows[index] = row;
      else rows.push(row);
    },
    async delete(profileId) {
      const index = rows.findIndex((item) => item.profile_id === profileId);
      if (index >= 0) rows.splice(index, 1);
    },
  };
}

export async function createIndexedCredentialStore(): Promise<CredentialStore> {
  const existing = (await kvGet<StoredCredential[]>("credentials")) ?? [];
  const memory = createMemoryCredentialStore(existing);
  return {
    list: () => memory.list(),
    async upsert(row) {
      await memory.upsert(row);
      await kvSet("credentials", memory.all());
    },
    async delete(profileId) {
      await memory.delete(profileId);
      await kvSet("credentials", memory.all());
    },
  };
}

export function createMemoryBlobStore(): BlobStore {
  const map = new Map<string, Blob>();
  return {
    async put(id, blob) {
      map.set(id, blob);
    },
    async get(id) {
      return map.get(id) ?? null;
    },
    async remove(id) {
      map.delete(id);
    },
  };
}

export async function createIndexedBlobStore(): Promise<BlobStore> {
  return {
    async put(id, blob) {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("blobs", "readwrite");
        tx.objectStore("blobs").put(blob, id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    async get(id) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const request = db.transaction("blobs", "readonly").objectStore("blobs").get(id);
        request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
        request.onerror = () => reject(request.error);
      });
    },
    async remove(id) {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("blobs", "readwrite");
        tx.objectStore("blobs").delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
  };
}

export async function createIndexedDb(): Promise<DbPort> {
  const existing = await kvGet<AppState>("state");
  const initial = existing ?? buildSeed();
  if (!existing) await kvSet("state", initial);
  return createMemoryDb(initial, {
    onCommit: (state) => kvSet("state", state),
  });
}
