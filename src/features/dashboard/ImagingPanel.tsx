import { ImageGallery } from "@/features/inspection/ImageGallery";
import { usePlatform } from "@/hooks/usePlatform";
import { byId, equipmentLabel } from "@/lib/derive";
import { can } from "@/lib/permissions";
import { addImage } from "@/services/platform/mutations";
import { readImageFile } from "@/utils/files";

export function ImagingPanel({ locationId }: { locationId: string | null }) {
  const { data, role, run, notify } = usePlatform();
  const location = locationId ? byId(data.inspection_locations, locationId) : undefined;
  const images = location
    ? data.inspection_images.filter((image) => image.equipment_id === location.equipment_id)
    : [];
  const openInspection = location
    ? data.inspections.find((inspection) => inspection.location_id === location.id && (inspection.status === "in_progress" || inspection.status === "pending_review"))
    : undefined;

  return (
    <div className="grid gap-2">
      <p className="text-xs text-muted">{location ? equipmentLabel(data, location.equipment_id) : "لم يُحدد موقع"} · الإطارات المعروضة تجريبية ما لم تُرفع من الجهاز.</p>
      <ImageGallery
        images={images}
        allowUpload={Boolean(openInspection) && can(role, "inspection.operate")}
        onUpload={(file, caption) => {
          if (!openInspection) {
            notify("لا يوجد تفتيش مفتوح لإرفاق الصورة.", true);
            return;
          }
          void readImageFile(file).then(
            (payload) => run((current, ctx) => addImage(current, openInspection.id, payload, caption, ctx)),
            (error: Error) => notify(error.message, true),
          );
        }}
      />
    </div>
  );
}
