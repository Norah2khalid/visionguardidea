import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/app/session";
import { InspectionBadge, Loading, MissionBadge, PageHeader, Panel } from "@/components/ui";
import { formatDuration } from "@/lib/analytics";
import { inspectionStatusLabel, pointCategoryLabel } from "@/lib/labels";
import { loadAnalytics, loadDashboard } from "@/services/platform/queries";
import { INSPECTION_STATUSES } from "@/types/domain";

export function DashboardPage() {
  const { backend } = useSession();
  const query = useQuery({ queryKey: ["dashboard"], enabled: Boolean(backend), queryFn: () => loadDashboard(backend!.db) });
  const analytics = useQuery({ queryKey: ["analytics"], enabled: Boolean(backend), queryFn: () => loadAnalytics(backend!.db) });
  if (!query.data || !analytics.data) return <Loading />;
  const { metrics, byStatus, recentInspections, activeMissions, latestPoints, recentReports, state } = query.data;
  const known = new Set<string>(INSPECTION_STATUSES);
  const rows: { key: string; label: string; count: number }[] = INSPECTION_STATUSES.filter((status) => status !== "DRAFT" && status !== "CANCELLED").map((status) => ({
    key: status,
    label: inspectionStatusLabel[status],
    count: byStatus[status] ?? 0,
  }));
  const unknown = Object.entries(byStatus).filter(([status]) => !known.has(status)).reduce((sum, [, count]) => sum + count, 0);
  if (unknown > 0) rows.push({ key: "unknown", label: "غير محدد", count: unknown });
  return (
    <>
      <PageHeader title="لوحة التحكم" subtitle="المؤشرات محسوبة من السجلات المخزنة، وليست نسب تحسن تشغيلية مقدّرة." />
      <div className="grid cols-4">
        <Metric label="تفتيشات نشطة" value={metrics.activeInspections} />
        <Metric label="تفتيشات مكتملة" value={metrics.completedInspections} />
        <Metric label="مهام قيد التنفيذ" value={metrics.missionsInProgress} />
        <Metric label="مناطق عالية الخطورة" value={metrics.highRiskZones} />
        <Metric label="تنبيهات غير محلولة" value={metrics.unresolvedAlerts} />
        <Metric label="درون متاحة" value={metrics.availableDrones} />
        <Metric label="متوسط دورة التفتيش" value={formatDuration(metrics.averageInspectionMs)} hint={metrics.inspectionSampleSize ? `من ${metrics.inspectionSampleSize} سجلًا فيه وقت بدء وإنهاء` : "لا توجد بيانات كافية"} />
      </div>
      <div className="grid cols-2">
        <Panel title="التفتيشات حسب الحالة">
          <div className="status-summary">
            {rows.map((row) => (
              <div key={row.key} className="status-row">
                <span className="status-dot" aria-hidden="true" />
                <span>{row.label}</span>
                <span className="status-count">{row.count}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="دورة العمل المقاسة">
          <p>متوسط مدة المهمة: {formatDuration(analytics.data.missionDuration.averageMs)}</p>
          <p>متوسط مدة المراجعة: {formatDuration(analytics.data.reviewDuration.averageMs)}</p>
          <p>معدل المتابعة: {analytics.data.followUp.rate == null ? "لا توجد بيانات كافية" : `${Math.round(analytics.data.followUp.rate * 100)}% من ${analytics.data.followUp.sampleSize}`}</p>
          <p>زمن إغلاق نقطة الفحص: {formatDuration(analytics.data.pointResolution.averageMs)}</p>
          <p className="muted">لا تُعرض نسبة خفض لزمن التفتيش لأن المقارنة التاريخية غير متوفرة.</p>
        </Panel>
      </div>
      <div className="grid cols-3">
        <Panel title="تفتيشات حديثة">
          {recentInspections.map((item) => <Link key={item.id} to={`/inspections/${item.id}`} style={{ display: "block", padding: "6px 0" }}><span className="mono">{item.code}</span> <InspectionBadge status={item.status} /></Link>)}
        </Panel>
        <Panel title="مهام نشطة">
          {activeMissions.length === 0 ? <p className="muted">لا توجد مهمة نشطة.</p> : activeMissions.map((item) => <Link key={item.id} to={`/missions/${item.id}/control`} style={{ display: "block", padding: "6px 0" }}><span className="mono">{item.code}</span> <MissionBadge status={item.status} /></Link>)}
        </Panel>
        <Panel title="أحدث الملاحظات">
          {latestPoints.length === 0 ? <p className="muted">لا توجد نقاط.</p> : latestPoints.map((item) => <div key={item.id} style={{ padding: "6px 0" }}>{pointCategoryLabel[item.category]} — {item.description}</div>)}
        </Panel>
      </div>
      <Panel title="تقارير حديثة">
        {recentReports.length === 0 ? <p className="muted">لا توجد تقارير.</p> : recentReports.map((report) => <Link key={report.id} to={`/reports/${report.id}`} style={{ display: "block", padding: "6px 0" }}><span className="mono">{report.code}</span> — مراجعة {report.revision}</Link>)}
        <p className="muted">المنشآت في النطاق: {state.facilities.filter((item) => item.status !== "archived").length}</p>
      </Panel>
    </>
  );
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <Panel><div className="kpi"><div className="muted">{label}</div><div className="value">{value}</div>{hint ? <div className="hint">{hint}</div> : null}</div></Panel>;
}
