import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/app/session";
import { Button, EmptyState, ErrorState, Field, InspectionBadge, Loading, MethodText, PageHeader, Pager, Panel, RiskBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { methodLabel, responseLabel } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { recommendInspectionMethods } from "@/lib/recommendations";
import { scoreChecklist } from "@/lib/scoring";
import { inspectionWizardSchema, type InspectionWizardInput } from "@/lib/validation";
import { loadCatalog, loadInspectionBundle } from "@/services/platform/queries";
import type { ChecklistResponse, Severity } from "@/types/domain";

export function InspectionListPage() {
  const { backend } = useSession();
  const query = useQuery({ queryKey: ["catalog"], enabled: Boolean(backend), queryFn: () => loadCatalog(backend!.db) });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [risk, setRisk] = useState("");
  const [facility, setFacility] = useState("");
  const [inspector, setInspector] = useState("");
  const [sort, setSort] = useState<"created_at" | "planned_at" | "code">("created_at");
  const [page, setPage] = useState(1);
  const { profile } = useSession();
  if (!query.data) return <Loading />;
  const rows = query.data.inspections.filter((item) => {
    const haystack = `${item.code} ${item.inspection_type}`.toLowerCase();
    if (search && !haystack.includes(search.toLowerCase())) return false;
    if (status && item.status !== status) return false;
    if (risk && item.risk_level !== risk) return false;
    if (facility && item.facility_id !== facility) return false;
    if (inspector && item.assigned_inspector_id !== inspector) return false;
    return true;
  }).sort((a, b) => String(b[sort] ?? "").localeCompare(String(a[sort] ?? "")));
  const pages = Math.max(1, Math.ceil(rows.length / 8));
  const visible = rows.slice((page - 1) * 8, page * 8);
  return (
    <>
      <PageHeader title="التفتيشات" subtitle="دورة التفتيش من المسودة حتى التقرير." actions={can(profile?.role_code, "inspections.create") ? <Link className="btn-primary" style={{ display: "inline-grid", placeItems: "center" }} to="/inspections/new">إنشاء تفتيش</Link> : null} />
      <div className="filters">
        <input className="input" placeholder="بحث بالرمز أو النوع" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        <select className="select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">كل الحالات</option>{["DRAFT","SCHEDULED","READY","IN_PROGRESS","REVIEW_REQUIRED","COMPLETED","FOLLOW_UP_REQUIRED","CLOSED","CANCELLED"].map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <select className="select" value={risk} onChange={(event) => setRisk(event.target.value)}><option value="">كل مستويات الخطورة</option><option value="normal">عادي</option><option value="medium">متوسط</option><option value="high">مرتفع</option></select>
        <select className="select" value={facility} onChange={(event) => setFacility(event.target.value)}><option value="">كل المنشآت</option>{query.data.facilities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select className="select" value={inspector} onChange={(event) => setInspector(event.target.value)}><option value="">كل المفتشين</option>{query.data.profiles.filter((item) => item.role_code !== "OPERATOR").map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select>
        <select className="select" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="created_at">الأحدث</option><option value="planned_at">الموعد</option><option value="code">الرمز</option></select>
      </div>
      <Panel>
        {visible.length === 0 ? <EmptyState title="لا توجد تفتيشات مطابقة" body="عدّل التصفية أو أنشئ تفتيشًا جديدًا." /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>الرمز</th><th>النوع</th><th>الخطورة</th><th>الأسلوب</th><th>الموعد</th><th>الحالة</th></tr></thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.id} className="clickable" onClick={() => window.location.assign(`/inspections/${item.id}`)}>
                  <td className="mono">{item.code}</td><td>{item.inspection_type}</td><td><RiskBadge risk={item.risk_level} /></td><td><MethodText method={item.method} /></td><td>{formatDateTime(item.planned_at)}</td><td><InspectionBadge status={item.status} /></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        <Pager page={page} pages={pages} onPage={setPage} />
      </Panel>
    </>
  );
}

const STEPS = ["المنشأة", "المنطقة", "تقييم الخطورة", "أسلوب التفتيش", "قائمة الفحص", "التعيين", "المراجعة", "الإنشاء"];

export function InspectionWizardPage() {
  const { backend, actor, profile } = useSession();
  const catalog = useQuery({ queryKey: ["catalog"], enabled: Boolean(backend), queryFn: () => loadCatalog(backend!.db) });
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<InspectionWizardInput>({
    resolver: zodResolver(inspectionWizardSchema),
    defaultValues: {
      facility_id: params.get("facility") ?? "",
      site_id: "",
      sector_id: "",
      zone_id: params.get("zone") ?? "",
      equipment_id: params.get("equipment"),
      inspection_type: "تفتيش دوري",
      method: "drone_human",
      template_id: "",
      assigned_inspector_id: profile?.role_code === "OPERATOR" ? "" : profile?.id ?? "",
      device_id: null,
      planned_at: new Date().toISOString().slice(0, 16),
      risk_acknowledgement: null,
      notes: null,
    },
  });
  if (!catalog.data || !actor) return <Loading />;
  const values = form.watch();
  const sites = catalog.data.sites.filter((item) => item.facility_id === values.facility_id);
  const sectors = catalog.data.sectors.filter((item) => item.site_id === values.site_id);
  const zones = catalog.data.inspection_zones.filter((item) => item.sector_id === values.sector_id || item.id === values.zone_id);
  const zone = catalog.data.inspection_zones.find((item) => item.id === values.zone_id);
  const equipment = catalog.data.equipment.filter((item) => !values.zone_id || item.zone_id === values.zone_id);
  const advice = zone ? recommendInspectionMethods(zone) : null;
  const kind = values.method === "drone" || values.method === "drone_human" ? "drone" : values.method === "robot" || values.method === "robot_human" ? "robot" : null;
  const devices = kind === "drone" ? catalog.data.drones : kind === "robot" ? catalog.data.robots : [];
  const inspectors = catalog.data.profiles.filter((item) => item.is_active && item.role_code !== "OPERATOR");

  async function next() {
    const fields: (keyof InspectionWizardInput)[][] = [
      ["facility_id", "site_id", "sector_id"],
      ["zone_id"],
      [],
      ["method"],
      ["template_id"],
      ["assigned_inspector_id", "planned_at"],
      [],
      [],
    ];
    const ok = fields[step].length ? await form.trigger(fields[step]) : true;
    if (!ok) return;
    if (step === 2 && advice?.requiresAcknowledgement && values.method === "human" && (values.risk_acknowledgement ?? "").trim().length < 8) {
      setError("يلزم إقرار صريح قبل اختيار الدخول البشري لمنطقة عالية الخطورة.");
      return;
    }
    setError(null);
    setStep((value) => Math.min(7, value + 1));
  }

  return (
    <>
      <PageHeader title="إنشاء تفتيش" subtitle="البيانات تبقى في النموذج عند الرجوع بين الخطوات." />
      <div className="steps">{STEPS.map((label, index) => <span key={label} className={`step-pill ${index === step ? "on" : ""}`}>{index + 1}. {label}</span>)}</div>
      <Panel>
        <form className="grid" onSubmit={form.handleSubmit(async (input) => {
          setError(null);
          try {
            const result = await backend!.platform.createInspection(actor, { ...input, planned_at: new Date(input.planned_at).toISOString(), equipment_id: input.equipment_id || null, device_id: input.device_id || null });
            navigate(result.mission ? `/missions/${result.mission.id}/control` : `/inspections/${result.inspection.id}`);
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "تعذر الإنشاء");
          }
        })}>
          {step === 0 && (
            <div className="grid cols-3">
              <Field label="المنشأة"><select className="select" {...form.register("facility_id")}><option value="">اختر</option>{catalog.data.facilities.filter((item) => item.status === "active").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
              <Field label="الموقع"><select className="select" {...form.register("site_id")}><option value="">اختر</option>{sites.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
              <Field label="القطاع"><select className="select" {...form.register("sector_id")}><option value="">اختر</option>{sectors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
            </div>
          )}
          {step === 1 && (
            <div className="grid cols-2">
              <Field label="المنطقة"><select className="select" {...form.register("zone_id")}><option value="">اختر</option>{zones.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
              <Field label="المعدة"><select className="select" value={values.equipment_id ?? ""} onChange={(event) => form.setValue("equipment_id", event.target.value || null)}><option value="">بدون تحديد</option>{equipment.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></Field>
            </div>
          )}
          {step === 2 && zone && advice && (
            <div className="grid">
              <div>الخطورة: <RiskBadge risk={zone.risk_level} /></div>
              <div>الدخول البشري: {zone.human_access === "prohibited" ? "ممنوع" : zone.human_access === "restricted" ? "مقيّد" : "مسموح"}</div>
              <div>المخاطر: {zone.hazard_categories.join("، ") || "—"}</div>
              <div>الوقاية: {zone.required_ppe.join("، ") || "—"}</div>
              <p>{advice.advisory}</p>
              <p className="muted">{zone.safety_notes}</p>
              {advice.requiresAcknowledgement ? <Field label="إقرار إذا اختير الدخول البشري"><textarea className="textarea" {...form.register("risk_acknowledgement")} placeholder="أقر بأن التوجيه استشاري وأن الدخول يخضع لإجراء المنشأة" /></Field> : null}
            </div>
          )}
          {step === 3 && (
            <div className="grid">
              {Object.entries(methodLabel).map(([key, label]) => (
                <label key={key} style={{ display: "flex", gap: 8 }}>
                  <input type="radio" value={key} {...form.register("method")} /> {label}
                  {advice?.recommended.includes(key as never) ? <span className="badge ok">موصى به</span> : null}
                  {advice?.discouraged.includes(key as never) ? <span className="badge warn">غير مفضل</span> : null}
                </label>
              ))}
            </div>
          )}
          {step === 4 && (
            <Field label="القالب"><select className="select" {...form.register("template_id")}><option value="">اختر</option>{catalog.data.inspection_templates.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          )}
          {step === 5 && (
            <div className="grid cols-2">
              <Field label="المفتش"><select className="select" {...form.register("assigned_inspector_id")}><option value="">اختر</option>{inspectors.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></Field>
              <Field label="الموعد"><input className="input" type="datetime-local" {...form.register("planned_at")} /></Field>
              {kind ? <Field label="الجهاز المتاح"><select className="select" value={values.device_id ?? ""} onChange={(event) => form.setValue("device_id", event.target.value || null)}><option value="">اختر</option>{devices.filter((item) => item.operational_status === "available").map((item) => <option key={item.id} value={item.id}>{item.code} — {item.current_battery}%</option>)}</select></Field> : <p className="muted">لا يُسنَد جهاز للتفتيش البشري.</p>}
              <Field label="ملاحظات"><textarea className="textarea" {...form.register("notes")} /></Field>
            </div>
          )}
          {step >= 6 && (
            <div className="grid">
              <Summary label="الأسلوب" value={methodLabel[values.method]} />
              <Summary label="المنطقة" value={zone?.name ?? "—"} />
              <Summary label="القالب" value={catalog.data.inspection_templates.find((item) => item.id === values.template_id)?.name ?? "—"} />
              <Summary label="الجهاز" value={devices.find((item) => item.id === values.device_id)?.code ?? "بدون"} />
              {step === 7 ? <p>سيُحفظ التفتيش، وتُنشأ مهمة محاكاة إذا كان الأسلوب يعتمد جهازًا. لن يُرسل أمر إلى جهاز فعلي.</p> : null}
            </div>
          )}
          {error ? <ErrorState message={error} /> : null}
          <div className="actions">
            <Button type="button" disabled={step === 0} onClick={() => setStep((value) => value - 1)}>السابق</Button>
            {step < 7 ? <Button variant="primary" type="button" onClick={() => void next()}>التالي</Button> : <Button variant="primary" type="submit">إنشاء وحفظ</Button>}
          </div>
        </form>
      </Panel>
    </>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div><span className="muted">{label}: </span>{value}</div>;
}

export function InspectionDetailPage() {
  const { id = "" } = useParams();
  const { backend, actor, profile } = useSession();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["inspection", id], enabled: Boolean(backend && id), queryFn: () => loadInspectionBundle(backend!.db, id) });
  const [error, setError] = useState<string | null>(null);
  if (query.isLoading) return <Loading />;
  if (!query.data?.inspection || !actor) return <EmptyState title="التفتيش غير موجود" />;
  const bundle = query.data;
  const score = scoreChecklist(bundle.items, bundle.template?.scoring_rules ?? {});
  async function run(action: () => Promise<unknown>) {
    setError(null);
    try { await action(); await queryClient.invalidateQueries(); } catch (caught) { setError(caught instanceof Error ? caught.message : "تعذر التنفيذ"); }
  }
  return (
    <>
      <PageHeader title={bundle.inspection.code} subtitle={bundle.inspection.inspection_type} actions={
        <>
          <Link className="btn" to={`/inspections/${id}/checklist`}>قائمة الفحص</Link>
          <Link className="btn" to={`/inspections/${id}/field`}>وضع ميداني</Link>
          {bundle.missions[0] ? <Link className="btn" to={`/missions/${bundle.missions[0].id}/control`}>مركز المهمة</Link> : null}
          {can(profile?.role_code, "reports.generate") ? <Button variant="primary" onClick={() => void run(() => backend!.platform.generateReport(actor, id))}>إصدار تقرير</Button> : null}
          {can(profile?.role_code, "inspections.complete") ? <Button onClick={() => void run(() => backend!.platform.finalizeInspection(actor, id))}>إنهاء التفتيش</Button> : null}
          {can(profile?.role_code, "inspections.cancel") ? <Button variant="danger" onClick={() => void run(() => backend!.platform.cancelInspection(actor, id))}>إلغاء</Button> : null}
        </>
      } />
      {error ? <ErrorState message={error} /> : null}
      <div className="grid cols-3">
        <Panel title="النطاق"><p>{bundle.facility?.name}</p><p>{bundle.site?.name} / {bundle.sector?.name}</p><p>{bundle.zone?.name}</p><p>{bundle.equipment ? `${bundle.equipment.code} — ${bundle.equipment.name}` : "بدون معدة محددة"}</p></Panel>
        <Panel title="التنفيذ"><p><MethodText method={bundle.inspection.method} /></p><p><RiskBadge risk={bundle.inspection.risk_level} /> <InspectionBadge status={bundle.inspection.status} /></p><p>المفتش: {bundle.inspector?.full_name ?? "غير مسجل"}</p><p>البداية: {formatDateTime(bundle.inspection.started_at)}</p><p>الإنهاء: {formatDateTime(bundle.inspection.completed_at)}</p></Panel>
        <Panel title="الدرجة المحسوبة">
          <div className="value">{score.overall == null ? "بانتظار البنود" : `${score.overall}%`}</div>
          <div>{score.band ?? ""}</div>
          {score.hasCriticalFailure ? <div className="banner">الدرجة لا تُلغي وجود بند حرج غير مطابق.</div> : null}
          {score.categories.map((item) => <div key={item.category}>{item.category}: {item.score}%</div>)}
        </Panel>
      </div>
      <Panel title="الخط الزمني">
        {bundle.audits.length === 0 && bundle.events.length === 0 ? <p className="muted">لا توجد أحداث.</p> : null}
        {[...bundle.events.map((event) => ({ at: event.created_at, text: event.message })), ...bundle.audits.map((event) => ({ at: event.created_at, text: event.action }))].sort((a, b) => a.at.localeCompare(b.at)).map((event) => (
          <div key={`${event.at}-${event.text}`} style={{ padding: "6px 0" }}><span className="mono">{formatDateTime(event.at)}</span> — {event.text}</div>
        ))}
      </Panel>
      <Panel title="التقارير">
        {bundle.reports.length === 0 ? <p className="muted">لم يُصدر تقرير بعد.</p> : bundle.reports.map((report) => <Link key={report.id} to={`/reports/${report.id}`}>{report.code} — مراجعة {report.revision}</Link>)}
      </Panel>
    </>
  );
}

export function ChecklistPage() {
  const { id = "" } = useParams();
  const { backend, actor } = useSession();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["inspection", id], enabled: Boolean(backend && id), queryFn: () => loadInspectionBundle(backend!.db, id) });
  if (!query.data?.inspection || !actor) return query.isLoading ? <Loading /> : <EmptyState title="القائمة غير متاحة" />;
  const score = scoreChecklist(query.data.items, query.data.template?.scoring_rules ?? {});
  return (
    <>
      <PageHeader title="قائمة الفحص" subtitle={`${query.data.inspection.code} — الإكمال ${Math.round(score.completionRatio * 100)}%`} />
      <Panel>
        <strong>{score.overall == null ? "لا توجد درجة قبل الإجابة" : `${score.overall}% ${score.band ?? ""}`}</strong>
        {query.data.items.sort((a, b) => a.sort_order - b.sort_order).map((item) => (
          <ChecklistEditor key={item.id} itemId={item.id} category={item.category} label={item.label} response={item.response} notes={item.notes} numeric={item.numeric_value} unit={item.numeric_unit} critical={item.critical} onSave={async (patch) => { await backend!.platform.saveChecklistItem(actor, item.id, patch); await queryClient.invalidateQueries(); }} />
        ))}
      </Panel>
    </>
  );
}

export function FieldInspectionPage() {
  const { id = "" } = useParams();
  const { backend, actor } = useSession();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["inspection", id], enabled: Boolean(backend && id), queryFn: () => loadInspectionBundle(backend!.db, id) });
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!query.data?.zone || !actor) return query.isLoading ? <Loading /> : <EmptyState title="التفتيش غير متاح" />;
  return (
    <div style={{ maxWidth: 760, marginInline: "auto" }}>
      <PageHeader title="تفتيش ميداني" subtitle="أزرار كبيرة للجهاز اللوحي. لا يوجد وضع دون اتصال حتى تكتمل المزامنة." />
      <Panel title="تعليمات السلامة">
        <p>{query.data.zone.safety_notes}</p>
        <p>الوقاية: {query.data.zone.required_ppe.join("، ")}</p>
      </Panel>
      {query.data.items.map((item) => (
        <div key={item.id} className="panel" style={{ marginTop: 10 }}>
          <strong>{item.label}</strong>
          <div className="muted">{item.category}{item.critical ? " — بند حرج" : ""}</div>
          <div className="choice" style={{ marginTop: 8 }}>
            {(["pass", "fail", "needs_review", "not_applicable"] as ChecklistResponse[]).map((response) => (
              <Button key={response} aria-pressed={item.response === response} style={{ minHeight: 52 }} onClick={() => void backend!.platform.saveChecklistItem(actor, item.id, { response }).then(() => queryClient.invalidateQueries())}>{responseLabel[response]}</Button>
            ))}
          </div>
        </div>
      ))}
      <Panel title="ملاحظة">
        <textarea className="textarea" value={note} onChange={(event) => setNote(event.target.value)} />
        <div className="actions" style={{ marginTop: 8 }}>
          <Button onClick={() => void backend!.platform.addObservation(actor, { inspection_id: id, category: "manual_observation", description: note, severity: "low" }).then(() => setNote(""))}>حفظ الملاحظة</Button>
          <label className="btn" style={{ display: "inline-grid", placeItems: "center" }}>
            رفع دليل
            <input hidden type="file" accept="image/*,video/mp4,application/pdf" capture="environment" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void backend!.platform.uploadEvidence(actor, { inspectionId: id, file, fileName: file.name }).catch((caught) => setError(caught instanceof Error ? caught.message : "فشل الرفع"));
            }} />
          </label>
          <Button variant="primary" onClick={() => void backend!.platform.finalizeInspection(actor, id).catch((caught) => setError(caught instanceof Error ? caught.message : "تعذر الإنهاء"))}>إرسال للإنهاء</Button>
        </div>
        {error ? <ErrorState message={error} /> : null}
      </Panel>
    </div>
  );
}

function ChecklistEditor({ itemId, category, label, response, notes, numeric, unit, critical, onSave }: { itemId: string; category: string; label: string; response: ChecklistResponse | null; notes: string | null; numeric: number | null; unit: string | null; critical: boolean; onSave: (patch: { response: ChecklistResponse; notes: string | null; numeric_value: number | null; severity: Severity | null }) => Promise<void> }) {
  const [localNotes, setLocalNotes] = useState(notes ?? "");
  const [localNumber, setLocalNumber] = useState(numeric?.toString() ?? "");
  const [severity, setSeverity] = useState<Severity | "">("");
  void itemId;
  return (
    <div className="check-row">
      <div><strong>{label}</strong> <span className="muted">{category}{critical ? " — حرج" : ""}</span></div>
      <div className="choice">
        {(["pass", "fail", "needs_review", "not_applicable"] as ChecklistResponse[]).map((option) => (
          <Button key={option} aria-pressed={response === option} onClick={() => void onSave({ response: option, notes: localNotes || null, numeric_value: localNumber ? Number(localNumber) : null, severity: severity || null })}>{responseLabel[option]}</Button>
        ))}
      </div>
      {unit ? <Field label={`قراءة (${unit})`}><input className="input" value={localNumber} onChange={(event) => setLocalNumber(event.target.value)} /></Field> : null}
      <Field label="ملاحظة"><input className="input" value={localNotes} onChange={(event) => setLocalNotes(event.target.value)} /></Field>
      <Field label="الشدة عند عدم المطابقة"><select className="select" value={severity} onChange={(event) => setSeverity(event.target.value as Severity | "")}><option value="">—</option><option value="low">منخفض</option><option value="medium">متوسط</option><option value="high">عالٍ</option><option value="critical">حرج</option></select></Field>
    </div>
  );
}

