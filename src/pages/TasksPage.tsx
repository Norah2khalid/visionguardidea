import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Badge, Button, Empty, Modal, Panel, controlClass } from "@/components/ui";
import { TaskForm } from "@/features/tasks/TaskForm";
import { usePlatform } from "@/hooks/usePlatform";
import { equipmentLabel, facilityName, isTaskOverdue, userName, visibleTasks, zoneName } from "@/lib/derive";
import { equipmentTypeLabel, markerLabel, priorityLabel, riskLabel, taskStatusLabel } from "@/lib/labels";
import { can } from "@/lib/permissions";
import type { TaskStatus } from "@/types/domain";
import { formatDate } from "@/utils/format";
import { cn } from "@/utils/cn";

export function TasksPage() {
  const { data, role, user } = usePlatform();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "locations" ? "locations" : "tasks";
  const [creating, setCreating] = useState(false);
  const [presetLocation, setPresetLocation] = useState<string | null>(null);
  const status = params.get("status") ?? "all";
  const facilityId = params.get("facility") ?? "all";
  const priority = params.get("priority") ?? "all";
  const query = params.get("q") ?? "";
  const locationFilter = params.get("location") ?? "all";
  const tasks = visibleTasks(data, role, user.id);

  const filtered = useMemo(() => tasks.filter((task) => {
    if (facilityId !== "all" && task.facility_id !== facilityId) return false;
    if (priority !== "all" && task.priority !== priority) return false;
    if (locationFilter !== "all" && task.location_id !== locationFilter) return false;
    if (status === "active" && (task.status === "completed" || task.status === "cancelled")) return false;
    if (status === "overdue" && !isTaskOverdue(task)) return false;
    if (status !== "all" && status !== "active" && status !== "overdue" && task.status !== status) return false;
    const blob = `${task.code} ${task.title} ${equipmentLabel(data, task.equipment_id)} ${userName(data, task.inspector_id)}`;
    return blob.includes(query.trim());
  }), [data, facilityId, locationFilter, priority, query, status, tasks]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next);
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex border border-line">
          <button className={cn("min-h-10 px-3 text-sm", tab === "tasks" && "bg-cyan text-navy")} onClick={() => setParam("tab", "tasks")}>المهام</button>
          <button className={cn("min-h-10 px-3 text-sm", tab === "locations" && "bg-cyan text-navy")} onClick={() => setParam("tab", "locations")}>مواقع التفتيش</button>
        </div>
        {can(role, "task.create") ? <Button variant="primary" onClick={() => { setPresetLocation(null); setCreating(true); }}>إنشاء مهمة</Button> : <Badge tone="neutral">الإنشاء متاح للمدير</Badge>}
      </div>
      <div className={cn("grid gap-3", tab === "tasks" ? "xl:grid-cols-[1.3fr_0.7fr]" : "")}>
        <Panel title="المهام" className={tab === "locations" ? "hidden xl:block" : ""}>
          <div className="mb-3 flex flex-wrap gap-2">
            <input className={controlClass + " max-w-xs"} placeholder="بحث" value={query} onChange={(event) => setParam("q", event.target.value)} aria-label="بحث في المهام" />
            <select className={controlClass + " max-w-[180px]"} value={status} onChange={(event) => setParam("status", event.target.value)} aria-label="حالة المهمة">
              <option value="all">كل الحالات</option>
              <option value="active">النشطة</option>
              <option value="overdue">متأخرة</option>
              {(Object.keys(taskStatusLabel) as TaskStatus[]).map((item) => <option key={item} value={item}>{taskStatusLabel[item]}</option>)}
            </select>
            <select className={controlClass + " max-w-[180px]"} value={facilityId} onChange={(event) => setParam("facility", event.target.value)} aria-label="المنشأة">
              <option value="all">كل المنشآت</option>
              {data.facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}
            </select>
            <select className={controlClass + " max-w-[160px]"} value={priority} onChange={(event) => setParam("priority", event.target.value)} aria-label="الأولوية">
              <option value="all">كل الأولويات</option>
              {(Object.keys(priorityLabel) as (keyof typeof priorityLabel)[]).map((item) => <option key={item} value={item}>{priorityLabel[item]}</option>)}
            </select>
          </div>
          {filtered.length === 0 ? <Empty title="لا مهام مطابقة" body="غيّر التصفية أو أنشئ مهمة جديدة." /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="text-muted">
                  <tr>
                    {["رقم المهمة", "العنوان", "المنشأة", "الموقع", "المعدة", "المفتش", "الأولوية", "الاستحقاق", "الحالة"].map((head) => <th key={head} className="p-2 text-start">{head}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((task) => {
                    const location = data.inspection_locations.find((item) => item.id === task.location_id);
                    const overdue = isTaskOverdue(task);
                    return (
                      <tr key={task.id} className="border-t border-line">
                        <td className="p-2"><Link className="mono text-cyan" to={`/tasks/${task.id}`}>{task.code}</Link></td>
                        <td className="p-2">{task.title}</td>
                        <td className="p-2">{facilityName(data, task.facility_id)}</td>
                        <td className="p-2 mono">{location?.code}</td>
                        <td className="p-2">{equipmentLabel(data, task.equipment_id)}</td>
                        <td className="p-2">{userName(data, task.inspector_id)}</td>
                        <td className="p-2">{priorityLabel[task.priority]}</td>
                        <td className="p-2">{formatDate(task.due_date)}</td>
                        <td className="p-2"><Badge tone={task.status === "completed" ? "ok" : task.status === "cancelled" ? "neutral" : overdue ? "crit" : "info"}>{overdue ? "متأخرة" : taskStatusLabel[task.status]}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel title="مواقع التفتيش" className={tab === "tasks" ? "hidden xl:block" : ""}>
          <div className="grid gap-3">
            {data.facilities.map((facility) => (
              <section key={facility.id} className="border border-line p-2">
                <h3 className="font-semibold">{facility.name}</h3>
                <p className="text-xs text-muted">{facility.region} · {facility.code}</p>
                {data.zones.filter((zone) => zone.facility_id === facility.id).map((zone) => (
                  <div key={zone.id} className="mt-2 border-t border-line pt-2">
                    <div className="text-sm">{zone.code} — {zone.name} · خطورة {riskLabel[zone.risk_level]}</div>
                    {data.equipment.filter((item) => item.zone_id === zone.id).map((equipment) => {
                      const location = data.inspection_locations.find((item) => item.equipment_id === equipment.id);
                      if (!location) return null;
                      return (
                        <div key={equipment.id} className="mt-2 grid gap-1 bg-[#07111c] p-2 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <button className="text-start" onClick={() => { setParam("location", location.id); setParam("tab", "tasks"); }}>
                              <span className="mono text-cyan">{equipment.code}</span> {equipment.name}
                            </button>
                            <Badge tone={location.marker_state === "CRITICAL" ? "crit" : location.marker_state === "WARNING" ? "warn" : location.marker_state === "INSPECTED" ? "info" : "ok"}>{markerLabel[location.marker_state]}</Badge>
                          </div>
                          <div className="text-xs text-muted">{equipmentTypeLabel[equipment.equipment_type]} · {zoneName(data, zone.id)} · {location.code}</div>
                          <div className="text-xs text-muted">آخر تفتيش {formatDate(location.last_inspection_at)} · القادم {location.next_inspection_at ?? "—"}</div>
                          <div className="mono text-[11px] text-muted">{location.latitude.toFixed(5)} , {location.longitude.toFixed(5)}</div>
                          {can(role, "task.create") ? <Button onClick={() => { setPresetLocation(location.id); setCreating(true); }}>مهمة على هذا الموقع</Button> : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </section>
            ))}
          </div>
        </Panel>
      </div>
      <Modal open={creating} title="مهمة تفتيش" onClose={() => setCreating(false)}>
        <TaskForm presetLocationId={presetLocation} onClose={() => setCreating(false)} />
      </Modal>
    </div>
  );
}
