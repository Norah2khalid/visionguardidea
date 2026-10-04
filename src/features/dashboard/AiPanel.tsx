import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useSession } from "@/app/session";
import { Button, ErrorState, SeverityBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { pointCategoryLabel, riskLabel } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { getAnalysisProvider } from "@/services/analysis/analysisService";
import type { AppState, DecisionAction, InspectionPoint } from "@/types/domain";

const CHART_TOOLTIP = { background: "#101922", border: "1px solid rgba(168,198,214,0.16)", color: "#fff" };
const COLORS = ["#3ddec8", "#22D3EE", "#e0a23a", "#e15b4c", "#79b6ff", "#8ea0b3"];

export function AiPanel({ state }: { state: AppState }) {
  const { backend, actor, profile } = useSession();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const provider = getAnalysisProvider();
  const findings = state.inspection_points.filter((point) => point.source !== "inspector");
  const human = state.inspection_observations.filter((item) => item.source === "inspector");
  const byCategory = count(findings.map((point) => pointCategoryLabel[point.category]));
  const byRisk = count(state.equipment.map((item) => riskLabel[item.risk_level]));
  const openCount = findings.filter((point) => point.review_status === "pending").length;
  const resolvedCount = findings.length - openCount;
  const byEquipment = state.equipment.map((item) => ({
    name: item.code,
    count: state.inspections.filter((inspection) => inspection.equipment_id === item.id).length,
  }));

  const review = async (point: InspectionPoint, action: DecisionAction) => {
    if (!backend || !actor) return;
    setError(null);
    setMessage(null);
    try {
      await backend.platform.recordDecision(actor, { inspectionId: point.inspection_id, pointId: point.id, action, notes: notes[point.id] || null });
      setMessage("سُجل قرار المراجعة على السجل، دون اعتباره حكمًا نهائيًا بسلامة المعدة.");
      await queryClient.invalidateQueries();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر حفظ المراجعة");
    }
  };

  return (
    <div className="grid">
      <p className="banner sim">
        {provider.isConfigured()
          ? "مزود التحليل متصل. تُعرض النتائج كما أعادها المزود، وليست قرار سلامة."
          : "لا يوجد نموذج تحليل متصل. المؤشرات أدناه سجلات تجريبية مخزنة للعرض، وليست كشوفات من ذكاء اصطناعي."}
      </p>
      {message ? <p className="banner">{message}</p> : null}
      {error ? <ErrorState message={error} /> : null}
      <div className="grid cols-2">
        <section>
          <h3>مؤشرات غير اعتيادية</h3>
          <ul className="plain-list">
            <li>تسرب محتمل: {findings.filter((point) => point.category === "possible_leak").length}</li>
            <li>تآكل أو ضرر سطحي: {findings.filter((point) => point.category === "possible_corrosion" || point.category === "visible_damage").length}</li>
            <li>حرارة غير اعتيادية: {state.sensor_readings.filter((reading) => reading.measurement_type === "surface_temperature").length} قراءة مخزنة</li>
            <li>شذوذ معدات: {findings.filter((point) => point.category === "equipment_condition" || point.category === "unusual_reading").length}</li>
            <li>ما يحتاج مراجعة بشرية: {openCount}</li>
          </ul>
          <p className="muted">القراءات الحرارية من السجل التجريبي، وليست بثًا حيًا.</p>
        </section>
        <section>
          <h3>اتجاهات الخطورة</h3>
          <p>توزيع المعدات: {byRisk.map((item) => `${item.name} ${item.count}`).join(" — ") || "لا توجد بيانات"}</p>
          <p>أولوية المراجعة: {findings.filter((point) => point.review_status === "pending").map((point) => point.code).join("، ") || "لا توجد مؤشرات مفتوحة"}</p>
          <p className="muted">المقارنة التاريخية تقتصر على عدد سجلات التفتيش لكل معدة. لا تُستنتج نسبة تحسن.</p>
        </section>
      </div>
      <div className="grid cols-2">
        <Chart title="توزيع الخطورة" data={byRisk} />
        <Chart title="المؤشرات حسب الفئة" data={byCategory} />
        <Chart title="مفتوح مقابل مُراجع" data={[{ name: "مفتوح", count: openCount }, { name: "مُراجع", count: resolvedCount }]} />
        <Chart title="سجلات التفتيش لكل معدة" data={byEquipment} />
      </div>
      <section>
        <h3>قائمة المؤشرات</h3>
        {findings.length === 0 ? <p className="muted">لا توجد مؤشرات مخزنة.</p> : findings.map((point) => {
          const facility = state.facilities.find((item) => item.id === point.facility_id);
          const equipment = state.equipment.find((item) => item.id === point.equipment_id);
          const media = state.inspection_media.find((item) => item.point_id === point.id || item.inspection_id === point.inspection_id);
          const decisions = state.inspection_decisions.filter((item) => item.point_id === point.id);
          const reviewer = decisions[0] ? state.profiles.find((item) => item.id === decisions[0].decided_by) : null;
          return (
            <article key={point.id} className="finding">
              <div className="page-title">
                <strong className="mono">{point.code}</strong>
                <SeverityBadge severity={point.severity} />
              </div>
              <p>{pointCategoryLabel[point.category]} — {point.description}</p>
              <p className="muted">{facility?.name ?? "منشأة"} / {equipment?.code ?? "معدة"} — {formatDateTime(point.created_at)}</p>
              <p>المصدر: {point.source === "analysis" ? "تحليل آلي" : point.source === "simulation" ? "محاكاة" : "سجل تجريبي"} — الثقة: {point.confidence == null ? "غير مزودة من نموذج" : point.confidence}</p>
              <p>المراجعة: {point.review_status}{reviewer ? ` — ${reviewer.full_name}` : ""}{decisions[0] ? ` — ${formatDateTime(decisions[0].decided_at)}` : ""}</p>
              {media ? <p>مرجع الدليل: {media.file_name}</p> : <p className="muted">لا يوجد مرجع صورة أو قياس مرتبط.</p>}
              <p>الإجراء المقترح: مراجعة بشرية قبل أي قرار صيانة أو إغلاق.</p>
              <div className="actions">
                <Link to={`/inspections/${point.inspection_id}`}>التفتيش</Link>
                <Link to={`/history?equipment=${point.equipment_id ?? ""}`}>السجل</Link>
              </div>
              {can(profile?.role_code, "decisions.record") ? (
                <div className="grid">
                  <textarea className="textarea" placeholder="ملاحظة المراجعة" value={notes[point.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [point.id]: event.target.value }))} />
                  <div className="actions">
                    <Button onClick={() => void review(point, "confirm")}>قبول المؤشر</Button>
                    <Button onClick={() => void review(point, "reject")}>رفض كإنذار خاطئ</Button>
                    <Button onClick={() => void review(point, "reinspect")}>طلب تفتيش آخر</Button>
                    <Button onClick={() => void review(point, "maintenance")}>إحالة للصيانة</Button>
                  </div>
                </div>
              ) : <p className="muted">مراجعة المؤشرات متاحة للمدير والمفتش.</p>}
            </article>
          );
        })}
      </section>
      <section>
        <h3>ملاحظات بشرية منفصلة</h3>
        {human.length === 0 ? <p className="muted">لا توجد ملاحظات سجلها مفتش بعد. لا تُخلط مع المؤشرات التجريبية.</p> : human.map((item) => <p key={item.id}>{item.description}</p>)}
      </section>
    </div>
  );
}

function count(values: string[]) {
  const map = new Map<string, number>();
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
  return [...map.entries()].map(([name, itemCount]) => ({ name, count: itemCount }));
}

function Chart({ title, data }: { title: string; data: { name: string; count: number }[] }) {
  return (
    <section>
      <h3>{title}</h3>
      {data.length === 0 ? <p className="muted">لا توجد بيانات.</p> : (
        <div className="chart-box" dir="ltr">
          {data.length <= 4 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="count" nameKey="name" innerRadius={36} outerRadius={64}>
                  {data.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <XAxis dataKey="name" stroke="#8ea0b3" />
                <YAxis allowDecimals={false} stroke="#8ea0b3" />
                <Tooltip contentStyle={CHART_TOOLTIP} />
                <Bar dataKey="count" fill="#3ddec8" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </section>
  );
}
