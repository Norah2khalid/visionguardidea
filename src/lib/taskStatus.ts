import type { Inspection, InspectionReport, InspectionStatus } from "@/types/domain";

export const TASK_VIEW_STATUSES = ["new", "scheduled", "in_progress", "review", "completed", "overdue", "cancelled"] as const;
export type TaskViewStatus = (typeof TASK_VIEW_STATUSES)[number];

export const taskViewLabel: Record<TaskViewStatus, string> = {
  new: "جديدة",
  scheduled: "مجدولة",
  in_progress: "قيد التنفيذ",
  review: "بانتظار المراجعة",
  completed: "مكتملة",
  overdue: "متأخرة",
  cancelled: "ملغاة",
};

const DONE = new Set<InspectionStatus>(["COMPLETED", "CLOSED"]);

export function taskViewStatus(inspection: Inspection, now = Date.now()): TaskViewStatus {
  if (inspection.status === "CANCELLED") return "cancelled";
  if (DONE.has(inspection.status)) return "completed";
  if (inspection.status === "REVIEW_REQUIRED" || inspection.status === "FOLLOW_UP_REQUIRED") return "review";
  if (inspection.status === "IN_PROGRESS") return "in_progress";
  const planned = inspection.planned_at ? Date.parse(inspection.planned_at) : Number.NaN;
  if (Number.isFinite(planned) && planned < now && (inspection.status === "SCHEDULED" || inspection.status === "READY" || inspection.status === "DRAFT")) {
    return "overdue";
  }
  if (inspection.status === "DRAFT") return "new";
  if (inspection.status === "SCHEDULED" || inspection.status === "READY") return "scheduled";
  return "new";
}

export function isActiveTask(inspection: Inspection, now = Date.now()): boolean {
  const status = taskViewStatus(inspection, now);
  return status !== "completed" && status !== "cancelled";
}

export type ReportQueueStatus = "new" | "in_review" | "complete" | "needs_completion" | "archived";

export const reportQueueLabel: Record<ReportQueueStatus, string> = {
  new: "جديدة",
  in_review: "قيد المراجعة",
  complete: "مكتملة",
  needs_completion: "تحتاج استكمالًا",
  archived: "مؤرشفة",
};

export function reportQueueStatus(inspection: Inspection, reports: InspectionReport[], now = Date.now()): ReportQueueStatus | null {
  const related = reports.filter((report) => report.inspection_id === inspection.id);
  if (inspection.archived_at) return related.length ? "archived" : null;
  if (inspection.status === "REVIEW_REQUIRED" || inspection.status === "FOLLOW_UP_REQUIRED") return "in_review";
  if (["COMPLETED", "CLOSED"].includes(inspection.status) && related.length === 0) return "needs_completion";
  if (related.length === 0) return null;
  const latest = related.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const age = now - Date.parse(latest.created_at);
  if (Number.isFinite(age) && age >= 0 && age < 14 * 24 * 60 * 60 * 1000) return "new";
  return "complete";
}
