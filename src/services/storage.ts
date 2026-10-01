export interface StoragePort {
  save(file: Blob, objectPath: string): Promise<string>;
  resolve(storagePath: string): Promise<string>;
}

export interface BlobStore {
  put(id: string, blob: Blob): Promise<void>;
  get(id: string): Promise<Blob | null>;
}

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "application/pdf",
]);

export function validateUpload(file: { type: string; size: number }): void {
  if (!ALLOWED.has(file.type)) {
    throw new Error("نوع الملف غير مسموح. المسموح: صور، فيديو MP4/WebM، أو PDF.");
  }
  const max = file.type.startsWith("video/") ? 30 * 1024 * 1024 : 8 * 1024 * 1024;
  if (file.size > max) throw new Error("حجم الملف يتجاوز الحد المسموح.");
}

export function createMemoryStorage(blobs: BlobStore): StoragePort {
  return {
    async save(file, objectPath) {
      validateUpload({ type: file.type || "application/octet-stream", size: file.size });
      await blobs.put(objectPath, file);
      return `local://${objectPath}`;
    },
    async resolve(storagePath) {
      if (storagePath.startsWith("data:") || storagePath.startsWith("blob:") || storagePath.startsWith("http")) return storagePath;
      if (storagePath.startsWith("local://")) {
        const blob = await blobs.get(storagePath.slice("local://".length));
        if (!blob) throw new Error("الملف غير موجود في التخزين المحلي.");
        if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") return URL.createObjectURL(blob);
        return storagePath;
      }
      return storagePath;
    },
  };
}

export function createUnavailableStorage(): StoragePort {
  return {
    async save() {
      throw new Error("تخزين الملفات غير مهيأ.");
    },
    async resolve(storagePath) {
      if (storagePath.startsWith("data:")) return storagePath;
      throw new Error("تعذر فتح الملف.");
    },
  };
}
