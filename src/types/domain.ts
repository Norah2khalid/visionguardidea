export const INSPECTION_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "READY",
  "IN_PROGRESS",
  "REVIEW_REQUIRED",
  "COMPLETED",
  "FOLLOW_UP_REQUIRED",
  "CLOSED",
  "CANCELLED",
] as const;
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

export const MISSION_STATUSES = [
  "CREATED",
  "ASSIGNED",
  "READY",
  "DISPATCHED",
  "INSPECTING",
  "DATA_TRANSMISSION",
  "REVIEW_REQUIRED",
  "INSPECTOR_REVIEW",
  "COMPLETED",
  "CANCELLED",
  "INTERRUPTED",
  "FAILED",
] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];

export const INSPECTION_METHODS = ["human", "drone", "robot", "drone_human", "robot_human"] as const;
export type InspectionMethod = (typeof INSPECTION_METHODS)[number];

export const RISK_LEVELS = ["normal", "medium", "high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const DEVICE_STATUSES = [
  "available",
  "reserved",
  "on_mission",
  "charging",
  "maintenance",
  "offline",
  "fault",
] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

export const CHECKLIST_RESPONSES = ["pass", "fail", "needs_review", "not_applicable"] as const;
export type ChecklistResponse = (typeof CHECKLIST_RESPONSES)[number];

export const DECISION_ACTIONS = ["confirm", "reject", "follow_up", "maintenance", "reinspect", "close"] as const;
export type DecisionAction = (typeof DECISION_ACTIONS)[number];

export const POINT_CATEGORIES = [
  "possible_leak",
  "possible_corrosion",
  "visible_damage",
  "unusual_reading",
  "equipment_condition",
  "manual_observation",
] as const;
export type PointCategory = (typeof POINT_CATEGORIES)[number];

export const ALERT_CATEGORIES = [
  "high_risk_zone",
  "point_review",
  "threshold_exceeded",
  "low_battery",
  "device_offline",
  "connection_lost",
  "mission_interrupted",
  "maintenance_required",
  "inspection_overdue",
  "review_pending",
] as const;
export type AlertCategory = (typeof ALERT_CATEGORIES)[number];

export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const ROLES = ["ADMIN", "INSPECTOR", "OPERATOR"] as const;
export type RoleCode = (typeof ROLES)[number];

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface Role {
  id: string;
  code: RoleCode;
  name_ar: string;
  description: string;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role_code: RoleCode;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Facility {
  id: string;
  code: string;
  name: string;
  description: string | null;
  facility_type: string;
  status: "active" | "inactive" | "archived";
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Site {
  id: string;
  facility_id: string;
  code: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Sector {
  id: string;
  site_id: string;
  code: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ZoneBoundary {
  points: { x: number; y: number }[];
}

export interface InspectionZone {
  id: string;
  facility_id: string;
  sector_id: string;
  code: string;
  name: string;
  description: string | null;
  risk_level: RiskLevel;
  hazard_categories: string[];
  human_access: "allowed" | "restricted" | "prohibited";
  recommended_method: InspectionMethod;
  required_ppe: string[];
  safety_notes: string | null;
  boundary: ZoneBoundary;
  created_at: string;
  updated_at: string;
}

export interface Equipment {
  id: string;
  facility_id: string;
  sector_id: string | null;
  zone_id: string | null;
  code: string;
  name: string;
  equipment_type: "tank" | "pipeline" | "valve" | "tower" | "structure" | "other";
  status: "active" | "inactive" | "out_of_service";
  risk_level: RiskLevel;
  position_x: number | null;
  position_y: number | null;
  description: string | null;
  last_inspection_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScoringRules {
  passValue?: number;
  failValue?: number;
  needsReviewValue?: number;
  categoryWeights?: Record<string, number>;
  bands?: { min: number; label: string }[];
}

export interface InspectionTemplate {
  id: string;
  name: string;
  category: string;
  description: string | null;
  scoring_rules: ScoringRules;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InspectionTemplateItem {
  id: string;
  template_id: string;
  category: string;
  label: string;
  response_type: "choice" | "choice_numeric";
  weight: number;
  critical: boolean;
  sort_order: number;
  numeric_unit: string | null;
  numeric_min: number | null;
  numeric_max: number | null;
  created_at: string;
}

export interface Inspection {
  id: string;
  code: string;
  facility_id: string;
  site_id: string;
  sector_id: string;
  zone_id: string;
  equipment_id: string | null;
  inspection_type: string;
  risk_level: RiskLevel;
  method: InspectionMethod;
  template_id: string;
  assigned_inspector_id: string | null;
  planned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  status: InspectionStatus;
  notes: string | null;
  risk_acknowledgement: string | null;
  created_by: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InspectionAssignment {
  id: string;
  inspection_id: string;
  assignee_id: string;
  role_in_inspection: "inspector" | "operator";
  assigned_at: string;
  assigned_by: string | null;
}

export interface InspectionChecklist {
  id: string;
  inspection_id: string;
  template_id: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InspectionChecklistItem {
  id: string;
  checklist_id: string;
  template_item_id: string | null;
  category: string;
  label: string;
  response: ChecklistResponse | null;
  numeric_value: number | null;
  notes: string | null;
  severity: Severity | null;
  weight: number;
  critical: boolean;
  response_type: "choice" | "choice_numeric";
  numeric_unit: string | null;
  sort_order: number;
  evidence_media_id: string | null;
  updated_at: string;
}

export interface Mission {
  id: string;
  code: string;
  inspection_id: string;
  facility_id: string;
  sector_id: string;
  zone_id: string;
  device_kind: "drone" | "robot" | null;
  device_id: string | null;
  inspector_id: string | null;
  risk_level: RiskLevel;
  mission_type: string;
  status: MissionStatus;
  progress: number;
  stage: number;
  is_simulation: boolean;
  safety_prerequisites: Json;
  created_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MissionEvent {
  id: string;
  mission_id: string;
  event_type: string;
  message: string;
  from_status: MissionStatus | null;
  to_status: MissionStatus | null;
  stage: number | null;
  origin: "user" | "simulation" | "seed" | "system";
  metadata: Json;
  created_by: string | null;
  created_at: string;
}

export interface Drone {
  id: string;
  code: string;
  name: string;
  model: string;
  manufacturer: string;
  camera_capable: boolean;
  resolution: string | null;
  battery_capacity_mah: number;
  current_battery: number;
  signal_quality: number | null;
  operational_status: DeviceStatus;
  availability: "available" | "unavailable";
  current_mission_id: string | null;
  last_maintenance_at: string | null;
  total_flight_minutes: number;
  position_label: string | null;
  last_position: Json;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Robot {
  id: string;
  code: string;
  name: string;
  robot_type: string;
  model: string;
  manufacturer: string;
  sensors: string[];
  battery_capacity_mah: number;
  current_battery: number;
  operational_status: DeviceStatus;
  availability: "available" | "unavailable";
  current_mission_id: string | null;
  location_label: string | null;
  last_maintenance_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TelemetryRecord {
  id: string;
  mission_id: string;
  device_id: string | null;
  device_kind: "drone" | "robot" | null;
  altitude_m: number | null;
  speed_mps: number | null;
  battery_percent: number | null;
  signal_quality: number | null;
  latitude: number | null;
  longitude: number | null;
  recorded_at: string;
  source: "simulation" | "device" | "seed";
  quality: "good" | "stale" | "invalid" | "missing";
  created_at: string;
}

export interface SensorThreshold {
  id: string;
  sensor_code: string;
  measurement_type: string;
  substance: string | null;
  unit: string;
  min_value: number | null;
  max_value: number | null;
  label: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export interface SensorReading {
  id: string;
  mission_id: string | null;
  sensor_code: string;
  measurement_type: string;
  numeric_value: number | null;
  unit: string;
  text_value: string | null;
  recorded_at: string;
  source: "simulation" | "device" | "seed" | "inspector";
  quality: "good" | "stale" | "invalid" | "missing";
  threshold_id: string | null;
  created_at: string;
}

export interface InspectionMedia {
  id: string;
  inspection_id: string | null;
  mission_id: string | null;
  point_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  caption: string | null;
  captured_at: string;
  source: "simulation" | "upload" | "seed";
  created_by: string | null;
  created_at: string;
}

export interface InspectionPoint {
  id: string;
  code: string;
  mission_id: string | null;
  inspection_id: string;
  facility_id: string;
  equipment_id: string | null;
  zone_id: string | null;
  location_label: string | null;
  category: PointCategory;
  description: string;
  severity: Severity;
  source: "simulation" | "inspector" | "analysis" | "seed";
  confidence: number | null;
  review_status: "pending" | "confirmed" | "rejected" | "follow_up" | "closed";
  created_at: string;
  updated_at: string;
}

export interface InspectionObservation {
  id: string;
  inspection_id: string;
  point_id: string | null;
  mission_id: string | null;
  category: PointCategory;
  description: string;
  severity: Severity;
  source: "simulation" | "inspector" | "analysis" | "seed";
  created_by: string | null;
  created_at: string;
}

export interface InspectionDecision {
  id: string;
  inspection_id: string;
  point_id: string | null;
  observation_id: string | null;
  action: DecisionAction;
  notes: string | null;
  decided_by: string | null;
  decided_at: string;
  created_at: string;
}

export interface Alert {
  id: string;
  code: string;
  category: AlertCategory;
  severity: Severity;
  message: string;
  facility_id: string | null;
  device_id: string | null;
  device_kind: "drone" | "robot" | null;
  mission_id: string | null;
  inspection_id: string | null;
  read_at: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolution_status: "open" | "acknowledged" | "escalated" | "resolved";
  assigned_user_id: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  dedupe_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface InspectionReport {
  id: string;
  code: string;
  inspection_id: string;
  revision: number;
  status: "final";
  snapshot: ReportSnapshot;
  created_by: string | null;
  created_at: string;
}

export interface InspectionReportItem {
  id: string;
  report_id: string;
  category: string;
  label: string;
  response: string | null;
  score: number | null;
  notes: string | null;
  sort_order: number;
}

export interface MaintenanceRecord {
  id: string;
  device_id: string;
  device_kind: "drone" | "robot";
  description: string;
  status: "scheduled" | "completed" | "overdue";
  performed_at: string | null;
  next_due_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  target_table: string;
  target_id: string | null;
  metadata: Json;
  created_at: string;
}

export interface CodeSequence {
  id: string;
  value: number;
}

export interface Setting {
  id: string;
  value: Json;
  updated_at: string;
  updated_by: string | null;
}

export interface ReportSnapshot {
  branding: "VISIONGUARD";
  disclaimer: string;
  report_code: string;
  revision: number;
  inspection_code: string;
  inspection_id: string;
  facility_name: string;
  site_name: string;
  sector_name: string;
  zone_name: string;
  equipment_label: string | null;
  inspector_name: string | null;
  method: InspectionMethod;
  started_at: string | null;
  completed_at: string | null;
  risk_level: RiskLevel;
  score: {
    overall: number | null;
    band: string | null;
    has_critical_failure: boolean;
    categories: { category: string; score: number; weight: number }[];
    explanation: string[];
  };
  checklist_items: {
    category: string;
    label: string;
    response: ChecklistResponse | null;
    numeric_value: number | null;
    unit: string | null;
    notes: string | null;
    critical: boolean;
    weight: number;
  }[];
  observations: { category: string; description: string; severity: Severity; source: string }[];
  points: { code: string; category: string; description: string; severity: Severity; review_status: string }[];
  media: { id: string; caption: string | null; captured_at: string; source: string }[];
  sensors: { measurement_type: string; numeric_value: number | null; unit: string; quality: string; interpretation: string; recorded_at: string }[];
  alerts: { code: string; category: string; severity: Severity; message: string; resolution_status: string }[];
  decisions: { action: DecisionAction; notes: string | null; decided_at: string }[];
  recommendations: string[];
  follow_up: string[];
  generated_at: string;
}

export interface DatabaseSchema {
  roles: Role[];
  profiles: Profile[];
  facilities: Facility[];
  sites: Site[];
  sectors: Sector[];
  inspection_zones: InspectionZone[];
  equipment: Equipment[];
  inspection_templates: InspectionTemplate[];
  inspection_template_items: InspectionTemplateItem[];
  inspections: Inspection[];
  inspection_assignments: InspectionAssignment[];
  inspection_checklists: InspectionChecklist[];
  inspection_checklist_items: InspectionChecklistItem[];
  missions: Mission[];
  mission_events: MissionEvent[];
  drones: Drone[];
  robots: Robot[];
  telemetry_records: TelemetryRecord[];
  sensor_thresholds: SensorThreshold[];
  sensor_readings: SensorReading[];
  inspection_media: InspectionMedia[];
  inspection_points: InspectionPoint[];
  inspection_observations: InspectionObservation[];
  inspection_decisions: InspectionDecision[];
  alerts: Alert[];
  inspection_reports: InspectionReport[];
  inspection_report_items: InspectionReportItem[];
  maintenance_records: MaintenanceRecord[];
  audit_logs: AuditLog[];
  code_sequences: CodeSequence[];
  settings: Setting[];
}

export type TableName = keyof DatabaseSchema;
export type AppState = DatabaseSchema;

export interface StoredCredential {
  profile_id: string;
  email: string;
  salt: string;
  password_hash: string;
}
