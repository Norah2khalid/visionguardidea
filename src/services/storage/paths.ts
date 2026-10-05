export function inspectionImagePath(facilityId: string, inspectionId: string, fileName: string): string {
  return `inspection-media/${facilityId}/${inspectionId}/${fileName}`;
}

export function inspectionVideoPath(facilityId: string, inspectionId: string, fileName: string): string {
  return `inspection-videos/${facilityId}/${inspectionId}/${fileName}`;
}

export function reportAttachmentPath(facilityId: string, reportId: string, fileName: string): string {
  return `report-attachments/${facilityId}/${reportId}/${fileName}`;
}

export function documentPath(facilityId: string, fileName: string): string {
  return `documents/${facilityId}/${fileName}`;
}
