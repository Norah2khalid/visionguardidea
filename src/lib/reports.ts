import { byId, checklistFor, equipmentLabel, facilityName, findingsFor, imagesFor, observationsFor, reviewsForFinding, userName, zoneName } from "@/lib/derive";
import {
  actionStatusLabel,
  checkResultLabel,
  findingCategoryLabel,
  findingStatusLabel,
  inspectionResultLabel,
  reviewDecisionLabel,
  riskLabel,
  severityLabel,
} from "@/lib/labels";
import type { AppData, Report, ReportSnapshot } from "@/types/domain";

const DISCLAIMER =
  "تحليل تجريبي ووضع محاكاة. هذا التقرير سجل تشغيلي داخل المنصة ولا يمثل قرار سلامة نهائيًا ولا قراءة حية من درون أو حساس. القرار البشري المسجل في التقرير هو مرجع المراجعة.";

export function buildReportSnapshot(data: AppData, report: Pick<Report, "code" | "revision" | "inspection_id" | "created_at" | "status">): ReportSnapshot {
  const inspection = byId(data.inspections, report.inspection_id);
  if (!inspection) throw new Error("التفتيش المرتبط بالتقرير غير موجود");
  const location = byId(data.inspection_locations, inspection.location_id);
  const { items } = checklistFor(data, inspection.id);
  const findings = findingsFor(data, inspection.id);
  const actions = data.corrective_actions.filter((action) => action.inspection_id === inspection.id);
  const proposed = [
    ...findings.filter((finding) => finding.status === "maintenance").map((finding) => `إحالة ${finding.code} إلى الصيانة`),
    ...findings.filter((finding) => finding.status === "extra_inspection").map((finding) => `فحص إضافي لـ ${finding.code}`),
    ...actions.map((action) => action.description),
  ];
  if (!proposed.length) proposed.push("لا توجد إجراءات مقترحة إضافية في هذا الإصدار.");

  return {
    report_code: report.code,
    revision: report.revision,
    inspection_code: inspection.code,
    inspection_date: inspection.completed_at ?? inspection.started_at,
    facility_name: facilityName(data, inspection.facility_id),
    zone_name: location ? zoneName(data, location.zone_id) : "—",
    equipment_label: equipmentLabel(data, inspection.equipment_id),
    location_label: location ? `${location.code} — ${location.name}` : "—",
    inspector_name: userName(data, inspection.inspector_id),
    result_label: inspectionResultLabel[inspection.result],
    risk_level: inspection.risk_level,
    checklist: items.map((item) => ({
      label: item.label,
      response: item.response ? checkResultLabel[item.response] : "بدون استجابة",
      numeric: item.numeric_value == null ? "—" : `${item.numeric_value} ${item.unit ?? ""}`.trim(),
      notes: item.notes || "—",
    })),
    images: imagesFor(data, inspection.id).map((image) => ({
      caption: image.caption,
      captured_at: image.captured_at,
      data_url: image.data_url,
      media_type: image.media_type,
    })),
    observations: observationsFor(data, inspection.id).map((observation) => ({
      body: observation.body,
      author: userName(data, observation.author_id),
      created_at: observation.created_at,
    })),
    ai_findings: findings.map((finding) => ({
      code: finding.code,
      category: findingCategoryLabel[finding.category],
      severity: severityLabel[finding.severity],
      confidence: `${Math.round(finding.confidence * 100)}٪`,
      status: findingStatusLabel[finding.status],
      summary: finding.summary,
      demo: finding.is_demo,
    })),
    human_decisions: [
      ...findings.flatMap((finding) =>
        reviewsForFinding(data, finding.id).map((review) => ({
          decision: reviewDecisionLabel[review.decision],
          reviewer: userName(data, review.reviewer_id),
          notes: review.notes,
          decided_at: review.decided_at,
        })),
      ),
      ...data.human_reviews
        .filter((review) => review.inspection_id === inspection.id && !review.finding_id)
        .map((review) => ({
          decision: reviewDecisionLabel[review.decision],
          reviewer: userName(data, review.reviewer_id),
          notes: review.notes,
          decided_at: review.decided_at,
        })),
    ],
    corrective_actions: actions.map((action) => ({
      description: action.description,
      status: actionStatusLabel[action.status],
    })),
    proposed_actions: proposed,
    treatment_status: treatmentStatus(report.status, actions.length),
    disclaimer: DISCLAIMER,
    generated_at: report.created_at,
  };
}

function treatmentStatus(status: Report["status"], actionCount: number): string {
  if (status === "archived") return "مؤرشف";
  if (status === "needs_completion") return "يحتاج استكمال";
  if (status === "completed" && actionCount) return "مكتمل مع إجراءات متابعة";
  if (status === "completed") return "مكتمل";
  if (status === "in_review") return "قيد المراجعة";
  return "جديد";
}

export function reportHtml(snapshot: ReportSnapshot): string {
  const rows = snapshot.checklist
    .map(
      (item) =>
        `<tr><td>${esc(item.label)}</td><td>${esc(item.response)}</td><td dir="ltr">${esc(item.numeric)}</td><td>${esc(item.notes)}</td></tr>`,
    )
    .join("");
  const findings = snapshot.ai_findings
    .map(
      (finding) =>
        `<tr><td dir="ltr">${esc(finding.code)}</td><td>${esc(finding.category)}</td><td>${esc(finding.severity)}</td><td>${esc(finding.confidence)}</td><td>${esc(finding.status)}</td><td>${esc(finding.summary)}</td></tr>`,
    )
    .join("");
  const decisions = snapshot.human_decisions
    .map((decision) => `<li><strong>${esc(decision.decision)}</strong> — ${esc(decision.reviewer)} — ${esc(decision.notes)}</li>`)
    .join("");
  const images = snapshot.images
    .map(
      (image) =>
        `<figure><img alt="${esc(image.caption)}" src="${image.data_url}" /><figcaption>${esc(image.caption)} · ${esc(image.media_type === "video" ? "إطار فيديو تجريبي" : "صورة")}</figcaption></figure>`,
    )
    .join("");
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${esc(snapshot.report_code)}</title>
  <style>
    body { font-family: "IBM Plex Sans Arabic", Tahoma, sans-serif; background: #f4f7f8; color: #14202b; margin: 0; padding: 32px; }
    article { max-width: 960px; margin: 0 auto; background: white; border: 1px solid #d5dee6; padding: 28px; }
    h1 { margin: 0 0 4px; font-size: 28px; }
    h2 { font-size: 18px; margin: 28px 0 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { border: 1px solid #d5dee6; padding: 8px; text-align: right; vertical-align: top; }
    th { background: #eef3f6; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
    .banner { background: #fff6df; border: 1px solid #e3a008; padding: 10px 12px; }
    figure { margin: 0; }
    img { width: 100%; height: auto; background: #07111c; }
    .figures { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .muted { color: #526272; font-size: 13px; }
  </style>
</head>
<body>
  <article>
    <p class="muted">VISIONGUARD · وضع المحاكاة</p>
    <h1>تقرير تفتيش ${esc(snapshot.report_code)}</h1>
    <p class="muted">مراجعة ${snapshot.revision} · ${esc(snapshot.disclaimer)}</p>
    <div class="banner">تحليل تجريبي — ليست بيانات درون حية.</div>
    <h2>بيانات التقرير</h2>
    <div class="meta">
      <div>رقم التقرير: <span dir="ltr">${esc(snapshot.report_code)}</span></div>
      <div>رقم التفتيش: <span dir="ltr">${esc(snapshot.inspection_code)}</span></div>
      <div>تاريخ التفتيش: ${esc(snapshot.inspection_date)}</div>
      <div>المنشأة: ${esc(snapshot.facility_name)}</div>
      <div>المنطقة: ${esc(snapshot.zone_name)}</div>
      <div>المعدة: ${esc(snapshot.equipment_label)}</div>
      <div>الموقع: ${esc(snapshot.location_label)}</div>
      <div>المفتش: ${esc(snapshot.inspector_name)}</div>
      <div>النتيجة: ${esc(snapshot.result_label)}</div>
      <div>الخطورة: ${esc(riskLabel[snapshot.risk_level])}</div>
      <div>حالة المعالجة: ${esc(snapshot.treatment_status)}</div>
    </div>
    <h2>نتيجة قائمة الفحص</h2>
    <table><thead><tr><th>البند</th><th>النتيجة</th><th>القراءة</th><th>ملاحظات</th></tr></thead><tbody>${rows}</tbody></table>
    <h2>الصور</h2>
    <div class="figures">${images || "<p>لا توجد صور في هذا الإصدار.</p>"}</div>
    <h2>الملاحظات</h2>
    <ul>${snapshot.observations.map((item) => `<li>${esc(item.body)} — ${esc(item.author)}</li>`).join("") || "<li>لا توجد ملاحظات.</li>"}</ul>
    <h2>نتائج الذكاء الاصطناعي</h2>
    <table><thead><tr><th>المعرف</th><th>الفئة</th><th>الشدة</th><th>الثقة</th><th>الحالة</th><th>الملخص</th></tr></thead><tbody>${findings || "<tr><td colspan='6'>لا توجد نتائج.</td></tr>"}</tbody></table>
    <h2>القرار البشري</h2>
    <ul>${decisions || "<li>لا يوجد قرار بشري مسجل.</li>"}</ul>
    <h2>الإجراءات المقترحة</h2>
    <ul>${snapshot.proposed_actions.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
  </article>
</body>
</html>`;
}

function esc(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
