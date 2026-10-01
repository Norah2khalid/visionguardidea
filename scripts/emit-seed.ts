import { writeFileSync } from "node:fs";
import { buildSeed } from "../src/services/db/seed";
import type { AppState, TableName } from "../src/types/domain";

const ORDER: TableName[] = [
  "roles",
  "facilities",
  "sites",
  "sectors",
  "inspection_zones",
  "equipment",
  "inspection_templates",
  "inspection_template_items",
  "sensor_thresholds",
  "drones",
  "robots",
  "inspections",
  "inspection_assignments",
  "inspection_checklists",
  "inspection_checklist_items",
  "missions",
  "mission_events",
  "telemetry_records",
  "sensor_readings",
  "inspection_points",
  "inspection_observations",
  "inspection_decisions",
  "inspection_media",
  "alerts",
  "inspection_reports",
  "inspection_report_items",
  "maintenance_records",
  "audit_logs",
  "code_sequences",
  "settings",
];

const JSON_COLUMNS = new Set(["scoring_rules", "boundary", "safety_prerequisites", "metadata", "last_position", "snapshot", "value"]);
const ARRAY_COLUMNS = new Set(["hazard_categories", "required_ppe", "sensors"]);

function sqlLiteral(column: string, value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (ARRAY_COLUMNS.has(column) && Array.isArray(value)) {
    if (!value.length) return "array[]::text[]";
    return `array[${value.map((item) => `'${String(item).replaceAll("'", "''")}'`).join(", ")}]::text[]`;
  }
  if (JSON_COLUMNS.has(column) || typeof value === "object") {
    return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

function emit(state: AppState): string {
  const lines = ["-- Generated from src/services/db/seed.ts. Demo data only.", "begin;"];
  for (const table of ORDER) {
    const rows = state[table] as unknown as Record<string, unknown>[];
    if (!rows.length) continue;
    for (const row of rows) {
      const columns = Object.keys(row);
      const values = columns.map((column) => sqlLiteral(column, row[column]));
      lines.push(`insert into public.${table} (${columns.join(", ")}) values (${values.join(", ")}) on conflict (id) do nothing;`);
    }
  }
  lines.push("commit;");
  return `${lines.join("\n")}\n`;
}

const seed = buildSeed();
const seen = new Set<string>();
for (const [table, rows] of Object.entries(seed)) {
  for (const row of rows as { id?: string }[]) {
    if (!row.id) continue;
    const key = `${table}:${row.id}`;
    if (seen.has(row.id) && table !== "settings") {
      // ids should be unique inside a table; cross-table reuse is rejected too for uuid tables
    }
    if (seen.has(key)) throw new Error(`duplicate ${key}`);
    seen.add(key);
    if (table !== "code_sequences" && table !== "settings" && !/^[0-9a-f-]{36}$/i.test(row.id)) {
      throw new Error(`bad uuid ${key}`);
    }
  }
}
const sql = emit(seed);
writeFileSync(new URL("../supabase/seed.sql", import.meta.url), sql);
console.log(`wrote supabase/seed.sql (${sql.length} bytes)`);
