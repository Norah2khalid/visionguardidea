import { dashboardMetrics, deviceUtilization, followUpRate, inspectionCycle, missionDuration, pointResolutionTime, reviewDuration } from "@/lib/analytics";
import type { DbPort } from "@/services/db/port";
import type { AppState } from "@/types/domain";

async function stateOf(db: DbPort): Promise<AppState> {
  return db.dump();
}

export async function loadDashboard(db: DbPort) {
  const state = await stateOf(db);
  const metrics = dashboardMetrics({
    inspections: state.inspections,
    missions: state.missions,
    highRiskZones: state.inspection_zones.filter((zone) => zone.risk_level === "high").length,
    alerts: state.alerts,
    drones: state.drones,
    robots: state.robots,
  });
  const recentInspections = state.inspections.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6);
  const activeMissions = state.missions.filter((mission) => !["COMPLETED", "CANCELLED", "FAILED"].includes(mission.status));
  const latestPoints = state.inspection_points.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6);
  const recentReports = state.inspection_reports.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
  const byStatus = state.inspections.reduce<Record<string, number>>((acc, inspection) => {
    acc[inspection.status] = (acc[inspection.status] ?? 0) + 1;
    return acc;
  }, {});
  return { metrics, recentInspections, activeMissions, latestPoints, recentReports, byStatus, state };
}

export async function loadInspectionBundle(db: DbPort, id: string) {
  const state = await stateOf(db);
  const inspection = state.inspections.find((item) => item.id === id) ?? null;
  if (!inspection) return null;
  const checklist = state.inspection_checklists.find((item) => item.inspection_id === id) ?? null;
  return {
    inspection,
    facility: state.facilities.find((item) => item.id === inspection.facility_id) ?? null,
    site: state.sites.find((item) => item.id === inspection.site_id) ?? null,
    sector: state.sectors.find((item) => item.id === inspection.sector_id) ?? null,
    zone: state.inspection_zones.find((item) => item.id === inspection.zone_id) ?? null,
    equipment: state.equipment.find((item) => item.id === inspection.equipment_id) ?? null,
    template: state.inspection_templates.find((item) => item.id === inspection.template_id) ?? null,
    checklist,
    items: checklist ? state.inspection_checklist_items.filter((item) => item.checklist_id === checklist.id) : [],
    missions: state.missions.filter((item) => item.inspection_id === id),
    events: state.mission_events.filter((event) => state.missions.some((mission) => mission.inspection_id === id && mission.id === event.mission_id)),
    points: state.inspection_points.filter((item) => item.inspection_id === id),
    observations: state.inspection_observations.filter((item) => item.inspection_id === id),
    decisions: state.inspection_decisions.filter((item) => item.inspection_id === id),
    media: state.inspection_media.filter((item) => item.inspection_id === id),
    reports: state.inspection_reports.filter((item) => item.inspection_id === id),
    alerts: state.alerts.filter((item) => item.inspection_id === id),
    audits: state.audit_logs.filter((item) => item.target_id === id || state.missions.some((mission) => mission.inspection_id === id && mission.id === item.target_id)),
    inspector: state.profiles.find((item) => item.id === inspection.assigned_inspector_id) ?? null,
  };
}

export async function loadMissionBundle(db: DbPort, id: string) {
  const state = await stateOf(db);
  const mission = state.missions.find((item) => item.id === id) ?? null;
  if (!mission) return null;
  const inspection = state.inspections.find((item) => item.id === mission.inspection_id) ?? null;
  return {
    mission,
    inspection,
    facility: state.facilities.find((item) => item.id === mission.facility_id) ?? null,
    sector: state.sectors.find((item) => item.id === mission.sector_id) ?? null,
    zone: state.inspection_zones.find((item) => item.id === mission.zone_id) ?? null,
    drone: mission.device_kind === "drone" ? state.drones.find((item) => item.id === mission.device_id) ?? null : null,
    robot: mission.device_kind === "robot" ? state.robots.find((item) => item.id === mission.device_id) ?? null : null,
    events: state.mission_events.filter((item) => item.mission_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    telemetry: state.telemetry_records.filter((item) => item.mission_id === id).sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)),
    readings: state.sensor_readings.filter((item) => item.mission_id === id).sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)),
    thresholds: state.sensor_thresholds,
    media: state.inspection_media.filter((item) => item.mission_id === id),
    points: state.inspection_points.filter((item) => item.mission_id === id),
    decisions: inspection ? state.inspection_decisions.filter((item) => item.inspection_id === inspection.id) : [],
    alerts: state.alerts.filter((item) => item.mission_id === id),
  };
}

export async function loadFacilityBundle(db: DbPort, id: string) {
  const state = await stateOf(db);
  const facility = state.facilities.find((item) => item.id === id) ?? null;
  if (!facility) return null;
  const sites = state.sites.filter((item) => item.facility_id === id);
  const siteIds = new Set(sites.map((item) => item.id));
  const sectors = state.sectors.filter((item) => siteIds.has(item.site_id));
  return {
    facility,
    sites,
    sectors,
    zones: state.inspection_zones.filter((item) => item.facility_id === id),
    equipment: state.equipment.filter((item) => item.facility_id === id),
    inspections: state.inspections.filter((item) => item.facility_id === id),
    reports: state.inspection_reports.filter((report) => state.inspections.some((inspection) => inspection.id === report.inspection_id && inspection.facility_id === id)),
    alerts: state.alerts.filter((item) => item.facility_id === id),
  };
}

export async function loadAnalytics(db: DbPort) {
  const state = await stateOf(db);
  return {
    inspectionCycle: inspectionCycle(state.inspections),
    missionDuration: missionDuration(state.missions),
    reviewDuration: reviewDuration(state.mission_events, state.inspection_decisions, state.missions),
    followUp: followUpRate(state.inspections),
    pointResolution: pointResolutionTime(state.inspection_points, state.inspection_decisions),
    drones: deviceUtilization(state.missions, state.drones),
    robots: deviceUtilization(state.missions, state.robots),
    deviceNames: Object.fromEntries([...state.drones, ...state.robots].map((device) => [device.id, device.code])),
  };
}

export async function loadCatalog(db: DbPort) {
  return stateOf(db);
}
