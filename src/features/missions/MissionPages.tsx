import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/app/session";
import { Button, EmptyState, ErrorState, Loading, MissionBadge, PageHeader, Panel, RiskBadge, SeverityBadge } from "@/components/ui";
import { connectionLabel, connectionMode } from "@/lib/connection";
import { formatDateTime, formatNumber } from "@/lib/format";
import { decisionLabel, pointCategoryLabel, stageLabel } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { interpretReading } from "@/lib/sensors";
import { loadCatalog, loadMissionBundle } from "@/services/platform/queries";
import type { DecisionAction } from "@/types/domain";

export function MissionListPage() {
  const { backend } = useSession();
  const query = useQuery({ queryKey: ["catalog"], enabled: Boolean(backend), queryFn: () => loadCatalog(backend!.db) });
  if (!query.data) return <Loading />;
  return (
    <>
      <PageHeader title="المهام ومركز التحكم" subtitle="المهام المرتبطة بتفتيش جهاز تُشغَّل هنا في وضع المحاكاة." />
      <Panel>
        {query.data.missions.length === 0 ? <EmptyState title="لا توجد مهام" body="أنشئ تفتيشًا بأسلوب درون أو روبوت." /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>الرمز</th><th>الحالة</th><th>التقدم</th><th>المرحلة</th><th>الخطورة</th></tr></thead>
            <tbody>
              {query.data.missions.map((mission) => (
                <tr key={mission.id}>
                  <td><Link className="mono" to={`/missions/${mission.id}`}>{mission.code}</Link></td>
                  <td><MissionBadge status={mission.status} /></td>
                  <td className="mono">{mission.progress}%</td>
                  <td>{stageLabel[mission.stage]}</td>
                  <td><RiskBadge risk={mission.risk_level} /></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Panel>
    </>
  );
}

export function MissionDetailPage() {
  const bundle = useMission();
  if (bundle.state === "loading") return <Loading />;
  if (bundle.state === "missing") return <EmptyState title="المهمة غير موجودة" />;
  const { data } = bundle;
  return (
    <>
      <PageHeader title={data.mission.code} subtitle={data.facility?.name} actions={<Link className="btn-primary" to={`/missions/${data.mission.id}/control`}>مركز التحكم</Link>} />
      <div className="grid cols-3">
        <Panel title="المهمة"><MissionBadge status={data.mission.status} /><p>التقدم {data.mission.progress}%</p><p>{data.isSimulationLabel}</p></Panel>
        <Panel title="الجهاز"><p>{data.drone?.code ?? data.robot?.code ?? "بدون جهاز"}</p><p>البطارية {data.drone?.current_battery ?? data.robot?.current_battery ?? "—"}%</p><p className="muted">لا يوجد اتصال بجهاز فعلي.</p></Panel>
        <Panel title="النطاق"><p>{data.zone?.name}</p><RiskBadge risk={data.mission.risk_level} /></Panel>
      </div>
      <EventList events={data.events} />
    </>
  );
}

export function MissionControlPage() {
  const { backend, actor, profile } = useSession();
  const bundle = useMission();
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [action, setAction] = useState<DecisionAction>("confirm");

  const missionId = bundle.state === "ready" ? bundle.data.mission.id : "";
  useEffect(() => {
    if (!running || paused || !backend || !actor || !missionId) return;
    let timer = 0;
    let stopped = false;
    const tick = async () => {
      try {
        const result = await backend.platform.advanceSimulation(actor, missionId);
        await queryClient.invalidateQueries();
        if (!result.done && !stopped) timer = window.setTimeout(() => void tick(), 1800);
        else setRunning(false);
      } catch (caught) {
        setRunning(false);
        setError(caught instanceof Error ? caught.message : "توقفت المحاكاة");
      }
    };
    timer = window.setTimeout(() => void tick(), 400);
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [running, paused, backend, actor, missionId, queryClient]);

  if (bundle.state === "loading") return <Loading />;
  if (bundle.state === "missing" || !actor) return <EmptyState title="المهمة غير موجودة" />;
  const { data } = bundle;
  const latest = data.telemetry.at(-1);
  const mode = connectionMode({ mission: data.mission, latest: latest ?? null, gatewayConfigured: Boolean(import.meta.env.VITE_DEVICE_GATEWAY_URL) });
  async function run(work: () => Promise<unknown>) {
    setError(null);
    try { await work(); await queryClient.invalidateQueries(); } catch (caught) { setError(caught instanceof Error ? caught.message : "تعذر التنفيذ"); }
  }
  return (
    <>
      <PageHeader title={`مركز التحكم ${data.mission.code}`} subtitle={connectionLabel[mode]} actions={<Link className="btn" to="/live">البيانات الحية</Link>} />
      <div className="banner sim">وضع المحاكاة — البيانات تجريبية. لن يُرسل أمر طيران أو حركة إلى جهاز حقيقي.</div>
      <div className="stage-track">
        {[1, 2, 3, 4, 5, 6].map((stage) => (
          <div key={stage} className={`stage ${data.mission.stage > stage ? "done" : ""} ${data.mission.stage === stage ? "now" : ""}`}>
            <div className="mono">0{stage}</div>
            <strong>{stageLabel[stage]}</strong>
          </div>
        ))}
      </div>
      <div className="grid cols-3">
        <Panel title="القياس"><p className="mono">ALT {formatNumber(latest?.altitude_m ?? null)} m</p><p className="mono">SPD {formatNumber(latest?.speed_mps ?? null)} m/s</p><p>البطارية {latest?.battery_percent ?? data.drone?.current_battery ?? "—"}%</p><p>التقدم {data.mission.progress}%</p></Panel>
        <Panel title="المستشعرات">
          {data.readings.length === 0 ? <p className="muted">لا توجد قراءة بعد.</p> : data.readings.map((reading) => {
            const threshold = data.thresholds.find((item) => item.id === reading.threshold_id) ?? null;
            const meaning = interpretReading(reading, threshold);
            return <p key={reading.id}>{reading.measurement_type}: {reading.numeric_value} {reading.unit} — {meaning.label}</p>;
          })}
        </Panel>
        <Panel title="التحكم">
          {can(profile?.role_code, "missions.operate") ? (
            <div className="actions">
              <Button variant="primary" onClick={() => { setPaused(false); setRunning(true); }}>بدء المحاكاة</Button>
              <Button onClick={() => setPaused(true)}>إيقاف مؤقت</Button>
              <Button onClick={() => { setPaused(false); setRunning(true); }}>متابعة</Button>
              <Button onClick={() => void run(() => backend!.platform.resetSimulation(actor, data.mission.id))}>إعادة ضبط</Button>
              <Button variant="danger" onClick={() => void run(() => backend!.platform.interruptMission(actor, data.mission.id))}>مقاطعة</Button>
            </div>
          ) : <p className="muted">التشغيل التشغيلي للمهمة غير متاح لدورك.</p>}
          <p className="muted">{data.mission.is_simulation ? "المهمة معلّمة كمحاكاة." : "سجل مهمة غير متصل بجهاز."}</p>
        </Panel>
      </div>
      {error ? <ErrorState message={error} /> : null}
      <div className="grid cols-2">
        <Panel title="الدليل">
          {data.media.length === 0 ? <p className="muted">لا يوجد دليل بعد.</p> : data.media.map((item) => <figure key={item.id}><img alt={item.caption ?? "دليل"} src={item.storage_path} style={{ width: "100%", borderRadius: 12 }} /><figcaption className="muted">{item.caption}{item.source === "simulation" || item.source === "seed" ? <span className="badge warn">تجريبي</span> : null}</figcaption></figure>)}
        </Panel>
        <Panel title="نقاط تحتاج فحصًا">
          {data.points.length === 0 ? <p className="muted">لم تُرصد نقطة.</p> : data.points.map((point) => (
            <div key={point.id} style={{ marginBottom: 12 }}>
              <div>{pointCategoryLabel[point.category]} <SeverityBadge severity={point.severity} /></div>
              <p>{point.description}</p>
              <p className="muted">المصدر: {point.source === "simulation" ? "سيناريو محاكاة" : point.source} — لا توجد درجة ثقة آلية.</p>
              <p>الحالة: {point.review_status}</p>
            </div>
          ))}
          {can(profile?.role_code, "decisions.record") && data.points.some((point) => point.review_status === "pending") ? (
            <form className="grid" onSubmit={(event) => { event.preventDefault(); const point = data.points.find((item) => item.review_status === "pending"); if (!point) return; void run(() => backend!.platform.recordDecision(actor, { inspectionId: data.mission.inspection_id, pointId: point.id, action, notes })); }}>
              <select className="select" value={action} onChange={(event) => setAction(event.target.value as DecisionAction)}>
                {Object.entries(decisionLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <textarea className="textarea" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="ملاحظة المفتش" />
              <Button variant="primary" type="submit">تسجيل القرار</Button>
            </form>
          ) : null}
          {can(profile?.role_code, "missions.review") ? <Button onClick={() => void run(() => backend!.platform.completeMission(actor, data.mission.id))}>إكمال المهمة</Button> : null}
          <Link to={`/inspections/${data.mission.inspection_id}`}>فتح التفتيش</Link>
        </Panel>
      </div>
      <EventList events={data.events} />
    </>
  );
}

export function LivePage() {
  const { backend } = useSession();
  const catalog = useQuery({ queryKey: ["catalog"], enabled: Boolean(backend), queryFn: () => loadCatalog(backend!.db) });
  const [missionId, setMissionId] = useState("");
  const bundle = useQuery({ queryKey: ["mission", missionId], enabled: Boolean(backend && missionId), queryFn: () => loadMissionBundle(backend!.db, missionId) });
  if (!catalog.data) return <Loading />;
  const mission = bundle.data?.mission ?? null;
  const latest = bundle.data?.telemetry.at(-1) ?? null;
  const mode = connectionMode({ mission, latest, gatewayConfigured: Boolean(import.meta.env.VITE_DEVICE_GATEWAY_URL) });
  return (
    <>
      <PageHeader title="البيانات الحية" subtitle={connectionLabel[mode]} />
      <FieldMission missions={catalog.data.missions.map((item) => ({ id: item.id, code: item.code }))} value={missionId} onChange={setMissionId} />
      {!missionId ? <EmptyState title="اختر مهمة" body="العرض يبقى فارغًا حتى تُختار مهمة لها قياس مخزن." /> : null}
      {bundle.data?.mission ? (
        <div className="grid cols-2">
          <Panel title="عرض الكاميرا المحاكى">
            <div className="camera" aria-label="عرض كاميرا تجريبي">
              {bundle.data.mission.status === "INSPECTING" || bundle.data.mission.status === "DATA_TRANSMISSION" ? <div className="scan" /> : null}
              <div style={{ position: "absolute", inset: 24 }}>
                <div className="mono">ALT {formatNumber(latest?.altitude_m ?? null)} m</div>
                <div className="mono">SPD {formatNumber(latest?.speed_mps ?? null)} m/s</div>
                <p>هذا المشهد مولَّد داخل المنصة وليس بثًا من كاميرا.</p>
              </div>
            </div>
          </Panel>
          <Panel title="الاتصال">
            <p>{connectionLabel[mode]}</p>
            <p className="muted">المصدر: {latest?.source ?? "غير متوفر"} — الجودة: {latest?.quality ?? "missing"}</p>
            {bundle.data.readings.map((reading) => <p key={reading.id}>{reading.measurement_type}: {reading.numeric_value ?? "غير متوفر"} {reading.unit}</p>)}
          </Panel>
          <Panel title="الوسائط">
            {bundle.data.media.length === 0 ? <p className="muted">لا توجد صور.</p> : bundle.data.media.map((item) => <figure key={item.id}><img alt={item.caption ?? ""} src={item.storage_path} style={{ width: "100%" }} /><figcaption>{formatDateTime(item.captured_at)} — {item.caption}</figcaption></figure>)}
          </Panel>
          <EventList events={bundle.data.events} />
        </div>
      ) : null}
    </>
  );
}

function FieldMission({ missions, value, onChange }: { missions: { id: string; code: string }[]; value: string; onChange: (value: string) => void }) {
  return <select className="select" value={value} onChange={(event) => onChange(event.target.value)}><option value="">اختر مهمة</option>{missions.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}</select>;
}

function EventList({ events }: { events: { id: string; created_at: string; message: string; origin: string }[] }) {
  return (
    <Panel title="الأحداث">
      {events.length === 0 ? <p className="muted">لا توجد أحداث.</p> : events.map((event) => <div key={event.id}><span className="mono">{formatDateTime(event.created_at)}</span> — {event.message} <span className="muted">({event.origin})</span></div>)}
    </Panel>
  );
}

function useMission() {
  const { id = "" } = useParams();
  const { backend } = useSession();
  const query = useQuery({ queryKey: ["mission", id], enabled: Boolean(backend && id), queryFn: () => loadMissionBundle(backend!.db, id) });
  if (query.isLoading) return { state: "loading" as const };
  if (!query.data) return { state: "missing" as const };
  return { state: "ready" as const, data: { ...query.data, isSimulationLabel: query.data.mission.is_simulation ? "وضع المحاكاة — البيانات تجريبية" : "سجل غير متصل بجهاز" } };
}
