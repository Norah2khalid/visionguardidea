import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Barcode = Tables<"barcodes">;
export const barcodeStorage = () => supabase.storage.from("event-barcodes");
export async function imageUrl(path: string) {
  const { data, error } = await barcodeStorage().createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}
export async function downloadBarcode(barcode: Barcode) {
  const { data, error } = await barcodeStorage().download(barcode.image_path);
  if (error || !data) throw error ?? new Error("image_unavailable");
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = barcode.original_name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}