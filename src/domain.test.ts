import { describe, expect, it } from "vitest";
import { batteryAlert, missingAlerts, overdueAlert } from "@/lib/alerts";
import { canFinalizeInspection } from "@/lib/completion";
import { connectionMode } from "@/lib/connection";
import { assertTransition } from "@/lib/missionState";
import { can } from "@/lib/permissions";
import { recommendInspectionMethods } from "@/lib/recommendations";
import { buildReportSnapshot, nextRevision } from "@/lib/reports";
import { scoreChecklist } from "@/lib/scoring";
import { interpretReading } from "@/lib/sensors";
import { validateInspectionCreation } from "@/lib/validation";
import { createMemoryDb } from "@/services/db/memory";
import { buildSeed, ID } from "@/services/db/seed";
import { createPlatform } from "@/services/platform/api";
import { simulationStepCount, TANK_PATROL_SCENARIO } from "@/services/simulation/scenarios";
import { createMemoryStorage } from "@/services/storage";
import type { Actor } from "@/services/platform/context";
import type { Inspection, InspectionChecklistItem, Profile } from "@/types/domain";

const admin: Actor = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  role_code: "ADMIN",
  full_name: "مدير العرض",
  email: "admin@visionguard.local",
};
const operator: Actor = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  role_code: "OPERATOR",
  full_name: "مشغّل",
  email: "operator@visionguard.local",
};

function profile(actor: Actor): Profile {
  return {
    id: actor.id,
    full_name: actor.full_name,
    email: actor.email,
    role_code: actor.role_code,
    is_active: true,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
  };
}

function platform() {
  const db = createMemoryDb(buildSeed());
  const blobs = new Map<string, Blob>();
  return {
    db,
    api: createPlatform({
      db,
      storage: createMemoryStorage({
        async put(id, blob) {
          blobs.set(id, blob);
        },
        async get(id) {
          return blobs.get(id) ?? null;
        },
      }),
    }),
  };
}

describe("scoring", () => {
  it("computes the seeded reference report as 87 without a hardcoded total", () => {
    const seed = buildSeed();
    const report = seed.inspection_reports.find((item) => item.code === "VG-REP-2026-00124");
    expect(report?.snapshot.score.overall).toBe(87);
    expect(report?.snapshot.score.band).toBe("جيد جدًا");
    expect(report?.snapshot.score.categories.map((item) => [item.category, item.score])).toEqual([
      ["معدات السلامة", 95],
      ["خزانات الوقود", 82],
      ["أنظمة الإنذار", 91],
    ]);
    expect(report?.snapshot.disclaimer).toContain("لا يُعد اعتمادًا");
  });

  it("does not let a numeric score clear a critical failure", () => {
    const result = scoreChecklist(
      [
        { category: "سلامة", weight: 1, critical: true, response: "fail" },
        { category: "سلامة", weight: 9, critical: false, response: "pass" },
      ],
      {},
    );
    expect(result.overall).toBe(90);
    expect(result.hasCriticalFailure).toBe(true);
    expect(result.explanation.some((line) => line.includes("لا تُلغي"))).toBe(true);
  });
});

describe("mission transitions", () => {
  it("rejects skipping to completed", () => {
    expect(() => assertTransition("CREATED", "COMPLETED")).toThrow(/لا يمكن نقل المهمة/);
    expect(() => assertTransition("READY", "DISPATCHED")).not.toThrow();
    expect(() => assertTransition("INSPECTOR_REVIEW", "COMPLETED")).not.toThrow();
  });

  it("walks the tank scenario in order", () => {
    expect(TANK_PATROL_SCENARIO.steps.map((step) => step.to_status)).toEqual([
      "DISPATCHED",
      "INSPECTING",
      "DATA_TRANSMISSION",
      "REVIEW_REQUIRED",
    ]);
    expect(simulationStepCount([{ origin: "simulation", event_type: "simulation_step" }, { origin: "user", event_type: "status_change" }])).toBe(1);
  });
});

describe("recommendations and validation", () => {
  it("advises a device for prohibited high-risk zones without authorizing entry", () => {
    const advice = recommendInspectionMethods({ risk_level: "high", human_access: "prohibited", recommended_method: "drone_human" });
    expect(advice.recommended).toContain("drone_human");
    expect(advice.discouraged).toContain("human");
    expect(advice.requiresAcknowledgement).toBe(true);
    expect(advice.advisory).toContain("استشاري");
  });

  it("rejects human entry to a high-risk zone without an explicit acknowledgement", () => {
    const seed = buildSeed();
    const result = validateInspectionCreation(
      {
        facility_id: ID.facility,
        site_id: ID.site,
        sector_id: ID.sector,
        zone_id: ID.zoneHigh,
        equipment_id: ID.tank04,
        inspection_type: "يدوي",
        method: "human",
        template_id: ID.template,
        assigned_inspector_id: admin.id,
        device_id: null,
        planned_at: "2026-10-02T08:00:00.000Z",
        risk_acknowledgement: "قصير",
        notes: null,
      },
      { ...seed, profiles: [profile(admin)], activeDeviceIds: [] },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("إقرار");
  });
});

describe("sensors, alerts, permissions, connection", () => {
  it("says gas is within the configured limit only when a threshold exists", () => {
    expect(interpretReading({ numeric_value: 12, quality: "good", unit: "ppm" }, { min_value: 0, max_value: 50, unit: "ppm", is_active: true }).label).toBe("ضمن الحد الطبيعي");
    expect(interpretReading({ numeric_value: 12, quality: "good", unit: "ppm" }, null).label).toBe("لا يوجد حد مُعد");
    expect(interpretReading(null, null).label).toBe("غير متوفر");
  });

  it("creates alerts from events and does not duplicate open ones", () => {
    expect(batteryAlert({ id: "d1", kind: "drone", code: "VG-DRONE-01", battery: 76 })).toBeNull();
    const low = batteryAlert({ id: "d1", kind: "drone", code: "VG-DRONE-01", battery: 15 });
    expect(low?.category).toBe("low_battery");
    const overdue = overdueAlert(
      { id: "i1", code: "VG-INS-1", planned_at: "2020-01-01T00:00:00.000Z", status: "SCHEDULED", facility_id: "f1" } as Inspection,
      Date.parse("2026-10-01T00:00:00.000Z"),
    );
    expect(missingAlerts([{ dedupe_key: overdue?.dedupe_key ?? "", resolution_status: "open" }], overdue ? [overdue] : [])).toHaveLength(0);
    expect(missingAlerts([{ dedupe_key: overdue?.dedupe_key ?? "", resolution_status: "resolved" }], overdue ? [overdue] : [])).toHaveLength(1);
  });

  it("keeps operator and inspector permissions distinct", () => {
    expect(can("ADMIN", "users.manage")).toBe(true);
    expect(can("INSPECTOR", "decisions.record")).toBe(true);
    expect(can("INSPECTOR", "users.manage")).toBe(false);
    expect(can("OPERATOR", "missions.operate")).toBe(true);
    expect(can("OPERATOR", "inspections.create")).toBe(false);
    expect(can("OPERATOR", "decisions.record")).toBe(false);
  });

  it("never labels simulation as live hardware", () => {
    expect(connectionMode({ mission: { is_simulation: true, status: "INSPECTING" }, latest: { source: "simulation", recorded_at: new Date().toISOString(), quality: "good" }, gatewayConfigured: true })).toBe("simulation");
    expect(connectionMode({ mission: null, latest: { source: "seed", recorded_at: "2026-09-15T06:40:00.000Z", quality: "good" }, gatewayConfigured: false })).toBe("demo_record");
    expect(connectionMode({ mission: null, latest: null, gatewayConfigured: false })).toBe("unavailable");
  });
});

describe("inspection workflow", () => {
  it("persists creation, blocks a busy drone, runs simulation, review, score, and versioned reports", async () => {
    const { db, api } = platform();
    await db.insert("profiles", profile(admin));
    await db.insert("profiles", profile(operator));
    await expect(api.createInspection(operator, draft())).rejects.toThrow(/صلاحية/);

    const created = await api.createInspection(admin, draft());
    expect(created.inspection.code).toMatch(/^VG-INS-\d{4}-\d{4}$/);
    expect(created.mission?.status).toBe("READY");
    expect(created.mission?.is_simulation).toBe(true);
    const drone = await db.get("drones", ID.drone);
    expect(drone?.operational_status).toBe("reserved");
    await expect(api.createInspection(admin, draft())).rejects.toThrow(/متاح|نشطة/);

    let latest = created.mission!;
    for (let index = 0; index < 4; index += 1) {
      const step = await api.advanceSimulation(admin, latest.id);
      latest = step.mission;
    }
    expect(latest.status).toBe("REVIEW_REQUIRED");
    const telemetry = await db.list("telemetry_records", { filters: { mission_id: latest.id } });
    expect(telemetry.at(-1)?.altitude_m).toBe(14.2);
    expect(telemetry.at(-1)?.speed_mps).toBe(0);
    expect(telemetry.every((item) => item.source === "simulation")).toBe(true);
    const points = await db.list("inspection_points", { filters: { mission_id: latest.id } });
    expect(points).toHaveLength(1);
    expect(points[0]?.confidence).toBeNull();
    await expect(api.completeMission(admin, latest.id)).rejects.toThrow(/مراجعة/);

    const checklist = (await db.list("inspection_checklists", { filters: { inspection_id: created.inspection.id } }))[0];
    const items = await db.list("inspection_checklist_items", { filters: { checklist_id: checklist.id } });
    await expect(api.finalizeInspection(admin, created.inspection.id)).rejects.toThrow(/قرار|بنود/);
    await api.recordDecision(admin, { inspectionId: created.inspection.id, pointId: points[0].id, action: "confirm", notes: "مراجعة بصرية تجريبية" });
    for (const item of items) {
      await api.saveChecklistItem(admin, item.id, { response: item.critical ? "pass" : "pass", notes: null, numeric_value: item.response_type === "choice_numeric" ? 42 : null });
    }
    const finalized = await api.finalizeInspection(admin, created.inspection.id);
    expect(["COMPLETED", "FOLLOW_UP_REQUIRED"]).toContain(finalized.status);
    const mission = await db.get("missions", latest.id);
    expect(mission?.status).toBe("COMPLETED");

    const first = await api.generateReport(admin, created.inspection.id);
    const second = await api.generateReport(admin, created.inspection.id);
    expect(second.revision).toBe(first.revision + 1);
    expect(second.id).not.toBe(first.id);
    expect((await db.get("inspection_reports", first.id))?.snapshot.report_code).toBe(first.code);
    expect(second.snapshot.score.overall).toBe(100);
    expect(nextRevision([{ revision: second.revision }])).toBe(second.revision + 1);
  });

  it("blocks completion when a critical item fails and no decision addresses it", () => {
    const inspection = { status: "REVIEW_REQUIRED", method: "human", id: "i" } as Inspection;
    const items = [{ critical: true, response: "fail", weight: 1, category: "سلامة", label: "حرج" } as InspectionChecklistItem];
    const result = canFinalizeInspection({ inspection, items, points: [], decisions: [], missions: [], actor: profile(admin) });
    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toContain("حرج");
  });
});

describe("report generation", () => {
  it("builds a snapshot from stored rows", () => {
    const seed = buildSeed();
    const inspection = seed.inspections.find((item) => item.id === ID.ins124)!;
    const snapshot = buildReportSnapshot({
      reportCode: "VG-REP-TEST",
      revision: 2,
      inspection,
      facility: seed.facilities[0],
      site: seed.sites[0],
      sector: seed.sectors[0],
      zone: seed.inspection_zones[0],
      equipment: seed.equipment[0],
      inspector: null,
      items: seed.inspection_checklist_items.filter((item) => item.checklist_id === "10000000-0000-4000-8000-000000000611"),
      scoringRules: seed.inspection_templates.find((item) => item.id === ID.templateDemo)!.scoring_rules,
      observations: [],
      points: seed.inspection_points,
      media: seed.inspection_media,
      readings: seed.sensor_readings,
      thresholds: seed.sensor_thresholds,
      alerts: [],
      decisions: seed.inspection_decisions,
      generatedAt: "2026-10-01T00:00:00.000Z",
    });
    expect(snapshot.score.overall).toBe(87);
    expect(snapshot.sensors.find((item) => item.measurement_type === "gas_concentration")?.interpretation).toBe("ضمن الحد الطبيعي");
    expect(snapshot.sensors.find((item) => item.measurement_type === "surface_temperature")?.numeric_value).toBe(42);
  });
});

function draft() {
  return {
    facility_id: ID.facility,
    site_id: ID.site,
    sector_id: ID.sector,
    zone_id: ID.zoneHigh,
    equipment_id: ID.tank04,
    inspection_type: "تفتيش دوري",
    method: "drone_human" as const,
    template_id: ID.template,
    assigned_inspector_id: admin.id,
    device_id: ID.drone,
    planned_at: new Date().toISOString(),
    risk_acknowledgement: null,
    notes: null,
  };
}
