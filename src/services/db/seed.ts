import { buildReportSnapshot } from "@/lib/reports";
import type {
  Alert,
  AppState,
  AuditLog,
  Drone,
  Equipment,
  Inspection,
  InspectionChecklist,
  InspectionChecklistItem,
  InspectionDecision,
  InspectionMedia,
  InspectionPoint,
  InspectionReport,
  InspectionReportItem,
  InspectionTemplate,
  InspectionTemplateItem,
  InspectionZone,
  MaintenanceRecord,
  Mission,
  MissionEvent,
  Robot,
  Sector,
  SensorReading,
  SensorThreshold,
  Site,
  TelemetryRecord,
  Facility,
} from "@/types/domain";

const T = "2026-09-01T00:00:00.000Z";

export const ID = {
  roleAdmin: "10000000-0000-4000-8000-0000000000a1",
  roleInspector: "10000000-0000-4000-8000-0000000000a2",
  roleOperator: "10000000-0000-4000-8000-0000000000a3",
  facility: "10000000-0000-4000-8000-000000000001",
  site: "10000000-0000-4000-8000-000000000002",
  sector: "10000000-0000-4000-8000-000000000003",
  zoneHigh: "10000000-0000-4000-8000-000000000011",
  zoneMed: "10000000-0000-4000-8000-000000000012",
  zoneLow: "10000000-0000-4000-8000-000000000013",
  tank04: "10000000-0000-4000-8000-000000000021",
  tank02: "10000000-0000-4000-8000-000000000022",
  tank01: "10000000-0000-4000-8000-000000000023",
  pipe: "10000000-0000-4000-8000-000000000024",
  valve: "10000000-0000-4000-8000-000000000025",
  tower: "10000000-0000-4000-8000-000000000026",
  template: "10000000-0000-4000-8000-000000000031",
  templateDemo: "10000000-0000-4000-8000-000000000041",
  drone: "10000000-0000-4000-8000-000000000051",
  robot: "10000000-0000-4000-8000-000000000052",
  thresholdGas: "10000000-0000-4000-8000-000000000061",
  thresholdTemp: "10000000-0000-4000-8000-000000000062",
  ins124: "10000000-0000-4000-8000-000000000101",
  ins2041: "10000000-0000-4000-8000-000000000102",
  ins2040: "10000000-0000-4000-8000-000000000103",
  ins2039: "10000000-0000-4000-8000-000000000104",
  insOverdue: "10000000-0000-4000-8000-000000000105",
  mission124: "10000000-0000-4000-8000-000000000201",
  point124: "10000000-0000-4000-8000-000000000301",
  media124: "10000000-0000-4000-8000-000000000401",
  report124: "10000000-0000-4000-8000-000000000501",
};

function svgEvidence(label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="#0d141c"/><rect x="16" y="16" width="608" height="328" fill="none" stroke="#3ddec8" opacity="0.45"/><text x="32" y="48" fill="#3ddec8" font-size="16" font-family="sans-serif">VISIONGUARD — بيانات تجريبية</text><circle cx="250" cy="200" r="62" fill="none" stroke="#e4b15a" stroke-width="4"/><text x="250" y="206" fill="#e7eef4" font-size="22" text-anchor="middle" font-family="sans-serif">${label}</text><text x="360" y="190" fill="#8ea0b3" font-size="14" font-family="sans-serif">ليست لقطة من درون حقيقية</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function empty(): AppState {
  return {
    roles: [],
    profiles: [],
    facilities: [],
    sites: [],
    sectors: [],
    inspection_zones: [],
    equipment: [],
    inspection_templates: [],
    inspection_template_items: [],
    inspections: [],
    inspection_assignments: [],
    inspection_checklists: [],
    inspection_checklist_items: [],
    missions: [],
    mission_events: [],
    drones: [],
    robots: [],
    telemetry_records: [],
    sensor_thresholds: [],
    sensor_readings: [],
    inspection_media: [],
    inspection_points: [],
    inspection_observations: [],
    inspection_decisions: [],
    alerts: [],
    inspection_reports: [],
    inspection_report_items: [],
    maintenance_records: [],
    audit_logs: [],
    code_sequences: [],
    settings: [],
  };
}

function standardItems(templateId: string): InspectionTemplateItem[] {
  const rows: [string, string, "choice" | "choice_numeric", boolean][] = [
    ["معدات السلامة", "حالة معدات السلامة", "choice", true],
    ["معدات السلامة", "توافر معدات الوقاية", "choice", false],
    ["خزانات الوقود", "الحالة الخارجية للخزان", "choice", false],
    ["خزانات الوقود", "تآكل ظاهر", "choice", true],
    ["خزانات الوقود", "الصمامات والوصلات", "choice", false],
    ["أنظمة الإنذار", "حالة نظام الإنذار", "choice", true],
    ["أنظمة الإنذار", "أضرار ظاهرة", "choice", false],
    ["أنظمة الإنذار", "درجة حرارة السطح", "choice_numeric", false],
  ];
  return rows.map((row, index) => ({
    id: `10000000-0000-4000-8000-0000000032${String(index).padStart(2, "0")}`,
    template_id: templateId,
    category: row[0],
    label: row[1],
    response_type: row[2],
    weight: 1,
    critical: row[3],
    sort_order: index + 1,
    numeric_unit: row[2] === "choice_numeric" ? "°C" : null,
    numeric_min: null,
    numeric_max: null,
    created_at: T,
  }));
}

function demoItems(templateId: string): InspectionTemplateItem[] {
  const rows: [string, string, number][] = [
    ["معدات السلامة", "حالة معدات السلامة", 9],
    ["معدات السلامة", "ملاحظات السلامة العامة", 1],
    ["خزانات الوقود", "الحالة الخارجية للخزان", 41],
    ["خزانات الوقود", "مؤشرات تحتاج متابعة", 9],
    ["أنظمة الإنذار", "حالة نظام الإنذار", 41],
    ["أنظمة الإنذار", "فحص المستشعرات الدوري", 9],
  ];
  return rows.map((row, index) => ({
    id: `10000000-0000-4000-8000-0000000042${String(index).padStart(2, "0")}`,
    template_id: templateId,
    category: row[0],
    label: row[1],
    response_type: "choice",
    weight: row[2],
    critical: false,
    sort_order: index + 1,
    numeric_unit: null,
    numeric_min: null,
    numeric_max: null,
    created_at: T,
  }));
}

export function buildSeed(at = "2026-10-01T08:00:00.000Z"): AppState {
  const state = empty();
  state.roles = [
    { id: ID.roleAdmin, code: "ADMIN", name_ar: "مدير النظام", description: "إدارة المستخدمين والمنشآت والقوالب والأجهزة.", created_at: T },
    { id: ID.roleInspector, code: "INSPECTOR", name_ar: "مفتش", description: "تنفيذ التفتيش والمراجعة وإصدار التقارير.", created_at: T },
    { id: ID.roleOperator, code: "OPERATOR", name_ar: "مشغّل", description: "متابعة المهام والأجهزة والتنبيهات.", created_at: T },
  ];

  const facility: Facility = {
    id: ID.facility,
    code: "PFG-01",
    name: "مصنع البترول والغاز",
    description: "منشأة تخزين ونقل للعرض التشغيلي. الإحداثيات الجغرافية غير متوفرة، ويُستخدم المخطط التخطيطي.",
    facility_type: "تخزين ونقل",
    status: "active",
    address: "منطقة صناعية — العنوان التفصيلي غير مُدخل",
    latitude: null,
    longitude: null,
    created_by: null,
    created_at: T,
    updated_at: T,
  };
  const site: Site = {
    id: ID.site,
    facility_id: facility.id,
    code: "SITE-01",
    name: "الموقع الرئيسي",
    description: null,
    created_at: T,
    updated_at: T,
  };
  const sector: Sector = {
    id: ID.sector,
    site_id: site.id,
    code: "SEC-B",
    name: "القطاع B — حقل الخزانات",
    description: "خزانات وأنابيب وصمامات وأبراج.",
    created_at: T,
    updated_at: T,
  };
  const zones: InspectionZone[] = [
    {
      id: ID.zoneHigh,
      facility_id: facility.id,
      sector_id: sector.id,
      code: "HZ-B1",
      name: "حقل الخزانات",
      description: "منطقة خزانات مصنفة عالية الخطورة في بيانات العرض.",
      risk_level: "high",
      hazard_categories: ["مواد قابلة للاشتعال", "منشآت مرتفعة"],
      human_access: "prohibited",
      recommended_method: "drone_human",
      required_ppe: ["خوذة", "نظارة", "حذاء سلامة", "كاشف غاز شخصي عند الاقتراب من المحيط"],
      safety_notes: "لا يُسمح للمفتش بدخول الحقل في هذا التصنيف. الجهاز يدخل، والمفتش يراجع من موقع آمن. التوجيه استشاري ولا يصرّح بأي عملية ميدانية.",
      boundary: { points: [{ x: 8, y: 12 }, { x: 68, y: 12 }, { x: 68, y: 68 }, { x: 8, y: 68 }] },
      created_at: T,
      updated_at: T,
    },
    {
      id: ID.zoneMed,
      facility_id: facility.id,
      sector_id: sector.id,
      code: "MZ-B2",
      name: "ممر الأنابيب",
      description: "ممر خطوط وصمامات متوسط الخطورة.",
      risk_level: "medium",
      hazard_categories: ["ضغط تشغيلي", "وصول مقيّد"],
      human_access: "restricted",
      recommended_method: "human",
      required_ppe: ["خوذة", "حذاء سلامة", "قفازات"],
      safety_notes: "الدخول وفق تصريح العمل الخاص بالمنشأة.",
      boundary: { points: [{ x: 8, y: 72 }, { x: 92, y: 72 }, { x: 92, y: 90 }, { x: 8, y: 90 }] },
      created_at: T,
      updated_at: T,
    },
    {
      id: ID.zoneLow,
      facility_id: facility.id,
      sector_id: sector.id,
      code: "NZ-B3",
      name: "منطقة التحكم",
      description: "منطقة عادية الخطورة للتوثيق الرقمي الميداني.",
      risk_level: "normal",
      hazard_categories: ["حركة معدات"],
      human_access: "allowed",
      recommended_method: "human",
      required_ppe: ["خوذة", "حذاء سلامة"],
      safety_notes: "استخدم قائمة الفحص الرقمية من الجهاز اللوحي.",
      boundary: { points: [{ x: 72, y: 12 }, { x: 94, y: 12 }, { x: 94, y: 66 }, { x: 72, y: 66 }] },
      created_at: T,
      updated_at: T,
    },
  ];
  const equipment: Equipment[] = [
    eq("tank", ID.tank04, "T-04", "خزان T-04", ID.zoneHigh, "high", 28, 34),
    eq("tank", ID.tank02, "T-02", "خزان T-02", ID.zoneHigh, "high", 48, 40),
    eq("tank", ID.tank01, "T-01", "خزان T-01", ID.zoneHigh, "medium", 28, 54),
    eq("pipeline", ID.pipe, "P-A", "خط أنابيب A", ID.zoneMed, "medium", 40, 80),
    eq("valve", ID.valve, "V-03", "محطة صمامات 3", ID.zoneMed, "medium", 62, 81),
    eq("tower", ID.tower, "TW-01", "برج المراقبة", ID.zoneLow, "normal", 83, 36),
  ];
  const template: InspectionTemplate = {
    id: ID.template,
    name: "فحص منشآت النفط والغاز — عام",
    category: "تشغيلي",
    description: "قالب قابل للتعديل. البنود أمثلة تشغيلية وليست معيارًا معتمدًا للسلامة.",
    scoring_rules: {
      passValue: 100,
      failValue: 0,
      needsReviewValue: 50,
      bands: [
        { min: 90, label: "ممتاز" },
        { min: 80, label: "جيد جدًا" },
        { min: 70, label: "جيد" },
        { min: 0, label: "يحتاج تحسين" },
      ],
    },
    is_active: true,
    created_at: T,
    updated_at: T,
  };
  const templateDemo: InspectionTemplate = {
    id: ID.templateDemo,
    name: "قالب العرض المرجعي",
    category: "عرض",
    description: "أوزان الفئات مخزنة في القالب حتى تُحسب الدرجة ولا تُكتب يدويًا.",
    scoring_rules: {
      passValue: 100,
      failValue: 0,
      needsReviewValue: 50,
      categoryWeights: { "معدات السلامة": 0.25, "خزانات الوقود": 0.55, "أنظمة الإنذار": 0.2 },
      bands: [
        { min: 90, label: "ممتاز" },
        { min: 80, label: "جيد جدًا" },
        { min: 70, label: "جيد" },
        { min: 0, label: "يحتاج تحسين" },
      ],
    },
    is_active: true,
    created_at: T,
    updated_at: T,
  };
  const drone: Drone = {
    id: ID.drone,
    code: "VG-DRONE-01",
    name: "درون التفتيش 01",
    model: "VG-X4",
    manufacturer: "غير متصل بمصنّع",
    camera_capable: true,
    resolution: "4K — مواصفات مسجلة للجهاز وليست بثًا حيًا",
    battery_capacity_mah: 8000,
    current_battery: 76,
    signal_quality: null,
    operational_status: "available",
    availability: "available",
    current_mission_id: null,
    last_maintenance_at: "2026-08-28T09:00:00.000Z",
    total_flight_minutes: 186,
    position_label: "محطة الشحن — القطاع B",
    last_position: null,
    notes: "لا يوجد اتصال بجهاز فعلي.",
    created_at: T,
    updated_at: T,
  };
  const robot: Robot = {
    id: ID.robot,
    code: "VG-ROBOT-01",
    name: "روبوت التفتيش الأرضي",
    robot_type: "أرضي بعجلات",
    model: "VG-R2",
    manufacturer: "غير متصل بمصنّع",
    sensors: ["كاميرا", "حرارة سطح", "كشف غاز قابل للضبط"],
    battery_capacity_mah: 12000,
    current_battery: 88,
    operational_status: "available",
    availability: "available",
    current_mission_id: null,
    location_label: "ورشة الأجهزة",
    last_maintenance_at: "2026-08-20T09:00:00.000Z",
    notes: "لا يوجد اتصال بروبوت فعلي.",
    created_at: T,
    updated_at: T,
  };
  const thresholds: SensorThreshold[] = [
    {
      id: ID.thresholdGas,
      sensor_code: "GAS-TANK-B",
      measurement_type: "gas_concentration",
      substance: "حد تشغيلي تجريبي لغاز قابل للاشتعال",
      unit: "ppm",
      min_value: 0,
      max_value: 50,
      label: "حد الغاز التجريبي",
      is_active: true,
      notes: "هذا الحد مُدخل لبيانات العرض فقط، وليس حدًا تنظيميًا أو مواصفة مستشعر معتمدة.",
      created_at: T,
    },
    {
      id: ID.thresholdTemp,
      sensor_code: "TEMP-SURF",
      measurement_type: "surface_temperature",
      substance: null,
      unit: "°C",
      min_value: -10,
      max_value: 80,
      label: "حد حرارة السطح التجريبي",
      is_active: true,
      notes: "حد تشغيلي تجريبي قابل للتعديل.",
      created_at: T,
    },
  ];

  const demoResponses: [InspectionChecklistItem["response"], string | null][] = [
    ["pass", "لا توجد ملاحظات جوهرية"],
    ["needs_review", "ملاحظة طفيفة لا تؤثر على الجاهزية"],
    ["pass", null],
    ["fail", "تحتاج متابعة دورية"],
    ["pass", "الأنظمة تعمل بشكل طبيعي"],
    ["needs_review", "مستشعر واحد بانتظار معايرة لاحقة"],
  ];
  const demoTemplateItems = demoItems(templateDemo.id);
  const checklist124: InspectionChecklist = {
    id: "10000000-0000-4000-8000-000000000611",
    inspection_id: ID.ins124,
    template_id: templateDemo.id,
    completed_at: "2026-09-15T07:20:00.000Z",
    created_at: "2026-09-15T06:00:00.000Z",
    updated_at: "2026-09-15T07:20:00.000Z",
  };
  const items124: InspectionChecklistItem[] = demoTemplateItems.map((item, index) => ({
    id: `10000000-0000-4000-8000-00000000071${index}`,
    checklist_id: checklist124.id,
    template_item_id: item.id,
    category: item.category,
    label: item.label,
    response: demoResponses[index][0],
    numeric_value: null,
    notes: demoResponses[index][1],
    severity: demoResponses[index][0] === "fail" ? "medium" : null,
    weight: item.weight,
    critical: item.critical,
    response_type: item.response_type,
    numeric_unit: item.numeric_unit,
    sort_order: item.sort_order,
    evidence_media_id: null,
    updated_at: "2026-09-15T07:20:00.000Z",
  }));

  const inspection124: Inspection = inspection({
    id: ID.ins124,
    code: "VG-2026-00124",
    zone: zones[0],
    equipmentId: ID.tank04,
    templateId: templateDemo.id,
    method: "drone_human",
    status: "COMPLETED",
    type: "تفتيش دوري للخزانات",
    planned: "2026-09-15T06:00:00.000Z",
    started: "2026-09-15T06:05:00.000Z",
    completed: "2026-09-15T07:30:00.000Z",
  });
  const inspection2041 = inspection({
    id: ID.ins2041,
    code: "INS-2041",
    zone: zones[1],
    equipmentId: ID.pipe,
    templateId: template.id,
    method: "human",
    status: "COMPLETED",
    type: "تفتيش خط أنابيب",
    planned: "2026-09-10T05:00:00.000Z",
    started: "2026-09-10T05:10:00.000Z",
    completed: "2026-09-10T06:20:00.000Z",
  });
  const inspection2040 = inspection({
    id: ID.ins2040,
    code: "INS-2040",
    zone: zones[1],
    equipmentId: ID.valve,
    templateId: template.id,
    method: "human",
    status: "COMPLETED",
    type: "تفتيش محطة صمامات",
    planned: "2026-09-12T05:30:00.000Z",
    started: "2026-09-12T05:40:00.000Z",
    completed: "2026-09-12T06:40:00.000Z",
  });
  const inspection2039 = inspection({
    id: ID.ins2039,
    code: "INS-2039",
    zone: zones[0],
    equipmentId: ID.tank02,
    templateId: template.id,
    method: "drone_human",
    status: "COMPLETED",
    type: "تفتيش خزان",
    planned: "2026-09-14T04:00:00.000Z",
    started: "2026-09-14T04:10:00.000Z",
    completed: "2026-09-14T05:10:00.000Z",
  });
  const inspectionOverdue = inspection({
    id: ID.insOverdue,
    code: "VG-INS-2026-0090",
    zone: zones[2],
    equipmentId: ID.tower,
    templateId: template.id,
    method: "human",
    status: "SCHEDULED",
    type: "تفتيش منطقة التحكم",
    planned: "2026-09-20T06:00:00.000Z",
    started: null,
    completed: null,
  });

  const simpleChecks = [inspection2041, inspection2040, inspection2039].map((item) => simpleChecklist(item, standardItems(template.id)));

  const mission124: Mission = {
    id: ID.mission124,
    code: "VG-MSN-2026-00124",
    inspection_id: inspection124.id,
    facility_id: facility.id,
    sector_id: sector.id,
    zone_id: zones[0].id,
    device_kind: "drone",
    device_id: drone.id,
    inspector_id: null,
    risk_level: "high",
    mission_type: "drone_human",
    status: "COMPLETED",
    progress: 100,
    stage: 6,
    is_simulation: false,
    safety_prerequisites: { zone_reviewed: true, human_access: "prohibited", recorded_at: "2026-09-15T06:00:00.000Z" },
    created_by: null,
    started_at: "2026-09-15T06:05:00.000Z",
    completed_at: "2026-09-15T07:25:00.000Z",
    created_at: "2026-09-15T06:00:00.000Z",
    updated_at: "2026-09-15T07:25:00.000Z",
  };
  const events: MissionEvent[] = [
    ["CREATED", "READY", 1, "سُجلت المهمة بعد مراجعة المنطقة والجهاز."],
    ["READY", "DISPATCHED", 2, "بدء المهمة المسجلة."],
    ["DISPATCHED", "INSPECTING", 3, "مسح المنطقة حول الخزان T-04."],
    ["INSPECTING", "DATA_TRANSMISSION", 4, "استُلمت قراءات العرض."],
    ["DATA_TRANSMISSION", "REVIEW_REQUIRED", 5, "رُصدت نقطة تحتاج فحصًا على T-04."],
    ["REVIEW_REQUIRED", "INSPECTOR_REVIEW", 6, "راجع المفتش الدليل وأغلق الملاحظة ضمن المتابعة الدورية."],
    ["INSPECTOR_REVIEW", "COMPLETED", 6, "اكتملت المهمة المسجلة."],
  ].map((row, index) => ({
    id: `10000000-0000-4000-8000-00000000081${index}`,
    mission_id: mission124.id,
    event_type: "status_change",
    message: row[3] as string,
    from_status: row[0] as MissionEvent["from_status"],
    to_status: row[1] as MissionEvent["to_status"],
    stage: row[2] as number,
    origin: "seed",
    metadata: null,
    created_by: null,
    created_at: `2026-09-15T06:${String(5 + index * 8).padStart(2, "0")}:00.000Z`,
  }));

  const telemetry: TelemetryRecord = {
    id: "10000000-0000-4000-8000-000000000901",
    mission_id: mission124.id,
    device_id: drone.id,
    device_kind: "drone",
    altitude_m: 14.2,
    speed_mps: 0,
    battery_percent: 76,
    signal_quality: 92,
    latitude: null,
    longitude: null,
    recorded_at: "2026-09-15T06:40:00.000Z",
    source: "seed",
    quality: "good",
    created_at: "2026-09-15T06:40:00.000Z",
  };
  const readings: SensorReading[] = [
    {
      id: "10000000-0000-4000-8000-000000000911",
      mission_id: mission124.id,
      sensor_code: "TEMP-SURF",
      measurement_type: "surface_temperature",
      numeric_value: 42,
      unit: "°C",
      text_value: null,
      recorded_at: "2026-09-15T06:40:00.000Z",
      source: "seed",
      quality: "good",
      threshold_id: ID.thresholdTemp,
      created_at: "2026-09-15T06:40:00.000Z",
    },
    {
      id: "10000000-0000-4000-8000-000000000912",
      mission_id: mission124.id,
      sensor_code: "GAS-TANK-B",
      measurement_type: "gas_concentration",
      numeric_value: 12,
      unit: "ppm",
      text_value: null,
      recorded_at: "2026-09-15T06:40:00.000Z",
      source: "seed",
      quality: "good",
      threshold_id: ID.thresholdGas,
      created_at: "2026-09-15T06:40:00.000Z",
    },
  ];
  const point: InspectionPoint = {
    id: ID.point124,
    code: "VG-PT-2026-0004",
    mission_id: mission124.id,
    inspection_id: inspection124.id,
    facility_id: facility.id,
    equipment_id: ID.tank04,
    zone_id: zones[0].id,
    location_label: "الواجهة الشرقية للخزان T-04",
    category: "possible_corrosion",
    description: "مؤشر تآكل محتمل. السجل يبرزه للمراجعة ولا يؤكد عطلًا.",
    severity: "medium",
    source: "seed",
    confidence: null,
    review_status: "closed",
    created_at: "2026-09-15T06:45:00.000Z",
    updated_at: "2026-09-15T07:10:00.000Z",
  };
  const media: InspectionMedia = {
    id: ID.media124,
    inspection_id: inspection124.id,
    mission_id: mission124.id,
    point_id: point.id,
    storage_path: svgEvidence("T-04"),
    file_name: "demo-t04.svg",
    mime_type: "image/svg+xml",
    size_bytes: 800,
    caption: "دليل تجريبي — الخزان T-04",
    captured_at: "2026-09-15T06:42:00.000Z",
    source: "seed",
    created_by: null,
    created_at: "2026-09-15T06:42:00.000Z",
  };
  const decision: InspectionDecision = {
    id: "10000000-0000-4000-8000-000000000a11",
    inspection_id: inspection124.id,
    point_id: point.id,
    observation_id: null,
    action: "close",
    notes: "أُدرجت المتابعة الدورية ضمن بند الخزانات دون تأكيد عطل.",
    decided_by: null,
    decided_at: "2026-09-15T07:10:00.000Z",
    created_at: "2026-09-15T07:10:00.000Z",
  };

  const alerts: Alert[] = [
    {
      id: "10000000-0000-4000-8000-000000000b11",
      code: "VG-ALT-2026-0001",
      category: "inspection_overdue",
      severity: "medium",
      message: "التفتيش VG-INS-2026-0090 تجاوز الموعد المخطط.",
      facility_id: facility.id,
      device_id: null,
      device_kind: null,
      mission_id: null,
      inspection_id: inspectionOverdue.id,
      read_at: null,
      acknowledged_at: null,
      acknowledged_by: null,
      resolution_status: "open",
      assigned_user_id: null,
      resolution_notes: null,
      resolved_at: null,
      resolved_by: null,
      dedupe_key: `overdue:${inspectionOverdue.id}`,
      created_at: "2026-09-21T06:00:00.000Z",
      updated_at: "2026-09-21T06:00:00.000Z",
    },
    {
      id: "10000000-0000-4000-8000-000000000b12",
      code: "VG-ALT-2026-0002",
      category: "point_review",
      severity: "medium",
      message: "أُغلقت نقطة T-04 ضمن سجل العرض.",
      facility_id: facility.id,
      device_id: drone.id,
      device_kind: "drone",
      mission_id: mission124.id,
      inspection_id: inspection124.id,
      read_at: "2026-09-15T07:12:00.000Z",
      acknowledged_at: "2026-09-15T07:12:00.000Z",
      acknowledged_by: null,
      resolution_status: "resolved",
      assigned_user_id: null,
      resolution_notes: "أُغلقت مع قرار المفتش في سجل العرض.",
      resolved_at: "2026-09-15T07:15:00.000Z",
      resolved_by: null,
      dedupe_key: "point:VG-PT-2026-0004",
      created_at: "2026-09-15T06:45:00.000Z",
      updated_at: "2026-09-15T07:15:00.000Z",
    },
  ];

  const maintenance: MaintenanceRecord = {
    id: "10000000-0000-4000-8000-000000000c11",
    device_id: drone.id,
    device_kind: "drone",
    description: "فحص دوري للبطارية والمستشعرات — سجل عرض.",
    status: "completed",
    performed_at: "2026-08-28T09:00:00.000Z",
    next_due_at: "2026-11-28T09:00:00.000Z",
    created_by: null,
    created_at: "2026-08-28T09:00:00.000Z",
  };

  const snapshot = buildReportSnapshot({
    reportCode: "VG-REP-2026-00124",
    revision: 1,
    inspection: inspection124,
    facility,
    site,
    sector,
    zone: zones[0],
    equipment: equipment[0],
    inspector: null,
    items: items124,
    scoringRules: templateDemo.scoring_rules,
    observations: [],
    points: [point],
    media: [media],
    readings,
    thresholds,
    alerts: alerts.filter((alert) => alert.inspection_id === inspection124.id),
    decisions: [decision],
    generatedAt: "2026-09-15T07:40:00.000Z",
  });
  const report: InspectionReport = {
    id: ID.report124,
    code: "VG-REP-2026-00124",
    inspection_id: inspection124.id,
    revision: 1,
    status: "final",
    snapshot,
    created_by: null,
    created_at: "2026-09-15T07:40:00.000Z",
  };
  const reportItems: InspectionReportItem[] = snapshot.checklist_items.map((item, index) => ({
    id: `10000000-0000-4000-8000-000000000d1${index}`,
    report_id: report.id,
    category: item.category,
    label: item.label,
    response: item.response,
    score: null,
    notes: item.notes,
    sort_order: index + 1,
  }));

  const audits: AuditLog[] = [inspection124, inspection2041, inspection2040, inspection2039].map((item, index) => ({
    id: `10000000-0000-4000-8000-000000000e1${index}`,
    actor_id: null,
    action: "inspection.seeded",
    target_table: "inspections",
    target_id: item.id,
    metadata: { code: item.code, status: item.status },
    created_at: item.created_at,
  }));

  state.facilities = [facility];
  state.sites = [site];
  state.sectors = [sector];
  state.inspection_zones = zones;
  state.equipment = equipment;
  state.inspection_templates = [template, templateDemo];
  state.inspection_template_items = [...standardItems(template.id), ...demoTemplateItems];
  state.drones = [drone];
  state.robots = [robot];
  state.sensor_thresholds = thresholds;
  state.inspections = [inspection124, inspection2041, inspection2040, inspection2039, inspectionOverdue];
  state.inspection_checklists = [checklist124, ...simpleChecks.map((item) => item.checklist)];
  state.inspection_checklist_items = [...items124, ...simpleChecks.flatMap((item) => item.items)];
  state.missions = [mission124];
  state.mission_events = events;
  state.telemetry_records = [telemetry];
  state.sensor_readings = readings;
  state.inspection_points = [point];
  state.inspection_media = [media];
  state.inspection_decisions = [decision];
  state.alerts = alerts;
  state.inspection_reports = [report];
  state.inspection_report_items = reportItems;
  state.maintenance_records = [maintenance];
  state.audit_logs = audits;
  state.settings = [
    { id: "organization_name", value: "VISIONGUARD", updated_at: at, updated_by: null },
    { id: "timezone", value: "Asia/Riyadh", updated_at: at, updated_by: null },
    { id: "simulation_enabled", value: true, updated_at: at, updated_by: null },
  ];
  state.code_sequences = [];
  return state;
}

function eq(
  type: Equipment["equipment_type"],
  id: string,
  code: string,
  name: string,
  zoneId: string,
  risk: Equipment["risk_level"],
  x: number,
  y: number,
): Equipment {
  return {
    id,
    facility_id: ID.facility,
    sector_id: ID.sector,
    zone_id: zoneId,
    code,
    name,
    equipment_type: type,
    status: "active",
    risk_level: risk,
    position_x: x,
    position_y: y,
    description: null,
    last_inspection_at: type === "tower" ? null : "2026-09-15T07:30:00.000Z",
    created_at: T,
    updated_at: T,
  };
}

function inspection(input: {
  id: string;
  code: string;
  zone: InspectionZone;
  equipmentId: string;
  templateId: string;
  method: Inspection["method"];
  status: Inspection["status"];
  type: string;
  planned: string;
  started: string | null;
  completed: string | null;
}): Inspection {
  return {
    id: input.id,
    code: input.code,
    facility_id: ID.facility,
    site_id: ID.site,
    sector_id: ID.sector,
    zone_id: input.zone.id,
    equipment_id: input.equipmentId,
    inspection_type: input.type,
    risk_level: input.zone.risk_level,
    method: input.method,
    template_id: input.templateId,
    assigned_inspector_id: null,
    planned_at: input.planned,
    started_at: input.started,
    completed_at: input.completed,
    status: input.status,
    notes: null,
    risk_acknowledgement: null,
    created_by: null,
    archived_at: null,
    created_at: input.planned,
    updated_at: input.completed ?? input.planned,
  };
}

function simpleChecklist(inspectionRow: Inspection, templateItems: InspectionTemplateItem[]) {
  const checklist: InspectionChecklist = {
    id: `10000000-0000-4000-8000-00000000c${inspectionRow.id.slice(-3)}`,
    inspection_id: inspectionRow.id,
    template_id: inspectionRow.template_id,
    completed_at: inspectionRow.completed_at,
    created_at: inspectionRow.created_at,
    updated_at: inspectionRow.updated_at,
  };
  const items: InspectionChecklistItem[] = templateItems.map((item, index) => ({
    id: `20000000-0000-4000-8000-${inspectionRow.id.slice(-4)}${index}00000000`.slice(0, 36),
    checklist_id: checklist.id,
    template_item_id: item.id,
    category: item.category,
    label: item.label,
    response: "pass",
    numeric_value: item.response_type === "choice_numeric" ? 36 : null,
    notes: null,
    severity: null,
    weight: item.weight,
    critical: item.critical,
    response_type: item.response_type,
    numeric_unit: item.numeric_unit,
    sort_order: item.sort_order,
    evidence_media_id: null,
    updated_at: inspectionRow.updated_at,
  }));
  return { checklist, items };
}
