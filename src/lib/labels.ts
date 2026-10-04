import type {
  AlertCategory,
  ChecklistResponse,
  DecisionAction,
  DeviceStatus,
  InspectionMethod,
  InspectionStatus,
  MissionStatus,
  PointCategory,
  RiskLevel,
  RoleCode,
  Severity,
} from "@/types/domain";

export const inspectionStatusLabel: Record<InspectionStatus, string> = {
  DRAFT: "مسودة",
  SCHEDULED: "مجدول",
  READY: "جاهز",
  IN_PROGRESS: "قيد التنفيذ",
  REVIEW_REQUIRED: "بانتظار المراجعة",
  COMPLETED: "مكتمل",
  FOLLOW_UP_REQUIRED: "يتطلب متابعة",
  CLOSED: "مغلق",
  CANCELLED: "ملغى",
};

export const missionStatusLabel: Record<MissionStatus, string> = {
  CREATED: "أُنشئت",
  ASSIGNED: "مُسندة",
  READY: "جاهزة",
  DISPATCHED: "أُرسل الجهاز",
  INSPECTING: "جارٍ المسح",
  DATA_TRANSMISSION: "إرسال البيانات",
  REVIEW_REQUIRED: "بانتظار المراجعة",
  INSPECTOR_REVIEW: "مراجعة المفتش",
  COMPLETED: "مكتملة",
  CANCELLED: "ملغاة",
  INTERRUPTED: "متوقفة",
  FAILED: "فشلت",
};

export const methodLabel: Record<InspectionMethod, string> = {
  human: "مفتش بشري",
  drone: "درون",
  robot: "روبوت",
  drone_human: "درون مع مراجعة بشرية",
  robot_human: "روبوت مع مراجعة بشرية",
};

export const riskLabel: Record<RiskLevel, string> = {
  normal: "عادي",
  medium: "متوسط",
  high: "مرتفع",
};

export const deviceStatusLabel: Record<DeviceStatus, string> = {
  available: "متاح",
  reserved: "محجوز",
  on_mission: "في مهمة",
  charging: "يشحن",
  maintenance: "صيانة",
  offline: "غير متصل",
  fault: "عطل",
};

export const responseLabel: Record<ChecklistResponse, string> = {
  pass: "مطابق",
  fail: "غير مطابق",
  needs_review: "يحتاج مراجعة",
  not_applicable: "لا ينطبق",
};

export const decisionLabel: Record<DecisionAction, string> = {
  confirm: "تأكيد الملاحظة",
  reject: "رفض الملاحظة",
  follow_up: "طلب متابعة",
  maintenance: "إحالة للصيانة",
  reinspect: "طلب تفتيش آخر",
  close: "إغلاق الملاحظة",
};

export const pointCategoryLabel: Record<PointCategory, string> = {
  possible_leak: "احتمال تسريب",
  possible_corrosion: "مؤشر تآكل",
  visible_damage: "ضرر ظاهر",
  unusual_reading: "قراءة غير معتادة",
  equipment_condition: "حالة معدة",
  manual_observation: "ملاحظة يدوية",
};

export const alertCategoryLabel: Record<AlertCategory, string> = {
  high_risk_zone: "منطقة عالية الخطورة",
  point_review: "نقطة تحتاج فحصًا",
  threshold_exceeded: "تجاوز حد مستشعر",
  low_battery: "بطارية منخفضة",
  device_offline: "جهاز غير متصل",
  connection_lost: "انقطاع الاتصال",
  mission_interrupted: "مهمة متوقفة",
  maintenance_required: "صيانة مطلوبة",
  inspection_overdue: "تفتيش متأخر",
  review_pending: "مراجعة معلّقة",
};

export const severityLabel: Record<Severity, string> = {
  low: "منخفض",
  medium: "متوسط",
  high: "عالٍ",
  critical: "حرج",
};

export const roleLabel: Record<RoleCode, string> = {
  ADMIN: "المدير",
  INSPECTOR: "المفتش",
  OPERATOR: "جامع التقارير",
};

export const equipmentTypeLabel: Record<"tank" | "pipeline" | "valve" | "tower" | "structure" | "other", string> = {
  tank: "خزان",
  pipeline: "خط أنابيب",
  valve: "صمام",
  tower: "برج",
  structure: "منشأة",
  other: "أصل آخر",
};

export const stageLabel: Record<number, string> = {
  1: "إرسال الدرون",
  2: "بدء التفتيش",
  3: "مسح وتصوير الموقع",
  4: "إرسال البيانات بشكل حي",
  5: "رصد نقطة تحتاج فحصًا",
  6: "تقييم واتخاذ القرار",
};

export function toneForInspection(status: InspectionStatus): "ok" | "warn" | "crit" | "info" | "neutral" {
  if (status === "COMPLETED" || status === "CLOSED") return "ok";
  if (status === "CANCELLED") return "neutral";
  if (status === "FOLLOW_UP_REQUIRED" || status === "REVIEW_REQUIRED") return "warn";
  if (status === "IN_PROGRESS") return "info";
  return "neutral";
}

export function toneForRisk(risk: RiskLevel): "ok" | "warn" | "crit" {
  if (risk === "high") return "crit";
  if (risk === "medium") return "warn";
  return "ok";
}

export function toneForSeverity(severity: Severity): "ok" | "warn" | "crit" | "info" {
  if (severity === "critical" || severity === "high") return "crit";
  if (severity === "medium") return "warn";
  return "info";
}
