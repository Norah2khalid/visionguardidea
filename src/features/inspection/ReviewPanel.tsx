import { useState } from "react";
import { Badge, Button, Empty } from "@/components/ui";
import { usePlatform } from "@/hooks/usePlatform";
import { byId, findingsFor, reviewsForFinding, userName } from "@/lib/derive";
import { findingCategoryLabel, findingStatusLabel, reviewDecisionLabel, severityLabel } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { clearWithoutFindings, reviewFinding } from "@/services/platform/mutations";
import type { ReviewDecision } from "@/types/domain";
import { formatDateTime, formatPercent } from "@/utils/format";

const DECISIONS: ReviewDecision[] = ["approve", "reject", "extra_inspection", "maintenance", "note"];

export function ReviewPanel({ inspectionId, findingId }: { inspectionId?: string | null; findingId?: string | null }) {
  const { data, role, run } = usePlatform();
  const [notes, setNotes] = useState("");
  const finding = findingId ? byId(data.inspection_findings, findingId) : inspectionId ? findingsFor(data, inspectionId).find((item) => item.status === "open") ?? findingsFor(data, inspectionId)[0] : undefined;
  const inspection = finding ? byId(data.inspections, finding.inspection_id) : inspectionId ? byId(data.inspections, inspectionId) : undefined;
  if (!inspection) return <Empty title="اختر ملاحظة أو تفتيشًا" />;
  const reviews = finding ? reviewsForFinding(data, finding.id) : data.human_reviews.filter((review) => review.inspection_id === inspection.id && !review.finding_id);
  const image = finding?.image_id ? byId(data.inspection_images, finding.image_id) : undefined;
  const editable = can(role, "finding.review") && inspection.status !== "completed" && inspection.status !== "cancelled";
  const findings = findingsFor(data, inspection.id);

  return (
    <div className="grid gap-3">
      <div className="border border-cyan/40 bg-cyan/5 p-3">
        <h3 className="mb-1 text-sm font-semibold text-cyan">تحليل الذكاء الاصطناعي</h3>
        <Badge tone="sim">تحليل تجريبي</Badge>
        {finding ? (
          <dl className="mt-2 grid gap-1 text-sm">
            <div className="mono">{finding.code}</div>
            <div>{findingCategoryLabel[finding.category]} · {severityLabel[finding.severity]} · ثقة {formatPercent(finding.confidence)}</div>
            <div>{finding.summary}</div>
            <div className="text-xs text-muted">{formatDateTime(finding.detected_at)} · الحالة {findingStatusLabel[finding.status]}</div>
          </dl>
        ) : <p className="mt-2 text-sm">لا توجد ملاحظة AI على هذا التفتيش.</p>}
        {image ? <img src={image.data_url} alt={image.caption} className="mt-2 max-h-40 w-full object-contain" /> : null}
      </div>
      <div className="border border-amber/40 bg-amber/5 p-3">
        <h3 className="mb-1 text-sm font-semibold text-amber">القرار البشري</h3>
        <p className="mb-2 text-xs text-muted">الذكاء الاصطناعي لا يغلق قرار السلامة. المراجع: {userName(data, inspection.inspector_id)} أو المدير.</p>
        {reviews.length === 0 ? <p className="text-sm text-muted">لا يوجد قرار بشري بعد.</p> : (
          <ul className="grid gap-2">
            {reviews.map((review) => (
              <li key={review.id} className="border border-line p-2 text-sm">
                <strong>{reviewDecisionLabel[review.decision]}</strong>
                <div className="text-xs text-muted">{userName(data, review.reviewer_id)} · {formatDateTime(review.decided_at)}</div>
                <p>{review.notes}</p>
              </li>
            ))}
          </ul>
        )}
        {editable && finding ? (
          <form className="mt-3 grid gap-2" onSubmit={(event) => event.preventDefault()}>
            <label className="text-sm">ملاحظة المراجعة
              <textarea className="mt-1 min-h-20 w-full border border-line bg-[#07111c] p-2" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
            <div className="flex flex-wrap gap-1">
              {DECISIONS.map((decision) => (
                <Button key={decision} type="button" onClick={() => run((current, ctx) => reviewFinding(current, finding.id, decision, notes, ctx)) && setNotes("")}>{reviewDecisionLabel[decision]}</Button>
              ))}
            </div>
          </form>
        ) : null}
        {editable && !findings.length ? (
          <form className="mt-3 grid gap-2" onSubmit={(event) => { event.preventDefault(); run((current, ctx) => clearWithoutFindings(current, inspection.id, notes, ctx)); }}>
            <label className="text-sm">توثيق عدم وجود ملاحظات
              <textarea className="mt-1 min-h-20 w-full border border-line bg-[#07111c] p-2" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
            <Button type="submit" variant="primary">اعتماد عدم وجود ملاحظات</Button>
          </form>
        ) : null}
        {!can(role, "finding.review") ? <p className="mt-2 text-xs text-muted">المراجعة البشرية غير متاحة لجامع التقارير.</p> : null}
      </div>
    </div>
  );
}
