import { useEffect, useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/utils/cn";

type Tone = "ok" | "warn" | "crit" | "info" | "neutral" | "sim";

const TONE: Record<Tone, string> = {
  ok: "border-ok/40 bg-ok/10 text-ok",
  warn: "border-amber/50 bg-amber/10 text-amber",
  crit: "border-danger/50 bg-danger/10 text-red-200",
  info: "border-cyan/40 bg-cyan/10 text-cyan",
  neutral: "border-line bg-panel2 text-muted",
  sim: "border-cyan/40 bg-[#082033] text-cyan",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 border px-1.5 py-0.5 text-[11px] leading-5", TONE[tone])}>{children}</span>;
}

export function Button({
  variant = "default",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" | "ghost" | "danger" }) {
  const styles = {
    default: "border border-line bg-panel2 text-ink hover:border-cyan/60",
    primary: "border border-cyan bg-cyan font-semibold text-navy hover:bg-cyan/90",
    ghost: "border border-transparent bg-transparent text-ink hover:border-line",
    danger: "border border-danger/50 bg-danger/10 text-red-100 hover:bg-danger/20",
  }[variant];
  return <button className={cn("inline-flex min-h-10 items-center justify-center gap-2 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50", styles, className)} {...props} />;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}

export const controlClass = "min-h-10 w-full border border-line bg-[#07111c] px-2 text-sm text-ink";

export function Banner({ children, tone = "sim" }: { children: ReactNode; tone?: "sim" | "warn" }) {
  return <div className={cn("border px-3 py-2 text-sm", tone === "warn" ? "border-amber/50 bg-amber/10 text-amber" : "border-cyan/40 bg-cyan/10 text-cyan")}>{children}</div>;
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <div className="border border-dashed border-line px-4 py-10 text-center">
      <p className="text-ink">{title}</p>
      {body ? <p className="mt-1 text-sm text-muted">{body}</p> : null}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="max-h-[88vh] w-full max-w-2xl overflow-auto border border-line bg-panel p-4" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" onClick={onClose} aria-label="إغلاق">إغلاق</Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="text-sm text-ink">{body}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
        <Button variant="ghost" onClick={onClose}>تراجع</Button>
      </div>
    </Modal>
  );
}

export function Panel({ title, action, children, id, className }: { title?: string; action?: ReactNode; children: ReactNode; id?: string; className?: string }) {
  return (
    <section id={id} className={cn("border border-line bg-panel p-3", className)}>
      {title ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Toast({ message, error, onClose }: { message: string; error: boolean; onClose: () => void }) {
  return (
    <div role="status" aria-live="polite" className={cn("fixed bottom-4 start-4 z-[60] max-w-sm border px-3 py-2 text-sm shadow-panel", error ? "border-danger/60 bg-[#2a1214] text-red-100" : "border-cyan/50 bg-[#082033] text-ink")}>
      <div className="flex items-start justify-between gap-3">
        <p>{message}</p>
        <button className="text-muted" onClick={onClose} aria-label="إخفاء التنبيه">×</button>
      </div>
    </div>
  );
}
