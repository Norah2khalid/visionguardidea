import { useEffect, useState } from "react";
import { useSession } from "@/app/session";

export function MediaPreview({ path, mime, alt }: { path: string; mime: string; alt: string }) {
  const { backend } = useSession();
  const [url, setUrl] = useState<string | null>(path.startsWith("data:") || path.startsWith("http") || path.startsWith("blob:") ? path : null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (path.startsWith("data:") || path.startsWith("http") || path.startsWith("blob:")) {
      setUrl(path);
      return;
    }
    if (!backend) return;
    let stop = false;
    void backend.storage.resolve(path).then((next) => {
      if (!stop) setUrl(next);
    }).catch((caught: unknown) => {
      if (!stop) setError(caught instanceof Error ? caught.message : "تعذر فتح الملف");
    });
    return () => { stop = true; };
  }, [backend, path]);
  if (error) return <p className="muted">{error}</p>;
  if (!url) return <p className="muted">جارٍ فتح الملف</p>;
  if (mime.startsWith("video/")) return <video className="media-frame" src={url} controls />;
  if (mime === "application/pdf") return <a className="btn" href={url} target="_blank" rel="noreferrer">فتح الملف</a>;
  return <img className="media-frame" src={url} alt={alt} />;
}
