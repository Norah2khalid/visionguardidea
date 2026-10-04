import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSession } from "@/app/session";
import { Button, EmptyState, ErrorState, Field, InspectionBadge, Loading, Modal, PageHeader, Panel, SeverityBadge } from "@/components/ui";
import { formatDateTime, formatPercent } from "@/lib/format";
import { alertCategoryLabel, decisionLabel, equipmentTypeLabel, methodLabel, pointCategoryLabel, responseLabel, riskLabel, roleLabel, severityLabel } from "@/lib/labels";
import { reportQueueLabel, reportQueueStatus, taskViewLabel, taskViewStatus, type ReportQueueStatus } from "@/lib/taskStatus";
import { can } from "@/lib/permissions";
import { integrationCatalog, probeDeviceGateway } from "@/services/integrations/providers";
import { getAnalysisProvider } from "@/services/analysis/analysisService";
import { loadCatalog } from "@/services/platform/queries";
import type { Alert, RoleCode } from "@/types/domain";

export function DroneListPage() { return <DeviceList kind="drone" title="الدرون" />; }
export function RobotListPage() { return <DeviceList kind="robot" title="الروبوتات" />; }
export function DroneDetailPage() { return <DeviceDetail kind="drone" />; }
export function RobotDetailPage() { return <DeviceDetail kind="robot" />; }

function DeviceList({ kind, title }: { kind: "drone" | "robot"; title: string }) {
  const { backend, actor, profile } = useSession();
  const query = useQuery({ queryKey: ["catalog"], enabled: Boolean(backend), queryFn: () => loadCatalog(backend!.db) });
  const [open, setOpen] = useState(false);
  if (!query.data || !actor) return <Loading />;
  const rows = kind === "drone" ? query.data.drones : query.data.robots;
  return (
    <>
      <PageHeader title={title} subtitle="سجل أجهزة. لا يوجد اتصال فعلي." actions={can(profile?.role_code, "devices.manage") ? <Button variant="primary" onClick={() => setOpen(true)}>إضافة</Button> : null} />
      <div className="banner">غير متصل — وضع المحاكاة متاح</div>
      <Panel>
        {rows.length === 0 ? <EmptyState title="لا توجد أجهزة" /> : rows.map((item) => (
          <Link key={item.id} to={`/${kind === "drone" ? "drones" : "robots"}/${item.id}`} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
            <span className="mono">{item.code}</span>
            <span>{item.operational_status} — {item.current_battery}%</span>
          </Link>
        ))}
      </Panel>
      {open ? <DeviceForm kind={kind} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function DeviceForm({ kind, onClose }: { kind: "drone" | "robot"; onClose: () => void }) {
  const { backend, actor } = useSession();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState(kind === "drone" ? "VG-DRONE-" : "VG-ROBOT-");
  const [name, setName] = useState("");
  if (!actor) return null;
  return (
    <Modal title="جهاز" onClose={onClose}>
      <form className="grid" onSubmit={(event) => {
        event.preventDefault();
        const common = { code, name, model: "غير محدد", manufacturer: "غير متصل", battery_capacity_mah: 5000, current_battery: 100 };
        const work = kind === "drone"
          ? backend!.platform.saveDrone(actor, common)
          : backend!.platform.saveRobot(actor, { ...common, robot_type: "أرضي", sensors: ["كاميرا"] });
        void work.then(() => queryClient.invalidateQueries()).then(onClose).catch((caught) => setError(caught instanceof Error ? caught.message : "تعذر الحفظ"));
      }}>
        <Field label="الرمز"><input className="input" value={code} onChange={(event) => setCode(event.target.value)} /></Field>
        <Field label="الاسم"><input className="input" value={name} onChange={(event) => setName(event.target.value)} /></Field>
        {error ? <ErrorState message={error} /> : null}
        <Button variant="primary">حفظ</Button>
      </form>
    </Modal>
  );
}

function DeviceDetail({ kind }: { kind: "drone" | "robot" }) {
  const { id = "" } = useParams();
  const { backend, actor, profile } = useSession();
  const query = useQuery({ queryKey: ["catalog"], enabled: Boolean(backend), queryFn: () => loadCatalog(backend!.db) });
  const [note, setNote] = useState("فحص دوري");
  const queryClient = useQueryClient();
  if (!query.data || !actor) return <Loading />;
  const device = (kind === "drone" ? query.data.drones : query.data.robots).find((item) => item.id === id);
  if (!device) return <EmptyState title="الجهاز غير موجود" />;
  const missions = query.data.missions.filter((item) => item.device_id === id);
  const maintenance = query.data.maintenance_records.filter((item) => item.device_id === id);
  return (
    <>
      <PageHeader title={device.code} subtitle={device.name} />
      <div className="banner">غير متصل — وضع المحاكاة متاح</div>
      <div className="grid cols-3">
        <Panel title="الحالة"><p>{device.operational_status}</p><p>البطارية {device.current_battery}% من {device.battery_capacity_mah} mAh</p><p>الإتاحة: {device.availability}</p>{kind === "drone" && "resolution" in device ? <p>{device.resolution}</p> : null}</Panel>
        <Panel title="الموقع">{kind === "drone" && "position_label" in device ? device.position_label : "location_label" in device ? device.location_label : "—"}<p className="muted">آخر صيانة: {device.last_maintenance_at ?? "—"}</p>{kind === "drone" && "total_flight_minutes" in device ? <p>زمن الطيران المسجل: {Math.round(device.total_flight_minutes)} د</p> : null}</Panel>
        <Panel title="المهمة الحالية">{device.current_mission_id ? <Link to={`/missions/${device.current_mission_id}`}>فتح المهمة</Link> : "لا توجد"}</Panel>
      </div>
      <Panel title="سجل المهام">{missions.length === 0 ? <p className="muted">لا يوجد سجل.</p> : missions.map((item) => <Link key={item.id} to={`/missions/${item.id}`}>{item.code}</Link>)}</Panel>
      <Panel title="الصيانة">
        {maintenance.map((item) => <div key={item.id}>{item.description} — {item.status}</div>)}
        {can(profile?.role_code, "devices.manage") ? <form className="actions" onSubmit={(event) => { event.preventDefault(); void backend!.platform.addMaintenance(actor, { device_id: id, device_kind: kind, description: note, status: "completed", performed_at: new Date().toISOString() }).then(() => queryClient.invalidateQueries()); }}>
          <input className="input" value={note} onChange={(event) => setNote(event.target.value)} />
          <Button type="submit">تسجيل صيانة</Button>
        </form> : null}
      </Panel>
    </>
  );
}

export function AlertsPage() {
  const { backend, actor, profile } = useSession();
  const query = useQuery({ queryKey: ["catalog"], enabled: Boolean(backend), queryFn: () => loadCatalog(backend!.db) });
  const [status, setStatus] = useState("");
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  if (!query.data || !actor) return <Loading />;
  const rows = query.data.alerts.filter((alert) => !status || alert.resolution_status === status).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const act = async (alert: Alert, action: "read" | "acknowledge" | "escalate" | "resolve" | "assign") => {
    setError(null);
    try { await backend!.platform.updateAlert(actor, alert.id, action, { notes: "أُغلق من مركز التنبيهات" }); await queryClient.invalidateQueries(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "تعذر التحديث"); }
  }
  return (
    <>
      <PageHeader title="التنبيهات" actions={<Button onClick={() => void backend!.platform.syncOperationalAlerts(actor).then(() => queryClient.invalidateQueries())}>تحديث القواعد</Button>} />
      <select className="select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">الكل</option><option value="open">مفتوح</option><option value="acknowledged">مُقَر</option><option value="escalated">مُصعَّد</option><option value="resolved">محلول</option></select>
      {error ? <ErrorState message={error} /> : null}
      <Panel>
        {rows.length === 0 ? <EmptyState title="لا توجد تنبيهات" /> : rows.map((alert) => (
          <article key={alert.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong>{alertCategoryLabel[alert.category]}</strong><SeverityBadge severity={alert.severity} /></div>
            <p>{alert.message}</p>
            <p className="muted">{formatDateTime(alert.created_at)} — {alert.resolution_status}</p>
            <div className="actions">
              <Button onClick={() => void act(alert, "read")}>تعليم كمقروء</Button>
              <Button onClick={() => void act(alert, "acknowledge")}>إقرار</Button>
              {can(profile?.role_code, "alerts.manage") ? <Button onClick={() => void act(alert, "assign")}>إسناد إليّ</Button> : null}
              {can(profile?.role_code, "alerts.manage") ? <Button onClick={() => void act(alert, "escalate")}>تصعيد</Button> : null}
              {can(profile?.role_code, "alerts.manage") ? <Button variant="primary" onClick={() => void act(alert, "resolve")}>حل</Button> : null}
              {alert.inspection_id ? <Link to={`/inspections/${alert.inspection_id}`}>فتح التفتيش</Link> : null}
            </div>
          </article>
        ))}
      </Panel>
    </>
  );
}

export function HistoryPage() {
  const { backend } = useSession();
  const [params, setParams] = useSearchParams();
  const query = useQuery({ queryKey: ["catalog"], enabled: Boolean(backend), queryFn: () => loadCatalog(backend!.db) });
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [risk, setRisk] = useState("");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [open, setOpen] = useState<string | null>(null);
  if (!query.data) return <Loading />;
  const equipmentFilter = params.get("equipment") ?? "";
  const rows = query.data.inspections.filter((item) => {
    const equipment = query.data.equipment.find((row) => row.id === item.equipment_id);
    const facility = query.data.facilities.find((row) => row.id === item.facility_id);
    const inspector = query.data.profiles.find((row) => row.id === item.assigned_inspector_id);
    const haystack = `${item.code} ${facility?.name ?? ""} ${equipment?.name ?? ""} ${equipment?.code ?? ""} ${inspector?.full_name ?? ""}`.toLowerCase();
    if (search && !haystack.includes(search.trim().toLowerCase())) return false;
    if (equipmentFilter && item.equipment_id !== equipmentFilter) return false;
    if (risk && item.risk_level !== risk) return false;
    if (status === "completed" && item.status !== "COMPLETED" && item.status !== "CLOSED") return false;
    if (status && status !== "completed" && taskViewStatus(item) !== status) return false;
    const stamp = Date.parse(item.completed_at ?? item.planned_at ?? item.created_at);
    if (from && stamp < Date.parse(from)) return false;
    if (to && stamp > Date.parse(to) + 86_400_000) return false;
    return true;
  }).sort((a, b) => (b.completed_at ?? b.created_at).localeCompare(a.completed_at ?? a.created_at));
  return (
    <>
      <PageHeader title="سجل التفتيش" subtitle="السجلات المكتملة تبقى محفوظة. تعديل مهمة جديدة لا يستبدل تفتيشًا سابقًا." />
      <div className="filters">
        <input className="input" placeholder="رقم، منشأة، معدة، أو مفتش" value={search} onChange={(event) => setSearch(event.target.value)} />
        <input className="input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <input className="input" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        <select className="select" value={risk} onChange={(event) => setRisk(event.target.value)}><option value="">كل الخطورة</option><option value="normal">عادي</option><option value="medium">متوسط</option><option value="high">عالٍ</option></select>
        <select className="select" value={status} onChange={(event) => { setStatus(event.target.value); const copy = new URLSearchParams(params); if (event.target.value) copy.set("status", event.target.value); else copy.delete("status"); setParams(copy); }}>
          <option value="">كل الحالات</option>
          <option value="completed">مكتملة</option>
          <option value="review">بانتظار المراجعة</option>
          <option value="overdue">متأخرة</option>
          <option value="cancelled">ملغاة</option>
        </select>
      </div>
      {rows.length === 0 ? <EmptyState title="لا توجد سجلات مطابقة" /> : rows.map((inspection) => {
        const equipment = query.data.equipment.find((item) => item.id === inspection.equipment_id);
        const facility = query.data.facilities.find((item) => item.id === inspection.facility_id);
        const zone = query.data.inspection_zones.find((item) => item.id === inspection.zone_id);
        const inspector = query.data.profiles.find((item) => item.id === inspection.assigned_inspector_id);
        const points = query.data.inspection_points.filter((item) => item.inspection_id === inspection.id);
        const decisions = query.data.inspection_decisions.filter((item) => item.inspection_id === inspection.id);
        const reports = query.data.inspection_reports.filter((item) => item.inspection_id === inspection.id);
        const media = query.data.inspection_media.filter((item) => item.inspection_id === inspection.id);
        const checklist = query.data.inspection_checklists.find((item) => item.inspection_id === inspection.id);
        const items = checklist ? query.data.inspection_checklist_items.filter((item) => item.checklist_id === checklist.id) : [];
        const observations = query.data.inspection_observations.filter((item) => item.inspection_id === inspection.id);
        const sameEquipment = query.data.inspections.filter((item) => item.equipment_id && item.equipment_id === inspection.equipment_id && item.id !== inspection.id);
        const audits = query.data.audit_logs.filter((item) => item.target_id === inspection.id);
        return (
          <Panel key={inspection.id} title={inspection.code} action={<InspectionBadge status={inspection.status} />}>
            <p>{formatDateTime(inspection.completed_at ?? inspection.planned_at)} — {facility?.name} / {zone?.name} — {equipment ? `${equipment.name} (${equipmentTypeLabel[equipment.equipment_type]})` : "بدون معدة"}</p>
            <p>المفتش: {inspector?.full_name ?? "غير مسجل"} — النتيجة: {taskViewLabel[taskViewStatus(inspection)]} — الخطورة: {riskLabel[inspection.risk_level]} — المؤشرات: {points.length}</p>
            <p>التقرير: {reports.map((item) => item.code).join("، ") || "لا يوجد"} — المراجعة: {decisions.at(-1) ? decisionLabel[decisions.at(-1)!.action] : "لا يوجد قرار"}</p>
            <Button variant="ghost" onClick={() => setOpen(open === inspection.id ? null : inspection.id)}>{open === inspection.id ? "إخفاء التفاصيل" : "التفاصيل الكاملة"}</Button>
            {open === inspection.id ? (
              <div className="grid">
                <div>قائمة الفحص: {items.map((item) => `${item.label} (${item.response ? responseLabel[item.response] : "—"})`).join(" | ") || "لا توجد"}</div>
                <div>ملاحظات المفتش: {observations.map((item) => item.description).join(" | ") || "لا توجد"}</div>
                <div>مؤشرات غير بشرية: {points.filter((point) => point.source !== "inspector").map((point) => `${point.code} ${pointCategoryLabel[point.category]} / ${point.review_status}`).join(" | ") || "لا توجد"}</div>
                <div>المرفقات: {media.map((item) => item.file_name).join("، ") || "لا توجد"}</div>
                <div>مقارنة المعدة: {sameEquipment.length === 0 ? "لا يوجد تفتيش سابق آخر لهذه المعدة." : sameEquipment.map((item) => `${item.code} (${formatDateTime(item.completed_at ?? item.planned_at)})`).join(" — ")}</div>
                <div>النشاط: {audits.map((item) => `${formatDateTime(item.created_at)} ${item.action}`).join(" | ") || "لا يوجد"}</div>
                <div className="actions">
                  <Link to={`/inspections/${inspection.id}`}>التفتيش</Link>
                  <Link to={`/work?tab=tasks&equipment=${inspection.equipment_id ?? ""}`}>المهام</Link>
                  <Link to={`/work?tab=locations`}>الموقع</Link>
                  {reports[0] ? <Link to={`/reports/${reports[0].id}`}>التقرير</Link> : null}
                  {equipment ? <Link to={`/equipment/${equipment.id}`}>المعدة</Link> : null}
                </div>
              </div>
            ) : null}
          </Panel>
        );
      })}
    </>
  );
}

export function ReportListPage() {
  const { backend } = useSession();
  const [params] = useSearchParams();
  const query = useQuery({ queryKey: ["catalog"], enabled: Boolean(backend), queryFn: () => loadCatalog(backend!.db) });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [facility, setFacility] = useState("");
  const [severity, setSeverity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<"date" | "code">("date");
  if (!query.data) return <Loading />;
  const equipmentFilter = params.get("equipment") ?? "";
  const rows = query.data.inspections.flatMap((inspection) => {
    const queue = reportQueueStatus(inspection, query.data.inspection_reports);
    if (!queue) return [];
    const reports = query.data.inspection_reports.filter((item) => item.inspection_id === inspection.id);
    const latest = reports.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    const facilityRow = query.data.facilities.find((item) => item.id === inspection.facility_id);
    const zone = query.data.inspection_zones.find((item) => item.id === inspection.zone_id);
    const equipment = query.data.equipment.find((item) => item.id === inspection.equipment_id);
    const inspector = query.data.profiles.find((item) => item.id === inspection.assigned_inspector_id);
    const points = query.data.inspection_points.filter((item) => item.inspection_id === inspection.id);
    const highest = points.reduce<string>((current, point) => rank(point.severity) > rank(current) ? point.severity : current, "low");
    return [{
      inspection,
      queue,
      latest,
      facilityRow,
      zone,
      equipment,
      inspector,
      severity: points.length ? highest : inspection.risk_level === "high" ? "high" : inspection.risk_level === "medium" ? "medium" : "low",
      date: latest?.created_at ?? inspection.completed_at ?? inspection.planned_at ?? inspection.created_at,
    }];
  }).filter((row) => {
    if (equipmentFilter && row.inspection.equipment_id !== equipmentFilter) return false;
    if (facility && row.inspection.facility_id !== facility) return false;
    if (status && row.queue !== status) return false;
    if (severity && row.severity !== severity) return false;
    const stamp = Date.parse(row.date);
    if (from && stamp < Date.parse(from)) return false;
    if (to && stamp > Date.parse(to) + 86_400_000) return false;
    const haystack = `${row.latest?.code ?? row.inspection.code} ${row.inspection.inspection_type} ${row.facilityRow?.name ?? ""} ${row.zone?.name ?? ""} ${row.inspector?.full_name ?? ""}`.toLowerCase();
    return !search || haystack.includes(search.trim().toLowerCase());
  }).sort((a, b) => sort === "code" ? (a.latest?.code ?? a.inspection.code).localeCompare(b.latest?.code ?? b.inspection.code) : b.date.localeCompare(a.date));
  const counts = {
    total: query.data.inspections.filter((item) => reportQueueStatus(item, query.data.inspection_reports)).length,
    fresh: query.data.inspections.filter((item) => reportQueueStatus(item, query.data.inspection_reports) === "new").length,
    review: query.data.inspections.filter((item) => reportQueueStatus(item, query.data.inspection_reports) === "in_review").length,
    complete: query.data.inspections.filter((item) => reportQueueStatus(item, query.data.inspection_reports) === "complete").length,
    missing: query.data.inspections.filter((item) => reportQueueStatus(item, query.data.inspection_reports) === "needs_completion").length,
  };
  return (
    <>
      <PageHeader title="التقارير" subtitle="كل تقرير يشير إلى تفتيشه. إصدار جديد لا يحذف المراجعة السابقة." />
      <div className="grid cols-5">
        <Panel><div className="kpi"><div className="muted">إجمالي التقارير</div><div className="value">{counts.total}</div></div></Panel>
        <Panel><div className="kpi"><div className="muted">التقارير الجديدة</div><div className="value">{counts.fresh}</div></div></Panel>
        <Panel><div className="kpi"><div className="muted">قيد المراجعة</div><div className="value">{counts.review}</div></div></Panel>
        <Panel><div className="kpi"><div className="muted">المكتملة</div><div className="value">{counts.complete}</div></div></Panel>
        <Panel><div className="kpi"><div className="muted">تحتاج استكمالًا</div><div className="value">{counts.missing}</div></div></Panel>
      </div>
      <div className="filters">
        <input className="input" placeholder="بحث" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">كل الحالات</option>{(Object.keys(reportQueueLabel) as ReportQueueStatus[]).map((item) => <option key={item} value={item}>{reportQueueLabel[item]}</option>)}</select>
        <select className="select" value={facility} onChange={(event) => setFacility(event.target.value)}><option value="">كل المنشآت</option>{query.data.facilities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select className="select" value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="">كل الشدة</option>{(["low", "medium", "high", "critical"] as const).map((item) => <option key={item} value={item}>{severityLabel[item]}</option>)}</select>
        <input className="input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <input className="input" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        <select className="select" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="date">الأحدث</option><option value="code">الرقم</option></select>
      </div>
      <Panel>
        {rows.length === 0 ? <EmptyState title="لا توجد تقارير مطابقة" /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>الرقم</th><th>العنوان</th><th>المنشأة</th><th>الموقع</th><th>المفتش</th><th>التاريخ</th><th>الشدة</th><th>الحالة</th><th>إجراء</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.inspection.id}>
                  <td className="mono">{row.latest?.code ?? row.inspection.code}</td>
                  <td>{row.inspection.inspection_type}</td>
                  <td>{row.facilityRow?.name}</td>
                  <td>{row.zone?.name} {row.equipment ? `— ${row.equipment.code}` : ""}</td>
                  <td>{row.inspector?.full_name ?? "—"}</td>
                  <td>{formatDateTime(row.date)}</td>
                  <td>{severityLabel[row.severity as keyof typeof severityLabel]}</td>
                  <td>{reportQueueLabel[row.queue]}</td>
                  <td>{row.latest ? <Link to={`/reports/${row.latest.id}`}>عرض</Link> : <Link to={`/inspections/${row.inspection.id}`}>استكمال</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Panel>
    </>
  );
}

function rank(value: string): number {
  return value === "critical" ? 4 : value === "high" ? 3 : value === "medium" ? 2 : 1;
}

export function ReportViewPage() {
  const { id = "" } = useParams();
  const { backend, actor, profile } = useSession();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["catalog"], enabled: Boolean(backend), queryFn: () => loadCatalog(backend!.db) });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  if (!query.data) return <Loading />;
  const report = query.data.inspection_reports.find((item) => item.id === id);
  if (!report) return <EmptyState title="التقرير غير موجود" />;
  const snapshot = report.snapshot;
  const inspection = query.data.inspections.find((item) => item.id === report.inspection_id);
  const media = query.data.inspection_media.filter((item) => item.inspection_id === report.inspection_id);
  return (
    <>
      <div className="actions no-print">
        <Button variant="primary" onClick={() => window.print()}>طباعة أو حفظ PDF</Button>
        <Button onClick={() => downloadHtml(snapshot)}>تنزيل HTML</Button>
        {can(profile?.role_code, "reports.generate") && actor && inspection && !inspection.archived_at ? <Button onClick={() => void backend!.platform.archiveInspection(actor, inspection.id).then(async () => { setNotice("أُرشف السجل وبقي التقرير محفوظًا."); await queryClient.invalidateQueries(); }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "تعذر الأرشفة"))}>أرشفة</Button> : null}
      </div>
      {notice ? <p className="banner no-print">{notice}</p> : null}
      {error ? <ErrorState message={error} /> : null}
      <article className="report-sheet">
        <div dir="ltr" style={{ fontWeight: 700, letterSpacing: "0.08em" }}><span style={{ color: "#0f8f86" }}>VISION</span><span style={{ color: "#22D3EE" }}>GUARD</span></div>
        <h1>تقرير فحص</h1>
        <p>{snapshot.disclaimer}</p>
        <p>رقم التقرير: {snapshot.report_code} — مراجعة {snapshot.revision}</p>
        <p>رقم التفتيش: {snapshot.inspection_code}</p>
        <p>المنشأة: {snapshot.facility_name} / {snapshot.site_name} / {snapshot.sector_name}</p>
        <p>المنطقة: {snapshot.zone_name}</p>
        <p>المعدة: {snapshot.equipment_label ?? "—"}</p>
        <p>المفتش: {snapshot.inspector_name ?? "غير مسجل على الحساب"}</p>
        <p>الأسلوب: {methodLabel[snapshot.method]} — الخطورة: {riskLabel[snapshot.risk_level]}</p>
        <p>البداية: {formatDateTime(snapshot.started_at)} — الإنهاء: {formatDateTime(snapshot.completed_at)}</p>
        <h2>النتيجة {snapshot.score.overall == null ? "—" : formatPercent(snapshot.score.overall)} {snapshot.score.band ?? ""}</h2>
        {snapshot.score.has_critical_failure ? <p>توجد بنود حرجة. النسبة لا تُلغيها.</p> : null}
        <table>
          <thead><tr><th>البند</th><th>الحالة</th><th>الدرجة</th></tr></thead>
          <tbody>{snapshot.score.categories.map((item) => <tr key={item.category}><td>{item.category}</td><td>{item.score >= 90 ? "ممتاز" : item.score >= 80 ? "جيد" : "متابعة"}</td><td>{item.score}%</td></tr>)}</tbody>
        </table>
        <h2>بنود القائمة</h2>
        <table>
          <thead><tr><th>البند</th><th>الاستجابة</th><th>ملاحظة</th></tr></thead>
          <tbody>{snapshot.checklist_items.map((item) => <tr key={item.label}><td>{item.label}</td><td>{item.response ? responseLabel[item.response] : "—"}</td><td>{item.notes ?? ""}</td></tr>)}</tbody>
        </table>
        <h2>ملاحظات بشرية</h2>
        {snapshot.observations.length === 0 ? <p>لا توجد ملاحظات بشرية في هذه النسخة.</p> : snapshot.observations.map((item) => <p key={item.description}>{item.description} — {item.source === "inspector" ? "مفتش" : item.source}</p>)}
        <h2>مؤشرات مساعدة — ليست قرار سلامة</h2>
        {snapshot.points.map((point) => <p key={point.code}>{point.code}: {point.description} — المراجعة: {point.review_status}</p>)}
        <h2>الصور</h2>
        {media.length === 0 ? <p>لا توجد صور مرتبطة.</p> : media.map((item) => <p key={item.id}>{item.file_name} — {formatDateTime(item.captured_at)} — {item.source === "seed" ? "دليل تجريبي" : item.source}</p>)}
        <h2>قرارات المراجعة البشرية</h2>
        {snapshot.decisions.map((item) => <p key={item.decided_at}>{decisionLabel[item.action]} — {item.notes}</p>)}
        <p>حالة الاعتماد: {inspection?.archived_at ? `مؤرشف ${formatDateTime(inspection.archived_at)}` : report.status === "final" ? "نسخة نهائية غير مؤرشفة" : report.status}</p>
        <h2>القراءات</h2>
        {snapshot.sensors.map((item) => <p key={item.recorded_at + item.measurement_type}>{item.measurement_type}: {item.numeric_value} {item.unit} — {item.interpretation}</p>)}
        <h2>التوصيات</h2>
        {snapshot.recommendations.map((item) => <p key={item}>{item}</p>)}
        <h2>المتابعة</h2>
        {snapshot.follow_up.length === 0 ? <p>لا توجد متابعة مسجلة.</p> : snapshot.follow_up.map((item) => <p key={item}>{item}</p>)}
        <p>أُنشئ في {formatDateTime(snapshot.generated_at)}</p>
      </article>
    </>
  );
}

function downloadHtml(snapshot: ReportViewSnapshot) {
  const rows = snapshot.checklist_items.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${escapeHtml(item.response ?? "—")}</td><td>${escapeHtml(item.notes ?? "")}</td></tr>`).join("");
  const points = snapshot.points.map((point) => `<li>${escapeHtml(point.code)}: ${escapeHtml(point.description)} — ${escapeHtml(point.review_status)}</li>`).join("");
  const html = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>${escapeHtml(snapshot.report_code)}</title><body style="font-family:sans-serif"><h1>VISIONGUARD</h1><p>${escapeHtml(snapshot.disclaimer)}</p><p>التقرير ${escapeHtml(snapshot.report_code)} — التفتيش ${escapeHtml(snapshot.inspection_code)}</p><p>${escapeHtml(snapshot.facility_name)} / ${escapeHtml(snapshot.zone_name)} / ${escapeHtml(snapshot.equipment_label ?? "—")}</p><table border="1" cellpadding="6">${rows}</table><h2>مؤشرات مساعدة</h2><ul>${points}</ul></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${snapshot.report_code}.html`;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] ?? char));
}

type ReportViewSnapshot = {
  report_code: string;
  disclaimer: string;
  inspection_code: string;
  facility_name: string;
  zone_name: string;
  equipment_label: string | null;
  checklist_items: { label: string; response: string | null; notes: string | null }[];
  points: { code: string; description: string; review_status: string }[];
};

const userSchema = z.object({
  fullName: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(10),
  role: z.enum(["ADMIN", "INSPECTOR", "OPERATOR"]),
});

export function UsersPage() {
  const { backend, profile } = useSession();
  const session = useSession();
  const query = useQuery({ queryKey: ["catalog"], enabled: Boolean(backend), queryFn: () => loadCatalog(backend!.db) });
  const form = useForm<z.infer<typeof userSchema>>({ resolver: zodResolver(userSchema), defaultValues: { role: "INSPECTOR", fullName: "", email: "", password: "" } });
  const [error, setError] = useState<string | null>(null);
  if (!profile || !can(profile.role_code, "users.manage")) return <EmptyState title="هذه الشاشة للمدير فقط" />;
  if (!query.data) return <Loading />;
  return (
    <>
      <PageHeader title="المستخدمون والصلاحيات" subtitle={backend?.mode === "demo" ? "كلمات المرور تُخزَّن كبصمة مملحة في وضع العرض، ولا تُحفظ كنص." : "إنشاء المستخدمين عبر Supabase يتطلب نشر دالة create-user."} />
      <Panel title="حساب جديد">
        <form className="grid cols-2" onSubmit={form.handleSubmit(async (values) => {
          setError(null);
          try { await session.createUser(values); form.reset(); } catch (caught) { setError(caught instanceof Error ? caught.message : "تعذر الإنشاء"); }
        })}>
          <Field label="الاسم"><input className="input" {...form.register("fullName")} /></Field>
          <Field label="البريد"><input className="input" dir="ltr" {...form.register("email")} /></Field>
          <Field label="كلمة المرور"><input className="input" type="password" dir="ltr" {...form.register("password")} /></Field>
          <Field label="الدور"><select className="select" {...form.register("role")}>{(["ADMIN", "INSPECTOR", "OPERATOR"] as RoleCode[]).map((role) => <option key={role} value={role}>{roleLabel[role]}</option>)}</select></Field>
          {error ? <ErrorState message={error} /> : null}
          <Button variant="primary" type="submit">حفظ</Button>
        </form>
      </Panel>
      <Panel>
        {query.data.profiles.map((item) => (
          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 0" }}>
            <span>{item.full_name} — {item.email}</span>
            <select className="select" value={item.role_code} onChange={(event) => void session.updateUser(item.id, { role_code: event.target.value as RoleCode })}>
              {(["ADMIN", "INSPECTOR", "OPERATOR"] as RoleCode[]).map((role) => <option key={role} value={role}>{roleLabel[role]}</option>)}
            </select>
            <Button variant="ghost" onClick={() => void session.updateUser(item.id, { is_active: !item.is_active })}>{item.is_active ? "تعطيل" : "تفعيل"}</Button>
          </div>
        ))}
      </Panel>
    </>
  );
}

export function SettingsPage() {
  const { backend, profile, actor } = useSession();
  const query = useQuery({ queryKey: ["catalog"], enabled: Boolean(backend), queryFn: () => loadCatalog(backend!.db) });
  const [gateway, setGateway] = useState<string>("لم يُفحص");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  if (!query.data || !profile || !actor) return <Loading />;
  const analysis = getAnalysisProvider();
  const thresholds = query.data.sensor_thresholds;
  return (
    <>
      <PageHeader title="الإعدادات" />
      <Panel title="الحساب"><p>{profile.full_name}</p><p>{profile.email}</p><p>{roleLabel[profile.role_code]}</p></Panel>
      <Panel title="التكاملات">
        {integrationCatalog().map((item) => <p key={item.id}><strong>{item.name}: </strong>{item.detail}</p>)}
        <p>التحليل الآلي: {analysis.isConfigured() ? "مهيأ" : "غير متاح. لم يُضبط مزود تحليل."}</p>
        <Button onClick={() => void probeDeviceGateway().then((result) => setGateway(result === "unconfigured" ? "غير متصل — وضع المحاكاة متاح" : result === "reachable" ? "البوابة استجابت، لكن الإرسال غير مفعّل." : "العنوان لا يستجيب"))}>فحص بوابة الأجهزة</Button>
        <p>{gateway}</p>
      </Panel>
      <Panel title="حدود المستشعرات">
        {thresholds.map((item) => <p key={item.id}>{item.label}: {item.min_value}–{item.max_value} {item.unit}. {item.notes}</p>)}
        <p className="muted">الحدود قابلة للتعديل من قاعدة البيانات، ولا تُعامل كحدود تنظيمية عامة.</p>
      </Panel>
      {can(profile.role_code, "settings.manage") && backend?.mode === "demo" ? <Panel title="بيانات العرض">
        <Button variant="danger" onClick={() => void backend.platform.resetDemoData(actor).then(() => queryClient.invalidateQueries()).catch((caught) => setError(caught instanceof Error ? caught.message : "تعذرت الإعادة"))}>إعادة تهيئة بيانات العرض مع الإبقاء على الحسابات</Button>
        {error ? <ErrorState message={error} /> : null}
      </Panel> : null}
    </>
  );
}
