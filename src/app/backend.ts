import { createIndexedBlobStore, createIndexedCredentialStore, createIndexedDb, type CredentialStore } from "@/services/db/idb";
import type { DbPort } from "@/services/db/port";
import { createPlatform, type Platform } from "@/services/platform/api";
import { createMemoryStorage, type StoragePort } from "@/services/storage";
import { getSupabase, isSupabaseConfigured } from "@/services/supabase/client";
import { createSupabaseDb, createSupabaseStorage } from "@/services/supabase/db";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface Backend {
  mode: "demo" | "supabase";
  db: DbPort;
  storage: StoragePort;
  platform: Platform;
  credentials: CredentialStore | null;
  supabase: SupabaseClient | null;
}

export async function initBackend(): Promise<Backend> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("تعذر تهيئة Supabase.");
    const db = createSupabaseDb(supabase);
    const storage = createSupabaseStorage(supabase);
    return { mode: "supabase", db, storage, platform: createPlatform({ db, storage }), credentials: null, supabase };
  }
  const db = await createIndexedDb();
  const storage = createMemoryStorage(await createIndexedBlobStore());
  const credentials = await createIndexedCredentialStore();
  return { mode: "demo", db, storage, platform: createPlatform({ db, storage }), credentials, supabase: null };
}
