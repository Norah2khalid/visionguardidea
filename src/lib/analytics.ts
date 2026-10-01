import type { Alert, Drone, Inspection, InspectionDecision, InspectionPoint, Mission, MissionEvent, Robot } from "@/types/domain";

export interface DurationStats {
  averageMs: number | null;
  sampleSize: number;
}

function average(values: number[]): DurationStats {
  if (!values.length) return { averageMs: null, sampleSize: 0 };
  const total = values.reduce((sum, value) => sum + value, 0);
  return { averageMs: total / values.length, sampleSize: values.length };
}

export function inspectionCycle(inspections: Pick<Inspection, "started_at" | "completed_at">[]): DurationStats {
  const values = inspections
    .filter((item) => item.started_at && item.completed_at)
    .map((item) => Date.parse(item.completed_at!) - Date.parse(item.started_at!))
    .filter((value) => Number.isFinite(value) && value >= 0);
  return average(values);
}

export function missionDuration(missions: Pick<Mission, "started_at" | "completed_at" | "status">[]): DurationStats {
  const values = missions
    .filter((item) => item.status === "COMPLETED" && item.started_at && item.completed_at)
    .map((item) => Date.parse(item.completed_at!) - Date.parse(item.started_at!))
    .filter((value) => Number.isFinite(value) && value >= 0);
  return average(values);
}

export function reviewDuration(
  events: Pick<MissionEvent, "mission_id" | "to_status" | "created_at">[],
  decisions: Pick<InspectionDecision, "inspection_id" | "decided_at">[],
  missions: Pick<Mission, "id" | "inspection_id">[],
): DurationStats {
  const values: number[] = [];
  for (const mission of missions) {
    const start = events
      .filter((event) => event.mission_id === mission.id && event.to_status === "REVIEW_REQUIRED")
      .map((event) => Date.parse(event.created_at))
      .sort((a, b) => a - b)[0];
    const decision = decisions
      .filter((item) => item.inspection_id === mission.inspection_id)
      .map((item) => Date.parse(item.decided_at))
      .sort((a, b) => a - b)[0];
    if (start != null && decision != null && decision >= start) values.push(decision - start);
  }
  return average(values);
}

export function followUpRate(inspections: Pick<Inspection, "status">[]): { rate: number | null; sampleSize: number } {
  const finished = inspections.filter((item) => item.status === "COMPLETED" || item.status === "FOLLOW_UP_REQUIRED" || item.status === "CLOSED");
  if (!finished.length) return { rate: null, sampleSize: 0 };
  const follow = finished.filter((item) => item.status === "FOLLOW_UP_REQUIRED").length;
  return { rate: follow / finished.length, sampleSize: finished.length };
}

export function pointResolutionTime(
  points: Pick<InspectionPoint, "id" | "created_at" | "review_status">[],
  decisions: Pick<InspectionDecision, "point_id" | "decided_at">[],
): DurationStats {
  const values: number[] = [];
  for (const point of points) {
    if (point.review_status === "pending") continue;
    const decision = decisions.find((item) => item.point_id === point.id);
    if (!decision) continue;
    const delta = Date.parse(decision.decided_at) - Date.parse(point.created_at);
    if (delta >= 0) values.push(delta);
  }
  return average(values);
}

export function deviceUtilization(missions: Pick<Mission, "device_id" | "status">[], devices: { id: string }[]): { deviceId: string; missions: number; share: number | null }[] {
  const considered = missions.filter((mission) => mission.device_id && mission.status !== "CANCELLED");
  return devices.map((device) => {
    const count = considered.filter((mission) => mission.device_id === device.id).length;
    return {
      deviceId: device.id,
      missions: count,
      share: considered.length ? count / considered.length : null,
    };
  });
}

export interface DashboardMetrics {
  activeInspections: number;
  completedInspections: number;
  missionsInProgress: number;
  highRiskZones: number;
  unresolvedAlerts: number;
  availableDrones: number;
  availableRobots: number;
  averageInspectionMs: number | null;
  inspectionSampleSize: number;
  followUpRate: number | null;
}

const ACTIVE_INSPECTION = new Set(["SCHEDULED", "READY", "IN_PROGRESS", "REVIEW_REQUIRED", "DRAFT"]);
const LIVE_MISSION = new Set(["DISPATCHED", "INSPECTING", "DATA_TRANSMISSION", "REVIEW_REQUIRED", "INSPECTOR_REVIEW"]);

export function dashboardMetrics(input: {
  inspections: Pick<Inspection, "status" | "started_at" | "completed_at">[];
  missions: Pick<Mission, "status">[];
  highRiskZones: number;
  alerts: Pick<Alert, "resolution_status">[];
  drones: Pick<Drone, "operational_status">[];
  robots: Pick<Robot, "operational_status">[];
}): DashboardMetrics {
  const cycle = inspectionCycle(input.inspections);
  const follow = followUpRate(input.inspections);
  return {
    activeInspections: input.inspections.filter((item) => ACTIVE_INSPECTION.has(item.status)).length,
    completedInspections: input.inspections.filter((item) => item.status === "COMPLETED" || item.status === "CLOSED").length,
    missionsInProgress: input.missions.filter((item) => LIVE_MISSION.has(item.status)).length,
    highRiskZones: input.highRiskZones,
    unresolvedAlerts: input.alerts.filter((item) => item.resolution_status !== "resolved").length,
    availableDrones: input.drones.filter((item) => item.operational_status === "available").length,
    availableRobots: input.robots.filter((item) => item.operational_status === "available").length,
    averageInspectionMs: cycle.averageMs,
    inspectionSampleSize: cycle.sampleSize,
    followUpRate: follow.rate,
  };
}

export function formatDuration(ms: number | null): string {
  if (ms == null) return "لا توجد بيانات كافية";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} د`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} س ${rest} د` : `${hours} س`;
}
