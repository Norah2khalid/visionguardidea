import { Link, useParams } from "react-router-dom";
import { Badge, Button, Empty, Panel } from "@/components/ui";
import { ImageGallery } from "@/features/inspection/ImageGallery";
import { ReviewPanel } from "@/features/inspection/ReviewPanel";
import { usePlatform } from "@/hooks/usePlatform";
import { activityFor, checklistFor, compareInspections, equipmentLabel, facilityName, findingsFor, imagesFor, observationsFor, reportsForInspection, temperatureOf, userName, zoneName } from "@/lib/derive";
import { checkResultLabel, findingCategoryLabel, inspectionResultLabel, riskLabel } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { generateReport } from "@/services/platform/mutations";
import { formatDateTime } from "@/utils/format";

export function InspectionDetailPage() {
  const { inspectionId } = useParams();
  const { data, role, run } = usePlatform();
  const inspection = data.inspections.find((item) => item.id === inspectionId);
  if (!inspection) return <Empty title="سجل التفتيش غير موجود" />;
  const location = data.inspection_locations.find((item) => item.id === inspection.location_id);
  const { items } = checklistFor(data, inspection.id);
  const comparison = compareInspections(data, inspection.id);
  const reports = reportsForInspection(data, inspection.id);
  const logs = activityFor(data, inspection.id);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="mono text-cyan">{inspection.code}</p>
          <p className="text-sm text-muted">{facilityName(data, inspection.facility_id)} · {location ? zoneName(data, location.zone_id) : "—"}</p>
        </div>
        <Link to="/history"><Button variant="ghost">العودة للسجل</Button></Link>
      </div>
      <Panel title="بيانات التفتيش">
        <dl className="grid gap-3 text-sm md:grid-cols-3">
          <div><dt className="text-muted">المعدة</dt><dd>{equipmentLabel(data, inspection.equipment_id)}</dd></div>
          <div><dt className="text-muted">الموقع</dt><dd className="mono">{location?.code}</dd></div>
          <div><dt className="text-muted">المفتش</dt><dd>{userName(data, inspection.inspector_id)}</dd></div>
          <div><dt className="text-muted">البداية</dt><dd>{formatDateTime(inspection.started_at)}</dd></div>
          <div><dt className="text-muted">الإغلاق</dt><dd>{formatDateTime(inspection.completed_at)}</dd></div>
          <div><dt className="text-muted">النتيجة</dt><dd>{inspectionResultLabel[inspection.result]} · خطورة {riskLabel[inspection.risk_level]}</dd></div>
        </dl>
        <p className="mt-3 text-sm">{inspection.summary || "لا توجد خلاصة مكتوبة."}</p>
      </Panel>
      {comparison ? (
        <Panel title="مقارنة مع التفتيش السابق">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="border border-line p-3">
              <div className="text-xs text-muted">السابق</div>
              <div className="mono">{comparison.previous.code}</div>
              <div>الخطورة: {riskLabel[comparison.previous.risk_level]}</div>
              <div>الحرارة: {temperatureOf(data, comparison.previous.id) ?? "—"}°C</div>
            </div>
            <div className="border border-cyan/50 p-3">
              <div className="text-xs text-cyan">الحالي</div>
              <div className="mono">{comparison.current.code}</div>
              <div>الخطورة: {riskLabel[comparison.current.risk_level]}</div>
              <div>الحرارة: {temperatureOf(data, comparison.current.id) ?? "—"}°C</div>
            </div>
          </div>
          <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            <div><dt className="text-muted">تغير الخطورة</dt><dd>{comparison.riskChange}</dd></div>
            <div><dt className="text-muted">تغير الحالة</dt><dd>{comparison.conditionChange}</dd></div>
            <div><dt className="text-muted">تغير الحرارة</dt><dd className="mono">{comparison.temperatureChange}</dd></div>
            <div><dt className="text-muted">الفاصل</dt><dd>{comparison.frequencyDays == null ? "—" : `${comparison.frequencyDays} يومًا`}</dd></div>
            <div><dt className="text-muted">ملاحظات جديدة</dt><dd>{comparison.newFindings.map((finding) => findingCategoryLabel[finding.category]).join("، ") || "لا يوجد"}</dd></div>
            <div><dt className="text-muted">ملاحظات لم تتكرر</dt><dd>{comparison.resolvedFindings.map((finding) => finding.code).join("، ") || "لا يوجد"}</dd></div>
          </dl>
        </Panel>
      ) : <Panel title="المقارنة التاريخية"><p className="text-sm text-muted">لا يوجد تفتيش أقدم لهذه المعدة.</p></Panel>}
      <Panel title="قائمة الفحص">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-muted"><tr>{["البند", "النتيجة", "القراءة", "ملاحظة"].map((head) => <th key={head} className="p-2 text-start">{head}</th>)}</tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-line">
                  <td className="p-2">{item.label}</td>
                  <td className="p-2">{item.response ? checkResultLabel[item.response] : "—"}</td>
                  <td className="mono p-2">{item.numeric_value == null ? "—" : `${item.numeric_value} ${item.unit ?? ""}`}</td>
                  <td className="p-2">{item.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="الصور" action={<Badge tone="sim">بيانات تصوير تجريبية</Badge>}>
        <ImageGallery images={imagesFor(data, inspection.id)} />
      </Panel>
      <Panel title="ملاحظات المفتش">
        <ul className="grid gap-2 text-sm">{observationsFor(data, inspection.id).map((item) => <li key={item.id} className="border border-line p-2">{item.body}<div className="text-xs text-muted">{userName(data, item.author_id)} · {formatDateTime(item.created_at)}</div></li>)}</ul>
      </Panel>
      <Panel title="النتائج والقرار البشري" action={<Badge tone="sim">تحليل تجريبي</Badge>}>
        {findingsFor(data, inspection.id).length === 0 ? <ReviewPanel inspectionId={inspection.id} /> : findingsFor(data, inspection.id).map((finding) => <div key={finding.id} className="mb-3"><ReviewPanel findingId={finding.id} /></div>)}
      </Panel>
      <Panel title="التقرير المرتبط">
        {reports.map((report) => <Link key={report.id} className="mono me-3 text-cyan" to={`/reports/${report.id}`}>{report.code}</Link>)}
        {inspection.status === "completed" && can(role, "report.generate") ? <Button onClick={() => run((current, ctx) => generateReport(current, inspection.id, ctx))}>إصدار تقرير</Button> : null}
        {!reports.length && inspection.status !== "completed" ? <p className="text-sm text-muted">يصدر التقرير بعد اكتمال التفتيش.</p> : null}
      </Panel>
      <Panel title="سجل النشاط">
        <ul className="grid gap-2 text-sm">{logs.map((log) => <li key={log.id}><span className="text-muted">{formatDateTime(log.created_at)} · {userName(data, log.actor_id)}</span><div>{log.message}</div></li>)}</ul>
      </Panel>
      <Link className="no-print text-cyan" to={`/tasks/${inspection.task_id}`}>فتح المهمة المرتبطة</Link>
    </div>
  );
}
