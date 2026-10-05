import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Badge, Button, ConfirmDialog, Empty, Panel, controlClass } from "@/components/ui";
import { usePlatform } from "@/hooks/usePlatform";
import { facilityName, userName, visibleReports } from "@/lib/derive";
import { reportStatusLabel, riskLabel } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { archiveReport } from "@/services/platform/mutations";
import type { ReportStatus, RiskLevel } from "@/types/domain";
import { formatDate } from "@/utils/format";

export function ReportsPage() {
  const { data, role, user, run } = usePlatform();
  const [params, setParams] = useSearchParams();
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const reports = visibleReports(data, role, user.id);
  const query = params.get("q") ?? "";
  const facilityId = params.get("facility") ?? "all";
  const inspectorId = params.get("inspector") ?? "all";
  const risk = params.get("risk") ?? "all";
  const status = params.get("status") ?? "all";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  const filtered = useMemo(() => reports.filter((report) => {
    if (facilityId !== "all" && report.facility_id !== facilityId) return false;
    if (inspectorId !== "all" && report.inspector_id !== inspectorId) return false;
    if (risk !== "all" && report.risk_level !== risk) return false;
    if (status !== "all" && report.status !== status) return false;
    const day = report.created_at.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    const blob = `${report.code} ${report.title} ${facilityName(data, report.facility_id)} ${userName(data, report.inspector_id)}`;
    return blob.includes(query.trim());
  }), [data, facilityId, from, inspectorId, query, reports, risk, status, to]);

  const counts = {
    total: reports.length,
    fresh: reports.filter((report) => report.status === "new").length,
    review: reports.filter((report) => report.status === "in_review").length,
    done: reports.filter((report) => report.status === "completed").length,
    missing: reports.filter((report) => report.status === "needs_completion").length,
  };
  const awaiting = data.inspections.filter((inspection) => inspection.status === "completed" && !data.reports.some((report) => report.inspection_id === inspection.id));

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next);
  }

  const cards = [
    ["إجمالي التقارير", counts.total, "all"],
    ["جديدة", counts.fresh, "new"],
    ["قيد المراجعة", counts.review, "in_review"],
    ["مكتملة", counts.done, "completed"],
    ["تحتاج استكمال", counts.missing, "needs_completion"],
  ] as const;

  return (
    <div className="grid gap-3">
      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label, value, key]) => (
          <button key={label} className="border border-line bg-panel p-3 text-start hover:border-cyan" onClick={() => setParam("status", key)}>
            <div className="text-xs text-muted">{label}</div>
            <div className="mt-1 text-2xl font-semibold">{value}</div>
          </button>
        ))}
      </section>
      {role === "report_collector" && awaiting.length ? (
        <Panel title="تفتيشات بلا تقرير">
          <ul className="grid gap-2 text-sm">
            {awaiting.map((inspection) => (
              <li key={inspection.id} className="flex flex-wrap items-center justify-between gap-2 border border-line p-2">
                <span className="mono">{inspection.code}</span>
                <Link className="text-cyan" to={`/history/${inspection.id}`}>فتح السجل لإصدار التقرير</Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      <Panel title="سجل التقارير">
        <div className="mb-3 flex flex-wrap gap-2">
          <input className={controlClass + " max-w-xs"} aria-label="بحث" placeholder="بحث" value={query} onChange={(event) => setParam("q", event.target.value)} />
          <input className={controlClass + " mono max-w-[160px]"} aria-label="من تاريخ" type="date" value={from} onChange={(event) => setParam("from", event.target.value)} />
          <input className={controlClass + " mono max-w-[160px]"} aria-label="إلى تاريخ" type="date" value={to} onChange={(event) => setParam("to", event.target.value)} />
          <select className={controlClass + " max-w-[180px]"} aria-label="المنشأة" value={facilityId} onChange={(event) => setParam("facility", event.target.value)}>
            <option value="all">كل المنشآت</option>
            {data.facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}
          </select>
          <select className={controlClass + " max-w-[180px]"} aria-label="المفتش" value={inspectorId} onChange={(event) => setParam("inspector", event.target.value)}>
            <option value="all">كل المفتشين</option>
            {data.users.filter((item) => item.role_code === "inspector").map((inspector) => <option key={inspector.id} value={inspector.id}>{inspector.full_name}</option>)}
          </select>
          <select className={controlClass + " max-w-[140px]"} aria-label="الخطورة" value={risk} onChange={(event) => setParam("risk", event.target.value)}>
            <option value="all">كل الخطورة</option>
            {(Object.keys(riskLabel) as RiskLevel[]).map((item) => <option key={item} value={item}>{riskLabel[item]}</option>)}
          </select>
          <select className={controlClass + " max-w-[160px]"} aria-label="الحالة" value={status} onChange={(event) => setParam("status", event.target.value)}>
            <option value="all">كل الحالات</option>
            {(Object.keys(reportStatusLabel) as ReportStatus[]).map((item) => <option key={item} value={item}>{reportStatusLabel[item]}</option>)}
          </select>
        </div>
        {filtered.length === 0 ? <Empty title="لا تقارير مطابقة" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="text-muted">
                <tr>
                  {["رقم التقرير", "العنوان", "المنشأة", "الموقع", "المفتش", "التاريخ", "الخطورة", "الحالة", "الإجراءات"].map((head) => <th key={head} className="p-2 text-start">{head}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((report) => {
                  const location = data.inspection_locations.find((item) => item.id === report.location_id);
                  return (
                    <tr key={report.id} className="border-t border-line">
                      <td className="p-2 mono">{report.code}</td>
                      <td className="p-2">{report.title}</td>
                      <td className="p-2">{facilityName(data, report.facility_id)}</td>
                      <td className="p-2 mono">{location?.code}</td>
                      <td className="p-2">{userName(data, report.inspector_id)}</td>
                      <td className="p-2">{formatDate(report.created_at)}</td>
                      <td className="p-2">{riskLabel[report.risk_level]}</td>
                      <td className="p-2"><Badge tone={report.status === "completed" ? "ok" : report.status === "needs_completion" ? "warn" : report.status === "archived" ? "neutral" : "info"}>{reportStatusLabel[report.status]}</Badge></td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          <Link to={`/reports/${report.id}`}><Button>عرض</Button></Link>
                          {can(role, "report.manage") && report.status !== "archived" ? <Button variant="danger" onClick={() => setArchiveId(report.id)}>أرشفة</Button> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <ConfirmDialog open={Boolean(archiveId)} title="أرشفة التقرير" body="الأرشفة لا تحذف التقرير ولا تغيّر لقطته." confirmLabel="أرشفة" onClose={() => setArchiveId(null)} onConfirm={() => { if (archiveId) run((current, ctx) => archiveReport(current, archiveId, ctx)); setArchiveId(null); }} />
    </div>
  );
}
