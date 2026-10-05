import { inspectionFrame, type FrameKind } from "@/data/imagery";
import { CHECKLIST_TEMPLATE } from "@/lib/checklistTemplate";
import { buildReportSnapshot } from "@/lib/reports";
import type {
  ActivityLog,
  AiAnalysisResult,
  AppData,
  CheckResult,
  CorrectiveAction,
  Device,
  Equipment,
  Facility,
  HumanReview,
  Inspection,
  InspectionChecklist,
  InspectionChecklistItem,
  InspectionFinding,
  InspectionImage,
  InspectionLocation,
  InspectionTask,
  Observation,
  Report,
  TelemetryRecord,
  User,
  Zone,
} from "@/types/domain";
import { fixedId } from "@/utils/ids";

export const SEED_STAMP = "2026-10-05-vg1";

const id = (group: number, n: number) => fixedId(group, n);

export const IDS = {
  roleManager: id(1, 1),
  roleInspector: id(1, 2),
  roleCollector: id(1, 3),
  nora: id(2, 1),
  khaled: id(2, 2),
  sara: id(2, 3),
  fahd: id(2, 4),
  facNorth: id(3, 1),
  facPump: id(3, 2),
  facSouth: id(3, 3),
  zoneA: id(4, 1),
  zoneB: id(4, 2),
  zoneC: id(4, 3),
  zoneD: id(4, 4),
  zoneE: id(4, 5),
  zoneF: id(4, 6),
  eqT04: id(5, 4),
  eqT07: id(5, 7),
  eqPL12: id(5, 12),
  eqPL18: id(5, 18),
  eqV19: id(5, 19),
  eqV22: id(5, 22),
  eqP03: id(5, 3),
  eqP06: id(5, 6),
  eqTW02: id(5, 2),
  eqHX08: id(5, 8),
  eqT11: id(5, 11),
  eqSK01: id(5, 21),
  locT04: id(6, 4),
  locT07: id(6, 7),
  locPL12: id(6, 12),
  locPL18: id(6, 18),
  locV19: id(6, 19),
  locV22: id(6, 22),
  locP03: id(6, 3),
  locP06: id(6, 6),
  locTW02: id(6, 2),
  locHX08: id(6, 8),
  locT11: id(6, 11),
  locSK01: id(6, 21),
  task3108: id(7, 3108),
  task3112: id(7, 3112),
  task3094: id(7, 3094),
  task3088: id(7, 3088),
  task3099: id(7, 3099),
  task3044: id(7, 3044),
  task3120: id(7, 3120),
  task3102: id(7, 3102),
  task3115: id(7, 3115),
  task3070: id(7, 3070),
  task3060: id(7, 3060),
  ins2055: id(8, 2055),
  ins2052: id(8, 2052),
  ins2041: id(8, 2041),
  ins2040: id(8, 2040),
  ins2062: id(8, 2062),
  ins2033: id(8, 2033),
  ins2060: id(8, 2060),
  rpt110: id(16, 110),
  rpt118: id(16, 118),
  rpt119: id(16, 119),
  rpt121: id(16, 121),
  rpt122: id(16, 122),
  drone: id(18, 1),
  robot: id(18, 2),
  camOffline: id(18, 4),
  tempSensor: id(18, 11),
  gasSensor: id(18, 7),
  camOnline: id(18, 5),
};

const CREATED = "2026-08-01T06:00:00.000Z";

const facilities: Facility[] = [
  facility(IDS.facNorth, "FAC-01", "مجمع التكرير الشمالي", "المنطقة الشرقية — قطاع تجريبي", "مجمع تكرير", 26.42, 50.11),
  facility(IDS.facPump, "FAC-02", "محطة الضخ الشرقية", "المنطقة الشرقية — قطاع تجريبي", "محطة ضخ", 26.39, 50.18),
  facility(IDS.facSouth, "FAC-03", "مستودع الخزانات الجنوبي", "المنطقة الشرقية — قطاع تجريبي", "مستودع", 26.35, 50.07),
];

const zones: Zone[] = [
  zone(IDS.zoneA, IDS.facNorth, "ZONE-A", "خزانات الخام", "منطقة خزانات النفط الخام والمكثفات", "high"),
  zone(IDS.zoneB, IDS.facNorth, "ZONE-B", "خطوط الأنابيب", "ممرات الخطوط الرئيسية والرجيع", "medium"),
  zone(IDS.zoneC, IDS.facPump, "ZONE-C", "الصمامات", "صمامات العزل والتنفيس", "high"),
  zone(IDS.zoneD, IDS.facPump, "ZONE-D", "المضخات", "مضخات النقل والدعم", "medium"),
  zone(IDS.zoneE, IDS.facNorth, "ZONE-E", "أبراج المعالجة", "برج التقطير والمبادلات", "high"),
  zone(IDS.zoneF, IDS.facSouth, "ZONE-F", "التخزين الجنوبي", "خزانات مساندة وهياكل", "low"),
];

const equipment: Equipment[] = [
  equipmentRow(IDS.eqT04, IDS.facNorth, IDS.zoneA, "T-04", "خزان النفط الخام", "tank", "critical"),
  equipmentRow(IDS.eqT07, IDS.facNorth, IDS.zoneA, "T-07", "خزان المكثفات", "tank", "medium"),
  equipmentRow(IDS.eqPL12, IDS.facNorth, IDS.zoneB, "PL-12", "أنبوب التغذية الرئيسي", "pipeline", "high"),
  equipmentRow(IDS.eqPL18, IDS.facNorth, IDS.zoneB, "PL-18", "أنبوب الرجيع", "pipeline", "low"),
  equipmentRow(IDS.eqV19, IDS.facPump, IDS.zoneC, "V-19", "صمام العزل", "valve", "high"),
  equipmentRow(IDS.eqV22, IDS.facPump, IDS.zoneC, "V-22", "صمام التنفيس", "valve", "low"),
  equipmentRow(IDS.eqP03, IDS.facPump, IDS.zoneD, "P-03", "مضخة النقل", "pump", "medium"),
  equipmentRow(IDS.eqP06, IDS.facPump, IDS.zoneD, "P-06", "مضخة الدعم", "pump", "low"),
  equipmentRow(IDS.eqTW02, IDS.facNorth, IDS.zoneE, "TW-02", "برج التقطير", "tower", "high"),
  equipmentRow(IDS.eqHX08, IDS.facNorth, IDS.zoneE, "HX-08", "مبادل حراري", "industrial", "medium"),
  equipmentRow(IDS.eqT11, IDS.facSouth, IDS.zoneF, "T-11", "خزان المياه المعالجة", "tank", "low"),
  equipmentRow(IDS.eqSK01, IDS.facSouth, IDS.zoneF, "SK-01", "هيكل المنصة", "industrial", "medium"),
];

const locations: InspectionLocation[] = [
  location(IDS.locT04, "LOC-T04", "موقع تفتيش الخزان T-04", IDS.facNorth, IDS.zoneA, IDS.eqT04, 18, 22, "critical", "CRITICAL", "متابعة مفتوحة", "2026-09-28T09:40:00.000Z", "2026-10-20", "ارتفاع حرارة وتسرب محتمل في الجدار السفلي — بانتظار إعادة الفحص"),
  location(IDS.locT07, "LOC-T07", "موقع تفتيش الخزان T-07", IDS.facNorth, IDS.zoneA, IDS.eqT07, 30, 24, "medium", "WARNING", "متأخر", "2026-08-18T07:10:00.000Z", "2026-09-28", "التفتيش الدوري تجاوز تاريخ الاستحقاق"),
  location(IDS.locPL12, "LOC-PL12", "موقع خط PL-12", IDS.facNorth, IDS.zoneB, IDS.eqPL12, 46, 48, "high", "WARNING", "بانتظار المراجعة", "2026-08-22T11:00:00.000Z", "2026-10-18", "تآكل ظاهر على العازل الخارجي"),
  location(IDS.locPL18, "LOC-PL18", "موقع خط PL-18", IDS.facNorth, IDS.zoneB, IDS.eqPL18, 60, 44, "low", "NORMAL", "مستقر", "2026-09-12T08:00:00.000Z", "2026-12-12", "لا توجد ملاحظات مفتوحة"),
  location(IDS.locV19, "LOC-V19", "موقع الصمام V-19", IDS.facPump, IDS.zoneC, IDS.eqV19, 22, 72, "high", "CRITICAL", "مجدول", null, "2026-10-08", "صمام عزل على جدول التفتيش العالي"),
  location(IDS.locV22, "LOC-V22", "موقع الصمام V-22", IDS.facPump, IDS.zoneC, IDS.eqV22, 34, 78, "low", "INSPECTED", "تم التفتيش", "2026-10-01T10:20:00.000Z", "2027-01-01", "الفحص الأخير سليم"),
  location(IDS.locP03, "LOC-P03", "موقع المضخة P-03", IDS.facPump, IDS.zoneD, IDS.eqP03, 50, 74, "medium", "WARNING", "مهمة جديدة", "2026-08-30T06:40:00.000Z", "2026-10-12", "اهتزاز ملحوظ في التشغيل التجريبي السابق"),
  location(IDS.locP06, "LOC-P06", "موقع المضخة P-06", IDS.facPump, IDS.zoneD, IDS.eqP06, 62, 68, "low", "NORMAL", "مستقر", "2026-09-05T06:40:00.000Z", "2026-12-05", "ضمن الحالة الطبيعية في السجل"),
  location(IDS.locTW02, "LOC-TW02", "موقع البرج TW-02", IDS.facNorth, IDS.zoneE, IDS.eqTW02, 78, 22, "high", "INSPECTED", "تم التفتيش", "2026-09-20T13:15:00.000Z", "2026-10-20", "ارتفاع حرارة متوسط تم اعتماده"),
  location(IDS.locHX08, "LOC-HX08", "موقع المبادل HX-08", IDS.facNorth, IDS.zoneE, IDS.eqHX08, 86, 36, "medium", "INSPECTED", "تم التفتيش", "2026-09-15T09:00:00.000Z", "2026-12-15", "تغير بصري طفيف رُفض بعد المراجعة"),
  location(IDS.locT11, "LOC-T11", "موقع الخزان T-11", IDS.facSouth, IDS.zoneF, IDS.eqT11, 74, 78, "low", "NORMAL", "مستقر", "2026-09-01T08:00:00.000Z", "2026-12-01", "لا مؤشرات"),
  location(IDS.locSK01, "LOC-SK01", "موقع الهيكل SK-01", IDS.facSouth, IDS.zoneF, IDS.eqSK01, 88, 70, "medium", "NORMAL", "مهمة ملغاة", "2026-07-20T08:00:00.000Z", "2026-11-20", "أُلغيت المهمة الأخيرة قبل البدء"),
];

const users: User[] = [
  user(IDS.nora, "نورة القحطاني", "nora.admin@visionguard.demo", "manager"),
  user(IDS.khaled, "خالد العتيبي", "khaled.inspector@visionguard.demo", "inspector"),
  user(IDS.sara, "سارة الدوسري", "sara.inspector@visionguard.demo", "inspector"),
  user(IDS.fahd, "فهد الشهري", "fahd.reports@visionguard.demo", "report_collector"),
];

const tasks: InspectionTask[] = [
  task(IDS.task3108, "VG-TSK-3108", "إعادة فحص حراري لخزان T-04", IDS.facNorth, IDS.locT04, IDS.eqT04, IDS.khaled, "critical", "2026-10-06", "in_progress", "started", "2026-10-04T05:10:00.000Z"),
  task(IDS.task3112, "VG-TSK-3112", "فحص تآكل خط PL-12", IDS.facNorth, IDS.locPL12, IDS.eqPL12, IDS.khaled, "high", "2026-10-05", "pending_review", "ai", "2026-10-02T06:00:00.000Z"),
  task(IDS.task3094, "VG-TSK-3094", "تفتيش دوري لبرج TW-02", IDS.facNorth, IDS.locTW02, IDS.eqTW02, IDS.khaled, "medium", "2026-09-20", "completed", "recorded", "2026-09-18T06:00:00.000Z"),
  task(IDS.task3088, "VG-TSK-3088", "تفتيش سابق لخزان T-04", IDS.facNorth, IDS.locT04, IDS.eqT04, IDS.sara, "medium", "2026-09-02", "completed", "recorded", "2026-08-28T06:00:00.000Z"),
  task(IDS.task3099, "VG-TSK-3099", "تفتيش متابعة لخزان T-04", IDS.facNorth, IDS.locT04, IDS.eqT04, IDS.khaled, "high", "2026-09-28", "completed", "recorded", "2026-09-26T06:00:00.000Z"),
  task(IDS.task3044, "VG-TSK-3044", "فحص المبادل HX-08", IDS.facNorth, IDS.locHX08, IDS.eqHX08, IDS.sara, "low", "2026-09-15", "completed", "recorded", "2026-09-14T06:00:00.000Z"),
  task(IDS.task3120, "VG-TSK-3120", "فحص صمام التنفيس V-22", IDS.facPump, IDS.locV22, IDS.eqV22, IDS.khaled, "low", "2026-10-01", "completed", "recorded", "2026-09-30T06:00:00.000Z"),
  task(IDS.task3102, "VG-TSK-3102", "فحص صمام العزل V-19", IDS.facPump, IDS.locV19, IDS.eqV19, IDS.sara, "high", "2026-10-08", "scheduled", "assigned", "2026-10-01T07:00:00.000Z"),
  task(IDS.task3115, "VG-TSK-3115", "فحص اهتزاز المضخة P-03", IDS.facPump, IDS.locP03, IDS.eqP03, null, "medium", "2026-10-12", "new", "created", "2026-10-03T07:20:00.000Z"),
  task(IDS.task3070, "VG-TSK-3070", "التفتيش الدوري لخزان T-07", IDS.facNorth, IDS.locT07, IDS.eqT07, IDS.sara, "high", "2026-09-28", "scheduled", "assigned", "2026-09-10T07:00:00.000Z"),
  task(IDS.task3060, "VG-TSK-3060", "فحص هيكل SK-01", IDS.facSouth, IDS.locSK01, IDS.eqSK01, IDS.khaled, "low", "2026-09-01", "cancelled", "created", "2026-08-20T07:00:00.000Z"),
];

const inspections: Inspection[] = [
  inspection(IDS.ins2055, "INS-2055", IDS.task3108, IDS.facNorth, IDS.locT04, IDS.eqT04, IDS.khaled, "pending", "critical", "in_progress", "started", "2026-10-04T06:05:00.000Z", null, "إعادة فحص بعد اعتماد تسرب محتمل."),
  inspection(IDS.ins2052, "INS-2052", IDS.task3112, IDS.facNorth, IDS.locPL12, IDS.eqPL12, IDS.khaled, "warning", "high", "pending_review", "ai", "2026-10-03T07:40:00.000Z", null, "جمع الصور اكتمل والتحليل التجريبي بانتظار مراجعة بشرية."),
  inspection(IDS.ins2041, "INS-2041", IDS.task3094, IDS.facNorth, IDS.locTW02, IDS.eqTW02, IDS.khaled, "warning", "medium", "completed", "recorded", "2026-09-20T08:00:00.000Z", "2026-09-20T13:15:00.000Z", "ارتفاع حرارة متوسط على بدن البرج."),
  inspection(IDS.ins2040, "INS-2040", IDS.task3088, IDS.facNorth, IDS.locT04, IDS.eqT04, IDS.sara, "warning", "medium", "completed", "recorded", "2026-09-02T08:10:00.000Z", "2026-09-02T12:05:00.000Z", "تآكل سطحي ومؤشر بصري متوسط."),
  inspection(IDS.ins2062, "INS-2062", IDS.task3099, IDS.facNorth, IDS.locT04, IDS.eqT04, IDS.khaled, "fail", "high", "completed", "recorded", "2026-09-28T08:00:00.000Z", "2026-09-28T09:40:00.000Z", "تسرب محتمل وارتفاع حرارة مقارنة بالتفتيش السابق."),
  inspection(IDS.ins2033, "INS-2033", IDS.task3044, IDS.facNorth, IDS.locHX08, IDS.eqHX08, IDS.sara, "pass", "low", "completed", "recorded", "2026-09-15T08:20:00.000Z", "2026-09-15T09:00:00.000Z", "الحالة العامة مقبولة مع تغير بصري طفيف."),
  inspection(IDS.ins2060, "INS-2060", IDS.task3120, IDS.facPump, IDS.locV22, IDS.eqV22, IDS.khaled, "pass", "low", "completed", "recorded", "2026-10-01T09:00:00.000Z", "2026-10-01T10:20:00.000Z", "الصمام سليم في هذه الجولة."),
];

const checklists: InspectionChecklist[] = [];
const checklistItems: InspectionChecklistItem[] = [];
let checklistSerial = 1;

seedChecklist(IDS.ins2040, id(9, 2040), "2026-09-02T11:40:00.000Z", {
  condition: { response: "pass" },
  temperature: { response: "pass", numeric: 64, notes: "ضمن المدى التجريبي" },
  pressure: { response: "pass", numeric: 4.2 },
  visual: { response: "warning", notes: "تغير لوني محدود" },
  leak: { response: "pass" },
  corrosion: { response: "warning", notes: "تآكل سطحي على العازل" },
  structural: { response: "pass" },
  safety: { response: "pass" },
});
seedChecklist(IDS.ins2062, id(9, 2062), "2026-09-28T09:10:00.000Z", {
  condition: { response: "warning", notes: "بقعة رطوبة أسفل الجدار" },
  temperature: { response: "fail", numeric: 91, notes: "أعلى من القراءة السابقة" },
  pressure: { response: "warning", numeric: 5.4 },
  visual: { response: "fail", notes: "أثر سائل" },
  leak: { response: "fail", notes: "مؤشر تسرب محتمل" },
  corrosion: { response: "warning" },
  structural: { response: "warning" },
  safety: { response: "warning", notes: "يلزم عزل المنطقة" },
});
seedChecklist(IDS.ins2041, id(9, 2041), "2026-09-20T12:40:00.000Z", {
  condition: { response: "pass" },
  temperature: { response: "warning", numeric: 78, notes: "ارتفاع عند المنسوب الأوسط" },
  pressure: { response: "pass", numeric: 6.1 },
  visual: { response: "warning" },
  leak: { response: "pass" },
  corrosion: { response: "pass" },
  structural: { response: "pass" },
  safety: { response: "pass" },
});
seedChecklist(IDS.ins2033, id(9, 2033), "2026-09-15T08:50:00.000Z", {
  condition: { response: "pass" },
  temperature: { response: "pass", numeric: 55 },
  pressure: { response: "pass", numeric: 3.1 },
  visual: { response: "pass", notes: "بقعة لونية طفيفة صُنفت مطابقة" },
  leak: { response: "pass" },
  corrosion: { response: "pass" },
  structural: { response: "pass" },
  safety: { response: "pass" },
});
seedChecklist(IDS.ins2060, id(9, 2060), "2026-10-01T10:00:00.000Z", {
  condition: { response: "pass" },
  temperature: { response: "pass", numeric: 41 },
  pressure: { response: "pass", numeric: 2.4 },
  visual: { response: "pass" },
  leak: { response: "pass" },
  corrosion: { response: "pass" },
  structural: { response: "pass" },
  safety: { response: "pass" },
});
seedChecklist(IDS.ins2052, id(9, 2052), "2026-10-03T09:20:00.000Z", {
  condition: { response: "warning" },
  temperature: { response: "warning", numeric: 73 },
  pressure: { response: "pass", numeric: 4.8 },
  visual: { response: "warning", notes: "تقشر في الطلاء" },
  leak: { response: "pass" },
  corrosion: { response: "warning", notes: "تآكل على الدعامة" },
  structural: { response: "pass" },
  safety: { response: "pass" },
});
seedChecklist(IDS.ins2055, id(9, 2055), null, {
  condition: { response: "warning", notes: "الفحص لم يكتمل" },
  temperature: { response: "warning", numeric: 88, notes: "قراءة أولية" },
});

const images: InspectionImage[] = [
  image(id(15, 1), IDS.ins2040, IDS.facNorth, IDS.eqT04, "t04-before.svg", "T-04 قبل — جدار الخزان", "2026-09-02T10:12:00.000Z", "image", "tank", 48, "before", "t04-shell", "available"),
  image(id(15, 2), IDS.ins2062, IDS.facNorth, IDS.eqT04, "t04-after.svg", "T-04 بعد — أثر عند القاعدة", "2026-09-28T08:42:00.000Z", "image", "corrosion", 86, "after", "t04-shell", "available"),
  image(id(15, 3), IDS.ins2062, IDS.facNorth, IDS.eqT04, "t04-thermal.svg", "T-04 إطار حراري تجريبي", "2026-09-28T08:48:00.000Z", "image", "thermal", 91, "single", null, "available"),
  image(id(15, 4), IDS.ins2062, IDS.facNorth, IDS.eqT04, "t04-clip.svg", "مقطع تجريبي غير متصل بكاميرا حية", "2026-09-28T08:55:00.000Z", "video", "tank", 91, "single", null, "unavailable"),
  image(id(15, 5), IDS.ins2041, IDS.facNorth, IDS.eqTW02, "tw02.svg", "TW-02 بدن البرج", "2026-09-20T11:05:00.000Z", "image", "tower", 78, "single", null, "available"),
  image(id(15, 6), IDS.ins2033, IDS.facNorth, IDS.eqHX08, "hx08.svg", "HX-08 سطح المبادل", "2026-09-15T08:40:00.000Z", "image", "pump", 40, "single", null, "available"),
  image(id(15, 7), IDS.ins2060, IDS.facPump, IDS.eqV22, "v22.svg", "V-22 جسم الصمام", "2026-10-01T09:30:00.000Z", "image", "valve", 30, "single", null, "available"),
  image(id(15, 8), IDS.ins2052, IDS.facNorth, IDS.eqPL12, "pl12.svg", "PL-12 دعامة الخط", "2026-10-03T08:15:00.000Z", "image", "pipe", 70, "single", null, "available"),
];

const analyses: AiAnalysisResult[] = [
  analysis(id(11, 1), IDS.ins2040, "2026-09-02T11:50:00.000Z", "رُصد تآكل سطحي في العينة التجريبية."),
  analysis(id(11, 2), IDS.ins2062, "2026-09-28T09:00:00.000Z", "العينة تشير إلى تسرب محتمل وحرارة مرتفعة. القرار النهائي بشري."),
  analysis(id(11, 3), IDS.ins2041, "2026-09-20T12:50:00.000Z", "ارتفاع حرارة متوسط على البرج."),
  analysis(id(11, 4), IDS.ins2033, "2026-09-15T08:55:00.000Z", "تغير بصري منخفض الثقة."),
  analysis(id(11, 5), IDS.ins2052, "2026-10-03T09:30:00.000Z", "تآكل وخلل معدات بانتظار المراجعة البشرية."),
];

const findings: InspectionFinding[] = [
  finding(id(12, 507), "FND-507", id(11, 1), IDS.ins2040, IDS.facNorth, IDS.eqT04, "corrosion", "medium", 0.71, "approved", "تآكل سطحي على عازل الخزان.", id(15, 1), "2026-09-02T11:50:00.000Z"),
  finding(id(12, 501), "FND-501", id(11, 2), IDS.ins2062, IDS.facNorth, IDS.eqT04, "possible_leak", "critical", 0.86, "maintenance", "أثر رطوبة وحرارة مرتفعة عند القاعدة.", id(15, 2), "2026-09-28T09:00:00.000Z"),
  finding(id(12, 509), "FND-509", id(11, 2), IDS.ins2062, IDS.facNorth, IDS.eqT04, "abnormal_heat", "high", 0.9, "approved", "القراءة الحرارية التجريبية 91 درجة.", id(15, 3), "2026-09-28T09:02:00.000Z"),
  finding(id(12, 503), "FND-503", id(11, 3), IDS.ins2041, IDS.facNorth, IDS.eqTW02, "abnormal_heat", "medium", 0.81, "approved", "حرارة أعلى من الجولة السابقة عند المنسوب الأوسط.", id(15, 5), "2026-09-20T12:50:00.000Z"),
  finding(id(12, 504), "FND-504", id(11, 4), IDS.ins2033, IDS.facNorth, IDS.eqHX08, "visual_change", "low", 0.58, "rejected", "تغير لوني طفيف لا يقابله أثر ميداني.", id(15, 6), "2026-09-15T08:55:00.000Z"),
  finding(id(12, 502), "FND-502", id(11, 5), IDS.ins2052, IDS.facNorth, IDS.eqPL12, "corrosion", "high", 0.74, "open", "تآكل على دعامة الخط PL-12.", id(15, 8), "2026-10-03T09:30:00.000Z"),
  finding(id(12, 508), "FND-508", id(11, 5), IDS.ins2052, IDS.facNorth, IDS.eqPL12, "equipment_fault", "medium", 0.69, "open", "خلخلة في مثبت الدعامة تحتاج فحصًا بشريًا.", id(15, 8), "2026-10-03T09:31:00.000Z"),
];

const reviews: HumanReview[] = [
  review(id(13, 1), id(12, 507), IDS.ins2040, IDS.sara, "approve", "يُعتمد كتآكل سطحي ويُراقب في الجولة التالية.", "2026-09-02T12:00:00.000Z"),
  review(id(13, 2), id(12, 501), IDS.ins2062, IDS.khaled, "maintenance", "تحويل للعزل وفحص اللحام. ليست قراءة حية.", "2026-09-28T09:20:00.000Z"),
  review(id(13, 3), id(12, 509), IDS.ins2062, IDS.nora, "approve", "اعتماد الارتفاع الحراري مقارنة بسجل سبتمبر.", "2026-09-28T09:28:00.000Z"),
  review(id(13, 4), id(12, 503), IDS.ins2041, IDS.khaled, "approve", "يُعتمد مع إبقاء المراقبة الدورية.", "2026-09-20T13:05:00.000Z"),
  review(id(13, 5), id(12, 504), IDS.ins2033, IDS.sara, "reject", "المعاينة الميدانية لا تدعم الملاحظة البصرية.", "2026-09-15T08:58:00.000Z"),
  review(id(13, 6), id(12, 504), IDS.ins2033, IDS.fahd, "note", "التقرير ما زال بحاجة إلى إجراء معالجة مكتوب.", "2026-09-16T08:00:00.000Z"),
];

const observations: Observation[] = [
  observation(id(14, 1), IDS.ins2040, IDS.sara, "العازل سليم في الأعلى ومتأثر في الثلث السفلي.", "2026-09-02T10:40:00.000Z"),
  observation(id(14, 2), IDS.ins2062, IDS.khaled, "طُلب إخلاء محيط القاعدة قبل أي عمل صيانة.", "2026-09-28T08:50:00.000Z"),
  observation(id(14, 3), IDS.ins2052, IDS.khaled, "الدعامة الثالثة على الخط يظهر عليها تقشر.", "2026-10-03T08:30:00.000Z"),
  observation(id(14, 4), IDS.ins2055, IDS.khaled, "بدأت الجولة من الجهة الغربية للخزان.", "2026-10-04T06:20:00.000Z"),
  observation(id(14, 5), IDS.ins2041, IDS.khaled, "لا رائحة ولا أثر تسرب حول البرج أثناء المعاينة.", "2026-09-20T11:30:00.000Z"),
];

const actions: CorrectiveAction[] = [
  {
    id: id(17, 1),
    report_id: IDS.rpt118,
    inspection_id: IDS.ins2062,
    description: "عزل محيط T-04 وفحص لحام القاعدة",
    status: "in_progress",
    created_at: "2026-09-28T10:00:00.000Z",
    updated_at: "2026-10-02T08:00:00.000Z",
  },
];

const reportDrafts: Report[] = [
  reportDraft(IDS.rpt110, "VG-RPT-0110", "تقرير التفتيش السابق لخزان T-04", IDS.ins2040, IDS.facNorth, IDS.locT04, IDS.sara, 1, "medium", "archived", null, "2026-09-02T12:20:00.000Z", "2026-09-05T08:00:00.000Z"),
  reportDraft(IDS.rpt118, "VG-RPT-0118", "تقرير متابعة خزان T-04", IDS.ins2062, IDS.facNorth, IDS.locT04, IDS.khaled, 1, "high", "completed", null, "2026-09-28T10:10:00.000Z", null),
  reportDraft(IDS.rpt119, "VG-RPT-0119", "تقرير برج التقطير TW-02", IDS.ins2041, IDS.facNorth, IDS.locTW02, IDS.khaled, 1, "medium", "in_review", null, "2026-09-20T13:30:00.000Z", null),
  reportDraft(IDS.rpt121, "VG-RPT-0121", "تقرير المبادل HX-08", IDS.ins2033, IDS.facNorth, IDS.locHX08, IDS.sara, 1, "low", "needs_completion", "بانتظار كتابة إجراء المعالجة.", "2026-09-15T09:20:00.000Z", null),
  reportDraft(IDS.rpt122, "VG-RPT-0122", "تقرير صمام V-22", IDS.ins2060, IDS.facPump, IDS.locV22, IDS.khaled, 1, "low", "new", null, "2026-10-01T10:40:00.000Z", null),
];

const devices: Device[] = [
  device(IDS.drone, "VG-DRONE-01", "درون الفحص الجوي 01", "drone", "mission", IDS.facNorth, "2026-10-04T06:40:00.000Z", 76, 26.421, 50.109, 33, 42, 6.2, "SIMULATION"),
  device(IDS.robot, "VG-ROBOT-02", "روبوت المسح الأرضي 02", "robot", "standby", IDS.facPump, "2026-10-04T05:10:00.000Z", 64, 26.389, 50.181, 36, 0, 0.4, "SIMULATION"),
  device(IDS.camOffline, "CAM-04", "كاميرا المنطقة B", "camera", "offline", IDS.facNorth, "2026-09-29T18:12:00.000Z", null, 26.419, 50.112, null, null, null, "UNAVAILABLE"),
  device(IDS.tempSensor, "TEMP-11", "حساس حرارة الخزان T-04", "temperature_sensor", "online", IDS.facNorth, "2026-10-04T06:42:00.000Z", 90, 26.4204, 50.1098, 88, null, null, "SIMULATION"),
  device(IDS.gasSensor, "GAS-07", "حساس غاز منطقة الخزانات", "gas_sensor", "online", IDS.facNorth, "2026-10-04T06:41:00.000Z", 81, 26.4208, 50.1104, 31, null, null, "SIMULATION"),
  device(IDS.camOnline, "CAM-02", "كاميرا محطة الضخ", "camera", "online", IDS.facPump, "2026-10-04T06:20:00.000Z", null, 26.3902, 50.1801, null, null, null, "SIMULATION"),
];

const telemetry: TelemetryRecord[] = devices.flatMap((item, index) => [
  telemetryRow(id(19, index + 1), item, "2026-10-04T06:10:00.000Z"),
  telemetryRow(id(19, index + 21), item, item.last_communication_at ?? "2026-10-04T06:40:00.000Z"),
]);

const activity: ActivityLog[] = [
  log(id(20, 1), "inspection_tasks", IDS.task3088, "create", "أُنشئت المهمة VG-TSK-3088", IDS.nora, "2026-08-28T06:00:00.000Z"),
  log(id(20, 2), "inspections", IDS.ins2040, "complete", "اكتمل التفتيش INS-2040 وحُفظ في السجل", IDS.sara, "2026-09-02T12:05:00.000Z"),
  log(id(20, 3), "reports", IDS.rpt110, "archive", "أُرشف التقرير VG-RPT-0110", IDS.fahd, "2026-09-05T08:00:00.000Z"),
  log(id(20, 4), "inspections", IDS.ins2062, "complete", "اكتمل التفتيش INS-2062 دون تعديل السجل السابق", IDS.khaled, "2026-09-28T09:40:00.000Z"),
  log(id(20, 5), "inspection_findings", id(12, 501), "review", "قرار بشري: تحويل للصيانة", IDS.khaled, "2026-09-28T09:20:00.000Z"),
  log(id(20, 6), "reports", IDS.rpt118, "generate", "صدر التقرير VG-RPT-0118", IDS.fahd, "2026-09-28T10:10:00.000Z"),
  log(id(20, 7), "inspections", IDS.ins2052, "analyze", "أُضيف تحليل تجريبي للتفتيش INS-2052", IDS.khaled, "2026-10-03T09:30:00.000Z"),
  log(id(20, 8), "inspections", IDS.ins2055, "start", "بدأ التفتيش INS-2055 على الخزان T-04", IDS.khaled, "2026-10-04T06:05:00.000Z"),
  log(id(20, 9), "inspection_tasks", IDS.task3060, "cancel", "أُلغيت المهمة VG-TSK-3060", IDS.nora, "2026-08-25T09:00:00.000Z"),
  log(id(20, 10), "reports", IDS.rpt121, "needs_completion", "طُلب استكمال تقرير HX-08", IDS.fahd, "2026-09-16T08:00:00.000Z"),
];

export function buildSeed(): AppData {
  const draft: AppData = {
    roles: [
      { id: IDS.roleManager, code: "manager", name_ar: "المدير", description: "عرض كامل وإدارة المهام والتقارير", created_at: CREATED, updated_at: CREATED },
      { id: IDS.roleInspector, code: "inspector", name_ar: "المفتش", description: "تنفيذ التفتيش والمراجعة البشرية", created_at: CREATED, updated_at: CREATED },
      { id: IDS.roleCollector, code: "report_collector", name_ar: "جامع التقارير", description: "استكمال التقارير والأرشفة والتصدير", created_at: CREATED, updated_at: CREATED },
    ],
    users,
    facilities,
    zones,
    equipment,
    inspection_locations: locations,
    inspection_tasks: tasks,
    inspections,
    inspection_checklists: checklists,
    inspection_checklist_items: checklistItems,
    ai_analysis_results: analyses,
    inspection_findings: findings,
    human_reviews: reviews,
    observations,
    inspection_images: images,
    reports: reportDrafts,
    corrective_actions: actions,
    devices,
    telemetry_records: telemetry,
    activity_logs: activity,
  };
  draft.reports = draft.reports.map((report) => ({ ...report, snapshot: buildReportSnapshot(draft, report) }));
  return draft;
}

function seedChecklist(
  inspectionId: string,
  checklistId: string,
  completedAt: string | null,
  overrides: Partial<Record<string, { response: CheckResult; numeric?: number; notes?: string }>>,
) {
  checklists.push({
    id: checklistId,
    inspection_id: inspectionId,
    completed_at: completedAt,
    created_at: completedAt ?? "2026-10-04T06:05:00.000Z",
    updated_at: completedAt ?? "2026-10-04T06:30:00.000Z",
  });
  const serial = checklistSerial++;
  CHECKLIST_TEMPLATE.forEach((template, index) => {
    const override = overrides[template.key];
    checklistItems.push({
      id: fixedId(10, serial * 10 + index + 1),
      checklist_id: checklistId,
      item_key: template.key,
      label: template.label,
      response: override?.response ?? null,
      numeric_value: override?.numeric ?? null,
      unit: template.unit,
      notes: override?.notes ?? "",
      sort_order: index + 1,
      updated_at: completedAt ?? "2026-10-04T06:30:00.000Z",
    });
  });
}

function facility(fid: string, code: string, name: string, region: string, facilityType: string, latitude: number, longitude: number): Facility {
  return { id: fid, code, name, region, facility_type: facilityType, status: "active", latitude, longitude, created_at: CREATED, updated_at: CREATED };
}

function zone(zid: string, facilityId: string, code: string, name: string, description: string, risk: Zone["risk_level"]): Zone {
  return { id: zid, facility_id: facilityId, code, name, description, risk_level: risk, created_at: CREATED, updated_at: CREATED };
}

function equipmentRow(eid: string, facilityId: string, zoneId: string, code: string, name: string, equipmentType: Equipment["equipment_type"], risk: Equipment["risk_level"]): Equipment {
  return { id: eid, facility_id: facilityId, zone_id: zoneId, code, name, equipment_type: equipmentType, status: "active", risk_level: risk, created_at: CREATED, updated_at: CREATED };
}

function location(
  lid: string,
  code: string,
  name: string,
  facilityId: string,
  zoneId: string,
  equipmentId: string,
  mapX: number,
  mapY: number,
  risk: InspectionLocation["risk_level"],
  marker: InspectionLocation["marker_state"],
  inspectionStatus: string,
  lastInspection: string | null,
  nextInspection: string | null,
  notes: string,
): InspectionLocation {
  const facility = facilities.find((item) => item.id === facilityId)!;
  return {
    id: lid,
    code,
    name,
    facility_id: facilityId,
    zone_id: zoneId,
    equipment_id: equipmentId,
    latitude: Number((facility.latitude + (mapY - 50) * 0.0004).toFixed(5)),
    longitude: Number((facility.longitude + (mapX - 50) * 0.0004).toFixed(5)),
    map_x: mapX,
    map_y: mapY,
    risk_level: risk,
    marker_state: marker,
    inspection_status: inspectionStatus,
    last_inspection_at: lastInspection,
    next_inspection_at: nextInspection,
    last_notes: notes,
    created_at: CREATED,
    updated_at: "2026-10-04T06:00:00.000Z",
  };
}

function user(uid: string, fullName: string, email: string, role: User["role_code"]): User {
  return { id: uid, full_name: fullName, email, role_code: role, is_active: true, created_at: CREATED, updated_at: CREATED };
}

function task(
  tid: string,
  code: string,
  title: string,
  facilityId: string,
  locationId: string,
  equipmentId: string,
  inspectorId: string | null,
  priority: InspectionTask["priority"],
  due: string,
  status: InspectionTask["status"],
  stage: InspectionTask["workflow_stage"],
  createdAt: string,
): InspectionTask {
  return {
    id: tid,
    code,
    title,
    facility_id: facilityId,
    location_id: locationId,
    equipment_id: equipmentId,
    inspector_id: inspectorId,
    priority,
    due_date: due,
    status,
    workflow_stage: stage,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

function inspection(
  iid: string,
  code: string,
  taskId: string,
  facilityId: string,
  locationId: string,
  equipmentId: string,
  inspectorId: string,
  result: Inspection["result"],
  risk: Inspection["risk_level"],
  status: Inspection["status"],
  stage: Inspection["workflow_stage"],
  started: string,
  completed: string | null,
  summary: string,
): Inspection {
  return {
    id: iid,
    code,
    task_id: taskId,
    facility_id: facilityId,
    location_id: locationId,
    equipment_id: equipmentId,
    inspector_id: inspectorId,
    result,
    risk_level: risk,
    status,
    workflow_stage: stage,
    started_at: started,
    completed_at: completed,
    summary,
    clearance_note: null,
    created_at: started,
    updated_at: completed ?? started,
  };
}

function image(
  imageId: string,
  inspectionId: string,
  facilityId: string,
  equipmentId: string,
  fileName: string,
  caption: string,
  capturedAt: string,
  mediaType: InspectionImage["media_type"],
  kind: FrameKind,
  heat: number,
  role: InspectionImage["comparison_role"],
  group: string | null,
  playback: InspectionImage["playback"],
): InspectionImage {
  const equipmentCode = equipment.find((item) => item.id === equipmentId)?.code ?? "EQ";
  return {
    id: imageId,
    inspection_id: inspectionId,
    facility_id: facilityId,
    equipment_id: equipmentId,
    file_name: fileName,
    mime_type: mediaType === "video" ? "video/mp4" : "image/svg+xml",
    storage_path: `inspection-media/${facilityId}/${inspectionId}/${fileName}`,
    data_url: inspectionFrame({ code: equipmentCode, title: caption, kind, stamp: capturedAt, heat, variant: role }),
    caption,
    captured_at: capturedAt,
    media_type: mediaType,
    source: "SIMULATION",
    comparison_group: group,
    comparison_role: role,
    playback,
    created_at: capturedAt,
  };
}

function analysis(aid: string, inspectionId: string, createdAt: string, summary: string): AiAnalysisResult {
  return { id: aid, inspection_id: inspectionId, provider: "mock", is_demo: true, summary, created_at: createdAt };
}

function finding(
  fid: string,
  code: string,
  analysisId: string,
  inspectionId: string,
  facilityId: string,
  equipmentId: string,
  category: InspectionFinding["category"],
  severity: InspectionFinding["severity"],
  confidence: number,
  status: InspectionFinding["status"],
  summary: string,
  imageId: string,
  detectedAt: string,
): InspectionFinding {
  return {
    id: fid,
    code,
    analysis_id: analysisId,
    inspection_id: inspectionId,
    facility_id: facilityId,
    equipment_id: equipmentId,
    category,
    severity,
    confidence,
    status,
    summary,
    image_id: imageId,
    is_demo: true,
    detected_at: detectedAt,
    created_at: detectedAt,
    updated_at: detectedAt,
  };
}

function review(rid: string, findingId: string, inspectionId: string, reviewerId: string, decision: HumanReview["decision"], notes: string, decidedAt: string): HumanReview {
  return { id: rid, finding_id: findingId, inspection_id: inspectionId, reviewer_id: reviewerId, decision, notes, decided_at: decidedAt, created_at: decidedAt };
}

function observation(oid: string, inspectionId: string, authorId: string, body: string, createdAt: string): Observation {
  return { id: oid, inspection_id: inspectionId, author_id: authorId, body, created_at: createdAt };
}

function reportDraft(
  rid: string,
  code: string,
  title: string,
  inspectionId: string,
  facilityId: string,
  locationId: string,
  inspectorId: string,
  revision: number,
  risk: Report["risk_level"],
  status: Report["status"],
  completionNote: string | null,
  createdAt: string,
  archivedAt: string | null,
): Report {
  return {
    id: rid,
    code,
    title,
    inspection_id: inspectionId,
    facility_id: facilityId,
    location_id: locationId,
    inspector_id: inspectorId,
    revision,
    risk_level: risk,
    status,
    snapshot: undefined as unknown as Report["snapshot"],
    completion_note: completionNote,
    archived_at: archivedAt,
    created_at: createdAt,
    updated_at: archivedAt ?? createdAt,
  };
}

function device(
  did: string,
  code: string,
  name: string,
  deviceType: Device["device_type"],
  status: Device["status"],
  facilityId: string,
  last: string | null,
  battery: number | null,
  latitude: number | null,
  longitude: number | null,
  temperature: number | null,
  altitude: number | null,
  speed: number | null,
  source: Device["source"],
): Device {
  return {
    id: did,
    code,
    name,
    device_type: deviceType,
    status,
    facility_id: facilityId,
    last_communication_at: last,
    battery_percent: battery,
    latitude,
    longitude,
    temperature_c: temperature,
    altitude_m: altitude,
    speed_mps: speed,
    source,
    created_at: CREATED,
    updated_at: last ?? CREATED,
  };
}

function telemetryRow(tid: string, item: Device, recordedAt: string): TelemetryRecord {
  return {
    id: tid,
    device_id: item.id,
    facility_id: item.facility_id,
    latitude: item.latitude,
    longitude: item.longitude,
    temperature_c: item.temperature_c,
    altitude_m: item.altitude_m,
    speed_mps: item.speed_mps,
    battery_percent: item.battery_percent,
    source: item.source,
    recorded_at: recordedAt,
    created_at: recordedAt,
  };
}

function log(lid: string, entityType: string, entityId: string, action: string, message: string, actorId: string, createdAt: string): ActivityLog {
  return { id: lid, entity_type: entityType, entity_id: entityId, action, message, actor_id: actorId, created_at: createdAt };
}
