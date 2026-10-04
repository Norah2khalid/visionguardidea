import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSession } from "@/app/session";
import { MediaPreview } from "@/components/MediaPreview";
import { Button, EmptyState, ErrorState, Loading, PageHeader, Panel, SeverityBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { alertCategoryLabel, deviceStatusLabel } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { isActiveTask } from "@/lib/taskStatus";
import { loadDashboard } from "@/services/platform/queries";
import type { Alert } from "@/types/domain";
import { AiPanel } from "./AiPanel";
import { MonitoringMap } from "./MonitoringMap";

export function DashboardPage() {
  const { backend, actor, profile } = useSession();
  const query = useQuery({ queryKey: ["dashboard"], enabled: Boolean(backend), queryFn: () => loadDashboard(backend!.db) });
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inspectionId, setInspectionId] = useState("");
  const [caption, setCaption] = useState("");
  if (!query.data) return <Loading />;
  const { metrics, state } = query.data;
  const locations = state.equipment.length;
  const activeTasks = state.inspections.filter((item) => isActiveTask(item)).length;
  const completed = state.inspections.filter((item) => item.status === "COMPLETED" || item.status === "CLOSED").length;
  const openAlerts = state.alerts.filter((alert) => alert.resolution_status !== "resolved").length;
  const devices = state.drones.filter((item) => item.availability === "available").length + state.robots.filter((item) => item.availability === "available").length;
  const demo = backend?.mode === "demo";

  const upload = async (file: File | undefined) => {
    if (!file || !backend || !actor || !inspectionId) return;
    setError(null);
    try {
      await backend.platform.uploadEvidence(actor, { inspectionId, file, fileName: file.name, caption: caption || file.name });
      setNotice("أُرفقت الصورة بسجل التفتيش المختار.");
      setCaption("");
      await queryClient.invalidateQueries();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر إرفاق الملف");
    }
  };

  return (
    <>
      <PageHeader title="لوحة التحكم" subtitle={demo ? "الأرقام من سجلات العرض المخزنة على هذا المتصفح، وليست تشغيلًا حيًا." : "الأرقام من السجلات المخزنة."} />
      <div className="grid cols-5">
        <Card href="/work?tab=locations" label="إجمالي مواقع التفتيش" value={locations} hint="معدات ومواقع مرتبطة بالمنشآت" />
        <Card href="/work?tab=tasks&status=active" label="المهام النشطة" value={activeTasks} hint="غير المكتملة وغير الملغاة" />
        <Card href="/history?status=completed" label="عمليات التفتيش المكتملة" value={completed} hint={`${metrics.completedInspections} حسب حالة السجل`} />
        <Card href="#alerts" label="التنبيهات والمخاطر" value={openAlerts} hint={`${metrics.highRiskZones} مناطق عالية الخطورة`} />
        <Card href="#devices" label="الأجهزة والدرون المتاحة" value={devices} hint={`${metrics.availableDrones} درون متاحة في السجل`} />
      </div>

      <Panel title="خريطة المتابعة والتصوير">
        <MonitoringMap state={state} />
        <div id="imaging" className="imaging">
          <h3>صور التفتيش</h3>
          <p className="muted">الصور مرتبطة بسجلات التفتيش. ملفات العرض التجريبية ليست لقطات من درون.</p>
          {state.inspection_media.length === 0 ? <EmptyState title="لا توجد صور" /> : (
            <div className="gallery">
              {state.inspection_media.map((media) => {
                const inspection = state.inspections.find((item) => item.id === media.inspection_id);
                const equipment = state.equipment.find((item) => item.id === inspection?.equipment_id);
                const siblings = state.inspection_media.filter((item) => item.id !== media.id && item.inspection_id === media.inspection_id);
                return (
                  <article key={media.id} className="shot">
                    <MediaPreview path={media.storage_path} mime={media.mime_type} alt={media.caption ?? media.file_name} />
                    <p>{media.caption ?? media.file_name}</p>
                    <p className="muted">{formatDateTime(media.captured_at)} — {equipment?.code ?? "بدون معدة"} — {inspection?.code ?? "بدون تفتيش"}</p>
                    <p className="muted">المصدر: {media.source === "upload" ? "مرفق" : media.source === "simulation" ? "محاكاة" : "بيانات عرض"}</p>
                    {siblings[0] ? <p>مقارنة: توجد صورة أخرى على التفتيش نفسه ({siblings[0].file_name}).</p> : <p className="muted">لا توجد صورة مقابلة للمقارنة.</p>}
                    {inspection ? <Link to={`/inspections/${inspection.id}`}>فتح التفتيش</Link> : null}
                  </article>
                );
              })}
            </div>
          )}
          {can(profile?.role_code, "checklists.fill") ? (
            <form className="grid cols-2" onSubmit={(event) => { event.preventDefault(); const file = (event.currentTarget.elements.namedItem("file") as HTMLInputElement).files?.[0]; void upload(file); }}>
              <label className="field"><span>التفتيش</span>
                <select className="select" value={inspectionId} onChange={(event) => setInspectionId(event.target.value)} required>
                  <option value="">اختر سجلًا</option>
                  {state.inspections.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}
                </select>
              </label>
              <label className="field"><span>وصف</span><input className="input" value={caption} onChange={(event) => setCaption(event.target.value)} /></label>
              <label className="field"><span>صورة أو فيديو</span><input className="input" name="file" type="file" accept="image/*,video/mp4,video/webm,application/pdf" /></label>
              <Button variant="primary" type="submit">إرفاق بالتفتيش</Button>
            </form>
          ) : <p className="muted">إرفاق الملفات متاح للمفتش والمدير.</p>}
          {notice ? <p className="banner">{notice}</p> : null}
          {error ? <ErrorState message={error} /> : null}
        </div>
      </Panel>

      <Panel title="تحليل الذكاء الاصطناعي">
        <AiPanel state={state} />
      </Panel>

      <Panel title="الأجهزة والقياس">
        <div id="devices" className="grid cols-2">
          {state.drones.map((drone) => <DeviceCard key={drone.id} name={drone.name} code={drone.code} kind="درون" status={deviceStatusLabel[drone.operational_status]} battery={drone.current_battery} facility={state.facilities[0]?.name ?? "—"} telemetry={state.telemetry_records.filter((item) => item.device_id === drone.id)} />)}
          {state.robots.map((robot) => <DeviceCard key={robot.id} name={robot.name} code={robot.code} kind="جهاز أرضي" status={deviceStatusLabel[robot.operational_status]} battery={robot.current_battery} facility={state.facilities[0]?.name ?? "—"} telemetry={state.telemetry_records.filter((item) => item.device_id === robot.id)} />)}
        </div>
        <p className="muted">لا يُعرض اتصال أو موقع حي إلا إذا وُجد سجل مصدره جهاز متصل. السجلات الحالية مصدرها العرض أو المحاكاة.</p>
      </Panel>

      <Panel title="التنبيهات والمخاطر">
        <div id="alerts">
          <AlertList />
        </div>
      </Panel>
    </>
  );
}

function Card({ href, label, value, hint }: { href: string; label: string; value: number; hint: string }) {
  return (
    <Link className="panel kpi-link" to={href}>
      <div className="kpi"><div className="muted">{label}</div><div className="value">{value}</div><div className="hint">{hint}</div></div>
    </Link>
  );
}

function DeviceCard({ name, code, kind, status, battery, facility, telemetry }: { name: string; code: string; kind: string; status: string; battery: number; facility: string; telemetry: { source: string; recorded_at: string; battery_percent: number | null; altitude_m: number | null; speed_mps: number | null; latitude: number | null; longitude: number | null }[] }) {
  const latest = telemetry.slice().sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0];
  const live = latest?.source === "device";
  return (
    <article>
      <strong>{name}</strong>
      <p className="mono">{code}</p>
      <p>{kind} — {status} — البطارية المسجلة {battery}%</p>
      <p className="muted">المنشأة المرتبطة في العرض: {facility}</p>
      {latest ? (
        <p>آخر قياس {formatDateTime(latest.recorded_at)} — {live ? "جهاز متصل" : latest.source === "simulation" ? "محاكاة" : "بيانات مستوردة للعرض"} — الارتفاع {latest.altitude_m ?? "—"} — السرعة {latest.speed_mps ?? "—"} — الموقع {latest.latitude == null ? "غير متوفر" : `${latest.latitude}, ${latest.longitude}`}</p>
      ) : <p>لا توجد قياسات. الاتصال الحي غير متوفر.</p>}
    </article>
  );
}

function AlertList() {
  const { backend, actor, profile } = useSession();
  const query = useQuery({ queryKey: ["dashboard"], enabled: Boolean(backend), queryFn: () => loadDashboard(backend!.db) });
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  if (!query.data || !actor) return <Loading />;
  const rows = query.data.state.alerts.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  const act = async (alert: Alert, action: "acknowledge" | "resolve") => {
    setError(null);
    try {
      await backend!.platform.updateAlert(actor, alert.id, action, { notes: "من لوحة التحكم" });
      await queryClient.invalidateQueries();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تحديث التنبيه");
    }
  };
  if (rows.length === 0) return <EmptyState title="لا توجد تنبيهات" />;
  return (
    <div className="grid">
      {error ? <ErrorState message={error} /> : null}
      {rows.map((alert) => (
        <article key={alert.id}>
          <div className="page-title"><strong>{alertCategoryLabel[alert.category]}</strong><SeverityBadge severity={alert.severity} /></div>
          <p>{alert.message}</p>
          <p className="muted">{formatDateTime(alert.created_at)} — {alert.resolution_status}</p>
          <div className="actions">
            {can(profile?.role_code, "alerts.view") ? <Button onClick={() => void act(alert, "acknowledge")}>إقرار</Button> : null}
            {can(profile?.role_code, "alerts.manage") ? <Button variant="primary" onClick={() => void act(alert, "resolve")}>إغلاق</Button> : null}
            {alert.inspection_id ? <Link to={`/inspections/${alert.inspection_id}`}>السجل</Link> : null}
          </div>
        </article>
      ))}
    </div>
  );
}
