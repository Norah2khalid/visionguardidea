import { useMemo, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { Badge, Button, controlClass } from "@/components/ui";
import { usePlatform } from "@/hooks/usePlatform";
import { byId, equipmentLabel, facilityName, zoneName } from "@/lib/derive";
import { equipmentTypeLabel, markerLabel, riskLabel } from "@/lib/labels";
import type { EquipmentType, MarkerState, RiskLevel } from "@/types/domain";
import { formatDateTime } from "@/utils/format";

const LINKS: [string, string][] = [
  ["T-04", "PL-12"],
  ["PL-12", "PL-18"],
  ["PL-18", "TW-02"],
  ["TW-02", "HX-08"],
  ["T-07", "T-04"],
  ["V-19", "P-03"],
  ["P-03", "P-06"],
  ["T-11", "SK-01"],
];

const MARKER_CLASS: Record<MarkerState, string> = {
  NORMAL: "border-ok bg-ok text-navy",
  WARNING: "border-amber bg-amber text-navy",
  CRITICAL: "border-danger bg-danger text-white",
  INSPECTED: "border-cyan bg-cyan text-navy",
};

export function MonitoringMap({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const { data } = usePlatform();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [query, setQuery] = useState("");
  const [facilityId, setFacilityId] = useState("all");
  const [zoneId, setZoneId] = useState("all");
  const [risk, setRisk] = useState("all");
  const [marker, setMarker] = useState("all");
  const [kind, setKind] = useState("all");
  const drag = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null);

  const locations = useMemo(() => {
    const q = query.trim();
    return data.inspection_locations.filter((location) => {
      const equipment = byId(data.equipment, location.equipment_id);
      if (facilityId !== "all" && location.facility_id !== facilityId) return false;
      if (zoneId !== "all" && location.zone_id !== zoneId) return false;
      if (risk !== "all" && location.risk_level !== risk) return false;
      if (marker !== "all" && location.marker_state !== marker) return false;
      if (kind !== "all" && equipment?.equipment_type !== kind) return false;
      if (!q) return true;
      const blob = `${location.name} ${location.code} ${equipment?.code ?? ""} ${equipment?.name ?? ""} ${facilityName(data, location.facility_id)}`;
      return blob.includes(q);
    });
  }, [data, facilityId, kind, marker, query, risk, zoneId]);

  const selected = data.inspection_locations.find((location) => location.id === selectedId) ?? null;
  const zones = data.zones.filter((zone) => facilityId === "all" || zone.facility_id === facilityId);
  const drone = data.devices.find((device) => device.code === "VG-DRONE-01");

  function point(code: string) {
    const equipment = data.equipment.find((item) => item.code === code);
    return equipment ? data.inspection_locations.find((location) => location.equipment_id === equipment.id) : undefined;
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs text-muted">بحث
          <input className={controlClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="اسم أو معرف" />
        </label>
        <label className="grid gap-1 text-xs text-muted">المنشأة
          <select className={controlClass} value={facilityId} onChange={(event) => { setFacilityId(event.target.value); setZoneId("all"); }}>
            <option value="all">كل المنشآت</option>
            {data.facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted">المنطقة
          <select className={controlClass} value={zoneId} onChange={(event) => setZoneId(event.target.value)}>
            <option value="all">كل المناطق</option>
            {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.code} — {zone.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted">الخطورة
          <select className={controlClass} value={risk} onChange={(event) => setRisk(event.target.value)}>
            <option value="all">الكل</option>
            {(["low", "medium", "high", "critical"] as RiskLevel[]).map((item) => <option key={item} value={item}>{riskLabel[item]}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted">حالة التفتيش
          <select className={controlClass} value={marker} onChange={(event) => setMarker(event.target.value)}>
            <option value="all">الكل</option>
            {(["NORMAL", "WARNING", "CRITICAL", "INSPECTED"] as MarkerState[]).map((item) => <option key={item} value={item}>{markerLabel[item]}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted">نوع المعدة
          <select className={controlClass} value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="all">الكل</option>
            {(Object.keys(equipmentTypeLabel) as EquipmentType[]).map((item) => <option key={item} value={item}>{equipmentTypeLabel[item]}</option>)}
          </select>
        </label>
        <div className="flex gap-1">
          <Button aria-label="تكبير" onClick={() => setZoom((value) => Math.min(2.4, Number((value + 0.2).toFixed(2))))}><Plus size={16} /></Button>
          <Button aria-label="تصغير" onClick={() => setZoom((value) => Math.max(0.8, Number((value - 0.2).toFixed(2))))}><Minus size={16} /></Button>
          <Button aria-label="إعادة ضبط الخريطة" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}><RotateCcw size={16} /></Button>
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-[1fr_280px]">
        <div
          className="relative h-[460px] overflow-hidden border border-line bg-[#07111c] md:h-[540px]"
          onPointerDown={(event) => {
            drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y, moved: false };
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            const dx = event.clientX - drag.current.x;
            const dy = event.clientY - drag.current.y;
            if (Math.hypot(dx, dy) > 4) drag.current.moved = true;
            setPan({ x: drag.current.panX + dx, y: drag.current.panY + dy });
          }}
          onPointerUp={() => { drag.current = null; }}
          onPointerLeave={() => { drag.current = null; }}
        >
          <div className="pointer-events-none absolute start-2 top-2 z-10 flex gap-1">
            <Badge tone="sim">بيانات محاكاة</Badge>
            <Badge tone="neutral">{locations.length} موقعًا ظاهرًا</Badge>
          </div>
          <div className="absolute inset-0" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
            <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              {Array.from({ length: 10 }, (_, index) => (
                <g key={index} stroke="#163044" strokeWidth="0.15">
                  <line x1={index * 10} y1="0" x2={index * 10} y2="100" />
                  <line x1="0" y1={index * 10} x2="100" y2={index * 10} />
                </g>
              ))}
              {zones.map((zone) => {
                const points = data.inspection_locations.filter((location) => location.zone_id === zone.id);
                if (!points.length) return null;
                const minX = Math.max(0, Math.min(...points.map((point) => point.map_x)) - 8);
                const maxX = Math.min(100, Math.max(...points.map((point) => point.map_x)) + 8);
                const minY = Math.max(0, Math.min(...points.map((point) => point.map_y)) - 8);
                const maxY = Math.min(100, Math.max(...points.map((point) => point.map_y)) + 8);
                return <rect key={zone.id} x={minX} y={minY} width={Math.max(8, maxX - minX)} height={Math.max(8, maxY - minY)} fill="rgba(56,189,248,0.04)" stroke="#23445d" strokeWidth="0.3" />;
              })}
              {LINKS.map(([from, to]) => {
                const a = point(from);
                const b = point(to);
                if (!a || !b) return null;
                if (!locations.some((item) => item.id === a.id) || !locations.some((item) => item.id === b.id)) return null;
                return <line key={`${from}-${to}`} x1={a.map_x} y1={a.map_y} x2={b.map_x} y2={b.map_y} stroke="#38bdf8" strokeWidth="0.45" strokeDasharray="1.2 0.8" opacity="0.8" />;
              })}
            </svg>
            {locations.map((location) => {
              const equipment = byId(data.equipment, location.equipment_id);
              const active = location.id === selectedId;
              return (
                <button
                  key={location.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${location.map_x}%`, top: `${location.map_y}%` }}
                  onClick={() => { if (!drag.current?.moved) onSelect(location.id); }}
                  aria-pressed={active}
                  aria-label={`${equipment?.code ?? location.code} ${location.name} — ${markerLabel[location.marker_state]} — خطورة ${riskLabel[location.risk_level]}`}
                >
                  <span className={`mx-auto grid h-7 w-7 place-items-center border text-[10px] font-bold ${MARKER_CLASS[location.marker_state]} ${active ? "ring-2 ring-white" : ""}`}>
                    {equipment?.code.slice(0, 2)}
                  </span>
                  <span className="mt-1 block bg-[#07111c]/90 px-1 text-[10px] text-ink">{equipment?.code}</span>
                  <span className="block text-[10px] text-muted">{markerLabel[location.marker_state]}</span>
                </button>
              );
            })}
            {drone ? (
              <div className="absolute" style={{ left: "24%", top: "34%" }}>
                <Badge tone="sim">VG-DRONE-01 · محاكاة</Badge>
              </div>
            ) : null}
          </div>
        </div>
        <aside className="border border-line bg-[#07111c] p-3 text-sm">
          <h3 className="mb-2 font-semibold">تفاصيل الموقع</h3>
          {!selected ? <p className="text-muted">اختر علامة على الخريطة.</p> : (
            <dl className="grid gap-2">
              <div><dt className="text-muted">اسم المنشأة</dt><dd>{facilityName(data, selected.facility_id)}</dd></div>
              <div><dt className="text-muted">المنطقة</dt><dd>{zoneName(data, selected.zone_id)}</dd></div>
              <div><dt className="text-muted">معرف المعدة</dt><dd className="mono">{equipmentLabel(data, selected.equipment_id)}</dd></div>
              <div><dt className="text-muted">حالة التفتيش</dt><dd>{selected.inspection_status} · {markerLabel[selected.marker_state]}</dd></div>
              <div><dt className="text-muted">آخر تفتيش</dt><dd>{formatDateTime(selected.last_inspection_at)}</dd></div>
              <div><dt className="text-muted">مستوى الخطورة</dt><dd>{riskLabel[selected.risk_level]}</dd></div>
              <div><dt className="text-muted">آخر الملاحظات</dt><dd>{selected.last_notes}</dd></div>
              <div><dt className="text-muted">إحداثيات تجريبية</dt><dd className="mono">{selected.latitude.toFixed(5)} , {selected.longitude.toFixed(5)}</dd></div>
            </dl>
          )}
          <ul className="mt-4 grid gap-1 text-[11px] text-muted">
            <li>طبيعي: حالة مستقرة</li>
            <li>تحذير: مؤشر يحتاج متابعة</li>
            <li>حرج: أولوية فحص</li>
            <li>تم التفتيش: آخر جولة مغلقة</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
