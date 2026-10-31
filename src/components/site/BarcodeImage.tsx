import { useEffect, useState } from "react";
import { Download, Maximize2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { type Barcode, imageUrl, downloadBarcode } from "@/lib/barcodes";
import { UI } from "@/lib/content";

export function BarcodeImage({
  barcode,
  compact = false,
}: {
  barcode: Barcode;
  compact?: boolean;
}) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      imageUrl(barcode.image_path)
        .then((value) => {
          if (!active) return;
          const preload = new Image();
          preload.onload = () => {
            if (active) {
              setUrl(value);
              setFailed(false);
            }
          };
          preload.onerror = () => {
            if (active) setFailed(true);
          };
          preload.src = value;
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    refresh();
    const timer = window.setInterval(refresh, 50 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [barcode.image_path]);
  return (
    <div className={compact ? "w-36 shrink-0 space-y-2 text-center" : "space-y-3"}>
      {compact && <p className="text-xs font-bold text-foreground">{UI.scan}</p>}
      <Button
        variant="ghost"
        className="h-auto w-full p-0"
        aria-label={`${UI.fullImage}: ${barcode.title}`}
        onClick={() => setOpen(true)}
        disabled={!url || failed}
      >
        {failed ? (
          <span className="text-sm text-destructive">{UI.imageError}</span>
        ) : url ? (
          <img
            src={url}
            alt={barcode.title}
            onError={() => setFailed(true)}
            className={`w-full rounded-md bg-card object-contain ${compact ? "h-36" : "h-52"}`}
          />
        ) : (
          <Loader2 className="h-8 w-8 animate-spin" />
        )}
      </Button>
      {!compact && <p className="break-words text-sm">{barcode.title}</p>}
      {!compact && barcode.description && (
        <p className="break-words text-xs text-muted-foreground">{barcode.description}</p>
      )}
      {!compact && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            title={UI.fullImage}
            aria-label={UI.fullImage}
            onClick={() => setOpen(true)}
            disabled={!url}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            title={UI.download}
            aria-label={UI.download}
            onClick={() => downloadBarcode(barcode).catch(() => toast.error(UI.operationError))}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] overflow-auto sm:max-w-3xl">
          <DialogTitle>{barcode.title}</DialogTitle>
          {url && <img src={url} alt={barcode.title} className="h-auto w-full object-contain" />}
          <Button
            onClick={() => downloadBarcode(barcode).catch(() => toast.error(UI.operationError))}
          >
            <Download className="h-4 w-4" />
            {UI.download}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
