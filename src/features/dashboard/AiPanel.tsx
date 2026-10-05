import { useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Panel } from "@/components/ui";
import { ReviewPanel } from "@/features/inspection/ReviewPanel";
import { usePlatform } from "@/hooks/usePlatform";
import { equipmentOutlook, findingResolution, findingsByCategory, riskDistribution, riskTrend, visibleInspections } from "@/lib/derive";
import { findingCategoryLabel, findingStatusLabel, priorityLabel, severityLabel } from "@/lib/labels";
import { formatDateTime, formatPercent } from "@/utils/format";

const COLORS: Record<string, string> = { low: "#3dbe7a", medium: "#38bdf8", high: "#e3a008", critical: "#e23d3d" };

export function AiPanel() {
  const { data, role, user } = usePlatform();
  const allowed = new Set(visibleInspections(data, role, user.id).map((item) => item.id));
  const findings = data.inspection_findings.filter((finding) => allowed.has(finding.inspection_id));
  const [selectedId, setSelectedId] = useState(findings.find((item) => item.status === "open")?.id ?? findings[0]?.id ?? null);
  const trend = riskTrend({ ...data, inspection_findings: findings });
  const categories = findingsByCategory({ ...data, inspection_findings: findings });
  const distribution = riskDistribution(data);
  const resolution = findingResolution({ ...data, inspection_findings: findings });
  const outlook = equipmentOutlook(data).filter((item) => role !== "inspector" || data.inspection_tasks.some((task) => task.equipment_id === item.equipment.id && task.inspector_id === user.id) || data.inspections.some((inspection) => inspection.equipment_id === item.equipment.id && inspection.inspector_id === user.id));
  const chartTip = { background: "#0c1826", border: "1px solid #23445d", color: "#e7eef4" };

  return (
    <div className="grid gap-3">
      <Badge tone="sim">تحليل تجريبي — ليس قرارًا تشغيليًا ولا تنبؤًا معتمدًا</Badge>
      <div className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="الكشف">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="p-2 text-start">المعرف</th>
                  <th className="p-2 text-start">الفئة</th>
                  <th className="p-2 text-start">المنشأة / المعدة</th>
                  <th className="p-2 text-start">الوقت</th>
                  <th className="p-2 text-start">الشدة</th>
                  <th className="p-2 text-start">الثقة</th>
                  <th className="p-2 text-start">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {findings.map((finding) => {
                  const facility = data.facilities.find((item) => item.id === finding.facility_id);
                  const equipment = data.equipment.find((item) => item.id === finding.equipment_id);
                  return (
                    <tr key={finding.id} className={`cursor-pointer border-t border-line ${selectedId === finding.id ? "bg-cyan/10" : ""}`} onClick={() => setSelectedId(finding.id)}>
                      <td className="p-2"><button className="mono text-cyan" onClick={() => setSelectedId(finding.id)}>{finding.code}</button></td>
                      <td className="p-2">{findingCategoryLabel[finding.category]}</td>
                      <td className="p-2">{facility?.name}<div className="mono text-xs text-muted">{equipment?.code}</div></td>
                      <td className="p-2">{formatDateTime(finding.detected_at)}</td>
                      <td className="p-2">{severityLabel[finding.severity]}</td>
                      <td className="p-2">{formatPercent(finding.confidence)}</td>
                      <td className="p-2">{findingStatusLabel[finding.status]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {findings.length === 0 ? <p className="text-sm text-muted">لا توجد ملاحظات ضمن نطاق الدور. يمكن تشغيل التحليل من مهمة قيد التنفيذ.</p> : null}
        </Panel>
        <ReviewPanel findingId={selectedId} />
      </div>
      <Panel title="التنبؤ والأولوية">
        <p className="mb-3 text-xs text-muted">المنحنيات محسوبة من الملاحظات والسجلات المخزنة في وضع المحاكاة.</p>
        <div className="grid gap-3 lg:grid-cols-2">
          <ChartCard title="اتجاه الخطورة">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend}>
                <CartesianGrid stroke="#23445d" />
                <XAxis dataKey="label" stroke="#8ea3b5" />
                <YAxis stroke="#8ea3b5" />
                <Tooltip contentStyle={chartTip} />
                <Line dataKey="score" name="متوسط الشدة" stroke="#38bdf8" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="الملاحظات حسب الفئة">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={categories}>
                <CartesianGrid stroke="#23445d" />
                <XAxis dataKey="label" stroke="#8ea3b5" interval={0} tick={{ fontSize: 10 }} />
                <YAxis stroke="#8ea3b5" allowDecimals={false} />
                <Tooltip contentStyle={chartTip} />
                <Bar dataKey="count" name="العدد" fill="#38bdf8" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="توزيع الخطورة">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={distribution}>
                <CartesianGrid stroke="#23445d" />
                <XAxis dataKey="label" stroke="#8ea3b5" />
                <YAxis stroke="#8ea3b5" allowDecimals={false} />
                <Tooltip contentStyle={chartTip} />
                <Bar dataKey="count" name="المواقع">
                  {distribution.map((entry) => <Cell key={entry.key} fill={COLORS[entry.key]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="الملاحظات المفتوحة والمغلقة">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={resolution}>
                <CartesianGrid stroke="#23445d" />
                <XAxis dataKey="label" stroke="#8ea3b5" />
                <YAxis stroke="#8ea3b5" allowDecimals={false} />
                <Tooltip contentStyle={chartTip} />
                <Bar dataKey="count" name="العدد" fill="#e3a008" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-muted">
              <tr>
                <th className="p-2 text-start">المعدة</th>
                <th className="p-2 text-start">الحالة</th>
                <th className="p-2 text-start">الخطورة المتوقعة</th>
                <th className="p-2 text-start">أولوية التفتيش</th>
                <th className="p-2 text-start">التغير التاريخي</th>
              </tr>
            </thead>
            <tbody>
              {outlook.map((item) => (
                <tr key={item.equipment.id} className="border-t border-line">
                  <td className="p-2 mono">{item.equipment.code}</td>
                  <td className="p-2">{item.condition}</td>
                  <td className="p-2">{item.predictedRisk}</td>
                  <td className="p-2">{item.priority === "لا توجد مهمة مفتوحة" ? item.priority : priorityLabel[item.priority as keyof typeof priorityLabel] ?? item.priority}</td>
                  <td className="p-2">{item.history}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border border-line p-2" dir="ltr">
      <h3 className="mb-2 text-sm text-ink" dir="rtl">{title}</h3>
      {children}
    </div>
  );
}
