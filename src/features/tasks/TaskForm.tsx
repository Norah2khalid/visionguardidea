import { useState } from "react";
import { Button, Field, controlClass } from "@/components/ui";
import { usePlatform } from "@/hooks/usePlatform";
import { createTask, updateTask, type TaskInput } from "@/services/platform/mutations";
import type { InspectionTask, Priority } from "@/types/domain";
import { priorityLabel } from "@/lib/labels";

export function TaskForm({ task, presetLocationId, onClose }: { task?: InspectionTask | null; presetLocationId?: string | null; onClose: () => void }) {
  const { data, run } = usePlatform();
  const preset = presetLocationId ? data.inspection_locations.find((item) => item.id === presetLocationId) : undefined;
  const [facilityId, setFacilityId] = useState(task?.facility_id ?? preset?.facility_id ?? data.facilities[0]?.id ?? "");
  const [locationId, setLocationId] = useState(task?.location_id ?? preset?.id ?? "");
  const [inspectorId, setInspectorId] = useState(task?.inspector_id ?? "");
  const [title, setTitle] = useState(task?.title ?? "");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "medium");
  const [due, setDue] = useState(task?.due_date ?? "2026-10-12");
  const locations = data.inspection_locations.filter((item) => item.facility_id === facilityId);
  const inspectors = data.users.filter((user) => user.role_code === "inspector");

  return (
    <form className="grid gap-3" onSubmit={(event) => {
      event.preventDefault();
      const input: TaskInput = { title, facility_id: facilityId, location_id: locationId, inspector_id: inspectorId || null, priority, due_date: due };
      const ok = run((current, ctx) => task ? updateTask(current, task.id, input, ctx) : createTask(current, input, ctx));
      if (ok) onClose();
    }}>
      <Field label="عنوان المهمة"><input className={controlClass} value={title} onChange={(event) => setTitle(event.target.value)} required autoFocus /></Field>
      <Field label="المنشأة">
        <select className={controlClass} value={facilityId} onChange={(event) => { setFacilityId(event.target.value); setLocationId(""); }}>
          {data.facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}
        </select>
      </Field>
      <Field label="موقع التفتيش">
        <select className={controlClass} value={locationId} onChange={(event) => setLocationId(event.target.value)} required>
          <option value="">اختر الموقع</option>
          {locations.map((location) => <option key={location.id} value={location.id}>{location.code}</option>)}
        </select>
      </Field>
      <Field label="المفتش">
        <select className={controlClass} value={inspectorId} onChange={(event) => setInspectorId(event.target.value)}>
          <option value="">غير معين</option>
          {inspectors.map((inspector) => <option key={inspector.id} value={inspector.id}>{inspector.full_name}</option>)}
        </select>
      </Field>
      <Field label="الأولوية">
        <select className={controlClass} value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
          {(Object.keys(priorityLabel) as Priority[]).map((item) => <option key={item} value={item}>{priorityLabel[item]}</option>)}
        </select>
      </Field>
      <Field label="تاريخ الاستحقاق">
        <input className={`${controlClass} mono`} dir="ltr" inputMode="numeric" placeholder="2026-10-20" value={due} onChange={(event) => setDue(event.target.value)} required />
      </Field>
      <p className="text-xs text-muted">اكتب التاريخ بالشكل سنة-شهر-يوم، مثل 2026-10-20.</p>
      <div className="flex gap-2">
        <Button type="submit" variant="primary">{task ? "حفظ التعديل" : "إنشاء المهمة"}</Button>
        <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
      </div>
    </form>
  );
}
