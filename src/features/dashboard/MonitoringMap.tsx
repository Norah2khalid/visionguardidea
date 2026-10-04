import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button, RiskBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { equipmentTypeLabel, inspectionStatusLabel, pointCategoryLabel, riskLabel } from "@/lib/labels";
import type { AppState, Equipment, InspectionStatus, RiskLevel } from "@/types/domain";

type MarkerTone = "normal" | "warning" | "critical" | "inspected";

function markerTone(equipment: Equipment, state: AppState): MarkerTone {
  const points = state.inspection_points.filter((point) => point.equipment_id === equipment.id && point.review_status === "pending");
  if (points.some((point) => point.severity === "critical" || point.severity === "high") || equipment.risk_level === "high") return "critical";
  if (points.length || equipment.risk_level === "medium") return "warning";
  const inspected = state.inspections.some((item) => item.equipment_id === equipment.id && (item.status === "COMPLETED" || item.status === "CLOSED"));
  if (inspected) return "inspected";
  return "normal";
}

export function MonitoringMap({ state }: { state: AppState }) {
  const [facilityId, setFacilityId] = useState("");
  const [status, setStatus] = useState("");
  const [risk, setRisk] = useState("");
  const [query, setQuery] = useState("");
  const [scale, setScale] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const equipment = useMemo(() => state.equipment.filter((item) => {
    if (facilityId && item.facility_id !== facilityId) return false;
    if (risk && item.risk_level !== risk) return false;
    if (status) {
      const latest = latestInspection(state, item.id);
      if ((latest?.status ?? "") !== status) return false;
    }
    const zone = state.inspection_zones.find((row) => row.id === item.zone_id);
    const haystack = `${item.name} ${item.code} ${zone?.name ?? ""}`.toLowerCase();
    if (query && !haystack.includes(query.trim().toLowerCase())) return false;
    return true;
  }), [facilityId, query, risk, state, status]);

  const selected = state.equipment.find((item) => item.id === selectedId) ?? null;
  const selectedZone = selected ? state.inspection_zones.find((item) => item.id === selected.zone_id) ?? null : null;
  const selectedFacility = selected ? state.facilities.find((item) => item.id === selected.facility_id) ?? null : null;
  const selectedInspection = selected ? latestInspection(state, selected.id) : null;
  const findings = selected ? state.inspection_points.filter((point) => point.equipment_id === selected.id) : [];

  return (
    <div className="grid cols-2">
      <div>
        <div className="filters" style={{ marginBottom: 8 }}>
          <input className="input" placeholder="بحث عن موقع أو معدة" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select className="select" value={facilityId} onChange={(event) => setFacilityId(event.target.value)}>
            <option value="">كل المنشآت</option>
            {state.facilities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select className="select" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">كل حالات التفتيش</option>
            {(["SCHEDULED", "IN_PROGRESS", "REVIEW_REQUIRED", "COMPLETED", "CANCELLED"] as InspectionStatus[]).map((item) => <option key={item} value={item}>{inspectionStatusLabel[item]}</option>)}
          </select>
          <select className="select" value={risk} onChange={(event) => setRisk(event.target.value)}>
            <option value="">كل درجات الخطورة</option>
            {(Object.keys(riskLabel) as RiskLevel[]).map((item) => <option key={item} value={item}>{riskLabel[item]}</option>)}
          </select>
          <Button type="button" onClick={() => setScale((value) => Math.min(2.4, Number((value + 0.2).toFixed(2))))}>تكبير</Button>
          <Button type="button" onClick={() => setScale((value) => Math.max(0.8, Number((value - 0.2).toFixed(2))))}>تصغير</Button>
        </div>
        <div className="map-frame">
          <svg viewBox="0 0 100 100" className="layout-map" style={{ transform: `scale(${scale})`, transformOrigin: "center" }}>
            {state.inspection_zones.filter((zone) => !facilityId || zone.facility_id === facilityId).map((zone) => (
              <polygon key={zone.id} points={zone.boundary.points.map((point) => `${point.x},${point.y}`).join(" ")} className={`zone-shape risk-${zone.risk_level}`} />
            ))}
            {equipment.map((item) => {
              const tone = markerTone(item, state);
              const x = item.position_x ?? 50;
              const y = item.position_y ?? 50;
              return (
                <g key={item.id} className="map-marker" onClick={() => setSelectedId(item.id)}>
                  <circle cx={x} cy={y} r={selectedId === item.id ? 3.4 : 2.6} className={`marker marker-${tone}`} />
                  <text x={x + 3.2} y={y + 1} className="marker-label">{item.code}</text>
                </g>
              );
            })}
          </svg>
          <p className="muted map-note">مخطط محاكاة للمواقع المخزنة. الإحداثيات الجغرافية غير متوفرة، وهذا ليس بثًا من درون.</p>
        </div>
        <div className="legend">
          <span><i className="marker marker-normal" /> عادي</span>
          <span><i className="marker marker-warning" /> تنبيه</span>
          <span><i className="marker marker-critical" /> حرج</span>
          <span><i className="marker marker-inspected" /> مُفتَّش</span>
        </div>
      </div>
      <div>
        {selected && selectedFacility ? (
          <div className="grid">
            <div>
              <strong>{selectedFacility.name}</strong>
              <p className="muted">{selectedZone?.name ?? "منطقة غير محددة"} — {selected.code}</p>
              <p>{equipmentTypeLabel[selected.equipment_type]} <RiskBadge risk={selected.risk_level} /></p>
              <p>حالة آخر تفتيش: {selectedInspection ? inspectionStatusLabel[selectedInspection.status] : "لا يوجد سجل"}</p>
              <p>آخر تفتيش: {formatDateTime(selected.last_inspection_at ?? selectedInspection?.completed_at)}</p>
              <p>الإحداثيات: {selectedFacility.latitude == null ? "غير متوفرة — يُستخدم موضع المخطط فقط" : `${selectedFacility.latitude}, ${selectedFacility.longitude}`}</p>
            </div>
            <div>
              <strong>الملاحظات المرتبطة</strong>
              {findings.length === 0 ? <p className="muted">لا توجد ملاحظات على هذه المعدة.</p> : findings.map((point) => <p key={point.id}>{pointCategoryLabel[point.category]} — {point.description}</p>)}
            </div>
            <div className="actions">
              <Link className="btn" to={`/work?tab=tasks&equipment=${selected.id}`}>المهام</Link>
              <Link className="btn" to={`/reports?equipment=${selected.id}`}>التقارير</Link>
              <Link className="btn" to={`/history?equipment=${selected.id}`}>السجل</Link>
              <a className="btn" href="#imaging">الصور</a>
            </div>
          </div>
        ) : <p className="muted">اختر مؤشرًا لعرض المنشأة والمنطقة والمعدة وحالة التفتيش.</p>}
      </div>
    </div>
  );
}

function latestInspection(state: AppState, equipmentId: string) {
  return state.inspections.filter((item) => item.equipment_id === equipmentId).sort((a, b) => (b.completed_at ?? b.planned_at ?? b.created_at).localeCompare(a.completed_at ?? a.planned_at ?? a.created_at))[0] ?? null;
}
