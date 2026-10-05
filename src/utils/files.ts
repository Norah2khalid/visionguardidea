export function readImageFile(file: File): Promise<{ name: string; mime: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("يُقبل ملف صورة فقط."));
      return;
    }
    if (file.size > 900_000) {
      reject(new Error("حجم الصورة يتجاوز حد العرض التجريبي."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, mime: file.type, dataUrl: String(reader.result) });
    reader.onerror = () => reject(new Error("تعذر قراءة الملف."));
    reader.readAsDataURL(file);
  });
}
