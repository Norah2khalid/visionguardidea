import { AppError } from "@/lib/errors";
import { nowIso, uid } from "@/lib/ids";
import { assertPasswordPolicy, hashPassword, randomSalt } from "@/lib/password";
import { can } from "@/lib/permissions";
import type { CredentialStore } from "@/services/db/idb";
import type { DbPort } from "@/services/db/port";
import type { Actor } from "@/services/platform/context";
import { audit } from "@/services/platform/context";
import type { Profile, RoleCode } from "@/types/domain";

const SESSION_KEY = "visionguard.session.v1";

export interface DemoSession {
  profileId: string;
  exp: number;
}

export function readDemoSession(): DemoSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoSession;
    if (!parsed.profileId || parsed.exp < Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeDemoSession(profileId: string): void {
  const value: DemoSession = { profileId, exp: Date.now() + 12 * 60 * 60 * 1000 };
  localStorage.setItem(SESSION_KEY, JSON.stringify(value));
}

export function clearDemoSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

const DEMO_HOLD_KEY = "visionguard.demo.hold";

export function holdDemoEntry(): void {
  sessionStorage.setItem(DEMO_HOLD_KEY, "1");
}

export function clearDemoHold(): void {
  sessionStorage.removeItem(DEMO_HOLD_KEY);
}

export function isDemoHeld(): boolean {
  return sessionStorage.getItem(DEMO_HOLD_KEY) === "1";
}

/** Demo mode only: open the stored workspace without a password. Production auth is unchanged. */
export async function openDemoSession(db: DbPort): Promise<Profile> {
  const existing = readDemoSession();
  if (existing) {
    const profile = await db.get("profiles", existing.profileId);
    if (profile?.is_active) return profile;
  }
  const profiles = await db.list("profiles");
  const active = profiles.find((profile) => profile.is_active && profile.role_code === "ADMIN") ?? profiles.find((profile) => profile.is_active);
  if (active) {
    writeDemoSession(active.id);
    return active;
  }
  const stamp = nowIso();
  const profile: Profile = {
    id: uid(),
    full_name: "عرض تجريبي",
    email: "demo@visionguard.local",
    role_code: "ADMIN",
    is_active: true,
    created_at: stamp,
    updated_at: stamp,
  };
  await db.insert("profiles", profile);
  await audit(db, { id: profile.id, role_code: "ADMIN", full_name: profile.full_name, email: profile.email }, "user.demo_opened", "profiles", profile.id, null);
  writeDemoSession(profile.id);
  return profile;
}

export async function hasActiveAdmin(db: DbPort): Promise<boolean> {
  const profiles = await db.list("profiles");
  return profiles.some((profile) => profile.role_code === "ADMIN" && profile.is_active);
}

export async function demoSignIn(db: DbPort, credentials: CredentialStore, email: string, password: string): Promise<Profile> {
  const rows = await credentials.list();
  const credential = rows.find((row) => row.email.toLowerCase() === email.trim().toLowerCase());
  if (!credential) throw new AppError("auth", "بيانات الدخول غير صحيحة.");
  const hash = await hashPassword(password, credential.salt);
  if (hash !== credential.password_hash) throw new AppError("auth", "بيانات الدخول غير صحيحة.");
  const profile = await db.get("profiles", credential.profile_id);
  if (!profile || !profile.is_active) throw new AppError("auth", "الحساب غير نشط.");
  writeDemoSession(profile.id);
  return profile;
}

export async function bootstrapDemoAdmin(
  db: DbPort,
  credentials: CredentialStore,
  input: { fullName: string; email: string; password: string },
): Promise<Profile> {
  if (await hasActiveAdmin(db)) throw new AppError("auth", "يوجد مدير بالفعل. استخدم تسجيل الدخول.");
  assertPasswordPolicy(input.password);
  const email = input.email.trim().toLowerCase();
  const salt = randomSalt();
  const passwordHash = await hashPassword(input.password, salt);
  const stamp = nowIso();
  const profile: Profile = {
    id: uid(),
    full_name: input.fullName.trim(),
    email,
    role_code: "ADMIN",
    is_active: true,
    created_at: stamp,
    updated_at: stamp,
  };
  await db.insert("profiles", profile);
  await credentials.upsert({ profile_id: profile.id, email, salt, password_hash: passwordHash });
  await audit(db, { id: profile.id, role_code: "ADMIN", full_name: profile.full_name, email }, "user.bootstrapped", "profiles", profile.id, null);
  writeDemoSession(profile.id);
  return profile;
}

export async function createDemoUser(
  db: DbPort,
  credentials: CredentialStore,
  actor: Actor,
  input: { fullName: string; email: string; password: string; role: RoleCode },
): Promise<Profile> {
  if (!can(actor.role_code, "users.manage")) throw new AppError("forbidden", "ليست لديك صلاحية لهذا الإجراء.");
  assertPasswordPolicy(input.password);
  const email = input.email.trim().toLowerCase();
  const existing = (await credentials.list()).some((row) => row.email.toLowerCase() === email);
  if (existing) throw new AppError("duplicate", "البريد مستخدم.");
  const salt = randomSalt();
  const passwordHash = await hashPassword(input.password, salt);
  const stamp = nowIso();
  const profile: Profile = {
    id: uid(),
    full_name: input.fullName.trim(),
    email,
    role_code: input.role,
    is_active: true,
    created_at: stamp,
    updated_at: stamp,
  };
  await db.insert("profiles", profile);
  await credentials.upsert({ profile_id: profile.id, email, salt, password_hash: passwordHash });
  await audit(db, actor, "user.created", "profiles", profile.id, { role: input.role });
  return profile;
}

export async function updateDemoUser(
  db: DbPort,
  actor: Actor,
  profileId: string,
  patch: { role_code?: RoleCode; is_active?: boolean; full_name?: string },
): Promise<Profile> {
  if (!can(actor.role_code, "users.manage")) throw new AppError("forbidden", "ليست لديك صلاحية لهذا الإجراء.");
  const profiles = await db.list("profiles");
  const target = profiles.find((item) => item.id === profileId);
  if (!target) throw new AppError("not_found", "المستخدم غير موجود.");
  const admins = profiles.filter((item) => item.role_code === "ADMIN" && item.is_active);
  const demotingLastAdmin = target.role_code === "ADMIN" && target.is_active && admins.length === 1 && (patch.role_code && patch.role_code !== "ADMIN" || patch.is_active === false);
  if (demotingLastAdmin) throw new AppError("invalid_state", "لا يمكن إزالة آخر مدير نشط.");
  const updated = await db.update("profiles", profileId, { ...patch, updated_at: nowIso() });
  await audit(db, actor, "user.permissions_changed", "profiles", profileId, patch as never);
  return updated;
}
