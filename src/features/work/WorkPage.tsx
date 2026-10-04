import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/app/session";
import { MediaPreview } from "@/components/MediaPreview";
import { Button, EmptyState, ErrorState, Field, Loading, PageHeader, Panel, RiskBadge, SeverityBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { decisionLabel, equipmentTypeLabel, methodLabel, pointCategoryLabel, responseLabel, riskLabel } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { isActiveTask, taskViewLabel, taskViewStatus, type TaskViewStatus } from "@/lib/taskStatus";
import { loadCatalog, loadInspectionBundle } from "@/services/platform/queries";
import type { AppState, PointCategory, Severity } from "@/types/domain";

export function WorkPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "locations" ? "locations" : "tasks";
  const setTab = (next: "tasks" | "locations") => {
    const copy = new URLSearchParams(params);
    copy.set("tab", next);
    setParams(copy);
  };
  return (
    <>
      <PageHeader title="المهام ومواقع التفتيش" subtitle="المهام والسجلات والمواقع تُقرأ من نفس قاعدة البيانات." />
      <div className="tabs">
        <button className={`tab ${tab === "tasks" ? "on" : ""}`} type="button" onClick={() => setTab("tasks")}>المهام</button>
        <button className={`tab ${tab === "locations" ? "on" : ""}`} type="button" onClick={() => setTab("locations")}>مواقع التفتيش</button>
      </div>
      {tab === "locations" ? <Locations /> : <Tasks />}
    </>
  );
}

function Tasks() {
  const { backend, profile } = useSession();
  const [params, setParams] = useSearchParams();
  const query = useQuery({ queryKey: ["catalog"], enabled: Boolean(backend), queryFn: () => loadCatalog(backend!.db) });
  const [search, setSearch] = useState("");
  if (!query.data) return <Loading />;
  const status = params.get("status") ?? "";
  const equipment = params.get("equipment") ?? "";
  const taskId = params.get("task") ?? "";
  const rows = query.data.inspections.filter((item) => {
    const view = taskViewStatus(item);
    if (status === "active" && !isActiveTask(item)) return false;
    if (status && status !== "active" && view !== status) return false;
    if (equipment && item.equipment_id !== equipment) return false;
    const facility = query.data.facilities.find((row) => row.id === item.facility_id);
    const asset = query.data.equipment.find((row) => row.id === item.equipment_id);
    const haystack = `${item.code} ${item.inspection_type} ${facility?.name ?? ""} ${asset?.name ?? ""}`.toLowerCase();
    return !search || haystack.includes(search.trim().toLowerCase());
  }).sort((a, b) => (b.planned_at ?? b.created_at).localeCompare(a.planned_at ?? a.created_at));
  return (
    <>
      <div className="filters">
        <input className="input" placeholder="بحث" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="select" value={status} onChange={(event) => setParam(params, setParams, "status", event.target.value)}>
          <option value="">كل الحالات</option>
          <option value="active">النشطة</option>
          {(Object.keys(taskViewLabel) as TaskViewStatus[]).map((item) => <option key={item} value={item}>{taskViewLabel[item]}</option>)}
        </select>
        {can(profile?.role_code, "inspections.create") ? <Link className="btn-primary" to="/inspections/new">إنشاء مهمة</Link> : <span className="muted">إنشاء المهام متاح للمدير والمفتش.</span>}
      </div>
      {rows.length === 0 ? <EmptyState title="لا توجد مهام مطابقة" /> : (
        <Panel>
          <div className="table-wrap"><table>
            <thead><tr><th>المهمة</th><th>الموقع</th><th>الموعد</th><th>الأولوية</th><th>الحالة</th></tr></thead>
            <tbody>
              {rows.map((item) => {
                const asset = query.data.equipment.find((row) => row.id === item.equipment_id);
                return (
                  <tr key={item.id} className="clickable" onClick={() => setParam(params, setParams, "task", item.id)}>
                    <td><span className="mono">{item.code}</span><div>{item.inspection_type}</div></td>
                    <td>{asset?.name ?? "—"}</td>
                    <td>{formatDateTime(item.planned_at)}</td>
                    <td><RiskBadge risk={item.risk_level} /></td>
                    <td>{taskViewLabel[taskViewStatus(item)]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </Panel>
      )}
      {taskId ? <TaskDetail id={taskId} state={query.data} /> : null}
    </>
  );
}

function TaskDetail({ id, state }: { id: string; state: AppState }) {
  const { backend, actor, profile } = useSession();
  const bundle = useQuery({ queryKey: ["inspection", id], enabled: Boolean(backend), queryFn: () => loadInspectionBundle(backend!.db, id) });
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [planned, setPlanned] = useState("");
  const [inspector, setInspector] = useState("");
  const [title, setTitle] = useState("");
  const [observation, setObservation] = useState("");
  const inspection = bundle.data?.inspection;
  useEffect(() => {
    if (!inspection) return;
    setNotes(inspection.notes ?? "");
    setPlanned(inspection.planned_at ? inspection.planned_at.slice(0, 16) : "");
    setInspector(inspection.assigned_inspector_id ?? "");
    setTitle(inspection.inspection_type);
  }, [inspection]);
  if (!bundle.data || !inspection) return <Loading />;
  const run = async (work: () => Promise<unknown>, success: string) => {
    setError(null);
    try {
      await work();
      setNotice(success);
      await queryClient.invalidateQueries();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تنفيذ الإجراء");
    }
  };
  const editable = !["COMPLETED", "CLOSED", "CANCELLED"].includes(inspection.status);
  return (
    <Panel title={inspection.code} action={<span>{taskViewLabel[taskViewStatus(inspection)]}</span>}>
      {notice ? <p className="banner">{notice}</p> : null}
      {error ? <ErrorState message={error} /> : null}
      <div className="grid cols-2">
        <div>
          <p>المفتش: {bundle.data.inspector?.full_name ?? "غير معيّن"}</p>
          <p>المنشأة: {bundle.data.facility?.name} / {bundle.data.zone?.name}</p>
          <p>المعدة: {bundle.data.equipment ? `${bundle.data.equipment.name} — ${equipmentTypeLabel[bundle.data.equipment.equipment_type]}` : "—"}</p>
          <p>الأسلوب: {methodLabel[inspection.method]} — الأولوية: {riskLabel[inspection.risk_level]}</p>
          <p>التقدم: {inspection.status === "COMPLETED" || inspection.status === "CLOSED" ? "مكتمل" : inspection.started_at ? "بدأ التنفيذ" : "لم يبدأ"}</p>
        </div>
        <div>
          <p>التقرير: {bundle.data.reports.map((item) => item.code).join("، ") || "لم يُصدر بعد"}</p>
          {bundle.data.reports[0] ? <Link to={`/reports/${bundle.data.reports[0].id}`}>فتح التقرير</Link> : null}
          <p><Link to={`/inspections/${inspection.id}`}>سير العمل الكامل</Link> — <Link to={`/inspections/${inspection.id}/checklist`}>قائمة الفحص</Link></p>
        </div>
      </div>
      {editable && can(profile?.role_code, "inspections.update") && actor ? (
        <form className="grid cols-2" onSubmit={(event) => {
          event.preventDefault();
          void run(() => backend!.platform.updateInspectionDetails(actor, inspection.id, {
            notes,
            inspection_type: title,
            planned_at: planned ? new Date(planned).toISOString() : null,
            assigned_inspector_id: inspector || null,
          }), "حُفظت تفاصيل المهمة دون المساس بالسجلات المنتهية.");
        }}>
          <Field label="العنوان"><input className="input" value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
          <Field label="الموعد"><input className="input" type="datetime-local" value={planned} onChange={(event) => setPlanned(event.target.value)} /></Field>
          <Field label="المفتش">
            <select className="select" value={inspector} onChange={(event) => setInspector(event.target.value)}>
              <option value="">غير معيّن</option>
              {state.profiles.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
            </select>
          </Field>
          <Field label="ملاحظات"><textarea className="textarea" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
          <Button variant="primary" type="submit">حفظ التعديل</Button>
        </form>
      ) : <p className="muted">{inspection.notes || "لا توجد ملاحظات."}</p>}
      <h3>قائمة الفحص</h3>
      {bundle.data.items.length === 0 ? <p className="muted">لا توجد بنود.</p> : bundle.data.items.map((item) => <p key={item.id}>{item.label} — {item.response ? responseLabel[item.response] : "بانتظار التعبئة"}</p>)}
      <h3>المرفقات</h3>
      {bundle.data.media.length === 0 ? <p className="muted">لا توجد مرفقات.</p> : (
        <div className="gallery">
          {bundle.data.media.map((media) => <article key={media.id} className="shot"><MediaPreview path={media.storage_path} mime={media.mime_type} alt={media.file_name} /><p>{media.file_name}</p></article>)}
        </div>
      )}
      {can(profile?.role_code, "checklists.fill") && actor ? (
        <form onSubmit={(event) => {
          event.preventDefault();
          const file = (event.currentTarget.elements.namedItem("file") as HTMLInputElement).files?.[0];
          if (!file) return;
          void run(() => backend!.platform.uploadEvidence(actor, { inspectionId: inspection.id, file, fileName: file.name }), "أُرفق الملف بالمهمة.");
        }}>
          <input className="input" name="file" type="file" accept="image/*,video/mp4,video/webm,application/pdf" />
          <Button type="submit">إرفاق</Button>
        </form>
      ) : null}
      <h3>ملاحظات المفتش</h3>
      {bundle.data.observations.length === 0 ? <p className="muted">لا توجد ملاحظات بشرية.</p> : bundle.data.observations.map((item) => <p key={item.id}>{item.description}</p>)}
      {can(profile?.role_code, "inspections.update") && actor ? (
        <form className="grid cols-2" onSubmit={(event) => {
          event.preventDefault();
          if (!observation.trim()) return;
          void run(() => backend!.platform.addObservation(actor, { inspection_id: inspection.id, category: "manual_observation" satisfies PointCategory, description: observation, severity: "medium" satisfies Severity }), "أُضيفت الملاحظة البشرية.");
          setObservation("");
        }}>
          <textarea className="textarea" value={observation} onChange={(event) => setObservation(event.target.value)} placeholder="ملاحظة ميدانية" />
          <Button type="submit">إضافة ملاحظة</Button>
        </form>
      ) : null}
      <h3>مؤشرات مرتبطة</h3>
      {bundle.data.points.length === 0 ? <p className="muted">لا توجد مؤشرات.</p> : bundle.data.points.map((point) => <p key={point.id}><SeverityBadge severity={point.severity} /> {pointCategoryLabel[point.category]} — {point.description} — {point.source === "inspector" ? "بشري" : "ليس قرارًا آليًا نهائيًا"}</p>)}
      <h3>النشاط</h3>
      {bundle.data.events.length === 0 && bundle.data.audits.length === 0 ? <p className="muted">لا يوجد نشاط.</p> : (
        <>
          {bundle.data.events.map((event) => <p key={event.id}>{formatDateTime(event.created_at)} — {event.message}</p>)}
          {bundle.data.audits.map((event) => <p key={event.id}>{formatDateTime(event.created_at)} — {event.action}</p>)}
        </>
      )}
      <div className="actions">
        {editable && can(profile?.role_code, "inspections.update") && actor ? <Button variant="primary" onClick={() => void run(() => backend!.platform.startInspection(actor, inspection.id), "بدأت المهمة وانتقلت إلى قيد التنفيذ.")}>بدء التفتيش</Button> : null}
        {can(profile?.role_code, "inspections.complete") && actor ? <Button onClick={() => void run(() => backend!.platform.finalizeInspection(actor, inspection.id), "أُغلق التفتيش وفق شروط الإنهاء.")}>إنهاء التفتيش</Button> : null}
        {editable && can(profile?.role_code, "inspections.cancel") && actor ? <Button variant="danger" onClick={() => void run(() => backend!.platform.cancelInspection(actor, inspection.id), "أُلغيت المهمة. السجلات السابقة بقيت.")}>إلغاء</Button> : null}
        {bundle.data.missions[0] ? <Link className="btn" to={`/missions/${bundle.data.missions[0].id}/control`}>مركز المهمة</Link> : null}
      </div>
      <h3>القرارات</h3>
      {bundle.data.decisions.length === 0 ? <p className="muted">لا توجد قرارات مراجعة.</p> : bundle.data.decisions.map((item) => <p key={item.id}>{decisionLabel[item.action]} — {item.notes} — {formatDateTime(item.decided_at)}</p>)}
    </Panel>
  );
}

function Locations() {
  const { backend } = useSession();
  const [params] = useSearchParams();
  const query = useQuery({ queryKey: ["catalog"], enabled: Boolean(backend), queryFn: () => loadCatalog(backend!.db) });
  const [search, setSearch] = useState("");
  const [facility, setFacility] = useState(params.get("facility") ?? "");
  const [risk, setRisk] = useState("");
  const [open, setOpen] = useState<string | null>(params.get("equipment"));
  if (!query.data) return <Loading />;
  const rows = query.data.equipment.filter((item) => {
    if (facility && item.facility_id !== facility) return false;
    if (risk && item.risk_level !== risk) return false;
    const zone = query.data.inspection_zones.find((row) => row.id === item.zone_id);
    const haystack = `${item.name} ${item.code} ${zone?.name ?? ""}`.toLowerCase();
    return !search || haystack.includes(search.trim().toLowerCase());
  });
  return (
    <>
      <div className="filters">
        <input className="input" placeholder="بحث بالاسم أو الرمز" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="select" value={facility} onChange={(event) => setFacility(event.target.value)}>
          <option value="">كل المنشآت</option>
          {query.data.facilities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select className="select" value={risk} onChange={(event) => setRisk(event.target.value)}>
          <option value="">كل الخطورة</option>
          <option value="normal">عادي</option>
          <option value="medium">متوسط</option>
          <option value="high">عالٍ</option>
        </select>
      </div>
      {rows.length === 0 ? <EmptyState title="لا توجد مواقع" /> : rows.map((item) => {
        const zone = query.data.inspection_zones.find((row) => row.id === item.zone_id);
        const facilityRow = query.data.facilities.find((row) => row.id === item.facility_id);
        const inspections = query.data.inspections.filter((row) => row.equipment_id === item.id);
        const latest = inspections.slice().sort((a, b) => (b.completed_at ?? b.created_at).localeCompare(a.completed_at ?? a.created_at))[0];
        const reports = query.data.inspection_reports.filter((report) => inspections.some((row) => row.id === report.inspection_id));
        return (
          <Panel key={item.id} title={`${item.name}`} action={<RiskBadge risk={item.risk_level} />}>
            <p className="mono">{item.code} — {equipmentTypeLabel[item.equipment_type]}</p>
            <p>{facilityRow?.name} / {zone?.name ?? "بدون منطقة"}</p>
            <Button variant="ghost" onClick={() => setOpen(open === item.id ? null : item.id)}>{open === item.id ? "إخفاء" : "التفاصيل"}</Button>
            {open === item.id ? (
              <div>
                <p>الإحداثيات الجغرافية: {facilityRow?.latitude == null ? "غير متوفرة" : `${facilityRow.latitude}, ${facilityRow.longitude}`}</p>
                <p>موضع المخطط: {item.position_x ?? "—"} , {item.position_y ?? "—"}</p>
                <p>آخر تفتيش: {formatDateTime(item.last_inspection_at)} {latest ? `— ${taskViewLabel[taskViewStatus(latest)]}` : ""}</p>
                <p>المهام: {inspections.map((row) => row.code).join("، ") || "لا توجد"}</p>
                <p>التقارير: {reports.map((row) => row.code).join("، ") || "لا توجد"}</p>
                <div className="actions">
                  <Link to={`/work?tab=tasks&equipment=${item.id}`}>مهام هذا الموقع</Link>
                  <Link to={`/history?equipment=${item.id}`}>السجل</Link>
                  {reports[0] ? <Link to={`/reports/${reports[0].id}`}>التقرير</Link> : null}
                </div>
              </div>
            ) : null}
          </Panel>
        );
      })}
    </>
  );
}

function setParam(params: URLSearchParams, setParams: (next: URLSearchParams) => void, key: string, value: string) {
  const copy = new URLSearchParams(params);
  if (value) copy.set(key, value);
  else copy.delete(key);
  setParams(copy);
}
