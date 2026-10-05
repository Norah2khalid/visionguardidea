import { describe, expect, it } from "vitest";
import { IDS, buildSeed } from "@/data/seed";
import { compareInspections, computeKpis, temperatureOf, visibleTasks } from "@/lib/derive";
import { can } from "@/lib/permissions";
import { analyzeDemo } from "@/services/ai/mockAIService";
import { buildAnalysisInput } from "@/services/ai/mapInput";
import {
  answerChecklistItem,
  addObservation,
  applyAnalysis,
  cancelTask,
  completeChecklist,
  confirmMedia,
  createTask,
  generateReport,
  reviewFinding,
  startInspection,
  submitInspection,
} from "@/services/platform/mutations";
import type { ActorContext, AppData, User } from "@/types/domain";

function user(data: AppData, id: string): User {
  const found = data.users.find((item) => item.id === id);
  if (!found) throw new Error("user");
  return found;
}

function ctx(actor: User, at: string): ActorContext {
  return { actor, at };
}

describe("seed", () => {
  it("links facilities, tasks, inspections, and reports without dangling ids", () => {
    const data = buildSeed();
    expect(data.inspection_locations).toHaveLength(12);
    expect(data.inspection_tasks).toHaveLength(11);
    for (const task of data.inspection_tasks) {
      expect(data.facilities.some((item) => item.id === task.facility_id)).toBe(true);
      expect(data.inspection_locations.some((item) => item.id === task.location_id)).toBe(true);
      expect(data.equipment.some((item) => item.id === task.equipment_id)).toBe(true);
    }
    for (const finding of data.inspection_findings) {
      expect(finding.is_demo).toBe(true);
      expect(data.inspection_images.some((image) => image.id === finding.image_id)).toBe(true);
    }
    const ids = data.inspection_checklist_items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(data.devices.every((device) => device.source === "SIMULATION" || device.source === "UNAVAILABLE")).toBe(true);
    expect(data.reports.find((report) => report.code === "VG-RPT-0118")?.snapshot.disclaimer).toContain("تحليل تجريبي");
  });
});

describe("kpis and roles", () => {
  it("derives dashboard counts from the same records", () => {
    const data = buildSeed();
    const kpis = computeKpis(data, data.inspection_tasks, data.inspections, new Date("2026-10-05T12:00:00.000Z"));
    expect(kpis.locations).toBe(data.inspection_locations.length);
    expect(kpis.activeTasks).toBe(data.inspection_tasks.filter((task) => !["completed", "cancelled"].includes(task.status)).length);
    expect(kpis.completedInspections).toBe(data.inspections.filter((item) => item.status === "completed").length);
    expect(kpis.devices).toBe(data.devices.length);
    const khaled = user(data, IDS.khaled);
    expect(visibleTasks(data, "inspector", khaled.id).every((task) => task.inspector_id === khaled.id)).toBe(true);
    expect(can("report_collector", "inspection.operate")).toBe(false);
    expect(can("manager", "records.view_all")).toBe(true);
  });
});

describe("history comparison", () => {
  it("shows the T-04 risk increase without rewriting the older inspection", () => {
    const data = buildSeed();
    const comparison = compareInspections(data, IDS.ins2062);
    expect(comparison?.previous.code).toBe("INS-2040");
    expect(comparison?.previous.risk_level).toBe("medium");
    expect(comparison?.current.risk_level).toBe("high");
    expect(temperatureOf(data, IDS.ins2040)).toBe(64);
    expect(temperatureOf(data, IDS.ins2062)).toBe(91);
    expect(comparison?.newFindings.some((finding) => finding.category === "possible_leak")).toBe(true);
  });
});

describe("inspection workflow", () => {
  it("walks a new task through review into a new report and keeps prior records", () => {
    const data = buildSeed();
    const manager = user(data, IDS.nora);
    const inspector = user(data, IDS.khaled);
    const at = "2026-10-05T09:00:00.000Z";
    const created = createTask(
      data,
      {
        title: "فحص طارئ لصمام V-19",
        facility_id: IDS.facPump,
        location_id: IDS.locV19,
        inspector_id: IDS.khaled,
        priority: "high",
        due_date: "2026-10-09",
      },
      ctx(manager, at),
    );
    expect(created.ok).toBe(true);
    const task = created.data.inspection_tasks.find((item) => item.title === "فحص طارئ لصمام V-19")!;
    const started = startInspection(created.data, task.id, ctx(inspector, "2026-10-05T09:10:00.000Z"));
    expect(started.ok).toBe(true);
    const inspection = started.data.inspections.find((item) => item.task_id === task.id)!;
    let current = started.data;
    const items = current.inspection_checklist_items.filter((item) =>
      current.inspection_checklists.some((list) => list.id === item.checklist_id && list.inspection_id === inspection.id),
    );
    for (const item of items) {
      const numeric = item.item_key === "temperature" ? 96 : item.item_key === "pressure" ? 7.2 : null;
      const response = item.item_key === "leak" || item.item_key === "temperature" ? "fail" : "warning";
      const saved = answerChecklistItem(current, item.id, response, numeric, "ملاحظة ميدانية", ctx(inspector, "2026-10-05T09:20:00.000Z"));
      expect(saved.ok).toBe(true);
      current = saved.data;
    }
    const closed = completeChecklist(current, inspection.id, ctx(inspector, "2026-10-05T09:30:00.000Z"));
    expect(closed.ok).toBe(true);
    current = closed.data;
    const noted = addObservation(current, inspection.id, "أُضيفت صورة ميدانية لاحقًا والملاحظة تغطي جمع البيانات.", ctx(inspector, "2026-10-05T09:35:00.000Z"));
    expect(noted.ok).toBe(true);
    current = noted.data;
    const media = confirmMedia(current, inspection.id, ctx(inspector, "2026-10-05T09:40:00.000Z"));
    expect(media.ok).toBe(true);
    current = media.data;
    const input = buildAnalysisInput(current, inspection.id)!;
    const analysis = analyzeDemo(input);
    expect(analysis.isDemo).toBe(true);
    expect(analysis.summary).toContain("تحليل تجريبي");
    const applied = applyAnalysis(current, inspection.id, analysis, ctx(inspector, "2026-10-05T09:45:00.000Z"));
    expect(applied.ok).toBe(true);
    current = applied.data;
    const openFindings = current.inspection_findings.filter((finding) => finding.inspection_id === inspection.id && finding.status === "open");
    expect(openFindings.length).toBeGreaterThan(0);
    const blocked = submitInspection(current, inspection.id, "محاولة إغلاق مبكرة", ctx(inspector, "2026-10-05T09:50:00.000Z"));
    expect(blocked.ok).toBe(false);
    for (const finding of openFindings) {
      const reviewed = reviewFinding(current, finding.id, "maintenance", "تحويل للصيانة بعد المعاينة", ctx(inspector, "2026-10-05T10:00:00.000Z"));
      expect(reviewed.ok).toBe(true);
      current = reviewed.data;
    }
    const submitted = submitInspection(current, inspection.id, "أُغلق التفتيش بعد المراجعة البشرية", ctx(inspector, "2026-10-05T10:10:00.000Z"));
    expect(submitted.ok).toBe(true);
    current = submitted.data;
    expect(current.inspections.find((item) => item.id === IDS.ins2040)?.risk_level).toBe("medium");
    expect(temperatureOf(current, IDS.ins2040)).toBe(64);
    const collector = user(current, IDS.fahd);
    const report = generateReport(current, inspection.id, ctx(collector, "2026-10-05T10:20:00.000Z"));
    expect(report.ok).toBe(true);
    const again = generateReport(report.data, inspection.id, ctx(collector, "2026-10-05T10:30:00.000Z"));
    expect(again.ok).toBe(true);
    const revisions = again.data.reports.filter((item) => item.inspection_id === inspection.id);
    expect(revisions.map((item) => item.revision).sort()).toEqual([1, 2]);
    expect(revisions[0]?.snapshot.report_code).not.toBe(revisions[1]?.snapshot.report_code);
    const denied = cancelTask(again.data, task.id, ctx(manager, "2026-10-05T10:40:00.000Z"));
    expect(denied.ok).toBe(false);
  });
});
