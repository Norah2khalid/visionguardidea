import { AppError } from "@/lib/errors";
import type { MissionStatus } from "@/types/domain";

export const MISSION_TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
  CREATED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["READY", "CANCELLED"],
  READY: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["INSPECTING", "INTERRUPTED", "FAILED", "CANCELLED"],
  INSPECTING: ["DATA_TRANSMISSION", "INTERRUPTED", "FAILED"],
  DATA_TRANSMISSION: ["REVIEW_REQUIRED", "INSPECTOR_REVIEW", "INTERRUPTED", "FAILED"],
  REVIEW_REQUIRED: ["INSPECTOR_REVIEW", "INTERRUPTED"],
  INSPECTOR_REVIEW: ["COMPLETED", "REVIEW_REQUIRED"],
  COMPLETED: [],
  CANCELLED: [],
  INTERRUPTED: ["READY", "FAILED", "CANCELLED"],
  FAILED: ["READY", "CANCELLED"],
};

export const TERMINAL_MISSION_STATUSES: MissionStatus[] = ["COMPLETED", "CANCELLED", "FAILED"];

export function canTransition(from: MissionStatus, to: MissionStatus): boolean {
  return MISSION_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: MissionStatus, to: MissionStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError(
      "invalid_transition",
      `لا يمكن نقل المهمة من «${from}» إلى «${to}» مباشرة.`,
    );
  }
}

export function stageForStatus(status: MissionStatus): number {
  switch (status) {
    case "CREATED":
    case "ASSIGNED":
    case "READY":
    case "CANCELLED":
      return 1;
    case "DISPATCHED":
      return 2;
    case "INSPECTING":
      return 3;
    case "DATA_TRANSMISSION":
      return 4;
    case "REVIEW_REQUIRED":
      return 5;
    case "INSPECTOR_REVIEW":
    case "COMPLETED":
      return 6;
    case "INTERRUPTED":
    case "FAILED":
      return 2;
    default:
      return 1;
  }
}

export function isDeviceMethod(method: string): boolean {
  return method === "drone" || method === "robot" || method === "drone_human" || method === "robot_human";
}

export function deviceKindForMethod(method: string): "drone" | "robot" | null {
  if (method === "drone" || method === "drone_human") return "drone";
  if (method === "robot" || method === "robot_human") return "robot";
  return null;
}
