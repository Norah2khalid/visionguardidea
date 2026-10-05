import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Badge, Empty, Panel, controlClass } from "@/components/ui";
import { usePlatform } from "@/hooks/usePlatform";
import { equipmentLabel, facilityName, observationCount, reviewState, userName, visibleInspections } from "@/lib/derive";
import { inspectionResultLabel, riskLabel } from "@/lib/labels";
import type { RiskLevel } from "@/types/domain";
import { formatDate, formatTime } from "@/utils/format";

export function HistoryPage() {
  const { data, role, user } = usePlatform();
  const [params, setParams] = useSearchParams();
  const inspections = visibleInspections(data, role, user.id);
  const query = params.get("q") ?? "";
  const facilityId = params.get("facility") ?? "all";
  const inspectorId = params.get("inspector") ?? "all";
  const risk = params.get("risk") ?? "all";
  const status = params.get("status") ?? "all";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  const rows = useMemo(() => inspections.filter((inspection) => {
    if (status === "completed" && inspection.status !== "completed") return false;
    if (status !== "all" && status !== "completed" && inspection.status !== status) return false;
    if (facilityId !== "all" && inspection.facility_id !== facilityId) return false;
    if (inspectorId !== "all" && inspection.inspector_id !== inspectorId) return false;
    if (risk !== "all" && inspection.risk_level !== risk) return false;
    const day = (inspection.completed_at ?? inspection.started_at).slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    const blob = `${inspection.code} ${equipmentLabel(data, inspection.equipment_id)} ${userName(data, inspection.inspector_id)}`;
    return blob.includes(query.trim());
  }).sort((a, b) => (b.completed_at ?? b.started_at).localeCompare(a.completed_at ?? a.started_at)), [data, facilityId, from, inspections, inspectorId, query, risk, status, to]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next);
  }

  return (
    <Panel title="الأرشيف الدائم">
      <p className="mb-3 text-xs text-muted">السجلات المكتملة لا تُستبدل. أي جولة لاحقة تُنشئ تفتيشًا جديدًا.</p>
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
          <option value="completed">مكتملة</option>
          <option value="in_progress">قيد التنفيذ</option>
          <option value="pending_review">بانتظار المراجعة</option>
          <option value="cancelled">ملغاة</option>
        </select>
      </div>
      {rows.length === 0 ? <Empty title="لا سجلات مطابقة" /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="text-muted">
              <tr>
                {["رقم التفتيش", "التاريخ", "الوقت", "المنشأة", "الموقع", "المعدة", "المفتش", "النتيجة", "الخطورة", "الملاحظات", "التقرير", "حالة المراجعة"].map((head) => <th key={head} className="p-2 text-start">{head}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((inspection) => {
                const location = data.inspection_locations.find((item) => item.id === inspection.location_id);
                const report = data.reports.filter((item) => item.inspection_id === inspection.id).sort((a, b) => b.revision - a.revision)[0];
                const when = inspection.completed_at ?? inspection.started_at;
                return (
                  <tr key={inspection.id} className="border-t border-line">
                    <td className="p-2"><Link className="mono text-cyan" to={`/history/${inspection.id}`}>{inspection.code}</Link></td>
                    <td className="p-2">{formatDate(when)}</td>
                    <td className="p-2">{formatTime(when)}</td>
                    <td className="p-2">{facilityName(data, inspection.facility_id)}</td>
                    <td className="p-2 mono">{location?.code}</td>
                    <td className="p-2">{equipmentLabel(data, inspection.equipment_id)}</td>
                    <td className="p-2">{userName(data, inspection.inspector_id)}</td>
                    <td className="p-2">{inspectionResultLabel[inspection.result]}</td>
                    <td className="p-2">{riskLabel[inspection.risk_level]}</td>
                    <td className="p-2">{observationCount(data, inspection.id)}</td>
                    <td className="p-2">{report ? <Link className="mono text-cyan" to={`/reports/${report.id}`}>{report.code}</Link> : "—"}</td>
                    <td className="p-2"><Badge tone="info">{reviewState(data, inspection)}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
