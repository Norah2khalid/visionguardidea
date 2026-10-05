import type {
  ActionStatus,
  CheckResult,
  DataSource,
  DemoRole,
  DeviceStatus,
  DeviceType,
  EquipmentType,
  FindingCategory,
  FindingStatus,
  InspectionResult,
  MarkerState,
  Priority,
  ReportStatus,
  ReviewDecision,
  RiskLevel,
  Severity,
  TaskStatus,
  WorkflowStage,
} from "@/types/domain";

export const roleLabel: Record<DemoRole, string> = {
  manager: "المدير",
  inspector: "المفتش",
  report_collector: "جامع التقارير",
};

export const taskStatusLabel: Record<TaskStatus, string> = {
  new: "جديدة",
  scheduled: "مجدولة",
  in_progress: "قيد التنفيذ",
  pending_review: "بانتظار المراجعة",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

export const priorityLabel: Record<Priority, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  critical: "حرجة",
};

export const riskLabel: Record<RiskLevel, string> = {
  low: "منخفض",
  medium: "متوسط",
  high: "مرتفع",
  critical: "حرج",
};

export const severityLabel: Record<Severity, string> = riskLabel;

export const markerLabel: Record<MarkerState, string> = {
  NORMAL: "طبيعي",
  WARNING: "تحذير",
  CRITICAL: "حرج",
  INSPECTED: "تم التفتيش",
};

export const equipmentTypeLabel: Record<EquipmentType, string> = {
  tank: "خزانات",
  pipeline: "أنابيب",
  valve: "صمامات",
  pump: "مضخات",
  tower: "أبراج",
  industrial: "معدات صناعية",
};

export const checkResultLabel: Record<CheckResult, string> = {
  pass: "مطابق",
  warning: "تحذير",
  fail: "غير مطابق",
  not_applicable: "لا ينطبق",
};

export const workflowLabel: Record<WorkflowStage, string> = {
  created: "إنشاء المهمة",
  assigned: "تعيين المهمة",
  started: "بدء التفتيش",
  checklist: "إكمال قائمة الفحص",
  media: "جمع الصور والبيانات",
  ai: "تحليل الذكاء الاصطناعي",
  review: "المراجعة البشرية",
  completed: "اكتمال التفتيش",
  reported: "إصدار التقرير",
  recorded: "حفظ السجل",
};

export const findingCategoryLabel: Record<FindingCategory, string> = {
  possible_leak: "تسرب محتمل",
  corrosion: "تآكل",
  abnormal_heat: "ارتفاع غير طبيعي في الحرارة",
  equipment_fault: "خلل في المعدات",
  visual_change: "تغير بصري غير طبيعي",
  needs_followup: "مؤشرات تحتاج إلى فحص إضافي",
};

export const findingStatusLabel: Record<FindingStatus, string> = {
  open: "مفتوحة",
  approved: "معتمدة",
  rejected: "مرفوضة",
  extra_inspection: "فحص إضافي",
  maintenance: "محالة للصيانة",
};

export const reviewDecisionLabel: Record<ReviewDecision, string> = {
  approve: "اعتماد الملاحظة",
  reject: "رفض الملاحظة",
  extra_inspection: "طلب فحص إضافي",
  maintenance: "تحويل للصيانة",
  note: "إضافة ملاحظة",
};

export const reportStatusLabel: Record<ReportStatus, string> = {
  new: "جديدة",
  in_review: "قيد المراجعة",
  completed: "مكتملة",
  needs_completion: "تحتاج استكمال",
  archived: "مؤرشفة",
};

export const inspectionResultLabel: Record<InspectionResult, string> = {
  pass: "سليم",
  warning: "تحذير",
  fail: "غير مطابق",
  pending: "قيد التنفيذ",
};

export const deviceTypeLabel: Record<DeviceType, string> = {
  drone: "درون",
  robot: "روبوت",
  camera: "كاميرا",
  temperature_sensor: "حساس حرارة",
  gas_sensor: "حساس غاز",
  other_sensor: "حساس آخر",
};

export const deviceStatusLabel: Record<DeviceStatus, string> = {
  online: "متصل",
  standby: "استعداد",
  mission: "في مهمة",
  offline: "غير متصل",
  fault: "عطل",
};

export const sourceLabel: Record<DataSource, string> = {
  LIVE: "مباشر",
  IMPORTED: "مستورد",
  SIMULATION: "محاكاة",
  UNAVAILABLE: "غير متاح",
};

export const actionStatusLabel: Record<ActionStatus, string> = {
  open: "مفتوح",
  in_progress: "قيد المعالجة",
  done: "مغلق",
};

export const REVIEW_STATUS_LABEL = {
  pending: "بانتظار المراجعة",
  reviewed: "تمت المراجعة",
  awaiting_report: "بانتظار التقرير",
  recorded: "محفوظ في السجل",
} as const;
