import type { SupabaseClient } from "@supabase/supabase-js";
import type { DbPort, ListOptions } from "@/services/db/port";
import type { AppState, DatabaseSchema, TableName } from "@/types/domain";

const TABLES: TableName[] = [
  "roles",
  "profiles",
  "facilities",
  "sites",
  "sectors",
  "inspection_zones",
  "equipment",
  "inspection_templates",
  "inspection_template_items",
  "inspections",
  "inspection_assignments",
  "inspection_checklists",
  "inspection_checklist_items",
  "missions",
  "mission_events",
  "drones",
  "robots",
  "telemetry_records",
  "sensor_thresholds",
  "sensor_readings",
  "inspection_media",
  "inspection_points",
  "inspection_observations",
  "inspection_decisions",
  "alerts",
  "inspection_reports",
  "inspection_report_items",
  "maintenance_records",
  "audit_logs",
  "code_sequences",
  "settings",
];

interface LooseQuery {
  select: (columns?: string) => LooseQuery;
  eq: (column: string, value: string | number | boolean) => LooseQuery;
  is: (column: string, value: null) => LooseQuery;
  order: (column: string, options: { ascending: boolean }) => LooseQuery;
  limit: (count: number) => LooseQuery;
  insert: (row: unknown) => LooseQuery;
  update: (patch: unknown) => LooseQuery;
  delete: () => LooseQuery;
  single: () => Promise<{ data: unknown; error: { message: string } | null }>;
  then: PromiseLike<{ data: unknown; error: { message: string } | null }>["then"];
}

function from(client: SupabaseClient, table: string): LooseQuery {
  return (client as unknown as { from: (name: string) => LooseQuery }).from(table);
}

async function unwrap<T>(query: LooseQuery | Promise<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export function createSupabaseDb(client: SupabaseClient): DbPort {
  const api: DbPort = {
    async list(table, options) {
      let query = from(client, table).select("*");
      if (options?.filters) {
        for (const [key, value] of Object.entries(options.filters)) {
          query = value === null ? query.is(key, null) : query.eq(key, value as string | number | boolean);
        }
      }
      if (options?.orderBy) query = query.order(options.orderBy, { ascending: !options.descending });
      if (options?.limit) query = query.limit(options.limit);
      return (await unwrap<DatabaseSchema[typeof table]>(query)) ?? ([] as never);
    },
    async get(table, id) {
      const query = from(client, table).select("*").eq("id", id);
      const rows = (await unwrap<unknown[]>(query)) ?? [];
      return (rows[0] as never) ?? null;
    },
    async insert(table, row) {
      const query = from(client, table).insert(row).select("*").single();
      return unwrap(query);
    },
    async update(table, id, patch) {
      const query = from(client, table).update(patch).eq("id", id).select("*").single();
      return unwrap(query);
    },
    async remove(table, id) {
      const query = from(client, table).delete().eq("id", id);
      await unwrap(query);
    },
    transaction(fn) {
      return fn(api);
    },
    subscribe(listener) {
      const channel = client
        .channel("visionguard-changes")
        .on("postgres_changes", { event: "*", schema: "public" }, () => listener())
        .subscribe();
      return () => {
        void client.removeChannel(channel);
      };
    },
    async dump() {
      const entries = await Promise.all(TABLES.map(async (table) => [table, await api.list(table)] as const));
      return Object.fromEntries(entries) as unknown as AppState;
    },
    async replace() {
      throw new Error("استبدال قاعدة البيانات بالكامل متاح في وضع العرض المحلي فقط.");
    },
  };
  void (null as unknown as ListOptions);
  return api;
}

export function createSupabaseStorage(client: SupabaseClient) {
  return {
    async save(file: Blob, objectPath: string) {
      const bucket = client.storage.from("inspection-media");
      const { error } = await bucket.upload(objectPath, file, { upsert: false, contentType: file.type });
      if (error) throw new Error(error.message);
      return objectPath;
    },
    async resolve(storagePath: string) {
      if (storagePath.startsWith("data:") || storagePath.startsWith("http")) return storagePath;
      const { data, error } = await client.storage.from("inspection-media").createSignedUrl(storagePath, 60 * 30);
      if (error || !data?.signedUrl) throw new Error(error?.message ?? "تعذر إنشاء رابط الملف.");
      return data.signedUrl;
    },
  };
}
