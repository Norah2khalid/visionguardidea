import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, Button, ConfirmDialog, Empty, Field, Modal, Panel, controlClass } from "@/components/ui";
import { ChecklistEditor } from "@/features/inspection/ChecklistEditor";
import { ImageGallery } from "@/features/inspection/ImageGallery";
import { ReviewPanel } from "@/features/inspection/ReviewPanel";
import { WorkflowTrack } from "@/features/inspection/WorkflowTrack";
import { TaskForm } from "@/features/tasks/TaskForm";
import { usePlatform } from "@/hooks/usePlatform";
import { activityFor, equipmentLabel, facilityName, findingsFor, imagesFor, isTaskOverdue, observationsFor, reportsForInspection, userName, zoneName } from "@/lib/derive";
import { priorityLabel, taskStatusLabel } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { buildAnalysisInput } from "@/services/ai/mapInput";
import { getAiService } from "@/services/ai/aiService";
import { addImage, addObservation, applyAnalysis, cancelTask, confirmMedia, generateReport, startInspection, submitInspection } from "@/services/platform/mutations";
import { readImageFile } from "@/utils/files";
import { formatDate, formatDateTime } from "@/utils/format";

export function TaskDetailPage() {
  const { taskId } = useParams();
  const { data, role, run, notify } = usePlatform();
  const task = data.inspection_tasks.find((item) => item.id === taskId);
  const [editing, setEditing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [note, setNote] = useState("");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  if (!task) return <Empty title="المهمة غير موجودة" />;
  const location = data.inspection_locations.find((item) => item.id === task.location_id);
  const inspection = data.inspections.find((item) => item.task_id === task.id && item.status !== "cancelled");
  const images = inspection ? imagesFor(data, inspection.id) : [];
  const findings = inspection ? findingsFor(data, inspection.id) : [];
  const reports = inspection ? reportsForInspection(data, inspection.id) : [];
  const logs = [...activityFor(data, task.id), ...(inspection ? activityFor(data, inspection.id) : [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const overdue = isTaskOverdue(task);

  async function analyze() {
    if (!inspection) return;
    const input = buildAnalysisInput(data, inspection.id);
    if (!input) return;
    setBusy(true);
    try {
      const output = await getAiService().analyze(input);
      run((current, ctx) => applyAnalysis(current, inspection.id, output, ctx));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="mono text-cyan">{task.code}</p>
          <p className="text-lg font-semibold">{task.title}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge tone={overdue ? "crit" : "info"}>{overdue ? "متأخرة" : taskStatusLabel[task.status]}</Badge>
            <Badge tone={task.priority === "critical" ? "crit" : task.priority === "high" ? "warn" : "neutral"}>{priorityLabel[task.priority]}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can(role, "task.edit") && task.status !== "completed" && task.status !== "cancelled" ? <Button onClick={() => setEditing(true)}>تعديل المهمة</Button> : null}
          {can(role, "inspection.operate") && !inspection && task.status !== "cancelled" && task.status !== "completed" ? <Button variant="primary" onClick={() => run((current, ctx) => startInspection(current, task.id, ctx))}>بدء التفتيش</Button> : null}
          {can(role, "task.cancel") && task.status !== "completed" && task.status !== "cancelled" ? <Button variant="danger" onClick={() => setCancelOpen(true)}>إلغاء المهمة</Button> : null}
          <Link to="/tasks"><Button variant="ghost">العودة للمهام</Button></Link>
        </div>
      </div>
      <WorkflowTrack stage={inspection?.workflow_stage ?? task.workflow_stage} />
      <Panel title="بيانات المهمة">
        <dl className="grid gap-3 text-sm md:grid-cols-3">
          <div><dt className="text-muted">المنشأة</dt><dd>{facilityName(data, task.facility_id)}</dd></div>
          <div><dt className="text-muted">المنطقة</dt><dd>{location ? zoneName(data, location.zone_id) : "—"}</dd></div>
          <div><dt className="text-muted">الموقع</dt><dd className="mono">{location?.code}</dd></div>
          <div><dt className="text-muted">المعدة</dt><dd>{equipmentLabel(data, task.equipment_id)}</dd></div>
          <div><dt className="text-muted">المفتش</dt><dd>{userName(data, task.inspector_id)}</dd></div>
          <div><dt className="text-muted">الاستحقاق</dt><dd>{formatDate(task.due_date)}</dd></div>
          <div><dt className="text-muted">التفتيش</dt><dd className="mono">{inspection?.code ?? "لم يبدأ"}</dd></div>
        </dl>
      </Panel>
      {inspection ? (
        <>
          <Panel title="قائمة الفحص"><ChecklistEditor inspectionId={inspection.id} /></Panel>
          <Panel title="الصور والملفات">
            <ImageGallery
              images={images}
              allowUpload={can(role, "inspection.operate") && inspection.status !== "completed"}
              onUpload={(file, caption) => {
                void readImageFile(file).then(
                  (payload) => run((current, ctx) => addImage(current, inspection.id, payload, caption, ctx)),
                  (error: Error) => notify(error.message, true),
                );
              }}
            />
            {can(role, "inspection.operate") && inspection.workflow_stage !== "completed" && inspection.status !== "completed" ? (
              <Button className="mt-2" onClick={() => run((current, ctx) => confirmMedia(current, inspection.id, ctx))}>تأكيد جمع الصور والبيانات</Button>
            ) : null}
          </Panel>
          <Panel title="ملاحظات المفتش">
            <ul className="mb-3 grid gap-2">
              {observationsFor(data, inspection.id).map((item) => (
                <li key={item.id} className="border border-line p-2 text-sm">
                  <div className="text-xs text-muted">{userName(data, item.author_id)} · {formatDateTime(item.created_at)}</div>
                  {item.body}
                </li>
              ))}
            </ul>
            {can(role, "inspection.operate") && inspection.status !== "completed" ? (
              <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); if (run((current, ctx) => addObservation(current, inspection.id, note, ctx))) setNote(""); }}>
                <Field label="ملاحظة جديدة"><textarea className={controlClass + " min-h-20"} value={note} onChange={(event) => setNote(event.target.value)} /></Field>
                <Button type="submit">إضافة ملاحظة</Button>
              </form>
            ) : null}
          </Panel>
          <Panel title="نتائج الذكاء الاصطناعي والمراجعة" action={<Badge tone="sim">تحليل تجريبي</Badge>}>
            {can(role, "inspection.operate") && inspection.status !== "completed" ? (
              <Button className="mb-3" variant="primary" disabled={busy} onClick={() => void analyze()}>{busy ? "جارٍ تجهيز التحليل التجريبي" : "تشغيل التحليل التجريبي"}</Button>
            ) : null}
            {findings.length === 0 ? <ReviewPanel inspectionId={inspection.id} /> : findings.map((finding) => <div key={finding.id} className="mb-3"><ReviewPanel findingId={finding.id} /></div>)}
          </Panel>
          {inspection.status !== "completed" && can(role, "inspection.operate") ? (
            <Panel title="إغلاق التفتيش">
              <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); run((current, ctx) => submitInspection(current, inspection.id, summary, ctx)); }}>
                <Field label="خلاصة التفتيش"><textarea className={controlClass + " min-h-20"} value={summary} onChange={(event) => setSummary(event.target.value)} /></Field>
                <Button type="submit" variant="primary">تسليم التفتيش</Button>
              </form>
            </Panel>
          ) : null}
          <Panel title="التقرير المرتبط">
            {reports.length === 0 ? <p className="text-sm text-muted">لم يصدر تقرير بعد. الإصدار متاح للمدير وجامع التقارير بعد اكتمال التفتيش.</p> : reports.map((report) => <Link key={report.id} className="mono text-cyan" to={`/reports/${report.id}`}>{report.code}</Link>)}
            {inspection.status === "completed" && can(role, "report.generate") ? <Button className="mt-2" onClick={() => run((current, ctx) => generateReport(current, inspection.id, ctx))}>إصدار التقرير</Button> : null}
            {inspection.status === "completed" ? <div className="mt-2"><Link className="text-cyan" to={`/history/${inspection.id}`}>فتح السجل التاريخي</Link></div> : null}
          </Panel>
        </>
      ) : <Empty title="لم يبدأ التفتيش" body="عند البدء تُنشأ قائمة الفحص ويُحفظ السجل دون المساس بالتفتيشات السابقة." />}
      <Panel title="سجل النشاط">
        <ul className="grid gap-2 text-sm">
          {logs.map((log) => <li key={log.id} className="border-b border-line pb-2"><span className="text-muted">{formatDateTime(log.created_at)} · {userName(data, log.actor_id)}</span><div>{log.message}</div></li>)}
        </ul>
      </Panel>
      <Modal open={editing} title="تعديل المهمة" onClose={() => setEditing(false)}>
        <TaskForm task={task} onClose={() => setEditing(false)} />
      </Modal>
      <ConfirmDialog open={cancelOpen} title="إلغاء المهمة" body="سيُحفظ أثر الإلغاء في السجل ولن تُحذف التفتيشات المكتملة." confirmLabel="تأكيد الإلغاء" onClose={() => setCancelOpen(false)} onConfirm={() => { run((current, ctx) => cancelTask(current, task.id, ctx)); setCancelOpen(false); }} />
    </div>
  );
}
