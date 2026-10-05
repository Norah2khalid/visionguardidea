export const DEMO_ROLES = ["manager", "inspector", "report_collector"] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

export const TASK_STATUSES = [
  "new",
  "scheduled",
  "in_progress",
  "pending_review",
  "completed",
  "cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const MARKER_STATES = ["NORMAL", "WARNING", "CRITICAL", "INSPECTED"] as const;
export type MarkerState = (typeof MARKER_STATES)[number];

export const EQUIPMENT_TYPES = ["tank", "pipeline", "valve", "pump", "tower", "industrial"] as const;
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

export const CHECK_RESULTS = ["pass", "warning", "fail", "not_applicable"] as const;
export type CheckResult = (typeof CHECK_RESULTS)[number];

export const WORKFLOW_STAGES = [
  "created",
  "assigned",
  "started",
  "checklist",
  "media",
  "ai",
  "review",
  "completed",
  "reported",
  "recorded",
] as const;
export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];

export const FINDING_CATEGORIES = [
  "possible_leak",
  "corrosion",
  "abnormal_heat",
  "equipment_fault",
  "visual_change",
  "needs_followup",
] as const;
export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

export const FINDING_STATUSES = ["open", "approved", "rejected", "extra_inspection", "maintenance"] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export const REVIEW_DECISIONS = ["approve", "reject", "extra_inspection", "maintenance", "note"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export const REPORT_STATUSES = ["new", "in_review", "completed", "needs_completion", "archived"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const INSPECTION_RESULTS = ["pass", "warning", "fail", "pending"] as const;
export type InspectionResult = (typeof INSPECTION_RESULTS)[number];

export const DEVICE_TYPES = ["drone", "robot", "camera", "temperature_sensor", "gas_sensor", "other_sensor"] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export const DEVICE_STATUSES = ["online", "standby", "mission", "offline", "fault"] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

export const DATA_SOURCES = ["LIVE", "IMPORTED", "SIMULATION", "UNAVAILABLE"] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

export const ACTION_STATUSES = ["open", "in_progress", "done"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export interface Role {
  id: string;
  code: DemoRole;
  name_ar: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  full_name: string;
  email: string;
  role_code: DemoRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Facility {
  id: string;
  code: string;
  name: string;
  region: string;
  facility_type: string;
  status: "active" | "inactive";
  latitude: number;
  longitude: number;
  created_at: string;
  updated_at: string;
}

export interface Zone {
  id: string;
  facility_id: string;
  code: string;
  name: string;
  description: string;
  risk_level: RiskLevel;
  created_at: string;
  updated_at: string;
}

export interface Equipment {
  id: string;
  facility_id: string;
  zone_id: string;
  code: string;
  name: string;
  equipment_type: EquipmentType;
  status: "active" | "out_of_service";
  risk_level: RiskLevel;
  created_at: string;
  updated_at: string;
}

export interface InspectionLocation {
  id: string;
  code: string;
  name: string;
  facility_id: string;
  zone_id: string;
  equipment_id: string;
  latitude: number;
  longitude: number;
  map_x: number;
  map_y: number;
  risk_level: RiskLevel;
  marker_state: MarkerState;
  inspection_status: string;
  last_inspection_at: string | null;
  next_inspection_at: string | null;
  last_notes: string;
  created_at: string;
  updated_at: string;
}

export interface InspectionTask {
  id: string;
  code: string;
  title: string;
  facility_id: string;
  location_id: string;
  equipment_id: string;
  inspector_id: string | null;
  priority: Priority;
  due_date: string;
  status: TaskStatus;
  workflow_stage: WorkflowStage;
  created_at: string;
  updated_at: string;
}

export interface Inspection {
  id: string;
  code: string;
  task_id: string;
  facility_id: string;
  location_id: string;
  equipment_id: string;
  inspector_id: string;
  result: InspectionResult;
  risk_level: RiskLevel;
  status: "in_progress" | "pending_review" | "completed" | "cancelled";
  workflow_stage: WorkflowStage;
  started_at: string;
  completed_at: string | null;
  summary: string;
  clearance_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface InspectionChecklist {
  id: string;
  inspection_id: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InspectionChecklistItem {
  id: string;
  checklist_id: string;
  item_key: string;
  label: string;
  response: CheckResult | null;
  numeric_value: number | null;
  unit: string | null;
  notes: string;
  sort_order: number;
  updated_at: string;
}

export interface AiAnalysisResult {
  id: string;
  inspection_id: string;
  provider: string;
  is_demo: boolean;
  summary: string;
  created_at: string;
}

export interface InspectionFinding {
  id: string;
  code: string;
  analysis_id: string | null;
  inspection_id: string;
  facility_id: string;
  equipment_id: string;
  category: FindingCategory;
  severity: Severity;
  confidence: number;
  status: FindingStatus;
  summary: string;
  image_id: string | null;
  is_demo: boolean;
  detected_at: string;
  created_at: string;
  updated_at: string;
}

export interface HumanReview {
  id: string;
  finding_id: string | null;
  inspection_id: string;
  reviewer_id: string;
  decision: ReviewDecision;
  notes: string;
  decided_at: string;
  created_at: string;
}

export interface Observation {
  id: string;
  inspection_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface InspectionImage {
  id: string;
  inspection_id: string;
  facility_id: string;
  equipment_id: string;
  file_name: string;
  mime_type: string;
  storage_path: string;
  data_url: string;
  caption: string;
  captured_at: string;
  media_type: "image" | "video";
  source: DataSource;
  comparison_group: string | null;
  comparison_role: "before" | "after" | "single";
  playback: "available" | "unavailable";
  created_at: string;
}

export interface ReportSnapshot {
  report_code: string;
  revision: number;
  inspection_code: string;
  inspection_date: string;
  facility_name: string;
  zone_name: string;
  equipment_label: string;
  location_label: string;
  inspector_name: string;
  result_label: string;
  risk_level: RiskLevel;
  checklist: { label: string; response: string; numeric: string; notes: string }[];
  images: { caption: string; captured_at: string; data_url: string; media_type: "image" | "video" }[];
  observations: { body: string; author: string; created_at: string }[];
  ai_findings: { code: string; category: string; severity: string; confidence: string; status: string; summary: string; demo: boolean }[];
  human_decisions: { decision: string; reviewer: string; notes: string; decided_at: string }[];
  corrective_actions: { description: string; status: string }[];
  proposed_actions: string[];
  treatment_status: string;
  disclaimer: string;
  generated_at: string;
}

export interface Report {
  id: string;
  code: string;
  title: string;
  inspection_id: string;
  facility_id: string;
  location_id: string;
  inspector_id: string;
  revision: number;
  risk_level: RiskLevel;
  status: ReportStatus;
  snapshot: ReportSnapshot;
  completion_note: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CorrectiveAction {
  id: string;
  report_id: string;
  inspection_id: string;
  description: string;
  status: ActionStatus;
  created_at: string;
  updated_at: string;
}

export interface Device {
  id: string;
  code: string;
  name: string;
  device_type: DeviceType;
  status: DeviceStatus;
  facility_id: string;
  last_communication_at: string | null;
  battery_percent: number | null;
  latitude: number | null;
  longitude: number | null;
  temperature_c: number | null;
  altitude_m: number | null;
  speed_mps: number | null;
  source: DataSource;
  created_at: string;
  updated_at: string;
}

export interface TelemetryRecord {
  id: string;
  device_id: string;
  facility_id: string;
  latitude: number | null;
  longitude: number | null;
  temperature_c: number | null;
  altitude_m: number | null;
  speed_mps: number | null;
  battery_percent: number | null;
  source: DataSource;
  recorded_at: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  message: string;
  actor_id: string | null;
  created_at: string;
}

export interface AppData {
  roles: Role[];
  users: User[];
  facilities: Facility[];
  zones: Zone[];
  equipment: Equipment[];
  inspection_locations: InspectionLocation[];
  inspection_tasks: InspectionTask[];
  inspections: Inspection[];
  inspection_checklists: InspectionChecklist[];
  inspection_checklist_items: InspectionChecklistItem[];
  ai_analysis_results: AiAnalysisResult[];
  inspection_findings: InspectionFinding[];
  human_reviews: HumanReview[];
  observations: Observation[];
  inspection_images: InspectionImage[];
  reports: Report[];
  corrective_actions: CorrectiveAction[];
  devices: Device[];
  telemetry_records: TelemetryRecord[];
  activity_logs: ActivityLog[];
}

export interface PersistedState {
  version: number;
  seed_stamp: string;
  role: DemoRole;
  data: AppData;
  read_notification_ids: string[];
}

export interface ActorContext {
  actor: User;
  at?: string;
}

export interface MutationResult {
  ok: boolean;
  data: AppData;
  message: string;
}
