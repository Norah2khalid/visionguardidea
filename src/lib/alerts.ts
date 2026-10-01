import type { Alert, AlertCategory, Inspection, SensorReading, SensorThreshold, Severity } from "@/types/domain";
import { interpretReading } from "@/lib/sensors";

export interface AlertDraft {
  category: AlertCategory;
  severity: Severity;
  message: string;
  facility_id: string | null;
  device_id: string | null;
  device_kind: "drone" | "robot" | null;
  mission_id: string | null;
  inspection_id: string | null;
  dedupe_key: string;
}

export function batteryAlert(device: { id: string; kind: "drone" | "robot"; code: string; battery: number }): AlertDraft | null {
  if (device.battery >= 20) return null;
  return {
    category: "low_battery",
    severity: device.battery < 10 ? "critical" : "high",
    message: `بطارية ${device.code} منخفضة (${device.battery}%).`,
    facility_id: null,
    device_id: device.id,
    device_kind: device.kind,
    mission_id: null,
    inspection_id: null,
    dedupe_key: `low_battery:${device.id}`,
  };
}

export function thresholdAlert(reading: SensorReading, threshold: SensorThreshold | null): AlertDraft | null {
  const interpretation = interpretReading(reading, threshold);
  if (interpretation.label !== "تجاوز الحد الأعلى" && interpretation.label !== "دون الحد الأدنى") return null;
  return {
    category: "threshold_exceeded",
    severity: interpretation.label === "تجاوز الحد الأعلى" ? "high" : "medium",
    message: `${reading.measurement_type}: ${interpretation.label} (${reading.numeric_value} ${reading.unit}).`,
    facility_id: null,
    device_id: null,
    device_kind: null,
    mission_id: reading.mission_id,
    inspection_id: null,
    dedupe_key: `threshold:${reading.id}`,
  };
}

export function overdueAlert(inspection: Inspection, now: number): AlertDraft | null {
  if (!inspection.planned_at) return null;
  if (inspection.status !== "SCHEDULED" && inspection.status !== "READY" && inspection.status !== "DRAFT") return null;
  if (Date.parse(inspection.planned_at) >= now) return null;
  return {
    category: "inspection_overdue",
    severity: "medium",
    message: `التفتيش ${inspection.code} تجاوز الموعد المخطط.`,
    facility_id: inspection.facility_id,
    device_id: null,
    device_kind: null,
    mission_id: null,
    inspection_id: inspection.id,
    dedupe_key: `overdue:${inspection.id}`,
  };
}

export function pointReviewAlert(input: {
  pointCode: string;
  inspectionId: string;
  facilityId: string;
  missionId: string | null;
  description: string;
}): AlertDraft {
  return {
    category: "point_review",
    severity: "medium",
    message: `نقطة تحتاج فحصًا ${input.pointCode}: ${input.description}`,
    facility_id: input.facilityId,
    device_id: null,
    device_kind: null,
    mission_id: input.missionId,
    inspection_id: input.inspectionId,
    dedupe_key: `point:${input.pointCode}`,
  };
}

export function missingAlerts(existing: Pick<Alert, "dedupe_key" | "resolution_status">[], drafts: AlertDraft[]): AlertDraft[] {
  const openKeys = new Set(
    existing.filter((alert) => alert.resolution_status !== "resolved" && alert.dedupe_key).map((alert) => alert.dedupe_key),
  );
  return drafts.filter((draft) => !openKeys.has(draft.dedupe_key));
}

export function canResolve(status: Alert["resolution_status"]): boolean {
  return status !== "resolved";
}
