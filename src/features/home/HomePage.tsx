import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/app/session";
import { InspectionBadge, Loading, PageHeader, Panel, RiskBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import { loadDashboard } from "@/services/platform/queries";

export function HomePage() {
  const { backend, profile } = useSession();
  const query = useQuery({ queryKey: ["dashboard"], enabled: Boolean(backend), queryFn: () => loadDashboard(backend!.db) });
  if (!query.data) return <Loading />;
  const { state, metrics, recentInspections, activeMissions } = query.data;
  const timezone = String(state.settings.find((item) => item.id === "timezone")?.value ?? "Asia/Riyadh");
  return (
    <>
      <PageHeader title={`مرحبًا ${profile?.full_name ?? ""}`} subtitle="غرفة عمليات التفتيش. الآلة تدخل المنطقة الخطرة، والمفتش يبقى في موقع آمن." actions={can(profile?.role_code, "inspections.create") ? <Link className="btn-primary" style={{ display: "inline-grid", placeItems: "center" }} to="/inspections/new">تفتيش جديد</Link> : null} />
      <div className="banner sim">وضع العرض المحلي يحفظ البيانات في هذا المتصفح. الاتصال بالدرون أو الروبوت أو التحليل الآلي غير مُفعّل.</div>
      <div className="grid cols-4">
        <Panel><div className="kpi"><div className="muted">تفتيشات نشطة</div><div className="value">{metrics.activeInspections}</div></div></Panel>
        <Panel><div className="kpi"><div className="muted">مهام غير مغلقة</div><div className="value">{activeMissions.length}</div></div></Panel>
        <Panel><div className="kpi"><div className="muted">تنبيهات مفتوحة</div><div className="value">{metrics.unresolvedAlerts}</div></div></Panel>
        <Panel><div className="kpi"><div className="muted">أجهزة متاحة</div><div className="value">{metrics.availableDrones + metrics.availableRobots}</div></div></Panel>
      </div>
      <div className="grid cols-2">
        <Panel title="أحدث التفتيشات">
          {recentInspections.length === 0 ? <p className="muted">لا توجد سجلات.</p> : recentInspections.map((inspection) => (
            <Link key={inspection.id} to={`/inspections/${inspection.id}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <span><span className="mono">{inspection.code}</span> — {inspection.inspection_type}</span>
              <InspectionBadge status={inspection.status} />
            </Link>
          ))}
        </Panel>
        <Panel title="مناطق عالية الخطورة">
          {state.inspection_zones.filter((zone) => zone.risk_level === "high").map((zone) => (
            <Link key={zone.id} to={`/zones/${zone.id}`} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
              <span>{zone.name}</span>
              <RiskBadge risk={zone.risk_level} />
            </Link>
          ))}
          {state.inspection_zones.every((zone) => zone.risk_level !== "high") ? <p className="muted">لا توجد مناطق عالية الخطورة.</p> : null}
        </Panel>
      </div>
      <Panel title="الجدول القريب">
        <div className="table-wrap">
          <table>
            <thead><tr><th>الرمز</th><th>الموعد</th><th>الحالة</th></tr></thead>
            <tbody>
              {state.inspections.filter((item) => item.planned_at).sort((a, b) => (b.planned_at ?? "").localeCompare(a.planned_at ?? "")).slice(0, 6).map((inspection) => (
                <tr key={inspection.id}><td className="mono">{inspection.code}</td><td>{formatDateTime(inspection.planned_at, timezone)}</td><td><InspectionBadge status={inspection.status} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
