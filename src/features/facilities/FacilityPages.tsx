import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/app/session";
import { Button, EmptyState, ErrorState, Field, InspectionBadge, Loading, Modal, PageHeader, Panel, RiskBadge } from "@/components/ui";
import { facilitySchema } from "@/lib/validation";
import { can } from "@/lib/permissions";
import { loadCatalog, loadFacilityBundle } from "@/services/platform/queries";
import type { Equipment, InspectionZone } from "@/types/domain";

export function FacilityListPage() {
  const { backend, actor, profile } = useSession();
  const query = useQuery({ queryKey: ["catalog"], enabled: Boolean(backend), queryFn: () => loadCatalog(backend!.db) });
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const form = useForm({ resolver: zodResolver(facilitySchema), defaultValues: { name: "", code: "", facility_type: "تخزين ونقل", description: "", address: "", status: "active" as const } });
  if (!query.data || !actor) return <Loading />;
  const rows = query.data.facilities.filter((item) => `${item.name} ${item.code}`.includes(search));
  return (
    <>
      <PageHeader title="المنشآت" actions={can(profile?.role_code, "facilities.manage") ? <Button variant="primary" onClick={() => setOpen(true)}>منشأة جديدة</Button> : null} />
      <input className="input" placeholder="بحث" value={search} onChange={(event) => setSearch(event.target.value)} />
      <Panel>
        {rows.length === 0 ? <EmptyState title="لا توجد منشآت" /> : rows.map((item) => (
          <Link key={item.id} to={`/facilities/${item.id}`} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
            <span>{item.name} <span className="mono">{item.code}</span></span><span className="badge">{item.status === "archived" ? "مؤرشف" : item.status === "active" ? "نشط" : "غير نشط"}</span>
          </Link>
        ))}
      </Panel>
      {open ? <Modal title="منشأة" onClose={() => setOpen(false)}>
        <form className="grid" onSubmit={form.handleSubmit(async (values) => {
          setError(null);
          try {
            await backend!.platform.createFacility(actor, values);
            setOpen(false);
            await queryClient.invalidateQueries();
          } catch (caught) { setError(caught instanceof Error ? caught.message : "تعذر الحفظ"); }
        })}>
          <Field label="الاسم" error={form.formState.errors.name?.message}><input className="input" {...form.register("name")} /></Field>
          <Field label="الرمز" error={form.formState.errors.code?.message}><input className="input" {...form.register("code")} /></Field>
          <Field label="النوع"><input className="input" {...form.register("facility_type")} /></Field>
          <Field label="الوصف"><textarea className="textarea" {...form.register("description")} /></Field>
          <Field label="العنوان"><input className="input" {...form.register("address")} /></Field>
          {error ? <ErrorState message={error} /> : null}
          <Button variant="primary" type="submit">حفظ</Button>
        </form>
      </Modal> : null}
    </>
  );
}

export function FacilityDetailPage() {
  const { id = "" } = useParams();
  const { backend, actor, profile } = useSession();
  const query = useQuery({ queryKey: ["facility", id], enabled: Boolean(backend && id), queryFn: () => loadFacilityBundle(backend!.db, id) });
  const [tab, setTab] = useState<"overview" | "sites" | "equipment" | "zones" | "inspections" | "reports">("overview");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  if (query.isLoading) return <Loading />;
  if (!query.data || !actor) return <EmptyState title="المنشأة غير موجودة" />;
  const data = query.data;
  return (
    <>
      <PageHeader title={data.facility.name} subtitle={data.facility.code} actions={
        <>
          <Link className="btn" to={`/facilities/${id}/layout`}>المخطط</Link>
          {can(profile?.role_code, "facilities.manage") ? <Button variant="danger" onClick={() => void backend!.platform.archiveFacility(actor, id).then(() => queryClient.invalidateQueries()).catch((caught) => setError(caught instanceof Error ? caught.message : "تعذر الأرشفة"))}>أرشفة</Button> : null}
        </>
      } />
      {error ? <ErrorState message={error} /> : null}
      <div className="tabs">
        {[["overview", "نظرة عامة"], ["sites", "المواقع والقطاعات"], ["equipment", "المعدات"], ["zones", "المناطق"], ["inspections", "التفتيشات"], ["reports", "التقارير"]].map(([key, label]) => <button key={key} className={`tab ${tab === key ? "on" : ""}`} onClick={() => setTab(key as typeof tab)}>{label}</button>)}
      </div>
      {tab === "overview" && <Panel><p>{data.facility.description}</p><p>{data.facility.address ?? "لا يوجد عنوان"}</p><p className="muted">لا تُعرض إحداثيات جغرافية لأن المنشأة لا تملك إحداثيات مخزنة.</p><p>النوع: {data.facility.facility_type}</p></Panel>}
      {tab === "sites" && <Hierarchy data={data} canEdit={can(profile?.role_code, "facilities.manage")} />}
      {tab === "equipment" && <Panel>{data.equipment.map((item) => <Link key={item.id} to={`/equipment/${item.id}`} style={{ display: "block", padding: "6px 0" }}>{item.code} — {item.name}</Link>)}</Panel>}
      {tab === "zones" && <Panel>{data.zones.map((item) => <Link key={item.id} to={`/zones/${item.id}`} style={{ display: "flex", justifyContent: "space-between" }}><span>{item.name}</span><RiskBadge risk={item.risk_level} /></Link>)}</Panel>}
      {tab === "inspections" && <Panel>{data.inspections.map((item) => <Link key={item.id} to={`/inspections/${item.id}`} style={{ display: "flex", justifyContent: "space-between" }}><span className="mono">{item.code}</span><InspectionBadge status={item.status} /></Link>)}</Panel>}
      {tab === "reports" && <Panel>{data.reports.length === 0 ? <p className="muted">لا توجد تقارير.</p> : data.reports.map((item) => <Link key={item.id} to={`/reports/${item.id}`}>{item.code}</Link>)}</Panel>}
    </>
  );
}

function Hierarchy({ data, canEdit }: { data: NonNullable<Awaited<ReturnType<typeof loadFacilityBundle>>>; canEdit: boolean }) {
  const { backend, actor } = useSession();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  if (!actor) return null;
  return (
    <Panel title="المواقع والقطاعات">
      {data.sites.map((site) => (
        <div key={site.id}>
          <strong>{site.name}</strong>
          {data.sectors.filter((sector) => sector.site_id === site.id).map((sector) => <div key={sector.id} className="muted">{sector.name}</div>)}
        </div>
      ))}
      {canEdit ? <form className="grid cols-3" onSubmit={(event) => { event.preventDefault(); void backend!.platform.saveSite(actor, { facility_id: data.facility.id, name, code }).then(() => queryClient.invalidateQueries()); }}>
        <input className="input" placeholder="اسم موقع" value={name} onChange={(event) => setName(event.target.value)} />
        <input className="input" placeholder="رمز" value={code} onChange={(event) => setCode(event.target.value)} />
        <Button type="submit">إضافة موقع</Button>
      </form> : null}
    </Panel>
  );
}

export function FacilityLayoutPage() {
  const { id = "" } = useParams();
  const { backend, actor, profile } = useSession();
  const query = useQuery({ queryKey: ["facility", id], enabled: Boolean(backend && id), queryFn: () => loadFacilityBundle(backend!.db, id) });
  const [selected, setSelected] = useState<string | null>(null);
  const queryClient = useQueryClient();
  if (!query.data || !actor) return query.isLoading ? <Loading /> : <EmptyState title="لا يوجد مخطط" />;
  const equipment = query.data.equipment.find((item) => item.id === selected) ?? null;
  return (
    <>
      <PageHeader title="مخطط المنشأة" subtitle="مواضع المعدات وحدود المناطق مخزنة كبيانات، والمخطط تخطيطي وليس خريطة جغرافية." />
      <div className="grid cols-3">
        <div style={{ gridColumn: "span 2" }}>
          <FacilitySvg zones={query.data.zones} equipment={query.data.equipment} selected={selected} onSelect={setSelected} />
        </div>
        <Panel title={equipment ? equipment.code : "أصل"}>
          {equipment ? <AssetCard equipment={equipment} inspections={query.data.inspections.filter((item) => item.equipment_id === equipment.id)} canEdit={can(profile?.role_code, "equipment.manage")} onSave={async (patch) => { await backend!.platform.saveEquipment(actor, { ...equipment, ...patch }); await queryClient.invalidateQueries(); }} /> : <p className="muted">اختر أصلًا من المخطط.</p>}
        </Panel>
      </div>
    </>
  );
}

export function EquipmentListPage() {
  const { backend } = useSession();
  const query = useQuery({ queryKey: ["catalog"], enabled: Boolean(backend), queryFn: () => loadCatalog(backend!.db) });
  if (!query.data) return <Loading />;
  return (
    <>
      <PageHeader title="المعدات" />
      <Panel>{query.data.equipment.map((item) => <Link key={item.id} to={`/equipment/${item.id}`} style={{ display: "block", padding: "8px 0" }}>{item.code} — {item.name}</Link>)}</Panel>
    </>
  );
}

export function EquipmentDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { backend } = useSession();
  const query = useQuery({ queryKey: ["catalog"], enabled: Boolean(backend), queryFn: () => loadCatalog(backend!.db) });
  if (!query.data) return <Loading />;
  const equipment = query.data.equipment.find((item) => item.id === id);
  if (!equipment) return <EmptyState title="المعدة غير موجودة" />;
  const inspections = query.data.inspections.filter((item) => item.equipment_id === id);
  return (
    <>
      <PageHeader title={`${equipment.code}`} subtitle={equipment.name} actions={<Button variant="primary" onClick={() => navigate(`/inspections/new?facility=${equipment.facility_id}&zone=${equipment.zone_id ?? ""}&equipment=${equipment.id}`)}>تفتيش جديد</Button>} />
      <Panel>
        <p>النوع: {equipment.equipment_type}</p>
        <p>الحالة: {equipment.status}</p>
        <RiskBadge risk={equipment.risk_level} />
        <p>آخر تفتيش: {equipment.last_inspection_at ?? "لا يوجد"}</p>
        {inspections.map((item) => <Link key={item.id} to={`/inspections/${item.id}`}>{item.code}</Link>)}
      </Panel>
    </>
  );
}

export function ZoneListPage() {
  const { backend } = useSession();
  const query = useQuery({ queryKey: ["catalog"], enabled: Boolean(backend), queryFn: () => loadCatalog(backend!.db) });
  if (!query.data) return <Loading />;
  return (
    <>
      <PageHeader title="المناطق الخطرة" />
      <Panel>{query.data.inspection_zones.map((zone) => <Link key={zone.id} to={`/zones/${zone.id}`} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}><span>{zone.name}</span><RiskBadge risk={zone.risk_level} /></Link>)}</Panel>
    </>
  );
}

export function ZoneDetailPage() {
  const { id = "" } = useParams();
  const { backend } = useSession();
  const query = useQuery({ queryKey: ["catalog"], enabled: Boolean(backend), queryFn: () => loadCatalog(backend!.db) });
  if (!query.data) return <Loading />;
  const zone = query.data.inspection_zones.find((item) => item.id === id);
  if (!zone) return <EmptyState title="المنطقة غير موجودة" />;
  const facility = query.data.facilities.find((item) => item.id === zone.facility_id);
  const sector = query.data.sectors.find((item) => item.id === zone.sector_id);
  const missions = query.data.missions.filter((item) => item.zone_id === zone.id && !["COMPLETED", "CANCELLED", "FAILED"].includes(item.status));
  const devices = [...query.data.drones, ...query.data.robots].filter((item) => item.operational_status === "available");
  return (
    <>
      <PageHeader title={zone.name} subtitle={`${facility?.name ?? ""} — ${sector?.name ?? ""}`} actions={<Link className="btn-primary" to={`/inspections/new?facility=${zone.facility_id}&zone=${zone.id}`}>إنشاء مهمة تفتيش</Link>} />
      <div className="grid cols-2">
        <Panel title="تصنيف الخطورة">
          <RiskBadge risk={zone.risk_level} />
          <p>نوع الخطر: {zone.hazard_categories.join("، ") || "—"}</p>
          <p>سياسة الدخول: {zone.human_access === "prohibited" ? "ممنوع على الأفراد" : zone.human_access === "restricted" ? "مقيّد" : "مسموح"}</p>
          <p>الأسلوب الموصى به استشاريًا: {zone.recommended_method}</p>
          <p>الوقاية: {zone.required_ppe.join("، ")}</p>
          <p>{zone.safety_notes}</p>
          <div className="banner">التوصية لا تصرّح تلقائيًا بأي عملية داخل المنطقة.</div>
        </Panel>
        <Panel title="التشغيل">
          <p>الأجهزة المتاحة: {devices.map((item) => item.code).join("، ") || "لا يوجد"}</p>
          <p>مهام حالية: {missions.length === 0 ? "لا توجد" : missions.map((item) => item.code).join("، ")}</p>
        </Panel>
      </div>
    </>
  );
}

function FacilitySvg({ zones, equipment, selected, onSelect }: { zones: InspectionZone[]; equipment: Equipment[]; selected: string | null; onSelect: (id: string) => void }) {
  const fill: Record<string, string> = { high: "rgba(225,91,76,.25)", medium: "rgba(224,162,58,.25)", normal: "rgba(61,222,200,.18)" };
  return (
    <svg viewBox="0 0 100 100" className="layout-map">
      {zones.map((zone) => <polygon key={zone.id} points={zone.boundary.points.map((point) => `${point.x},${point.y}`).join(" ")} fill={fill[zone.risk_level]} stroke="#8ea0b3" />)}
      {equipment.map((item) => (
        <g key={item.id} onClick={() => onSelect(item.id)} style={{ cursor: "pointer" }}>
          {item.equipment_type === "tank" ? <circle cx={item.position_x ?? 0} cy={item.position_y ?? 0} r="4.2" fill={selected === item.id ? "#e4b15a" : "#163246"} stroke="#3ddec8" /> : null}
          {item.equipment_type === "pipeline" ? <line x1={(item.position_x ?? 0) - 8} y1={item.position_y ?? 0} x2={(item.position_x ?? 0) + 8} y2={item.position_y ?? 0} stroke="#8ea0b3" strokeWidth="1.4" /> : null}
          {item.equipment_type === "valve" ? <rect x={(item.position_x ?? 0) - 2} y={(item.position_y ?? 0) - 2} width="4" height="4" transform={`rotate(45 ${item.position_x} ${item.position_y})`} fill="#e4b15a" /> : null}
          {item.equipment_type === "tower" ? <rect x={(item.position_x ?? 0) - 1.5} y={(item.position_y ?? 0) - 6} width="3" height="10" fill="#3ddec8" /> : null}
          <text x={(item.position_x ?? 0) + 5} y={item.position_y ?? 0} fill="#e7eef4" fontSize="3">{item.code}</text>
        </g>
      ))}
    </svg>
  );
}

function AssetCard({ equipment, inspections, canEdit, onSave }: { equipment: Equipment; inspections: { id: string; code: string; status: string }[]; canEdit: boolean; onSave: (patch: { position_x: number; position_y: number }) => Promise<void> }) {
  const [x, setX] = useState(String(equipment.position_x ?? ""));
  const [y, setY] = useState(String(equipment.position_y ?? ""));
  return (
    <div className="grid">
      <div>{equipment.name}</div>
      <div>النوع: {equipment.equipment_type}</div>
      <div>الحالة: {equipment.status}</div>
      <RiskBadge risk={equipment.risk_level} />
      <div>آخر تفتيش: {equipment.last_inspection_at ?? "لا يوجد"}</div>
      {inspections.map((item) => <Link key={item.id} to={`/inspections/${item.id}`}>{item.code}</Link>)}
      <Link className="btn-primary" style={{ display: "inline-grid", placeItems: "center" }} to={`/inspections/new?facility=${equipment.facility_id}&zone=${equipment.zone_id ?? ""}&equipment=${equipment.id}`}>تفتيش جديد</Link>
      {canEdit ? <form className="grid" onSubmit={(event) => { event.preventDefault(); void onSave({ position_x: Number(x), position_y: Number(y) }); }}>
        <Field label="X"><input className="input" value={x} onChange={(event) => setX(event.target.value)} /></Field>
        <Field label="Y"><input className="input" value={y} onChange={(event) => setY(event.target.value)} /></Field>
        <Button type="submit">حفظ الموضع</Button>
      </form> : null}
    </div>
  );
}
