import type {
  Inspection,
  InspectionChecklistItem,
  InspectionDecision,
  InspectionPoint,
  Mission,
  Profile,
} from "@/types/domain";
import { isDeviceMethod } from "@/lib/missionState";
import { scoreChecklist } from "@/lib/scoring";

export interface RuleResult {
  ok: boolean;
  reasons: string[];
}

export function canFinalizeInspection(input: {
  inspection: Inspection;
  items: InspectionChecklistItem[];
  points: InspectionPoint[];
  decisions: InspectionDecision[];
  missions: Mission[];
  actor: Pick<Profile, "role_code">;
}): RuleResult {
  const reasons: string[] = [];
  const { inspection, items, points, decisions, missions, actor } = input;
  if (actor.role_code === "OPERATOR") {
    reasons.push("إغلاق التفتيش متاح للمفتش أو مدير النظام.");
  }
  if (inspection.status === "CANCELLED" || inspection.status === "CLOSED") {
    reasons.push("التفتيش ملغى أو مغلق.");
  }
  if (inspection.status === "COMPLETED" || inspection.status === "FOLLOW_UP_REQUIRED") {
    reasons.push("التفتيش مُنهى مسبقًا.");
  }
  const score = scoreChecklist(items);
  if (score.unanswered > 0) {
    reasons.push("توجد بنود قائمة لم تُجب بعد.");
  }
  const openPoints = points.filter((point) => point.review_status === "pending");
  if (openPoints.length) {
    reasons.push("توجد نقاط فحص بانتظار قرار المفتش.");
  }
  if (score.hasCriticalFailure) {
    const addressed = decisions.some((decision) => decision.action === "follow_up" || decision.action === "maintenance" || decision.action === "close" || decision.action === "confirm");
    if (!addressed) {
      reasons.push("بند حرج غير مطابق يحتاج قرارًا موثقًا قبل الإنهاء.");
    }
  }
  if (isDeviceMethod(inspection.method)) {
    const mission = missions.find((item) => item.inspection_id === inspection.id && item.status !== "CANCELLED" && item.status !== "FAILED");
    if (!mission) {
      reasons.push("لا توجد مهمة جهاز مرتبطة بهذا التفتيش.");
    } else if (mission.status !== "INSPECTOR_REVIEW" && mission.status !== "COMPLETED") {
      reasons.push("يجب أن تصل المهمة إلى مراجعة المفتش قبل إنهاء التفتيش.");
    }
  }
  return { ok: reasons.length === 0, reasons };
}

export function completionStatus(decisions: Pick<InspectionDecision, "action">[]): "COMPLETED" | "FOLLOW_UP_REQUIRED" {
  const follow = decisions.some((decision) => decision.action === "follow_up" || decision.action === "reinspect" || decision.action === "maintenance");
  return follow ? "FOLLOW_UP_REQUIRED" : "COMPLETED";
}

export function canCompleteMission(input: {
  status: Mission["status"];
  points: Pick<InspectionPoint, "review_status">[];
}): RuleResult {
  const reasons: string[] = [];
  if (input.status !== "INSPECTOR_REVIEW") {
    reasons.push("إكمال المهمة متاح فقط بعد مراجعة المفتش.");
  }
  if (input.points.some((point) => point.review_status === "pending")) {
    reasons.push("توجد نقاط لم يُسجَّل لها قرار.");
  }
  return { ok: reasons.length === 0, reasons };
}
