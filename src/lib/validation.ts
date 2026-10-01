import { z } from "zod";
import type { Drone, Equipment, InspectionMethod, InspectionTemplate, InspectionZone, Profile, Robot, Sector, Site } from "@/types/domain";
import { INSPECTION_METHODS } from "@/types/domain";
import { deviceKindForMethod, isDeviceMethod, TERMINAL_MISSION_STATUSES } from "@/lib/missionState";
import { recommendInspectionMethods } from "@/lib/recommendations";

export const facilitySchema = z.object({
  name: z.string().trim().min(2, "اسم المنشأة مطلوب"),
  code: z.string().trim().min(2, "رمز المنشأة مطلوب"),
  facility_type: z.string().trim().min(2, "نوع المنشأة مطلوب"),
  description: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  status: z.enum(["active", "inactive", "archived"]).default("active"),
});

export const inspectionWizardSchema = z.object({
  facility_id: z.string().min(1, "اختر المنشأة"),
  site_id: z.string().min(1, "اختر الموقع"),
  sector_id: z.string().min(1, "اختر القطاع"),
  zone_id: z.string().min(1, "اختر المنطقة"),
  equipment_id: z.string().nullable(),
  inspection_type: z.string().trim().min(2, "حدد نوع التفتيش"),
  method: z.enum(INSPECTION_METHODS),
  template_id: z.string().min(1, "اختر قالب الفحص"),
  assigned_inspector_id: z.string().min(1, "عيّن مفتشًا"),
  device_id: z.string().nullable(),
  planned_at: z.string().min(8, "حدد الموعد"),
  risk_acknowledgement: z.string().nullable(),
  notes: z.string().nullable(),
});

export type InspectionWizardInput = z.infer<typeof inspectionWizardSchema>;

export interface InspectionCatalog {
  sites: Site[];
  sectors: Sector[];
  inspection_zones: InspectionZone[];
  equipment: Equipment[];
  inspection_templates: InspectionTemplate[];
  profiles: Profile[];
  drones: Drone[];
  robots: Robot[];
  activeDeviceIds: string[];
}

export function validateInspectionCreation(input: InspectionWizardInput, catalog: InspectionCatalog): { ok: true } | { ok: false; errors: string[] } {
  const parsed = inspectionWizardSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => issue.message) };
  }
  const errors: string[] = [];
  const site = catalog.sites.find((item) => item.id === input.site_id);
  const sector = catalog.sectors.find((item) => item.id === input.sector_id);
  const zone = catalog.inspection_zones.find((item) => item.id === input.zone_id);
  const template = catalog.inspection_templates.find((item) => item.id === input.template_id);
  const inspector = catalog.profiles.find((item) => item.id === input.assigned_inspector_id);
  if (!site || site.facility_id !== input.facility_id) errors.push("الموقع لا يتبع المنشأة المحددة.");
  if (!sector || sector.site_id !== input.site_id) errors.push("القطاع لا يتبع الموقع المحدد.");
  if (!zone || zone.sector_id !== input.sector_id) errors.push("منطقة التفتيش لا تتبع القطاع المحدد.");
  if (input.equipment_id) {
    const equipment = catalog.equipment.find((item) => item.id === input.equipment_id);
    if (!equipment || equipment.facility_id !== input.facility_id) errors.push("المعدة لا تتبع المنشأة.");
    if (equipment && zone && equipment.zone_id && equipment.zone_id !== zone.id) errors.push("المعدة خارج المنطقة المحددة.");
  }
  if (!template || !template.is_active) errors.push("قالب الفحص غير متاح.");
  if (!inspector || !inspector.is_active || (inspector.role_code !== "INSPECTOR" && inspector.role_code !== "ADMIN")) {
    errors.push("المفتش المعيّن غير مؤهل.");
  }
  if (zone && isDeviceMethod(input.method) && !input.device_id) {
    errors.push("أسلوب التفتيش يتطلب جهازًا متاحًا.");
  }
  if (input.device_id) {
    const kind = deviceKindForMethod(input.method);
    const drone = catalog.drones.find((item) => item.id === input.device_id);
    const robot = catalog.robots.find((item) => item.id === input.device_id);
    if (kind === "drone" && !drone) errors.push("الدرون المحددة غير موجودة.");
    if (kind === "robot" && !robot) errors.push("الروبوت المحدد غير موجود.");
    if (kind === null) errors.push("لا يُسنَد جهاز لأسلوب المفتش البشري.");
    const device = drone ?? robot;
    if (device && device.operational_status !== "available") errors.push("الجهاز غير متاح للتعيين.");
    if (device && catalog.activeDeviceIds.includes(device.id)) errors.push("الجهاز مرتبط بمهمة نشطة أخرى.");
  }
  if (zone) {
    const advice = recommendInspectionMethods(zone);
    if (advice.requiresAcknowledgement && input.method === "human") {
      if (!input.risk_acknowledgement || input.risk_acknowledgement.trim().length < 8) {
        errors.push("دخول المنطقة عالية الخطورة يتطلب إقرارًا صريحًا بأن التوجيه استشاري.");
      }
    }
  }
  if (Number.isNaN(Date.parse(input.planned_at))) errors.push("الموعد غير صالح.");
  return errors.length ? { ok: false, errors } : { ok: true };
}

export function deviceRequired(method: InspectionMethod): boolean {
  return isDeviceMethod(method);
}

export function isTerminalMission(status: string): boolean {
  return TERMINAL_MISSION_STATUSES.includes(status as never);
}
