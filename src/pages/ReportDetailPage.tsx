import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, Button, ConfirmDialog, Empty, Field, Panel, controlClass } from "@/components/ui";
import { usePlatform } from "@/hooks/usePlatform";
import { reportStatusLabel, riskLabel } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { reportHtml } from "@/lib/reports";
import { addCorrectiveAction, archiveReport, setActionStatus, updateReport } from "@/services/platform/mutations";
import type { ReportStatus } from "@/types/domain";
import { formatDateTime } from "@/utils/format";

export function ReportDetailPage() {
  const { reportId } = useParams();
  const { data, role, run, notify } = usePlatform();
  const report = data.reports.find((item) => item.id === reportId);
  const [note, setNote] = useState("");
  const [action, setAction] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  if (!report) return <Empty title="التقرير غير موجود" />;
  const actions = data.corrective_actions.filter((item) => item.report_id === report.id);
  const snapshot = report.snapshot;

  function printReport() {
    document.title = snapshot.report_code;
    window.print();
    notify("اختر «حفظ كـ PDF» من نافذة الطباعة لإبقاء الاتجاه العربي والصور والجداول.");
  }

  function downloadHtml() {
    const blob = new Blob([reportHtml(snapshot)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${snapshot.report_code}.html`;
    link.click();
    URL.revokeObjectURL(url);
    notify("نُزّل ملف HTML عربي. لملف PDF استخدم زر تصدير PDF ثم الحفظ من نافذة الطباعة.");
  }

  return (
    <div className="grid gap-3">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Badge tone="sim">وضع المحاكاة</Badge>
          <Badge tone={report.status === "needs_completion" ? "warn" : report.status === "completed" ? "ok" : "info"}>{reportStatusLabel[report.status]}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={printReport}>طباعة</Button>
          <Button onClick={printReport}>تصدير PDF</Button>
          <Button onClick={downloadHtml}>تنزيل HTML</Button>
          {can(role, "report.manage") && report.status !== "archived" ? <Button variant="danger" onClick={() => setArchiveOpen(true)}>أرشفة</Button> : null}
          <Link to="/reports"><Button variant="ghost">العودة</Button></Link>
        </div>
      </div>
      {can(role, "report.manage") && report.status !== "archived" ? (
        <Panel className="no-print" title="مراجعة التقرير">
          <div className="flex flex-wrap gap-2">
            {(["in_review", "needs_completion", "completed"] as ReportStatus[]).map((status) => (
              <Button key={status} onClick={() => run((current, ctx) => updateReport(current, report.id, status, note, ctx))}>{reportStatusLabel[status]}</Button>
            ))}
          </div>
          <Field label="ملاحظة الاستكمال أو الاعتماد">
            <textarea className={controlClass + " mt-1 min-h-20"} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
          <form className="mt-3 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); if (run((current, ctx) => addCorrectiveAction(current, report.id, action, ctx))) setAction(""); }}>
            <input className={controlClass + " max-w-md"} aria-label="إجراء تصحيحي" value={action} onChange={(event) => setAction(event.target.value)} placeholder="إجراء المعالجة" />
            <Button type="submit">إضافة إجراء</Button>
          </form>
          <ul className="mt-3 grid gap-2 text-sm">
            {actions.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 border border-line p-2">
                <span>{item.description}</span>
                <select className={controlClass + " max-w-[160px]"} aria-label="حالة الإجراء" value={item.status} onChange={(event) => run((current, ctx) => setActionStatus(current, item.id, event.target.value as typeof item.status, ctx))}>
                  <option value="open">مفتوح</option>
                  <option value="in_progress">قيد المعالجة</option>
                  <option value="done">مغلق</option>
                </select>
              </li>
            ))}
          </ul>
          {report.completion_note ? <p className="mt-2 text-sm text-amber">{report.completion_note}</p> : null}
        </Panel>
      ) : null}
      <article className="print-sheet border border-line bg-[#f4f7f8] p-6 text-[#14202b]">
        <p className="text-xs text-[#526272]">VISIONGUARD · وضع المحاكاة · مراجعة {snapshot.revision}</p>
        <h2 className="mt-1 text-2xl font-semibold">تقرير تفتيش {snapshot.report_code}</h2>
        <p className="mt-2 border border-[#e3a008] bg-[#fff6df] p-2 text-sm">{snapshot.disclaimer}</p>
        <dl className="mt-4 grid gap-2 text-sm md:grid-cols-2">
          <div>رقم التقرير: <span className="mono">{snapshot.report_code}</span></div>
          <div>رقم التفتيش: <span className="mono">{snapshot.inspection_code}</span></div>
          <div>تاريخ التفتيش: {formatDateTime(snapshot.inspection_date)}</div>
          <div>المنشأة: {snapshot.facility_name}</div>
          <div>المنطقة: {snapshot.zone_name}</div>
          <div>المعدة: {snapshot.equipment_label}</div>
          <div>الموقع: {snapshot.location_label}</div>
          <div>المفتش: {snapshot.inspector_name}</div>
          <div>نتيجة قائمة الفحص: {snapshot.result_label}</div>
          <div>مستوى الخطورة: {riskLabel[snapshot.risk_level]}</div>
          <div>حالة المعالجة: {snapshot.treatment_status}</div>
        </dl>
        <h3 className="mt-6 text-lg font-semibold">نتيجة قائمة الفحص</h3>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full border-collapse text-sm">
            <thead><tr>{["البند", "النتيجة", "القراءة", "الملاحظات"].map((head) => <th key={head} className="border border-[#d5dee6] bg-[#eef3f6] p-2 text-start">{head}</th>)}</tr></thead>
            <tbody>
              {snapshot.checklist.map((item) => (
                <tr key={item.label}><td className="border border-[#d5dee6] p-2">{item.label}</td><td className="border border-[#d5dee6] p-2">{item.response}</td><td className="mono border border-[#d5dee6] p-2">{item.numeric}</td><td className="border border-[#d5dee6] p-2">{item.notes}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="mt-6 text-lg font-semibold">الصور</h3>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {snapshot.images.map((image) => (
            <figure key={image.captured_at + image.caption}>
              <img src={image.data_url} alt={image.caption} className="w-full border border-[#d5dee6] bg-[#07111c]" />
              <figcaption className="mt-1 text-xs text-[#526272]">{image.caption} · {image.media_type === "video" ? "إطار فيديو تجريبي" : "صورة"} · {formatDateTime(image.captured_at)}</figcaption>
            </figure>
          ))}
        </div>
        <h3 className="mt-6 text-lg font-semibold">الملاحظات</h3>
        <ul className="mt-2 list-disc pe-5 text-sm">{snapshot.observations.map((item) => <li key={item.created_at}>{item.body} — {item.author}</li>)}</ul>
        <h3 className="mt-6 text-lg font-semibold">نتائج الذكاء الاصطناعي</h3>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full border-collapse text-sm">
            <thead><tr>{["المعرف", "الفئة", "الشدة", "الثقة", "الحالة", "الملخص"].map((head) => <th key={head} className="border border-[#d5dee6] bg-[#eef3f6] p-2 text-start">{head}</th>)}</tr></thead>
            <tbody>
              {snapshot.ai_findings.map((finding) => (
                <tr key={finding.code}><td className="mono border border-[#d5dee6] p-2">{finding.code}</td><td className="border border-[#d5dee6] p-2">{finding.category}</td><td className="border border-[#d5dee6] p-2">{finding.severity}</td><td className="border border-[#d5dee6] p-2">{finding.confidence}</td><td className="border border-[#d5dee6] p-2">{finding.status}</td><td className="border border-[#d5dee6] p-2">{finding.summary}{finding.demo ? " · تحليل تجريبي" : ""}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="mt-6 text-lg font-semibold">القرار البشري</h3>
        <ul className="mt-2 grid gap-2 text-sm">
          {snapshot.human_decisions.map((decision) => <li key={decision.decided_at + decision.decision} className="border border-[#d5dee6] p-2"><strong>{decision.decision}</strong> — {decision.reviewer} — {formatDateTime(decision.decided_at)}<div>{decision.notes}</div></li>)}
        </ul>
        <h3 className="mt-6 text-lg font-semibold">الإجراءات المقترحة</h3>
        <ul className="mt-2 list-disc pe-5 text-sm">{snapshot.proposed_actions.map((item) => <li key={item}>{item}</li>)}</ul>
        {snapshot.corrective_actions.length ? (
          <>
            <h3 className="mt-6 text-lg font-semibold">حالة المعالجة</h3>
            <ul className="mt-2 text-sm">{snapshot.corrective_actions.map((item) => <li key={item.description}>{item.description} — {item.status}</li>)}</ul>
          </>
        ) : null}
      </article>
      <ConfirmDialog open={archiveOpen} title="أرشفة التقرير" body="ستبقى اللقطة كما هي ولن يُحذف السجل." confirmLabel="أرشفة" onClose={() => setArchiveOpen(false)} onConfirm={() => { run((current, ctx) => archiveReport(current, report.id, ctx)); setArchiveOpen(false); }} />
    </div>
  );
}
