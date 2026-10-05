import { byId, checklistFor, facilityName, findingsFor } from "@/lib/derive";
import type { AnalysisInput } from "@/services/ai/types";
import type { AppData } from "@/types/domain";

export function buildAnalysisInput(data: AppData, inspectionId: string): AnalysisInput | null {
  const inspection = byId(data.inspections, inspectionId);
  const equipment = inspection ? byId(data.equipment, inspection.equipment_id) : undefined;
  if (!inspection || !equipment) return null;
  const { items } = checklistFor(data, inspectionId);
  return {
    inspectionId,
    inspectionCode: inspection.code,
    facilityId: inspection.facility_id,
    facilityName: facilityName(data, inspection.facility_id),
    equipmentId: equipment.id,
    equipmentCode: equipment.code,
    items: items.map((item) => ({
      key: item.item_key,
      label: item.label,
      response: item.response,
      numeric: item.numeric_value,
    })),
    existingCategories: findingsFor(data, inspectionId).map((finding) => finding.category),
  };
}
