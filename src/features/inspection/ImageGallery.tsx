import { useMemo, useState } from "react";
import { Badge, Button, Empty, Modal } from "@/components/ui";
import { sourceLabel } from "@/lib/labels";
import type { InspectionImage } from "@/types/domain";
import { formatDateTime } from "@/utils/format";

export function ImageGallery({
  images,
  onUpload,
  allowUpload,
}: {
  images: InspectionImage[];
  onUpload?: (file: File, caption: string) => void;
  allowUpload?: boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(images[0]?.id ?? null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [caption, setCaption] = useState("");
  const [videoNote, setVideoNote] = useState(false);
  const active = images.find((image) => image.id === activeId) ?? images[0] ?? null;
  const pair = useMemo(() => {
    if (!active?.comparison_group) return null;
    const group = images.filter((image) => image.comparison_group === active.comparison_group);
    const before = group.find((image) => image.comparison_role === "before");
    const after = group.find((image) => image.comparison_role === "after");
    if (!before || !after) return null;
    return { before, after };
  }, [active, images]);

  if (!images.length && !allowUpload) return <Empty title="لا توجد صور لهذا الاختيار" body="الصور التجريبية تظهر عند اختيار معدة لها سجل تصوير." />;

  return (
    <div className="grid gap-3">
      {active ? (
        <div className="border border-line bg-[#07111c] p-2">
          <button className="block w-full" onClick={() => { setZoom(1); setZoomOpen(true); }} aria-label="تكبير الصورة">
            <img src={active.data_url} alt={active.caption} className="max-h-72 w-full object-contain" />
          </button>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <Badge tone="sim">بيانات تصوير تجريبية</Badge>
            <Badge tone={active.source === "UNAVAILABLE" ? "crit" : "neutral"}>{sourceLabel[active.source]}</Badge>
            <span className="mono">{active.file_name}</span>
            <span>{formatDateTime(active.captured_at)}</span>
          </div>
          <p className="mt-1 text-sm">{active.caption}</p>
          {active.media_type === "video" ? (
            <Button className="mt-2" onClick={() => setVideoNote(true)}>عرض المقطع</Button>
          ) : null}
        </div>
      ) : <Empty title="لا توجد إطارات بعد" body="يمكن للمفتش إرفاق صورة على تفتيش مفتوح." />}
      {pair ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold">مقارنة قبل / بعد</h3>
          <div className="grid gap-2 md:grid-cols-2">
            {[pair.before, pair.after].map((image) => (
              <figure key={image.id} className="border border-line p-2">
                <img src={image.data_url} alt={image.caption} className="h-40 w-full object-cover" />
                <figcaption className="mt-1 text-xs text-muted">{image.comparison_role === "before" ? "السابق" : "الحالي"} · {image.caption}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      ) : null}
      <div className="flex gap-2 overflow-x-auto">
        {images.map((image) => (
          <button key={image.id} className={`w-24 shrink-0 border p-1 ${image.id === active?.id ? "border-cyan" : "border-line"}`} onClick={() => setActiveId(image.id)} aria-label={image.caption}>
            <img src={image.data_url} alt="" className="h-14 w-full object-cover" />
            <span className="block truncate text-[10px] text-muted">{image.media_type === "video" ? "فيديو" : "صورة"}</span>
          </button>
        ))}
      </div>
      {allowUpload && onUpload ? (
        <form className="grid gap-2 border border-line p-2" onSubmit={(event) => {
          event.preventDefault();
          const input = event.currentTarget.elements.namedItem("file") as HTMLInputElement;
          const file = input.files?.[0];
          if (!file) return;
          onUpload(file, caption);
          event.currentTarget.reset();
          setCaption("");
        }}>
          <label className="text-sm text-muted">إرفاق صورة تفتيش
            <input className="mt-1 block w-full text-sm" name="file" type="file" accept="image/*" required />
          </label>
          <label className="text-sm text-muted">وصف الصورة
            <input className="mt-1 min-h-10 w-full border border-line bg-[#07111c] px-2" value={caption} onChange={(event) => setCaption(event.target.value)} />
          </label>
          <Button type="submit" variant="primary">رفع وإرفاق</Button>
        </form>
      ) : null}
      <Modal open={zoomOpen && Boolean(active)} title={active?.caption ?? "معاينة"} onClose={() => setZoomOpen(false)}>
        {active ? (
          <div className="grid gap-2">
            <div className="overflow-auto border border-line bg-black">
              <img src={active.data_url} alt={active.caption} style={{ width: `${zoom * 100}%`, maxWidth: "none" }} />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted">مستوى التكبير
              <input type="range" min={1} max={2.5} step={0.1} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
            </label>
            <p className="text-xs text-muted">{formatDateTime(active.captured_at)} · بيانات تصوير تجريبية</p>
          </div>
        ) : null}
      </Modal>
      <Modal open={videoNote} title="مقطع تجريبي" onClose={() => setVideoNote(false)}>
        <p className="text-sm">لا يوجد بث حي. الإطار المعروض من بيانات تصوير تجريبية والمقطع غير متصل بكاميرا أو درون.</p>
        {active ? <img src={active.data_url} alt={active.caption} className="mt-3 w-full" /> : null}
      </Modal>
    </div>
  );
}
