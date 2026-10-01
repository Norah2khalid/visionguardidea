import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useSession } from "@/app/session";
import { InspectionBadge, Loading, MissionBadge, PageHeader, Panel } from "@/components/ui";
import { formatDuration } from "@/lib/analytics";
import { inspectionStatusLabel, pointCategoryLabel } from "@/lib/labels";
import { loadAnalytics, loadDashboard } from "@/services/platform/queries";

export function DashboardPage() {
  const { backend } = useSession();
  const query = useQuery({ queryKey: ["dashboard"], enabled: Boolean(backend), queryFn: () => loadDashboard(backend!.db) });
  const analytics = useQuery({ queryKey: ["analytics"], enabled: Boolean(backend), queryFn: () => loadAnalytics(backend!.db) });
  if (!query.data || !analytics.data) return <Loading />;
  const { metrics, byStatus, recentInspections, activeMissions, latestPoints, recentReports, state } = query.data;
  const chart = Object.entries(byStatus).map(([status, count]) => ({ name: inspectionStatusLabel[status as keyof typeof inspectionStatusLabel] ?? status, count }));
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
          {chart.length === 0 ? <p className="muted">لا توجد بيانات للرسم.</p> : (
            <div dir="ltr" style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart}>
                  <XAxis dataKey="name" stroke="#8ea0b3" />
                  <YAxis allowDecimals={false} stroke="#8ea0b3" />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3ddec8" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
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
