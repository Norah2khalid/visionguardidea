import { CHECKLIST_TEMPLATE } from "@/lib/checklistTemplate";
import {
  findingCategoryLabel,
  inspectionResultLabel,
  reviewDecisionLabel,
  riskLabel,
  severityLabel,
} from "@/lib/labels";
import type {
  AppData,
  DemoRole,
  Equipment,
  Facility,
  Inspection,
  InspectionFinding,
  InspectionLocation,
  InspectionTask,
  Report,
  RiskLevel,
  TaskStatus,
  User,
  Zone,
} from "@/types/domain";
import { isPastDue } from "@/utils/format";

const OPEN_TASK: TaskStatus[] = ["new", "scheduled", "in_progress", "pending_review"];
const SEVERITY_SCORE: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 };

export function byId<T extends { id: string }>(rows: T[], id: string | null | undefined): T | undefined {
  if (!id) return undefined;
  return rows.find((row) => row.id === id);
}

export function userById(data: AppData, id: string | null | undefined): User | undefined {
  return byId(data.users, id);
}

export function userName(data: AppData, id: string | null | undefined): string {
  return userById(data, id)?.full_name ?? "غير معين";
}

export function facilityName(data: AppData, id: string): string {
  return byId(data.facilities, id)?.name ?? "—";
}

export function zoneName(data: AppData, id: string): string {
  return byId(data.zones, id)?.name ?? "—";
}

export function equipmentLabel(data: AppData, id: string): string {
  const equipment = byId(data.equipment, id);
  if (!equipment) return "—";
  return `${equipment.code} — ${equipment.name}`;
}

export function locationOfEquipment(data: AppData, equipmentId: string): InspectionLocation | undefined {
  return data.inspection_locations.find((location) => location.equipment_id === equipmentId);
}

export function personaForRole(data: AppData, role: DemoRole): User {
  const match = data.users.find((user) => user.role_code === role && user.is_active);
  if (!match) throw new Error("لا يوجد مستخدم تجريبي لهذا الدور");
  return match;
}

export function isTaskOverdue(task: InspectionTask, now = new Date()): boolean {
  if (task.status === "completed" || task.status === "cancelled") return false;
  return isPastDue(task.due_date, now);
}

export function visibleTasks(data: AppData, role: DemoRole, userId: string): InspectionTask[] {
  if (role === "inspector") return data.inspection_tasks.filter((task) => task.inspector_id === userId);
  return data.inspection_tasks;
}

export function visibleInspections(data: AppData, role: DemoRole, userId: string): Inspection[] {
  if (role === "inspector") return data.inspections.filter((inspection) => inspection.inspector_id === userId);
  return data.inspections;
}

export function visibleReports(data: AppData, role: DemoRole, userId: string): Report[] {
  if (role === "inspector") return data.reports.filter((report) => report.inspector_id === userId);
  return data.reports;
}

export interface Kpis {
  locations: number;
  activeTasks: number;
  overdueTasks: number;
  completedInspections: number;
  alerts: number;
  criticalAlerts: number;
  devices: number;
  drones: number;
}

export function computeKpis(data: AppData, tasks: InspectionTask[], inspections: Inspection[], now = new Date()): Kpis {
  const active = tasks.filter((task) => OPEN_TASK.includes(task.status));
  const openFindings = data.inspection_findings.filter((finding) => finding.status === "open" || finding.status === "extra_inspection");
  return {
    locations: data.inspection_locations.length,
    activeTasks: active.length,
    overdueTasks: tasks.filter((task) => isTaskOverdue(task, now)).length,
    completedInspections: inspections.filter((inspection) => inspection.status === "completed").length,
    alerts: openFindings.length + tasks.filter((task) => isTaskOverdue(task, now)).length,
    criticalAlerts: openFindings.filter((finding) => finding.severity === "critical" || finding.severity === "high").length,
    devices: data.devices.length,
    drones: data.devices.filter((device) => device.device_type === "drone" || device.device_type === "robot").length,
  };
}

export function checklistFor(data: AppData, inspectionId: string) {
  const checklist = data.inspection_checklists.find((row) => row.inspection_id === inspectionId);
  const items = checklist
    ? data.inspection_checklist_items
        .filter((item) => item.checklist_id === checklist.id)
        .sort((a, b) => a.sort_order - b.sort_order)
    : [];
  return { checklist, items };
}

export function findingsFor(data: AppData, inspectionId: string): InspectionFinding[] {
  return data.inspection_findings
    .filter((finding) => finding.inspection_id === inspectionId)
    .sort((a, b) => b.detected_at.localeCompare(a.detected_at));
}

export function reviewsForFinding(data: AppData, findingId: string) {
  return data.human_reviews
    .filter((review) => review.finding_id === findingId)
    .sort((a, b) => b.decided_at.localeCompare(a.decided_at));
}

export function latestReview(data: AppData, findingId: string) {
  return reviewsForFinding(data, findingId)[0];
}

export function terminalDecision(finding: InspectionFinding): boolean {
  return finding.status !== "open";
}

export function imagesFor(data: AppData, inspectionId: string) {
  return data.inspection_images
    .filter((image) => image.inspection_id === inspectionId)
    .sort((a, b) => a.captured_at.localeCompare(b.captured_at));
}

export function observationsFor(data: AppData, inspectionId: string) {
  return data.observations
    .filter((observation) => observation.inspection_id === inspectionId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function reportsForInspection(data: AppData, inspectionId: string): Report[] {
  return data.reports
    .filter((report) => report.inspection_id === inspectionId)
    .sort((a, b) => b.revision - a.revision || b.created_at.localeCompare(a.created_at));
}

export function activityFor(data: AppData, entityId: string) {
  return data.activity_logs
    .filter((log) => log.entity_id === entityId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export interface Comparison {
  previous: Inspection;
  current: Inspection;
  riskChange: string;
  conditionChange: string;
  temperatureChange: string;
  newFindings: InspectionFinding[];
  resolvedFindings: InspectionFinding[];
  frequencyDays: number | null;
}

export function temperatureOf(data: AppData, inspectionId: string): number | null {
  const { items } = checklistFor(data, inspectionId);
  const row = items.find((item) => item.item_key === "temperature");
  return row?.numeric_value ?? null;
}

export function conditionScore(data: AppData, inspectionId: string): number | null {
  const { items } = checklistFor(data, inspectionId);
  const scored = items.filter((item) => item.response && item.response !== "not_applicable");
  if (!scored.length) return null;
  const points = scored.reduce((sum, item) => {
    if (item.response === "pass") return sum + 1;
    if (item.response === "warning") return sum + 0.5;
    return sum;
  }, 0);
  return points / scored.length;
}

export function compareInspections(data: AppData, currentId: string): Comparison | null {
  const current = byId(data.inspections, currentId);
  if (!current) return null;
  const previous = data.inspections
    .filter((inspection) => inspection.equipment_id === current.equipment_id && inspection.id !== current.id && inspection.started_at < current.started_at)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
  if (!previous) return null;
  const previousFindings = findingsFor(data, previous.id);
  const currentFindings = findingsFor(data, current.id);
  const previousCodes = new Set(previousFindings.map((finding) => finding.category));
  const currentCategories = new Set(currentFindings.map((finding) => finding.category));
  const previousTemp = temperatureOf(data, previous.id);
  const currentTemp = temperatureOf(data, current.id);
  const previousCondition = conditionScore(data, previous.id);
  const currentCondition = conditionScore(data, current.id);
  const days = Math.round((new Date(current.started_at).getTime() - new Date(previous.started_at).getTime()) / 86_400_000);
  return {
    previous,
    current,
    riskChange: `${riskLabel[previous.risk_level]} ← ${riskLabel[current.risk_level]}`,
    conditionChange: formatCondition(previousCondition, currentCondition),
    temperatureChange:
      previousTemp == null || currentTemp == null ? "لا توجد قراءة حرارة في السجلين" : `${previousTemp}°C ← ${currentTemp}°C`,
    newFindings: currentFindings.filter((finding) => !previousCodes.has(finding.category)),
    resolvedFindings: previousFindings.filter((finding) => !currentCategories.has(finding.category) && finding.status !== "open"),
    frequencyDays: Number.isFinite(days) ? days : null,
  };
}

function formatCondition(previous: number | null, current: number | null): string {
  if (previous == null || current == null) return "قائمة الفحص غير مكتملة في أحد السجلين";
  const delta = Math.round((current - previous) * 100);
  const direction = delta > 0 ? "تحسن" : delta < 0 ? "تراجع" : "بدون تغير";
  return `${direction} (${delta > 0 ? "+" : ""}${delta} نقطة مئوية)`;
}

export function resultFromChecklist(data: AppData, inspectionId: string): Inspection["result"] {
  const { items } = checklistFor(data, inspectionId);
  if (items.some((item) => item.response === "fail")) return "fail";
  if (items.some((item) => item.response === "warning")) return "warning";
  if (items.every((item) => item.response)) return "pass";
  return "pending";
}

export function worstRisk(levels: RiskLevel[]): RiskLevel {
  return [...levels].sort((a, b) => SEVERITY_SCORE[b] - SEVERITY_SCORE[a])[0] ?? "low";
}

export interface TrendPoint {
  label: string;
  score: number;
}

export function riskTrend(data: AppData): TrendPoint[] {
  const buckets = new Map<string, number[]>();
  for (const finding of data.inspection_findings) {
    const label = new Intl.DateTimeFormat("ar-SA", { month: "short" }).format(new Date(finding.detected_at));
    const list = buckets.get(label) ?? [];
    list.push(SEVERITY_SCORE[finding.severity]);
    buckets.set(label, list);
  }
  return [...buckets.entries()].map(([label, scores]) => ({
    label,
    score: Number((scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(2)),
  }));
}

export function findingsByCategory(data: AppData): { label: string; count: number }[] {
  return (Object.keys(findingCategoryLabel) as (keyof typeof findingCategoryLabel)[]).map((key) => ({
    label: findingCategoryLabel[key],
    count: data.inspection_findings.filter((finding) => finding.category === key).length,
  }));
}

export function riskDistribution(data: AppData): { label: string; count: number; key: RiskLevel }[] {
  return (["low", "medium", "high", "critical"] as RiskLevel[]).map((key) => ({
    key,
    label: riskLabel[key],
    count: data.inspection_locations.filter((location) => location.risk_level === key).length,
  }));
}

export function findingResolution(data: AppData): { label: string; count: number }[] {
  const open = data.inspection_findings.filter((finding) => finding.status === "open" || finding.status === "extra_inspection" || finding.status === "maintenance").length;
  const closed = data.inspection_findings.filter((finding) => finding.status === "approved" || finding.status === "rejected").length;
  return [
    { label: "مفتوحة", count: open },
    { label: "مغلقة", count: closed },
  ];
}

export interface EquipmentOutlook {
  equipment: Equipment;
  condition: string;
  predictedRisk: string;
  priority: string;
  history: string;
}

export function equipmentOutlook(data: AppData): EquipmentOutlook[] {
  return data.equipment.slice(0, 6).map((equipment) => {
    const inspections = data.inspections
      .filter((inspection) => inspection.equipment_id === equipment.id)
      .sort((a, b) => b.started_at.localeCompare(a.started_at));
    const latest = inspections[0];
    const open = data.inspection_findings.filter((finding) => finding.equipment_id === equipment.id && finding.status === "open");
    const task = data.inspection_tasks
      .filter((item) => item.equipment_id === equipment.id && OPEN_TASK.includes(item.status))
      .sort((a, b) => SEVERITY_SCORE[b.priority] - SEVERITY_SCORE[a.priority])[0];
    const score = latest ? conditionScore(data, latest.id) : null;
    return {
      equipment,
      condition: score == null ? "لا توجد قائمة مكتملة" : `${Math.round(score * 100)}٪ بنود مطابقة أو مقبولة`,
      predictedRisk: open[0] ? `${riskLabel[open[0].severity]} — ${open[0].code}` : riskLabel[equipment.risk_level],
      priority: task ? task.priority : "لا توجد مهمة مفتوحة",
      history: inspections.length > 1 ? `${inspections.length} عمليات على السجل` : inspections.length === 1 ? "تفتيش واحد مسجل" : "بدون سجل",
    };
  });
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  href: string;
}

export function notificationsFor(data: AppData, role: DemoRole, userId: string, now = new Date()): AppNotification[] {
  const tasks = visibleTasks(data, role, userId);
  const reports = visibleReports(data, role, userId);
  const items: AppNotification[] = [];
  for (const task of tasks.filter((task) => isTaskOverdue(task, now))) {
    items.push({
      id: `overdue:${task.id}`,
      title: `مهمة متأخرة ${task.code}`,
      body: task.title,
      severity: "warning",
      href: `/tasks/${task.id}`,
    });
  }
  for (const finding of data.inspection_findings.filter((finding) => finding.status === "open")) {
    const inspection = byId(data.inspections, finding.inspection_id);
    if (role === "inspector" && inspection?.inspector_id !== userId) continue;
    items.push({
      id: `finding:${finding.id}`,
      title: `${finding.code} · ${severityLabel[finding.severity]}`,
      body: finding.summary,
      severity: finding.severity === "critical" || finding.severity === "high" ? "critical" : "warning",
      href: `/history/${finding.inspection_id}`,
    });
  }
  for (const report of reports.filter((report) => report.status === "needs_completion" || report.status === "new" || report.status === "in_review")) {
    items.push({
      id: `report:${report.id}`,
      title: `تقرير ${report.code}`,
      body: report.title,
      severity: report.status === "needs_completion" ? "warning" : "info",
      href: `/reports/${report.id}`,
    });
  }
  return items;
}

export function reviewState(data: AppData, inspection: Inspection): string {
  if (inspection.workflow_stage === "recorded" || inspection.workflow_stage === "reported") return "محفوظ في السجل";
  if (inspection.status === "completed") return "بانتظار التقرير";
  const findings = findingsFor(data, inspection.id);
  if (!findings.length) return inspection.clearance_note ? "لا توجد ملاحظات AI" : "بانتظار التحليل";
  if (findings.every(terminalDecision)) return "تمت المراجعة";
  return "بانتظار المراجعة";
}

export function observationCount(data: AppData, inspectionId: string): number {
  return observationsFor(data, inspectionId).length + findingsFor(data, inspectionId).length;
}

export function stageIndex(stage: Inspection["workflow_stage"]): number {
  const order = ["created", "assigned", "started", "checklist", "media", "ai", "review", "completed", "reported", "recorded"];
  return order.indexOf(stage);
}

export function checklistTemplateKeys(): string[] {
  return CHECKLIST_TEMPLATE.map((item) => item.key);
}

export function decisionText(decision: keyof typeof reviewDecisionLabel): string {
  return reviewDecisionLabel[decision];
}

export function resultText(result: Inspection["result"]): string {
  return inspectionResultLabel[result];
}

export function zonesInFacility(data: AppData, facilityId: string): Zone[] {
  return data.zones.filter((zone) => zone.facility_id === facilityId);
}

export function equipmentInZone(data: AppData, zoneId: string): Equipment[] {
  return data.equipment.filter((item) => item.zone_id === zoneId);
}

export function locationsInZone(data: AppData, zoneId: string): InspectionLocation[] {
  return data.inspection_locations.filter((location) => location.zone_id === zoneId);
}

export function facilityOf(data: AppData, id: string): Facility | undefined {
  return byId(data.facilities, id);
}
