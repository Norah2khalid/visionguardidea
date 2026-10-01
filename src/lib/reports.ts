import type {
  Alert,
  DecisionAction,
  Equipment,
  Facility,
  Inspection,
  InspectionChecklistItem,
  InspectionDecision,
  InspectionMedia,
  InspectionObservation,
  InspectionPoint,
  InspectionReport,
  InspectionZone,
  Profile,
  ReportSnapshot,
  ScoringRules,
  Sector,
  SensorReading,
  SensorThreshold,
  Site,
} from "@/types/domain";
import { decisionLabel, pointCategoryLabel } from "@/lib/labels";
import { scoreChecklist } from "@/lib/scoring";
import { interpretReading } from "@/lib/sensors";
const DISCLAIMER = "هذا التقرير سجل تشغيلي داخلي لمنصة VISIONGUARD ولا يُعد اعتمادًا هندسيًا أو شهادة تنظيمية.";

export interface ReportSource {
  reportCode: string;
  revision: number;
  inspection: Inspection;
  facility: Facility;
  site: Site;
  sector: Sector;
  zone: InspectionZone;
  equipment: Equipment | null;
  inspector: Profile | null;
  items: InspectionChecklistItem[];
  scoringRules: ScoringRules;
  observations: InspectionObservation[];
  points: InspectionPoint[];
  media: InspectionMedia[];
  readings: SensorReading[];
  thresholds: SensorThreshold[];
  alerts: Alert[];
  decisions: InspectionDecision[];
  generatedAt: string;
}

export function buildReportSnapshot(source: ReportSource): ReportSnapshot {
  const score = scoreChecklist(source.items, source.scoringRules);
  const recommendations: string[] = [];
  const followUp: string[] = [];
  for (const item of source.items) {
    if (item.response === "fail" || item.response === "needs_review") {
      recommendations.push(`${item.category} — ${item.label}: ${item.notes || "تحتاج متابعة من إدارة السلامة."}`);
    }
    if (item.critical && item.response === "fail") {
      followUp.push(`بند حرج: ${item.label}`);
    }
  }
  for (const decision of source.decisions) {
    if (decision.action === "follow_up" || decision.action === "maintenance" || decision.action === "reinspect") {
      followUp.push(`${decisionLabel[decision.action]}${decision.notes ? ` — ${decision.notes}` : ""}`);
    }
  }
  if (!recommendations.length) {
    recommendations.push("لا توجد بنود راسبة في هذه الدورة. يحدد مسؤول السلامة موعد الدورة التالية وفق إجراء المنشأة.");
  }
  if (score.hasCriticalFailure) {
    recommendations.unshift("الدرجة الرقمية لا تُلغي البنود الحرجة غير المطابقة.");
  }

  return {
    branding: "VISIONGUARD",
    disclaimer: DISCLAIMER,
    report_code: source.reportCode,
    revision: source.revision,
    inspection_code: source.inspection.code,
    inspection_id: source.inspection.id,
    facility_name: source.facility.name,
    site_name: source.site.name,
    sector_name: source.sector.name,
    zone_name: source.zone.name,
    equipment_label: source.equipment ? `${source.equipment.code} — ${source.equipment.name}` : null,
    inspector_name: source.inspector?.full_name ?? null,
    method: source.inspection.method,
    started_at: source.inspection.started_at,
    completed_at: source.inspection.completed_at,
    risk_level: source.inspection.risk_level,
    score: {
      overall: score.overall,
      band: score.band,
      has_critical_failure: score.hasCriticalFailure,
      categories: score.categories.map((category) => ({
        category: category.category,
        score: category.score,
        weight: category.weight,
      })),
      explanation: score.explanation,
    },
    checklist_items: source.items
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({
        category: item.category,
        label: item.label,
        response: item.response,
        numeric_value: item.numeric_value,
        unit: item.numeric_unit,
        notes: item.notes,
        critical: item.critical,
        weight: item.weight,
      })),
    observations: source.observations.map((item) => ({
      category: pointCategoryLabel[item.category],
      description: item.description,
      severity: item.severity,
      source: item.source,
    })),
    points: source.points.map((item) => ({
      code: item.code,
      category: pointCategoryLabel[item.category],
      description: item.description,
      severity: item.severity,
      review_status: item.review_status,
    })),
    media: source.media.map((item) => ({
      id: item.id,
      caption: item.caption,
      captured_at: item.captured_at,
      source: item.source,
    })),
    sensors: source.readings.map((reading) => {
      const threshold = source.thresholds.find((item) => item.id === reading.threshold_id) ?? source.thresholds.find((item) => item.measurement_type === reading.measurement_type && item.sensor_code === reading.sensor_code) ?? null;
      return {
        measurement_type: reading.measurement_type,
        numeric_value: reading.numeric_value,
        unit: reading.unit,
        quality: reading.quality,
        interpretation: interpretReading(reading, threshold).label,
        recorded_at: reading.recorded_at,
      };
    }),
    alerts: source.alerts.map((alert) => ({
      code: alert.code,
      category: alert.category,
      severity: alert.severity,
      message: alert.message,
      resolution_status: alert.resolution_status,
    })),
    decisions: source.decisions.map((decision) => ({
      action: decision.action as DecisionAction,
      notes: decision.notes,
      decided_at: decision.decided_at,
    })),
    recommendations,
    follow_up: followUp,
    generated_at: source.generatedAt,
  };
}

export function assertReportImmutable(existing: Pick<InspectionReport, "status">[]): void {
  if (existing.some((report) => report.status === "final")) {
    return;
  }
}

export function nextRevision(existing: Pick<InspectionReport, "revision">[]): number {
  return existing.reduce((max, report) => Math.max(max, report.revision), 0) + 1;
}
