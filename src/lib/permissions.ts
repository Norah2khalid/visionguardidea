import type { RoleCode } from "@/types/domain";

export const PERMISSIONS = [
  "dashboard.view",
  "inspections.view",
  "inspections.create",
  "inspections.update",
  "inspections.cancel",
  "inspections.complete",
  "checklists.fill",
  "decisions.record",
  "reports.view",
  "reports.generate",
  "missions.view",
  "missions.create",
  "missions.operate",
  "missions.review",
  "facilities.view",
  "facilities.manage",
  "zones.view",
  "zones.manage",
  "equipment.view",
  "equipment.manage",
  "devices.view",
  "devices.manage",
  "telemetry.view",
  "alerts.view",
  "alerts.manage",
  "history.view",
  "users.manage",
  "settings.manage",
  "templates.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const INSPECTOR: Permission[] = [
  "dashboard.view",
  "inspections.view",
  "inspections.create",
  "inspections.update",
  "inspections.cancel",
  "inspections.complete",
  "checklists.fill",
  "decisions.record",
  "reports.view",
  "reports.generate",
  "missions.view",
  "missions.create",
  "missions.operate",
  "missions.review",
  "facilities.view",
  "zones.view",
  "equipment.view",
  "devices.view",
  "telemetry.view",
  "alerts.view",
  "history.view",
];

const OPERATOR: Permission[] = [
  "dashboard.view",
  "inspections.view",
  "missions.view",
  "missions.operate",
  "facilities.view",
  "zones.view",
  "equipment.view",
  "devices.view",
  "telemetry.view",
  "alerts.view",
  "alerts.manage",
  "history.view",
  "reports.view",
];

const MATRIX: Record<RoleCode, readonly Permission[] | "*"> = {
  ADMIN: "*",
  INSPECTOR,
  OPERATOR,
};

export function can(role: RoleCode | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const allowed = MATRIX[role];
  if (allowed === "*") return true;
  return allowed.includes(permission);
}

export function canAny(role: RoleCode | null | undefined, permissions: Permission[]): boolean {
  return permissions.some((permission) => can(role, permission));
}
