import { inspectionFrame } from "@/data/imagery";
import { CHECKLIST_TEMPLATE } from "@/lib/checklistTemplate";
import { checklistFor, findingsFor, resultFromChecklist, terminalDecision, worstRisk } from "@/lib/derive";
import { can } from "@/lib/permissions";
import { buildReportSnapshot } from "@/lib/reports";
import type { AnalysisOutput } from "@/services/ai/types";
import { inspectionImagePath } from "@/services/storage/paths";
import type {
  ActorContext,
  AppData,
  CheckResult,
  FindingStatus,
  InspectionTask,
  MutationResult,
  Priority,
  ReportStatus,
  ReviewDecision,
  WorkflowStage,
} from "@/types/domain";
import { nextCode, uid } from "@/utils/ids";

const STAGE_ORDER: WorkflowStage[] = ["created", "assigned", "started", "checklist", "media", "ai", "review", "completed", "reported", "recorded"];

const DECISION_STATUS: Record<Exclude<ReviewDecision, "note">, FindingStatus> = {
  approve: "approved",
  reject: "rejected",
  extra_inspection: "extra_inspection",
  maintenance: "maintenance",
};

export interface TaskInput {
  title: string;
  facility_id: string;
  location_id: string;
  inspector_id: string | null;
  priority: Priority;
  due_date: string;
}

export function createTask(data: AppData, input: TaskInput, ctx: ActorContext): MutationResult {
  if (!can(ctx.actor.role_code, "task.create")) return fail(data, "إنشاء المهام متاح للمدير.");
  const title = input.title.trim();
  if (title.length < 4) return fail(data, "أدخل عنوانًا واضحًا للمهمة.");
  const dueDate = normalizeDueDate(input.due_date);
  if (!dueDate) return fail(data, "تاريخ الاستحقاق غير صالح. استخدم الصيغة 2026-10-20.");
  const location = data.inspection_locations.find((item) => item.id === input.location_id && item.facility_id === input.facility_id);
  if (!location) return fail(data, "موقع التفتيش لا يتبع المنشأة المحددة.");
  if (input.inspector_id && !data.users.some((user) => user.id === input.inspector_id && user.role_code === "inspector")) {
    return fail(data, "يجب تعيين مفتش من قائمة المفتشين.");
  }
  const next = draft(data);
  const now = stamp(ctx);
  const task: InspectionTask = {
    id: uid(),
    code: nextCode(next.inspection_tasks.map((item) => item.code), "VG-TSK-"),
    title,
    facility_id: input.facility_id,
    location_id: location.id,
    equipment_id: location.equipment_id,
    inspector_id: input.inspector_id,
    priority: input.priority,
    due_date: dueDate,
    status: input.inspector_id ? "scheduled" : "new",
    workflow_stage: input.inspector_id ? "assigned" : "created",
    created_at: now,
    updated_at: now,
  };
  next.inspection_tasks.push(task);
  pushLog(next, "inspection_tasks", task.id, "create", `أُنشئت المهمة ${task.code}`, ctx.actor.id, now);
  return ok(next, `تم إنشاء المهمة ${task.code}`);
}

export function updateTask(data: AppData, taskId: string, input: TaskInput, ctx: ActorContext): MutationResult {
  if (!can(ctx.actor.role_code, "task.edit")) return fail(data, "تعديل المهام متاح للمدير.");
  const current = data.inspection_tasks.find((item) => item.id === taskId);
  if (!current) return fail(data, "المهمة غير موجودة.");
  if (current.status === "completed" || current.status === "cancelled") return fail(data, "لا يمكن تعديل مهمة مكتملة أو ملغاة.");
  const title = input.title.trim();
  if (title.length < 4) return fail(data, "أدخل عنوانًا واضحًا للمهمة.");
  const dueDate = normalizeDueDate(input.due_date);
  if (!dueDate) return fail(data, "تاريخ الاستحقاق غير صالح. استخدم الصيغة 2026-10-20.");
  const location = data.inspection_locations.find((item) => item.id === input.location_id && item.facility_id === input.facility_id);
  if (!location) return fail(data, "موقع التفتيش لا يتبع المنشأة المحددة.");
  if (input.inspector_id && !data.users.some((user) => user.id === input.inspector_id && user.role_code === "inspector")) {
    return fail(data, "يجب تعيين مفتش من قائمة المفتشين.");
  }
  const next = draft(data);
  const task = next.inspection_tasks.find((item) => item.id === taskId)!;
  const now = stamp(ctx);
  task.title = title;
  task.facility_id = input.facility_id;
  task.location_id = location.id;
  task.equipment_id = location.equipment_id;
  task.inspector_id = input.inspector_id;
  task.priority = input.priority;
  task.due_date = dueDate;
  task.updated_at = now;
  if (task.status === "new" && input.inspector_id) {
    task.status = "scheduled";
    task.workflow_stage = maxStage(task.workflow_stage, "assigned");
  }
  if (task.status === "scheduled" && !input.inspector_id) {
    task.status = "new";
    task.workflow_stage = "created";
  }
  pushLog(next, "inspection_tasks", task.id, "update", `عُدلت المهمة ${task.code}`, ctx.actor.id, now);
  return ok(next, `تم تحديث المهمة ${task.code}`);
}

export function cancelTask(data: AppData, taskId: string, ctx: ActorContext): MutationResult {
  if (!can(ctx.actor.role_code, "task.cancel")) return fail(data, "إلغاء المهام متاح للمدير.");
  const current = data.inspection_tasks.find((item) => item.id === taskId);
  if (!current) return fail(data, "المهمة غير موجودة.");
  if (current.status === "completed") return fail(data, "لا تُلغى مهمة مكتملة. السجل يبقى محفوظًا.");
  if (current.status === "cancelled") return fail(data, "المهمة ملغاة بالفعل.");
  const next = draft(data);
  const now = stamp(ctx);
  const task = next.inspection_tasks.find((item) => item.id === taskId)!;
  task.status = "cancelled";
  task.updated_at = now;
  const inspection = next.inspections.find((item) => item.task_id === taskId && item.status !== "completed");
  if (inspection && inspection.status !== "cancelled") {
    inspection.status = "cancelled";
    inspection.updated_at = now;
    pushLog(next, "inspections", inspection.id, "cancel", `أُلغي التفتيش ${inspection.code} مع المهمة`, ctx.actor.id, now);
  }
  pushLog(next, "inspection_tasks", task.id, "cancel", `أُلغيت المهمة ${task.code}`, ctx.actor.id, now);
  return ok(next, `تم إلغاء المهمة ${task.code}`);
}

export function startInspection(data: AppData, taskId: string, ctx: ActorContext): MutationResult {
  if (!can(ctx.actor.role_code, "inspection.operate")) return fail(data, "بدء التفتيش متاح للمفتش والمدير.");
  const current = data.inspection_tasks.find((item) => item.id === taskId);
  if (!current) return fail(data, "المهمة غير موجودة.");
  if (current.status === "cancelled" || current.status === "completed") return fail(data, "لا يمكن بدء تفتيش على مهمة مغلقة.");
  if (!current.inspector_id) return fail(data, "عيّن مفتشًا قبل بدء التفتيش.");
  if (ctx.actor.role_code === "inspector" && ctx.actor.id !== current.inspector_id) return fail(data, "هذه المهمة مسندة إلى مفتش آخر.");
  const existing = data.inspections.find((item) => item.task_id === taskId && item.status !== "cancelled");
  if (existing) return ok(data, `التفتيش ${existing.code} قائم بالفعل.`);
  const next = draft(data);
  const now = stamp(ctx);
  const task = next.inspection_tasks.find((item) => item.id === taskId)!;
  const inspectionId = uid();
  const checklistId = uid();
  const code = nextCode(next.inspections.map((item) => item.code), "INS-");
  next.inspections.push({
    id: inspectionId,
    code,
    task_id: task.id,
    facility_id: task.facility_id,
    location_id: task.location_id,
    equipment_id: task.equipment_id,
    inspector_id: task.inspector_id!,
    result: "pending",
    risk_level: task.priority === "critical" ? "critical" : task.priority === "high" ? "high" : task.priority === "medium" ? "medium" : "low",
    status: "in_progress",
    workflow_stage: "started",
    started_at: now,
    completed_at: null,
    summary: "",
    clearance_note: null,
    created_at: now,
    updated_at: now,
  });
  next.inspection_checklists.push({ id: checklistId, inspection_id: inspectionId, completed_at: null, created_at: now, updated_at: now });
  CHECKLIST_TEMPLATE.forEach((template, index) => {
    next.inspection_checklist_items.push({
      id: uid(),
      checklist_id: checklistId,
      item_key: template.key,
      label: template.label,
      response: null,
      numeric_value: null,
      unit: template.unit,
      notes: "",
      sort_order: index + 1,
      updated_at: now,
    });
  });
  task.status = "in_progress";
  task.workflow_stage = maxStage(task.workflow_stage, "started");
  task.updated_at = now;
  const location = next.inspection_locations.find((item) => item.id === task.location_id);
  if (location) {
    location.inspection_status = "قيد التنفيذ";
    location.updated_at = now;
  }
  pushLog(next, "inspections", inspectionId, "start", `بدأ التفتيش ${code}`, ctx.actor.id, now);
  return ok(next, `بدأ التفتيش ${code}`);
}

export function answerChecklistItem(
  data: AppData,
  itemId: string,
  response: CheckResult,
  numeric: number | null,
  notes: string,
  ctx: ActorContext,
): MutationResult {
  const item = data.inspection_checklist_items.find((row) => row.id === itemId);
  if (!item) return fail(data, "بند القائمة غير موجود.");
  const checklist = data.inspection_checklists.find((row) => row.id === item.checklist_id);
  const inspection = checklist ? data.inspections.find((row) => row.id === checklist.inspection_id) : undefined;
  if (!inspection || !checklist) return fail(data, "التفتيش غير موجود.");
  const denied = guardInspection(data, inspection.id, ctx);
  if (denied) return fail(data, denied);
  if (inspection.status === "completed" || inspection.status === "cancelled") return fail(data, "سجل التفتيش المغلق لا يُعدل.");
  if (checklist.completed_at) return fail(data, "القائمة مغلقة. لا تُعاد كتابة البنود.");
  const template = CHECKLIST_TEMPLATE.find((row) => row.key === item.item_key);
  if (template?.numeric && response !== "not_applicable" && (numeric == null || Number.isNaN(numeric))) return fail(data, `أدخل قيمة ${template.label}.`);
  const next = draft(data);
  const now = stamp(ctx);
  const target = next.inspection_checklist_items.find((row) => row.id === itemId)!;
  target.response = response;
  target.numeric_value = response === "not_applicable" ? null : numeric;
  target.notes = notes.trim();
  target.updated_at = now;
  return ok(next, "حُفظ بند قائمة الفحص");
}

export function completeChecklist(data: AppData, inspectionId: string, ctx: ActorContext): MutationResult {
  const denied = guardInspection(data, inspectionId, ctx);
  if (denied) return fail(data, denied);
  const inspection = data.inspections.find((item) => item.id === inspectionId)!;
  if (inspection.status === "completed" || inspection.status === "cancelled") return fail(data, "سجل التفتيش المغلق لا يُعدل.");
  const { checklist, items } = checklistFor(data, inspectionId);
  if (!checklist) return fail(data, "لا توجد قائمة فحص.");
  if (items.some((item) => !item.response)) return fail(data, "أكمل كل بنود القائمة قبل الإغلاق.");
  const missingNumeric = items.find((item) => {
    const template = CHECKLIST_TEMPLATE.find((row) => row.key === item.item_key);
    return template?.numeric && item.response !== "not_applicable" && item.numeric_value == null;
  });
  if (missingNumeric) return fail(data, `القيمة الرقمية ناقصة في ${missingNumeric.label}.`);
  const next = draft(data);
  const now = stamp(ctx);
  const list = next.inspection_checklists.find((item) => item.id === checklist.id)!;
  list.completed_at = now;
  list.updated_at = now;
  advance(next, inspectionId, "checklist", ctx, now);
  pushLog(next, "inspections", inspectionId, "checklist", "أُغلقت قائمة الفحص", ctx.actor.id, now);
  return ok(next, "اكتملت قائمة الفحص");
}

export function confirmMedia(data: AppData, inspectionId: string, ctx: ActorContext): MutationResult {
  const denied = guardInspection(data, inspectionId, ctx);
  if (denied) return fail(data, denied);
  const inspection = data.inspections.find((item) => item.id === inspectionId)!;
  if (stageIndex(inspection.workflow_stage) < stageIndex("checklist")) return fail(data, "أغلق قائمة الفحص قبل تأكيد جمع البيانات.");
  const hasImage = data.inspection_images.some((image) => image.inspection_id === inspectionId);
  const hasNote = data.observations.some((observation) => observation.inspection_id === inspectionId);
  if (!hasImage && !hasNote) return fail(data, "أضف صورة تفتيش أو ملاحظة ميدانية قبل تأكيد الجمع.");
  const next = draft(data);
  const now = stamp(ctx);
  advance(next, inspectionId, "media", ctx, now);
  pushLog(next, "inspections", inspectionId, "media", "تم تأكيد جمع الصور والبيانات", ctx.actor.id, now);
  return ok(next, "تم تأكيد جمع الصور والبيانات");
}

export function addObservation(data: AppData, inspectionId: string, body: string, ctx: ActorContext): MutationResult {
  const denied = guardInspection(data, inspectionId, ctx);
  if (denied) return fail(data, denied);
  const text = body.trim();
  if (text.length < 3) return fail(data, "اكتب الملاحظة.");
  const inspection = data.inspections.find((item) => item.id === inspectionId)!;
  if (inspection.status === "completed" || inspection.status === "cancelled") return fail(data, "لا تُضاف ملاحظات على سجل مغلق.");
  const next = draft(data);
  const now = stamp(ctx);
  next.observations.push({ id: uid(), inspection_id: inspectionId, author_id: ctx.actor.id, body: text, created_at: now });
  pushLog(next, "inspections", inspectionId, "observation", "أُضيفت ملاحظة مفتش", ctx.actor.id, now);
  return ok(next, "حُفظت الملاحظة");
}

export function addImage(
  data: AppData,
  inspectionId: string,
  file: { name: string; mime: string; dataUrl: string },
  caption: string,
  ctx: ActorContext,
): MutationResult {
  const denied = guardInspection(data, inspectionId, ctx);
  if (denied) return fail(data, denied);
  const inspection = data.inspections.find((item) => item.id === inspectionId)!;
  if (inspection.status === "completed" || inspection.status === "cancelled") return fail(data, "لا تُرفق ملفات على سجل مغلق.");
  if (!file.dataUrl.startsWith("data:image/")) return fail(data, "يُقبل ملف صورة فقط في وضع المحاكاة.");
  if (file.dataUrl.length > 1_200_000) return fail(data, "الصورة أكبر من الحد التجريبي.");
  const next = draft(data);
  const now = stamp(ctx);
  const imageId = uid();
  next.inspection_images.push({
    id: imageId,
    inspection_id: inspectionId,
    facility_id: inspection.facility_id,
    equipment_id: inspection.equipment_id,
    file_name: file.name || "upload.svg",
    mime_type: file.mime || "image/png",
    storage_path: inspectionImagePath(inspection.facility_id, inspectionId, `${imageId}.img`),
    data_url: file.dataUrl,
    caption: caption.trim() || "صورة تفتيش مرفوعة",
    captured_at: now,
    media_type: "image",
    source: "IMPORTED",
    comparison_group: null,
    comparison_role: "single",
    playback: "available",
    created_at: now,
  });
  pushLog(next, "inspections", inspectionId, "image", "أُرفقت صورة تفتيش", ctx.actor.id, now);
  return ok(next, "أُرفقت الصورة بالتفتيش");
}

export function applyAnalysis(data: AppData, inspectionId: string, output: AnalysisOutput, ctx: ActorContext): MutationResult {
  const denied = guardInspection(data, inspectionId, ctx);
  if (denied) return fail(data, denied);
  if (!output.isDemo) return fail(data, "مزود التحليل غير معرّف كتحليل تجريبي.");
  const inspection = data.inspections.find((item) => item.id === inspectionId)!;
  if (inspection.status === "completed" || inspection.status === "cancelled") return fail(data, "لا يُعاد تحليل سجل مغلق.");
  if (stageIndex(inspection.workflow_stage) < stageIndex("media")) return fail(data, "أكّد جمع الصور والبيانات قبل التحليل.");
  const { checklist } = checklistFor(data, inspectionId);
  if (!checklist?.completed_at) return fail(data, "قائمة الفحص غير مكتملة.");
  const next = draft(data);
  const now = stamp(ctx);
  const analysisId = uid();
  next.ai_analysis_results.push({
    id: analysisId,
    inspection_id: inspectionId,
    provider: output.provider,
    is_demo: true,
    summary: output.summary,
    created_at: now,
  });
  const equipment = next.equipment.find((item) => item.id === inspection.equipment_id);
  output.findings.forEach((item) => {
    const imageId = uid();
    const findingId = uid();
    const code = nextCode(next.inspection_findings.map((finding) => finding.code), "FND-", 3);
    next.inspection_images.push({
      id: imageId,
      inspection_id: inspectionId,
      facility_id: inspection.facility_id,
      equipment_id: inspection.equipment_id,
      file_name: `${code}.svg`,
      mime_type: "image/svg+xml",
      storage_path: inspectionImagePath(inspection.facility_id, inspectionId, `${code}.svg`),
      data_url: inspectionFrame({
        code: equipment?.code ?? code,
        title: item.summary.slice(0, 48),
        kind: item.frame,
        stamp: now,
        heat: item.heat,
        variant: "single",
      }),
      caption: `إطار داعم تجريبي · ${code}`,
      captured_at: now,
      media_type: "image",
      source: "SIMULATION",
      comparison_group: null,
      comparison_role: "single",
      playback: "available",
      created_at: now,
    });
    next.inspection_findings.push({
      id: findingId,
      code,
      analysis_id: analysisId,
      inspection_id: inspectionId,
      facility_id: inspection.facility_id,
      equipment_id: inspection.equipment_id,
      category: item.category,
      severity: item.severity,
      confidence: item.confidence,
      status: "open",
      summary: item.summary,
      image_id: imageId,
      is_demo: true,
      detected_at: now,
      created_at: now,
      updated_at: now,
    });
  });
  advance(next, inspectionId, "ai", ctx, now);
  const stored = next.inspections.find((item) => item.id === inspectionId)!;
  stored.status = "pending_review";
  const task = next.inspection_tasks.find((item) => item.id === stored.task_id);
  if (task && task.status !== "cancelled" && task.status !== "completed") {
    task.status = "pending_review";
    task.updated_at = now;
  }
  pushLog(next, "inspections", inspectionId, "analyze", output.summary, ctx.actor.id, now);
  return ok(next, output.findings.length ? "أُضيف تحليل تجريبي وبانتظار المراجعة البشرية" : "التحليل التجريبي لم يضف ملاحظات جديدة");
}

export function reviewFinding(data: AppData, findingId: string, decision: ReviewDecision, notes: string, ctx: ActorContext): MutationResult {
  if (!can(ctx.actor.role_code, "finding.review")) return fail(data, "المراجعة البشرية متاحة للمدير والمفتش.");
  const finding = data.inspection_findings.find((item) => item.id === findingId);
  if (!finding) return fail(data, "الملاحظة غير موجودة.");
  const inspection = data.inspections.find((item) => item.id === finding.inspection_id);
  if (!inspection) return fail(data, "التفتيش غير موجود.");
  if (inspection.status === "completed" || inspection.status === "cancelled") return fail(data, "مراجعة السجل المغلق غير متاحة.");
  if (ctx.actor.role_code === "inspector" && ctx.actor.id !== inspection.inspector_id) return fail(data, "المراجعة متاحة لمفتش المهمة أو المدير.");
  const text = notes.trim();
  if (text.length < 3) return fail(data, "أدخل ملاحظة المراجعة.");
  const next = draft(data);
  const now = stamp(ctx);
  const target = next.inspection_findings.find((item) => item.id === findingId)!;
  if (decision !== "note") target.status = DECISION_STATUS[decision];
  target.updated_at = now;
  next.human_reviews.push({
    id: uid(),
    finding_id: findingId,
    inspection_id: inspection.id,
    reviewer_id: ctx.actor.id,
    decision,
    notes: text,
    decided_at: now,
    created_at: now,
  });
  const open = findingsFor(next, inspection.id).some((item) => !terminalDecision(item));
  if (!open) advance(next, inspection.id, "review", ctx, now);
  pushLog(next, "inspection_findings", findingId, "review", `قرار بشري: ${decision}`, ctx.actor.id, now);
  return ok(next, "سُجل القرار البشري");
}

export function clearWithoutFindings(data: AppData, inspectionId: string, notes: string, ctx: ActorContext): MutationResult {
  const denied = guardInspection(data, inspectionId, ctx);
  if (denied) return fail(data, denied);
  if (!can(ctx.actor.role_code, "finding.review")) return fail(data, "المراجعة البشرية متاحة للمدير والمفتش.");
  const inspection = data.inspections.find((item) => item.id === inspectionId)!;
  if (stageIndex(inspection.workflow_stage) < stageIndex("ai")) return fail(data, "شغّل التحليل التجريبي أولًا.");
  if (findingsFor(data, inspectionId).length) return fail(data, "توجد ملاحظات تحتاج قرارًا لكل واحدة.");
  const text = notes.trim();
  if (text.length < 3) return fail(data, "وثّق قرار عدم وجود ملاحظات.");
  const next = draft(data);
  const now = stamp(ctx);
  const stored = next.inspections.find((item) => item.id === inspectionId)!;
  stored.clearance_note = text;
  next.human_reviews.push({
    id: uid(),
    finding_id: null,
    inspection_id: inspectionId,
    reviewer_id: ctx.actor.id,
    decision: "approve",
    notes: text,
    decided_at: now,
    created_at: now,
  });
  advance(next, inspectionId, "review", ctx, now);
  pushLog(next, "inspections", inspectionId, "review", "قرار بشري: لا ملاحظات AI مفتوحة", ctx.actor.id, now);
  return ok(next, "سُجل القرار البشري بعدم وجود ملاحظات مفتوحة");
}

export function submitInspection(data: AppData, inspectionId: string, summary: string, ctx: ActorContext): MutationResult {
  const denied = guardInspection(data, inspectionId, ctx);
  if (denied) return fail(data, denied);
  const inspection = data.inspections.find((item) => item.id === inspectionId)!;
  if (inspection.status === "completed") return fail(data, "التفتيش مكتمل ومحفوظ.");
  if (stageIndex(inspection.workflow_stage) < stageIndex("review")) return fail(data, "أكمل المراجعة البشرية قبل إغلاق التفتيش.");
  const findings = findingsFor(data, inspectionId);
  if (findings.some((finding) => !terminalDecision(finding))) return fail(data, "توجد ملاحظات AI بلا قرار بشري.");
  const text = summary.trim();
  if (text.length < 3) return fail(data, "أدخل خلاصة التفتيش.");
  const previousCodes = new Set(data.inspections.filter((item) => item.id !== inspectionId).map((item) => item.code));
  const next = draft(data);
  const now = stamp(ctx);
  const stored = next.inspections.find((item) => item.id === inspectionId)!;
  stored.result = resultFromChecklist(next, inspectionId);
  stored.risk_level = worstRisk([stored.risk_level, ...findings.map((finding) => finding.severity)]);
  stored.status = "completed";
  stored.completed_at = now;
  stored.summary = text;
  stored.updated_at = now;
  advance(next, inspectionId, "completed", ctx, now);
  const task = next.inspection_tasks.find((item) => item.id === stored.task_id);
  if (task) {
    task.status = "completed";
    task.workflow_stage = maxStage(task.workflow_stage, "completed");
    task.updated_at = now;
  }
  const location = next.inspection_locations.find((item) => item.id === stored.location_id);
  if (location) {
    location.last_inspection_at = now;
    location.next_inspection_at = addDays(now, 30);
    location.last_notes = text;
    location.inspection_status = "تم التفتيش";
    location.marker_state = stored.result === "fail" ? "CRITICAL" : stored.result === "warning" ? "WARNING" : "INSPECTED";
    location.updated_at = now;
  }
  pushLog(next, "inspections", inspectionId, "complete", `اكتمل التفتيش ${stored.code} وحُفظ في السجل`, ctx.actor.id, now);
  const stillThere = next.inspections.filter((item) => previousCodes.has(item.code));
  if (stillThere.length !== previousCodes.size) return fail(data, "رُفض الحفظ لأن سجلًا سابقًا تغيّر.");
  return ok(next, `اكتمل التفتيش ${stored.code} وأُضيف إلى سجل التفتيش`);
}

export function generateReport(data: AppData, inspectionId: string, ctx: ActorContext): MutationResult {
  if (!can(ctx.actor.role_code, "report.generate")) return fail(data, "إصدار التقرير متاح للمدير وجامع التقارير.");
  const inspection = data.inspections.find((item) => item.id === inspectionId);
  if (!inspection) return fail(data, "التفتيش غير موجود.");
  if (inspection.status !== "completed") return fail(data, "يصدر التقرير بعد اكتمال التفتيش.");
  const next = draft(data);
  const now = stamp(ctx);
  const siblings = next.reports.filter((report) => report.inspection_id === inspectionId);
  const revision = Math.max(0, ...siblings.map((report) => report.revision)) + 1;
  const reportId = uid();
  const code = nextCode(next.reports.map((report) => report.code), "VG-RPT-");
  const partial = {
    id: reportId,
    code,
    title: `تقرير ${inspection.code}`,
    inspection_id: inspectionId,
    facility_id: inspection.facility_id,
    location_id: inspection.location_id,
    inspector_id: inspection.inspector_id,
    revision,
    risk_level: inspection.risk_level,
    status: "new" as const,
    completion_note: null,
    archived_at: null,
    created_at: now,
    updated_at: now,
  };
  const snapshot = buildReportSnapshot(next, partial);
  next.reports.push({ ...partial, snapshot });
  advance(next, inspectionId, "recorded", ctx, now);
  pushLog(next, "reports", reportId, "generate", `صدر التقرير ${code} مراجعة ${revision}`, ctx.actor.id, now);
  return ok(next, revision > 1 ? `صدرت مراجعة جديدة ${code}` : `صدر التقرير ${code}`);
}

export function updateReport(data: AppData, reportId: string, status: ReportStatus, note: string, ctx: ActorContext): MutationResult {
  if (!can(ctx.actor.role_code, "report.manage")) return fail(data, "إدارة حالة التقرير متاحة للمدير وجامع التقارير.");
  const current = data.reports.find((item) => item.id === reportId);
  if (!current) return fail(data, "التقرير غير موجود.");
  if (current.status === "archived") return fail(data, "التقرير المؤرشف لا يُعدل.");
  if (status === "needs_completion" && note.trim().length < 3) return fail(data, "اكتب ما ينقص التقرير.");
  if (status === "archived") return archiveReport(data, reportId, ctx);
  const allowed: Record<ReportStatus, ReportStatus[]> = {
    new: ["in_review", "needs_completion", "completed"],
    in_review: ["completed", "needs_completion"],
    needs_completion: ["in_review", "completed"],
    completed: [],
    archived: [],
  };
  if (status !== current.status && !allowed[current.status].includes(status)) return fail(data, "انتقال حالة التقرير غير متاح.");
  const next = draft(data);
  const now = stamp(ctx);
  const report = next.reports.find((item) => item.id === reportId)!;
  const previousSnapshot = JSON.stringify(report.snapshot);
  report.status = status;
  report.completion_note = note.trim() || report.completion_note;
  report.updated_at = now;
  if (JSON.stringify(report.snapshot) !== previousSnapshot) return fail(data, "لقطة التقرير ثابتة ولا تُعاد كتابتها.");
  pushLog(next, "reports", reportId, "status", `أصبحت حالة ${report.code}: ${status}`, ctx.actor.id, now);
  return ok(next, `حُدثت حالة التقرير ${report.code}`);
}

export function archiveReport(data: AppData, reportId: string, ctx: ActorContext): MutationResult {
  if (!can(ctx.actor.role_code, "report.manage")) return fail(data, "الأرشفة متاحة للمدير وجامع التقارير.");
  const current = data.reports.find((item) => item.id === reportId);
  if (!current) return fail(data, "التقرير غير موجود.");
  if (current.status === "archived") return fail(data, "التقرير مؤرشف بالفعل.");
  const next = draft(data);
  const now = stamp(ctx);
  const report = next.reports.find((item) => item.id === reportId)!;
  report.status = "archived";
  report.archived_at = now;
  report.updated_at = now;
  pushLog(next, "reports", reportId, "archive", `أُرشف التقرير ${report.code}`, ctx.actor.id, now);
  return ok(next, `أُرشف التقرير ${report.code}`);
}

export function addCorrectiveAction(data: AppData, reportId: string, description: string, ctx: ActorContext): MutationResult {
  if (!can(ctx.actor.role_code, "report.manage")) return fail(data, "إضافة الإجراء متاحة للمدير وجامع التقارير.");
  const report = data.reports.find((item) => item.id === reportId);
  if (!report) return fail(data, "التقرير غير موجود.");
  if (report.status === "archived") return fail(data, "لا يُضاف إجراء إلى تقرير مؤرشف.");
  const text = description.trim();
  if (text.length < 4) return fail(data, "صف الإجراء التصحيحي.");
  const next = draft(data);
  const now = stamp(ctx);
  next.corrective_actions.push({
    id: uid(),
    report_id: reportId,
    inspection_id: report.inspection_id,
    description: text,
    status: "open",
    created_at: now,
    updated_at: now,
  });
  pushLog(next, "reports", reportId, "action", `أُضيف إجراء معالجة للتقرير ${report.code}`, ctx.actor.id, now);
  return ok(next, "أُضيف الإجراء التصحيحي");
}

export function setActionStatus(data: AppData, actionId: string, status: "open" | "in_progress" | "done", ctx: ActorContext): MutationResult {
  if (!can(ctx.actor.role_code, "report.manage")) return fail(data, "تحديث الإجراء متاح للمدير وجامع التقارير.");
  const current = data.corrective_actions.find((item) => item.id === actionId);
  if (!current) return fail(data, "الإجراء غير موجود.");
  const next = draft(data);
  const now = stamp(ctx);
  const action = next.corrective_actions.find((item) => item.id === actionId)!;
  action.status = status;
  action.updated_at = now;
  return ok(next, "حُدثت حالة المعالجة");
}

function guardInspection(data: AppData, inspectionId: string, ctx: ActorContext): string | null {
  if (!can(ctx.actor.role_code, "inspection.operate") && !can(ctx.actor.role_code, "finding.review")) {
    return "هذا الإجراء غير متاح لدورك.";
  }
  const inspection = data.inspections.find((item) => item.id === inspectionId);
  if (!inspection) return "التفتيش غير موجود.";
  if (ctx.actor.role_code === "inspector" && inspection.inspector_id !== ctx.actor.id) return "هذا التفتيش مسند إلى مفتش آخر.";
  return null;
}

function advance(data: AppData, inspectionId: string, stage: WorkflowStage, ctx: ActorContext, now: string) {
  const inspection = data.inspections.find((item) => item.id === inspectionId);
  if (!inspection) return;
  inspection.workflow_stage = maxStage(inspection.workflow_stage, stage);
  inspection.updated_at = now;
  const task = data.inspection_tasks.find((item) => item.id === inspection.task_id);
  if (task) {
    task.workflow_stage = maxStage(task.workflow_stage, stage);
    task.updated_at = now;
  }
  void ctx;
}

function maxStage(current: WorkflowStage, nextStage: WorkflowStage): WorkflowStage {
  return stageIndex(nextStage) > stageIndex(current) ? nextStage : current;
}

function stageIndex(stage: WorkflowStage): number {
  return STAGE_ORDER.indexOf(stage);
}

function pushLog(data: AppData, entityType: string, entityId: string, action: string, message: string, actorId: string, createdAt: string) {
  data.activity_logs.push({ id: uid(), entity_type: entityType, entity_id: entityId, action, message, actor_id: actorId, created_at: createdAt });
}

function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function normalizeDueDate(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return validIso(trimmed);
  const match = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!match) return null;
  const iso = `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  return validIso(iso);
}

function validIso(iso: string): string | null {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return iso;
}

function stamp(ctx: ActorContext): string {
  return ctx.at ?? new Date().toISOString();
}

function draft(data: AppData): AppData {
  return structuredClone(data);
}

function ok(data: AppData, message: string): MutationResult {
  return { ok: true, data, message };
}

function fail(data: AppData, message: string): MutationResult {
  return { ok: false, data, message };
}
