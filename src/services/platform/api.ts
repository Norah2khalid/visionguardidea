import { missingAlerts, overdueAlert, pointReviewAlert, thresholdAlert, batteryAlert } from "@/lib/alerts";
import { canCompleteMission, canFinalizeInspection, completionStatus } from "@/lib/completion";
import { AppError } from "@/lib/errors";
import { nowIso, uid } from "@/lib/ids";
import { assertTransition, deviceKindForMethod, isDeviceMethod, stageForStatus, TERMINAL_MISSION_STATUSES } from "@/lib/missionState";
import { buildReportSnapshot, nextRevision } from "@/lib/reports";
import { validateInspectionCreation, type InspectionWizardInput } from "@/lib/validation";
import type { DbPort } from "@/services/db/port";
import { buildSeed } from "@/services/db/seed";
import { audit, guard, nextCode, type Actor, type PlatformDeps } from "@/services/platform/context";
import { loadCatalog } from "@/services/platform/queries";
import { simulatedEvidenceSvg } from "@/services/simulation/evidence";
import { simulationStepCount, TANK_PATROL_SCENARIO, type SimulationStep } from "@/services/simulation/scenarios";
import { validateUpload } from "@/services/storage";
import type {
  ChecklistResponse,
  DecisionAction,
  DeviceStatus,
  Equipment,
  InspectionZone,
  Json,
  Mission,
  MissionStatus,
  Severity,
} from "@/types/domain";

const BUSY: MissionStatus[] = ["CREATED", "ASSIGNED", "READY", "DISPATCHED", "INSPECTING", "DATA_TRANSMISSION", "REVIEW_REQUIRED", "INSPECTOR_REVIEW", "INTERRUPTED"];

function deviceTable(kind: "drone" | "robot") {
  return kind === "drone" ? "drones" : "robots";
}

async function setDeviceStatus(tx: DbPort, mission: Mission, status: DeviceStatus) {
  if (!mission.device_id || !mission.device_kind) return;
  const table = deviceTable(mission.device_kind);
  const device = await tx.get(table, mission.device_id);
  if (!device) return;
  const patch: Record<string, unknown> = {
    operational_status: status,
    availability: status === "available" ? "available" : "unavailable",
    current_mission_id: status === "available" ? null : mission.id,
    updated_at: nowIso(),
  };
  if (status === "available" && mission.device_kind === "drone" && mission.started_at && mission.completed_at && "total_flight_minutes" in device) {
    const minutes = Math.max(0, (Date.parse(mission.completed_at) - Date.parse(mission.started_at)) / 60000);
    patch.total_flight_minutes = device.total_flight_minutes + minutes;
  }
  await tx.update(table, device.id, patch as never);
}

async function applyMissionStatus(tx: DbPort, actor: Actor, mission: Mission, to: MissionStatus, message: string, origin: "user" | "simulation" | "system") {
  assertTransition(mission.status, to);
  const stamp = nowIso();
  const started = mission.started_at ?? (to === "DISPATCHED" ? stamp : null);
  const completed = to === "COMPLETED" ? stamp : mission.completed_at;
  const updated: Mission = {
    ...mission,
    status: to,
    stage: stageForStatus(to),
    started_at: started,
    completed_at: completed,
    updated_at: stamp,
  };
  await tx.update("missions", mission.id, {
    status: to,
    stage: updated.stage,
    started_at: started,
    completed_at: completed,
    updated_at: stamp,
  });
  await tx.insert("mission_events", {
    id: uid(),
    mission_id: mission.id,
    event_type: origin === "simulation" ? "simulation_step" : "status_change",
    message,
    from_status: mission.status,
    to_status: to,
    stage: updated.stage,
    origin,
    metadata: null,
    created_by: actor.id,
    created_at: stamp,
  });
  if (to === "DISPATCHED" || to === "INSPECTING" || to === "DATA_TRANSMISSION") {
    await setDeviceStatus(tx, updated, "on_mission");
    const inspection = await tx.get("inspections", mission.inspection_id);
    if (inspection && ["READY", "SCHEDULED", "DRAFT"].includes(inspection.status)) {
      await tx.update("inspections", inspection.id, { status: "IN_PROGRESS", started_at: inspection.started_at ?? stamp, updated_at: stamp });
    }
  }
  if (to === "REVIEW_REQUIRED") {
    const inspection = await tx.get("inspections", mission.inspection_id);
    if (inspection && inspection.status !== "COMPLETED" && inspection.status !== "CLOSED" && inspection.status !== "CANCELLED") {
      await tx.update("inspections", inspection.id, { status: "REVIEW_REQUIRED", updated_at: stamp });
    }
  }
  if (to === "COMPLETED" || to === "CANCELLED" || to === "FAILED") {
    await setDeviceStatus(tx, { ...updated, status: to }, "available");
  }
  if (to === "READY" || to === "ASSIGNED") {
    await setDeviceStatus(tx, updated, "reserved");
  }
  if (to === "INTERRUPTED") {
    await tx.insert("alerts", {
      id: uid(),
      code: await nextCode(tx, "alert", "VG-ALT"),
      category: "mission_interrupted",
      severity: "high",
      message: `توقفت المهمة ${mission.code}.`,
      facility_id: mission.facility_id,
      device_id: mission.device_id,
      device_kind: mission.device_kind,
      mission_id: mission.id,
      inspection_id: mission.inspection_id,
      read_at: null,
      acknowledged_at: null,
      acknowledged_by: null,
      resolution_status: "open",
      assigned_user_id: null,
      resolution_notes: null,
      resolved_at: null,
      resolved_by: null,
      dedupe_key: `interrupted:${mission.id}:${stamp}`,
      created_at: stamp,
      updated_at: stamp,
    });
  }
  await audit(tx, actor, "mission.transition", "missions", mission.id, { from: mission.status, to });
  return updated;
}

async function insertAlertFromDraft(tx: DbPort, draft: ReturnType<typeof overdueAlert>, code: string) {
  if (!draft) return;
  const stamp = nowIso();
  await tx.insert("alerts", {
    id: uid(),
    code,
    ...draft,
    read_at: null,
    acknowledged_at: null,
    acknowledged_by: null,
    resolution_status: "open",
    assigned_user_id: null,
    resolution_notes: null,
    resolved_at: null,
    resolved_by: null,
    created_at: stamp,
    updated_at: stamp,
  });
}

export function createPlatform(deps: PlatformDeps) {
  const { db, storage } = deps;

  return {
    db,
    storage,

    async createFacility(actor: Actor, input: { name: string; code: string; facility_type: string; description?: string | null; address?: string | null; status?: "active" | "inactive" | "archived" }) {
      guard(actor, "facilities.manage");
      return db.transaction(async (tx) => {
        const facilities = await tx.list("facilities");
        if (facilities.some((item) => item.code.toLowerCase() === input.code.trim().toLowerCase())) {
          throw new AppError("duplicate", "رمز المنشأة مستخدم.");
        }
        const stamp = nowIso();
        const row = await tx.insert("facilities", {
          id: uid(),
          code: input.code.trim(),
          name: input.name.trim(),
          description: input.description ?? null,
          facility_type: input.facility_type.trim(),
          status: input.status ?? "active",
          address: input.address ?? null,
          latitude: null,
          longitude: null,
          created_by: actor.id,
          created_at: stamp,
          updated_at: stamp,
        });
        await audit(tx, actor, "facility.created", "facilities", row.id, { code: row.code });
        return row;
      });
    },

    async updateFacility(actor: Actor, id: string, patch: { name?: string; code?: string; description?: string | null; facility_type?: string; address?: string | null; status?: "active" | "inactive" | "archived" }) {
      guard(actor, "facilities.manage");
      return db.transaction(async (tx) => {
        const current = await tx.get("facilities", id);
        if (!current) throw new AppError("not_found", "المنشأة غير موجودة.");
        const row = await tx.update("facilities", id, { ...patch, updated_at: nowIso() } as never);
        await audit(tx, actor, "facility.updated", "facilities", id, null);
        return row;
      });
    },

    async archiveFacility(actor: Actor, id: string) {
      guard(actor, "facilities.manage");
      return db.transaction(async (tx) => {
        const row = await tx.update("facilities", id, { status: "archived", updated_at: nowIso() });
        await audit(tx, actor, "facility.archived", "facilities", id, null);
        return row;
      });
    },

    async saveSite(actor: Actor, input: { id?: string; facility_id: string; code: string; name: string; description?: string | null }) {
      guard(actor, "facilities.manage");
      return db.transaction(async (tx) => {
        const stamp = nowIso();
        if (input.id) return tx.update("sites", input.id, { code: input.code, name: input.name, description: input.description ?? null, updated_at: stamp });
        return tx.insert("sites", { id: uid(), facility_id: input.facility_id, code: input.code, name: input.name, description: input.description ?? null, created_at: stamp, updated_at: stamp });
      });
    },

    async saveSector(actor: Actor, input: { id?: string; site_id: string; code: string; name: string; description?: string | null }) {
      guard(actor, "facilities.manage");
      return db.transaction(async (tx) => {
        const stamp = nowIso();
        if (input.id) return tx.update("sectors", input.id, { code: input.code, name: input.name, description: input.description ?? null, updated_at: stamp });
        return tx.insert("sectors", { id: uid(), site_id: input.site_id, code: input.code, name: input.name, description: input.description ?? null, created_at: stamp, updated_at: stamp });
      });
    },

    async saveZone(actor: Actor, input: Omit<InspectionZone, "created_at" | "updated_at" | "id"> & { id?: string }) {
      guard(actor, "zones.manage");
      return db.transaction(async (tx) => {
        const stamp = nowIso();
        if (input.id) {
          const { id, ...rest } = input;
          return tx.update("inspection_zones", id, { ...rest, updated_at: stamp });
        }
        const row = await tx.insert("inspection_zones", { ...input, id: uid(), created_at: stamp, updated_at: stamp });
        await audit(tx, actor, "zone.created", "inspection_zones", row.id, { code: row.code });
        return row;
      });
    },

    async saveEquipment(actor: Actor, input: Omit<Equipment, "created_at" | "updated_at" | "id" | "last_inspection_at"> & { id?: string }) {
      guard(actor, "equipment.manage");
      return db.transaction(async (tx) => {
        const stamp = nowIso();
        const existing = await tx.list("equipment", { filters: { facility_id: input.facility_id } });
        if (existing.some((item) => item.code.toLowerCase() === input.code.toLowerCase() && item.id !== input.id)) {
          throw new AppError("duplicate", "رمز المعدة مستخدم داخل المنشأة.");
        }
        if (input.id) {
          const { id, ...rest } = input;
          const row = await tx.update("equipment", id, { ...rest, updated_at: stamp });
          await audit(tx, actor, "equipment.updated", "equipment", id, null);
          return row;
        }
        const row = await tx.insert("equipment", { ...input, id: uid(), last_inspection_at: null, created_at: stamp, updated_at: stamp });
        await audit(tx, actor, "equipment.created", "equipment", row.id, { code: row.code });
        return row;
      });
    },

    async createInspection(actor: Actor, input: InspectionWizardInput) {
      guard(actor, "inspections.create");
      return db.transaction(async (tx) => {
        const catalogState = await loadCatalog(tx);
        const activeDeviceIds = catalogState.missions.filter((mission) => mission.device_id && BUSY.includes(mission.status)).map((mission) => mission.device_id!);
        const validation = validateInspectionCreation(input, { ...catalogState, activeDeviceIds });
        if (!validation.ok) throw new AppError("validation", validation.errors.join(" "));
        const zone = catalogState.inspection_zones.find((item) => item.id === input.zone_id)!;
        const stamp = nowIso();
        const planned = new Date(input.planned_at).toISOString();
        const status = Date.parse(planned) > Date.now() + 60_000 ? "SCHEDULED" : "READY";
        const inspection = await tx.insert("inspections", {
          id: uid(),
          code: await nextCode(tx, "inspection", "VG-INS"),
          facility_id: input.facility_id,
          site_id: input.site_id,
          sector_id: input.sector_id,
          zone_id: input.zone_id,
          equipment_id: input.equipment_id,
          inspection_type: input.inspection_type.trim(),
          risk_level: zone.risk_level,
          method: input.method,
          template_id: input.template_id,
          assigned_inspector_id: input.assigned_inspector_id,
          planned_at: planned,
          started_at: null,
          completed_at: null,
          status,
          notes: input.notes,
          risk_acknowledgement: input.risk_acknowledgement,
          created_by: actor.id,
          archived_at: null,
          created_at: stamp,
          updated_at: stamp,
        });
        await tx.insert("inspection_assignments", {
          id: uid(),
          inspection_id: inspection.id,
          assignee_id: input.assigned_inspector_id,
          role_in_inspection: "inspector",
          assigned_at: stamp,
          assigned_by: actor.id,
        });
        const checklist = await tx.insert("inspection_checklists", {
          id: uid(),
          inspection_id: inspection.id,
          template_id: input.template_id,
          completed_at: null,
          created_at: stamp,
          updated_at: stamp,
        });
        const templateItems = catalogState.inspection_template_items.filter((item) => item.template_id === input.template_id);
        for (const item of templateItems) {
          await tx.insert("inspection_checklist_items", {
            id: uid(),
            checklist_id: checklist.id,
            template_item_id: item.id,
            category: item.category,
            label: item.label,
            response: null,
            numeric_value: null,
            notes: null,
            severity: null,
            weight: item.weight,
            critical: item.critical,
            response_type: item.response_type,
            numeric_unit: item.numeric_unit,
            sort_order: item.sort_order,
            evidence_media_id: null,
            updated_at: stamp,
          });
        }
        let mission: Mission | null = null;
        if (isDeviceMethod(input.method)) {
          const kind = deviceKindForMethod(input.method);
          mission = await tx.insert("missions", {
            id: uid(),
            code: await nextCode(tx, "mission", "VG-MSN"),
            inspection_id: inspection.id,
            facility_id: input.facility_id,
            sector_id: input.sector_id,
            zone_id: input.zone_id,
            device_kind: kind,
            device_id: input.device_id,
            inspector_id: input.assigned_inspector_id,
            risk_level: zone.risk_level,
            mission_type: input.method,
            status: "CREATED",
            progress: 0,
            stage: 1,
            is_simulation: true,
            safety_prerequisites: {
              zone_reviewed: true,
              human_access: zone.human_access,
              required_ppe: zone.required_ppe,
              acknowledgement: input.risk_acknowledgement,
              recorded_at: stamp,
            },
            created_by: actor.id,
            started_at: null,
            completed_at: null,
            created_at: stamp,
            updated_at: stamp,
          });
          await tx.insert("mission_events", {
            id: uid(),
            mission_id: mission.id,
            event_type: "stage",
            message: "تم تحديد المنطقة والجهاز ومتطلبات السلامة.",
            from_status: null,
            to_status: "CREATED",
            stage: 1,
            origin: "user",
            metadata: null,
            created_by: actor.id,
            created_at: stamp,
          });
          let current = mission;
          current = await applyMissionStatus(tx, actor, current, "ASSIGNED", "تم تعيين الجهاز والمفتش.", "user");
          current = await applyMissionStatus(tx, actor, current, "READY", "المهمة جاهزة للبدء ضمن وضع المحاكاة.", "user");
          mission = current;
          if (input.device_id && kind) {
            await tx.update(deviceTable(kind), input.device_id, {
              operational_status: "reserved",
              availability: "unavailable",
              current_mission_id: mission.id,
              updated_at: stamp,
            });
          }
          if (zone.risk_level === "high") {
            await insertAlertFromDraft(tx, {
              category: "high_risk_zone",
              severity: "high",
              message: `مهمة ${mission.code} تستهدف منطقة عالية الخطورة. التوجيه استشاري ولا يصرّح بالدخول البشري.`,
              facility_id: zone.facility_id,
              device_id: input.device_id,
              device_kind: kind,
              mission_id: mission.id,
              inspection_id: inspection.id,
              dedupe_key: `high_risk:${mission.id}`,
            }, await nextCode(tx, "alert", "VG-ALT"));
          }
          await audit(tx, actor, "mission.assigned", "missions", mission.id, { device_id: input.device_id });
        }
        await audit(tx, actor, "inspection.created", "inspections", inspection.id, { code: inspection.code, method: inspection.method });
        return { inspection, mission };
      });
    },

    async cancelInspection(actor: Actor, id: string) {
      guard(actor, "inspections.cancel");
      return db.transaction(async (tx) => {
        const inspection = await tx.get("inspections", id);
        if (!inspection) throw new AppError("not_found", "التفتيش غير موجود.");
        if (inspection.status === "COMPLETED" || inspection.status === "CLOSED") throw new AppError("invalid_state", "لا يمكن إلغاء تفتيش منتهٍ.");
        const stamp = nowIso();
        await tx.update("inspections", id, { status: "CANCELLED", updated_at: stamp });
        const missions = await tx.list("missions", { filters: { inspection_id: id } });
        for (const mission of missions) {
          if (!TERMINAL_MISSION_STATUSES.includes(mission.status) && mission.status !== "INTERRUPTED") {
            if (["CREATED", "ASSIGNED", "READY", "DISPATCHED"].includes(mission.status) || mission.status === "FAILED") {
              try {
                await applyMissionStatus(tx, actor, mission, "CANCELLED", "أُلغي التفتيش المرتبط.", "user");
              } catch {
                await tx.update("missions", mission.id, { status: "CANCELLED", updated_at: stamp });
                await setDeviceStatus(tx, { ...mission, status: "CANCELLED" }, "available");
              }
            } else {
              await tx.update("missions", mission.id, { status: "CANCELLED", updated_at: stamp, completed_at: stamp });
              await setDeviceStatus(tx, { ...mission, status: "CANCELLED", completed_at: stamp }, "available");
            }
          }
        }
        await audit(tx, actor, "inspection.cancelled", "inspections", id, null);
      });
    },

    async saveChecklistItem(
      actor: Actor,
      itemId: string,
      patch: { response?: ChecklistResponse | null; numeric_value?: number | null; notes?: string | null; severity?: Severity | null },
    ) {
      guard(actor, "checklists.fill");
      return db.transaction(async (tx) => {
        const item = await tx.get("inspection_checklist_items", itemId);
        if (!item) throw new AppError("not_found", "بند القائمة غير موجود.");
        return tx.update("inspection_checklist_items", itemId, { ...patch, updated_at: nowIso() });
      });
    },

    async addObservation(actor: Actor, input: { inspection_id: string; category: import("@/types/domain").PointCategory; description: string; severity: Severity; mission_id?: string | null }) {
      guard(actor, "inspections.update");
      return db.transaction(async (tx) => {
        const inspection = await tx.get("inspections", input.inspection_id);
        if (!inspection) throw new AppError("not_found", "التفتيش غير موجود.");
        const row = await tx.insert("inspection_observations", {
          id: uid(),
          inspection_id: input.inspection_id,
          point_id: null,
          mission_id: input.mission_id ?? null,
          category: input.category,
          description: input.description.trim(),
          severity: input.severity,
          source: "inspector",
          created_by: actor.id,
          created_at: nowIso(),
        });
        await audit(tx, actor, "observation.created", "inspection_observations", row.id, null);
        return row;
      });
    },

    async uploadEvidence(actor: Actor, input: { inspectionId: string; missionId?: string | null; pointId?: string | null; file: Blob; fileName: string; caption?: string }) {
      guard(actor, "checklists.fill");
      validateUpload({ type: input.file.type, size: input.file.size });
      const id = uid();
      const storagePath = await storage.save(input.file, `${input.inspectionId}/${id}-${input.fileName}`);
      return db.transaction(async (tx) => {
        const row = await tx.insert("inspection_media", {
          id,
          inspection_id: input.inspectionId,
          mission_id: input.missionId ?? null,
          point_id: input.pointId ?? null,
          storage_path: storagePath,
          file_name: input.fileName,
          mime_type: input.file.type,
          size_bytes: input.file.size,
          caption: input.caption ?? input.fileName,
          captured_at: nowIso(),
          source: "upload",
          created_by: actor.id,
          created_at: nowIso(),
        });
        await audit(tx, actor, "media.uploaded", "inspection_media", row.id, { file: input.fileName });
        return row;
      });
    },

    async recordDecision(actor: Actor, input: { inspectionId: string; pointId?: string | null; action: DecisionAction; notes?: string | null }) {
      guard(actor, "decisions.record");
      return db.transaction(async (tx) => {
        const inspection = await tx.get("inspections", input.inspectionId);
        if (!inspection) throw new AppError("not_found", "التفتيش غير موجود.");
        const stamp = nowIso();
        const decision = await tx.insert("inspection_decisions", {
          id: uid(),
          inspection_id: input.inspectionId,
          point_id: input.pointId ?? null,
          observation_id: null,
          action: input.action,
          notes: input.notes ?? null,
          decided_by: actor.id,
          decided_at: stamp,
          created_at: stamp,
        });
        if (input.pointId) {
          const status =
            input.action === "confirm" ? "confirmed" :
            input.action === "reject" ? "rejected" :
            input.action === "close" ? "closed" : "follow_up";
          await tx.update("inspection_points", input.pointId, { review_status: status, updated_at: stamp });
        }
        if (input.action === "maintenance") {
          const mission = (await tx.list("missions", { filters: { inspection_id: inspection.id } }))[0];
          if (mission?.device_id && mission.device_kind) {
            await tx.insert("maintenance_records", {
              id: uid(),
              device_id: mission.device_id,
              device_kind: mission.device_kind,
              description: input.notes || "إحالة من قرار تفتيش",
              status: "scheduled",
              performed_at: null,
              next_due_at: null,
              created_by: actor.id,
              created_at: stamp,
            });
          }
        }
        const missions = await tx.list("missions", { filters: { inspection_id: inspection.id } });
        const points = await tx.list("inspection_points", { filters: { inspection_id: inspection.id } });
        for (const mission of missions) {
          if (mission.status === "REVIEW_REQUIRED" && points.every((point) => point.review_status !== "pending")) {
            await applyMissionStatus(tx, actor, mission, "INSPECTOR_REVIEW", "سُجل قرار المفتش وأصبحت المهمة قيد المراجعة الختامية.", "user");
          }
        }
        await audit(tx, actor, "decision.recorded", "inspection_decisions", decision.id, { action: input.action });
        return decision;
      });
    },

    async completeMission(actor: Actor, missionId: string) {
      guard(actor, "missions.review");
      return db.transaction(async (tx) => {
        const mission = await tx.get("missions", missionId);
        if (!mission) throw new AppError("not_found", "المهمة غير موجودة.");
        const points = await tx.list("inspection_points", { filters: { mission_id: missionId } });
        const check = canCompleteMission({ status: mission.status, points });
        if (!check.ok) throw new AppError("invalid_state", check.reasons.join(" "));
        const updated = await applyMissionStatus(tx, actor, mission, "COMPLETED", "اكتملت المهمة بعد مراجعة المفتش.", "user");
        await audit(tx, actor, "mission.completed", "missions", missionId, null);
        return updated;
      });
    },

    async interruptMission(actor: Actor, missionId: string) {
      guard(actor, "missions.operate");
      return db.transaction(async (tx) => {
        const mission = await tx.get("missions", missionId);
        if (!mission) throw new AppError("not_found", "المهمة غير موجودة.");
        return applyMissionStatus(tx, actor, mission, "INTERRUPTED", "أوقف المشغّل المهمة.", "user");
      });
    },

    async advanceSimulation(actor: Actor, missionId: string) {
      guard(actor, "missions.operate");
      return db.transaction(async (tx) => {
        const mission = await tx.get("missions", missionId);
        if (!mission) throw new AppError("not_found", "المهمة غير موجودة.");
        if (!mission.is_simulation) throw new AppError("invalid_state", "هذه المهمة ليست في وضع المحاكاة.");
        const events = await tx.list("mission_events", { filters: { mission_id: missionId } });
        const step = TANK_PATROL_SCENARIO.steps[simulationStepCount(events)];
        if (!step) return { done: true as const, mission };
        await applySimulationStep(tx, actor, mission, step);
        const updated = await tx.get("missions", missionId);
        return { done: simulationStepCount(await tx.list("mission_events", { filters: { mission_id: missionId } })) >= TANK_PATROL_SCENARIO.steps.length, mission: updated! };
      });
    },

    async resetSimulation(actor: Actor, missionId: string) {
      guard(actor, "missions.operate");
      return db.transaction(async (tx) => {
        const mission = await tx.get("missions", missionId);
        if (!mission) throw new AppError("not_found", "المهمة غير موجودة.");
        const decisions = await tx.list("inspection_decisions", { filters: { inspection_id: mission.inspection_id } });
        if (decisions.length) throw new AppError("invalid_state", "لا يمكن إعادة المحاكاة بعد تسجيل قرار.");
        const events = await tx.list("mission_events", { filters: { mission_id: missionId } });
        for (const row of events) {
          if (row.event_type === "stage" || row.to_status === "CREATED") continue;
          await tx.remove("mission_events", row.id);
        }
        for (const row of await tx.list("telemetry_records", { filters: { mission_id: missionId } })) {
          if (row.source === "simulation") await tx.remove("telemetry_records", row.id);
        }
        for (const row of await tx.list("sensor_readings", { filters: { mission_id: missionId } })) {
          if (row.source === "simulation") await tx.remove("sensor_readings", row.id);
        }
        for (const row of await tx.list("inspection_media", { filters: { mission_id: missionId } })) {
          if (row.source === "simulation") await tx.remove("inspection_media", row.id);
        }
        for (const row of await tx.list("inspection_points", { filters: { mission_id: missionId } })) {
          if (row.source === "simulation") await tx.remove("inspection_points", row.id);
        }
        for (const row of await tx.list("inspection_observations", { filters: { mission_id: missionId } })) {
          if (row.source === "simulation") await tx.remove("inspection_observations", row.id);
        }
        for (const row of await tx.list("alerts", { filters: { mission_id: missionId } })) {
          if (row.category === "point_review" || row.dedupe_key?.startsWith("point:")) await tx.remove("alerts", row.id);
        }
        const stamp = nowIso();
        await tx.update("missions", missionId, { status: "READY", progress: 0, stage: 1, started_at: null, completed_at: null, updated_at: stamp });
        if (mission.device_id && mission.device_kind) {
          await tx.update(deviceTable(mission.device_kind), mission.device_id, { operational_status: "reserved", availability: "unavailable", current_mission_id: missionId, updated_at: stamp });
        }
        const inspection = await tx.get("inspections", mission.inspection_id);
        if (inspection && !["COMPLETED", "CLOSED", "CANCELLED"].includes(inspection.status)) {
          await tx.update("inspections", inspection.id, { status: "READY", started_at: null, updated_at: stamp });
        }
        await audit(tx, actor, "mission.reset_simulation", "missions", missionId, null);
      });
    },

    async finalizeInspection(actor: Actor, inspectionId: string) {
      guard(actor, "inspections.complete");
      return db.transaction(async (tx) => {
        const inspection = await tx.get("inspections", inspectionId);
        if (!inspection) throw new AppError("not_found", "التفتيش غير موجود.");
        let missions = await tx.list("missions", { filters: { inspection_id: inspectionId } });
        const points = await tx.list("inspection_points", { filters: { inspection_id: inspectionId } });
        for (const mission of missions) {
          if (mission.status === "INSPECTOR_REVIEW" && canCompleteMission({ status: mission.status, points: points.filter((point) => point.mission_id === mission.id) }).ok) {
            await applyMissionStatus(tx, actor, mission, "COMPLETED", "أُغلقت المهمة مع إنهاء التفتيش.", "user");
          }
        }
        missions = await tx.list("missions", { filters: { inspection_id: inspectionId } });
        const checklist = (await tx.list("inspection_checklists", { filters: { inspection_id: inspectionId } }))[0];
        const items = checklist ? await tx.list("inspection_checklist_items", { filters: { checklist_id: checklist.id } }) : [];
        const decisions = await tx.list("inspection_decisions", { filters: { inspection_id: inspectionId } });
        const check = canFinalizeInspection({ inspection, items, points, decisions, missions, actor });
        if (!check.ok) throw new AppError("invalid_state", check.reasons.join(" "));
        const status = completionStatus(decisions);
        const stamp = nowIso();
        const updated = await tx.update("inspections", inspectionId, {
          status,
          completed_at: stamp,
          started_at: inspection.started_at ?? stamp,
          updated_at: stamp,
        });
        if (checklist) await tx.update("inspection_checklists", checklist.id, { completed_at: stamp, updated_at: stamp });
        if (inspection.equipment_id) await tx.update("equipment", inspection.equipment_id, { last_inspection_at: stamp, updated_at: stamp });
        await audit(tx, actor, "inspection.completed", "inspections", inspectionId, { status });
        return updated;
      });
    },

    async generateReport(actor: Actor, inspectionId: string) {
      guard(actor, "reports.generate");
      return db.transaction(async (tx) => {
        const inspection = await tx.get("inspections", inspectionId);
        if (!inspection) throw new AppError("not_found", "التفتيش غير موجود.");
        if (!["COMPLETED", "FOLLOW_UP_REQUIRED", "CLOSED"].includes(inspection.status)) {
          throw new AppError("invalid_state", "يُنشأ التقرير بعد إنهاء التفتيش.");
        }
        const facility = await tx.get("facilities", inspection.facility_id);
        const site = await tx.get("sites", inspection.site_id);
        const sector = await tx.get("sectors", inspection.sector_id);
        const zone = await tx.get("inspection_zones", inspection.zone_id);
        if (!facility || !site || !sector || !zone) throw new AppError("invalid_state", "بيانات المنشأة غير مكتملة.");
        const existing = await tx.list("inspection_reports", { filters: { inspection_id: inspectionId } });
        const revision = nextRevision(existing);
        const checklist = (await tx.list("inspection_checklists", { filters: { inspection_id: inspectionId } }))[0];
        const items = checklist ? await tx.list("inspection_checklist_items", { filters: { checklist_id: checklist.id } }) : [];
        const template = await tx.get("inspection_templates", inspection.template_id);
        const equipment = inspection.equipment_id ? await tx.get("equipment", inspection.equipment_id) : null;
        const inspector = inspection.assigned_inspector_id ? await tx.get("profiles", inspection.assigned_inspector_id) : null;
        const observations = await tx.list("inspection_observations", { filters: { inspection_id: inspectionId } });
        const points = await tx.list("inspection_points", { filters: { inspection_id: inspectionId } });
        const media = await tx.list("inspection_media", { filters: { inspection_id: inspectionId } });
        const missions = await tx.list("missions", { filters: { inspection_id: inspectionId } });
        const readings = (await tx.list("sensor_readings")).filter((reading) => missions.some((mission) => mission.id === reading.mission_id));
        const thresholds = await tx.list("sensor_thresholds");
        const alerts = await tx.list("alerts", { filters: { inspection_id: inspectionId } });
        const decisions = await tx.list("inspection_decisions", { filters: { inspection_id: inspectionId } });
        const code = await nextCode(tx, "report", "VG-REP");
        const snapshot = buildReportSnapshot({
          reportCode: code,
          revision,
          inspection,
          facility,
          site,
          sector,
          zone,
          equipment,
          inspector,
          items,
          scoringRules: template?.scoring_rules ?? {},
          observations,
          points,
          media,
          readings,
          thresholds,
          alerts,
          decisions,
          generatedAt: nowIso(),
        });
        const report = await tx.insert("inspection_reports", {
          id: uid(),
          code,
          inspection_id: inspectionId,
          revision,
          status: "final",
          snapshot,
          created_by: actor.id,
          created_at: snapshot.generated_at,
        });
        for (const [index, item] of snapshot.checklist_items.entries()) {
          await tx.insert("inspection_report_items", {
            id: uid(),
            report_id: report.id,
            category: item.category,
            label: item.label,
            response: item.response,
            score: null,
            notes: item.notes,
            sort_order: index + 1,
          });
        }
        await audit(tx, actor, "report.generated", "inspection_reports", report.id, { revision, code });
        return report;
      });
    },

    async syncOperationalAlerts(actor: Actor) {
      guard(actor, "alerts.view");
      return db.transaction(async (tx) => {
        const inspections = await tx.list("inspections");
        const existing = await tx.list("alerts");
        const drafts = inspections.map((inspection) => overdueAlert(inspection, Date.now())).filter((item): item is NonNullable<typeof item> => Boolean(item));
        const missing = missingAlerts(existing, drafts);
        for (const draft of missing) {
          await insertAlertFromDraft(tx, draft, await nextCode(tx, "alert", "VG-ALT"));
        }
        return missing.length;
      });
    },

    async updateAlert(actor: Actor, id: string, action: "read" | "acknowledge" | "escalate" | "resolve" | "assign", extra?: { notes?: string; assigneeId?: string }) {
      const permission = action === "read" || action === "acknowledge" ? "alerts.view" : "alerts.manage";
      if (action === "resolve" || action === "escalate" || action === "assign") guard(actor, "alerts.manage");
      else guard(actor, permission);
      return db.transaction(async (tx) => {
        const alert = await tx.get("alerts", id);
        if (!alert) throw new AppError("not_found", "التنبيه غير موجود.");
        const stamp = nowIso();
        if (action === "read") return tx.update("alerts", id, { read_at: alert.read_at ?? stamp, updated_at: stamp });
        if (action === "acknowledge") {
          return tx.update("alerts", id, { read_at: alert.read_at ?? stamp, acknowledged_at: stamp, acknowledged_by: actor.id, resolution_status: alert.resolution_status === "open" ? "acknowledged" : alert.resolution_status, updated_at: stamp });
        }
        if (action === "assign") return tx.update("alerts", id, { assigned_user_id: extra?.assigneeId ?? actor.id, updated_at: stamp });
        if (action === "escalate") {
          return tx.update("alerts", id, { resolution_status: "escalated", severity: alert.severity === "critical" ? "critical" : "high", updated_at: stamp });
        }
        const row = await tx.update("alerts", id, { resolution_status: "resolved", resolution_notes: extra?.notes ?? null, resolved_at: stamp, resolved_by: actor.id, updated_at: stamp });
        await audit(tx, actor, "alert.resolved", "alerts", id, null);
        return row;
      });
    },

    async saveDrone(actor: Actor, input: { id?: string; code: string; name: string; model: string; manufacturer: string; resolution?: string | null; battery_capacity_mah: number; current_battery: number; notes?: string | null; operational_status?: DeviceStatus }) {
      guard(actor, "devices.manage");
      return db.transaction(async (tx) => {
        const stamp = nowIso();
        const status = input.operational_status ?? "available";
        if (input.id) {
          const row = await tx.update("drones", input.id, {
            code: input.code,
            name: input.name,
            model: input.model,
            manufacturer: input.manufacturer,
            resolution: input.resolution ?? null,
            battery_capacity_mah: input.battery_capacity_mah,
            current_battery: input.current_battery,
            notes: input.notes ?? null,
            operational_status: status,
            availability: status === "available" ? "available" : "unavailable",
            updated_at: stamp,
          });
          await audit(tx, actor, "device.updated", "drones", input.id, null);
          return row;
        }
        const row = await tx.insert("drones", {
          id: uid(),
          code: input.code,
          name: input.name,
          model: input.model,
          manufacturer: input.manufacturer,
          camera_capable: true,
          resolution: input.resolution ?? null,
          battery_capacity_mah: input.battery_capacity_mah,
          current_battery: input.current_battery,
          signal_quality: null,
          operational_status: status,
          availability: status === "available" ? "available" : "unavailable",
          current_mission_id: null,
          last_maintenance_at: null,
          total_flight_minutes: 0,
          position_label: null,
          last_position: null,
          notes: input.notes ?? null,
          created_at: stamp,
          updated_at: stamp,
        });
        await audit(tx, actor, "device.created", "drones", row.id, { code: row.code });
        return row;
      });
    },

    async saveRobot(actor: Actor, input: { id?: string; code: string; name: string; robot_type: string; model: string; manufacturer: string; sensors: string[]; battery_capacity_mah: number; current_battery: number; notes?: string | null; location_label?: string | null; operational_status?: DeviceStatus }) {
      guard(actor, "devices.manage");
      return db.transaction(async (tx) => {
        const stamp = nowIso();
        const status = input.operational_status ?? "available";
        if (input.id) {
          const row = await tx.update("robots", input.id, { ...input, operational_status: status, availability: status === "available" ? "available" : "unavailable", updated_at: stamp });
          await audit(tx, actor, "device.updated", "robots", input.id, null);
          return row;
        }
        const row = await tx.insert("robots", {
          id: uid(),
          code: input.code,
          name: input.name,
          robot_type: input.robot_type,
          model: input.model,
          manufacturer: input.manufacturer,
          sensors: input.sensors,
          battery_capacity_mah: input.battery_capacity_mah,
          current_battery: input.current_battery,
          operational_status: status,
          availability: status === "available" ? "available" : "unavailable",
          current_mission_id: null,
          location_label: input.location_label ?? null,
          last_maintenance_at: null,
          notes: input.notes ?? null,
          created_at: stamp,
          updated_at: stamp,
        });
        await audit(tx, actor, "device.created", "robots", row.id, { code: row.code });
        return row;
      });
    },

    async addMaintenance(actor: Actor, input: { device_id: string; device_kind: "drone" | "robot"; description: string; status: "scheduled" | "completed" | "overdue"; performed_at?: string | null; next_due_at?: string | null }) {
      guard(actor, "devices.manage");
      return db.transaction(async (tx) => {
        const row = await tx.insert("maintenance_records", {
          id: uid(),
          device_id: input.device_id,
          device_kind: input.device_kind,
          description: input.description,
          status: input.status,
          performed_at: input.performed_at ?? null,
          next_due_at: input.next_due_at ?? null,
          created_by: actor.id,
          created_at: nowIso(),
        });
        if (input.status === "completed") {
          await tx.update(deviceTable(input.device_kind), input.device_id, { last_maintenance_at: input.performed_at ?? nowIso(), updated_at: nowIso() });
        }
        await audit(tx, actor, "device.maintenance", "maintenance_records", row.id, null);
        return row;
      });
    },

    async updateSettings(actor: Actor, key: string, value: Json) {
      guard(actor, "settings.manage");
      return db.transaction(async (tx) => {
        const existing = await tx.get("settings", key);
        const stamp = nowIso();
        if (existing) return tx.update("settings", key, { value, updated_at: stamp, updated_by: actor.id });
        return tx.insert("settings", { id: key, value, updated_at: stamp, updated_by: actor.id });
      });
    },

    async resetDemoData(actor: Actor) {
      guard(actor, "settings.manage");
      const current = await db.dump();
      const seed = buildSeed();
      seed.profiles = current.profiles;
      seed.audit_logs = [...seed.audit_logs, ...current.audit_logs.filter((item) => item.target_table === "profiles")];
      await db.replace(seed);
      await audit(db, actor, "demo.reset", "settings", "simulation_enabled", null);
    },
  };
}

async function applySimulationStep(tx: DbPort, actor: Actor, mission: Mission, step: SimulationStep) {
  const updated = await applyMissionStatus(tx, actor, mission, step.to_status, step.message, "simulation");
  const stamp = nowIso();
  await tx.update("missions", mission.id, { progress: step.progress, stage: step.stage, updated_at: stamp });
      if (step.telemetry && mission.device_id && mission.device_kind) {
    await tx.insert("telemetry_records", {
      id: uid(),
      mission_id: mission.id,
      device_id: mission.device_id,
      device_kind: mission.device_kind,
      altitude_m: step.telemetry.altitude_m,
      speed_mps: step.telemetry.speed_mps,
      battery_percent: step.telemetry.battery_percent,
      signal_quality: step.telemetry.signal_quality,
      latitude: null,
      longitude: null,
      recorded_at: stamp,
      source: "simulation",
      quality: "good",
      created_at: stamp,
    });
    await tx.update(deviceTable(mission.device_kind), mission.device_id, {
        current_battery: step.telemetry.battery_percent,
        ...(mission.device_kind === "drone" ? { signal_quality: step.telemetry.signal_quality } : {}),
        updated_at: stamp,
      } as never);
      const draft = batteryAlert({ id: mission.device_id, kind: mission.device_kind, code: "الجهاز", battery: step.telemetry.battery_percent });
      if (draft) {
        const existing = await tx.list("alerts");
        if (!existing.some((alert) => alert.dedupe_key === draft.dedupe_key && alert.resolution_status !== "resolved")) {
          await insertAlertFromDraft(tx, draft, await nextCode(tx, "alert", "VG-ALT"));
        }
      }
    }
  if (step.sensors) {
    const thresholds = await tx.list("sensor_thresholds");
    for (const sensor of step.sensors) {
      const threshold = thresholds.find((item) => item.sensor_code === sensor.sensor_code && item.measurement_type === sensor.measurement_type && item.is_active) ?? null;
      const reading = await tx.insert("sensor_readings", {
        id: uid(),
        mission_id: mission.id,
        sensor_code: sensor.sensor_code,
        measurement_type: sensor.measurement_type,
        numeric_value: sensor.numeric_value,
        unit: sensor.unit,
        text_value: null,
        recorded_at: stamp,
        source: "simulation",
        quality: "good",
        threshold_id: threshold?.id ?? null,
        created_at: stamp,
      });
      const draft = thresholdAlert(reading, threshold);
      if (draft) await insertAlertFromDraft(tx, draft, await nextCode(tx, "alert", "VG-ALT"));
    }
  }
  if (step.mediaCaption) {
    const path = simulatedEvidenceSvg(step.mediaCaption);
    await tx.insert("inspection_media", {
      id: uid(),
      inspection_id: mission.inspection_id,
      mission_id: mission.id,
      point_id: null,
      storage_path: path,
      file_name: "simulation.svg",
      mime_type: "image/svg+xml",
      size_bytes: path.length,
      caption: step.mediaCaption,
      captured_at: stamp,
      source: "simulation",
      created_by: actor.id,
      created_at: stamp,
    });
  }
  if (step.point) {
    const inspection = await tx.get("inspections", mission.inspection_id);
    const code = await nextCode(tx, "point", "VG-PT");
    const point = await tx.insert("inspection_points", {
      id: uid(),
      code,
      mission_id: mission.id,
      inspection_id: mission.inspection_id,
      facility_id: mission.facility_id,
      equipment_id: inspection?.equipment_id ?? null,
      zone_id: mission.zone_id,
      location_label: "موقع المحاكاة",
      category: step.point.category,
      description: step.point.description,
      severity: step.point.severity,
      source: "simulation",
      confidence: null,
      review_status: "pending",
      created_at: stamp,
      updated_at: stamp,
    });
    await tx.insert("inspection_observations", {
      id: uid(),
      inspection_id: mission.inspection_id,
      point_id: point.id,
      mission_id: mission.id,
      category: step.point.category,
      description: step.point.description,
      severity: step.point.severity,
      source: "simulation",
      created_by: actor.id,
      created_at: stamp,
    });
    const draft = pointReviewAlert({
      pointCode: code,
      inspectionId: mission.inspection_id,
      facilityId: mission.facility_id,
      missionId: mission.id,
      description: step.point.description,
    });
    await insertAlertFromDraft(tx, draft, await nextCode(tx, "alert", "VG-ALT"));
    await audit(tx, actor, "observation.created", "inspection_points", point.id, { source: "simulation" });
  }
  return updated;
}

export type Platform = ReturnType<typeof createPlatform>;
