import { AppError } from "@/lib/errors";
import { formatSequence, nowIso, uid } from "@/lib/ids";
import { can, type Permission } from "@/lib/permissions";
import type { DbPort } from "@/services/db/port";
import type { StoragePort } from "@/services/storage";
import type { Json, RoleCode } from "@/types/domain";

export interface Actor {
  id: string;
  role_code: RoleCode;
  full_name: string;
  email: string;
}

export interface PlatformDeps {
  db: DbPort;
  storage: StoragePort;
}

export function guard(actor: Actor, permission: Permission): void {
  if (!can(actor.role_code, permission)) {
    throw new AppError("forbidden", "ليست لديك صلاحية لهذا الإجراء.");
  }
}

export async function nextCode(db: DbPort, key: string, prefix: string): Promise<string> {
  const year = new Date().getUTCFullYear();
  const id = `${key}:${year}`;
  const existing = await db.get("code_sequences", id);
  const value = (existing?.value ?? 0) + 1;
  if (existing) await db.update("code_sequences", id, { value });
  else await db.insert("code_sequences", { id, value });
  return formatSequence(prefix, year, value);
}

export async function audit(
  db: DbPort,
  actor: Actor | null,
  action: string,
  targetTable: string,
  targetId: string | null,
  metadata: Json = null,
): Promise<void> {
  await db.insert("audit_logs", {
    id: uid(),
    actor_id: actor?.id ?? null,
    action,
    target_table: targetTable,
    target_id: targetId,
    metadata,
    created_at: nowIso(),
  });
}

export function touch(): string {
  return nowIso();
}
