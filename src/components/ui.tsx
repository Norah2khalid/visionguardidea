import type { ButtonHTMLAttributes, ReactNode } from "react";
import { inspectionStatusLabel, methodLabel, missionStatusLabel, riskLabel, severityLabel, toneForInspection, toneForRisk, toneForSeverity } from "@/lib/labels";
import type { InspectionStatus, MissionStatus, RiskLevel, Severity } from "@/types/domain";

export function Button({ variant = "default", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" | "ghost" | "danger" }) {
  const variantClass = variant === "primary" ? "btn-primary" : variant === "ghost" ? "btn-ghost" : variant === "danger" ? "btn-danger" : "btn";
  return <button className={`${variantClass} ${className}`} {...props} />;
}

export function Badge({ tone = "neutral", children }: { tone?: "ok" | "warn" | "crit" | "info" | "neutral"; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function InspectionBadge({ status }: { status: InspectionStatus }) {
  return <Badge tone={toneForInspection(status)}>{inspectionStatusLabel[status]}</Badge>;
}

export function MissionBadge({ status }: { status: MissionStatus }) {
  const tone = status === "COMPLETED" ? "ok" : status === "FAILED" || status === "CANCELLED" ? "crit" : status === "REVIEW_REQUIRED" || status === "INTERRUPTED" ? "warn" : "info";
  return <Badge tone={tone}>{missionStatusLabel[status]}</Badge>;
}

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  return <Badge tone={toneForRisk(risk)}>{riskLabel[risk]}</Badge>;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <Badge tone={toneForSeverity(severity)}>{severityLabel[severity]}</Badge>;
}

export function MethodText({ method }: { method: keyof typeof methodLabel }) {
  return <>{methodLabel[method]}</>;
}

export function Panel({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel">
      {(title || action) && (
        <div className="page-title" style={{ marginBottom: 8 }}>
          {title ? <h2>{title}</h2> : <span />}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p className="muted" style={{ margin: "6px 0 0" }}>{subtitle}</p> : null}
      </div>
      {actions ? <div className="actions">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {body ? <p>{body}</p> : null}
      {action}
    </div>
  );
}

export function Loading({ label = "جارٍ التحميل" }: { label?: string }) {
  return <div className="loading" role="status">{label}</div>;
}

export function ErrorState({ message }: { message: string }) {
  return <div className="error" role="alert">{message}</div>;
}

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error ? <small className="error">{error}</small> : null}
    </label>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-back" role="presentation" onClick={onClose}>
      <div className="panel modal" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="page-title">
          <h2>{title}</h2>
          <Button variant="ghost" onClick={onClose}>إغلاق</Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="pager">
      <Button disabled={page <= 1} onClick={() => onPage(page - 1)}>السابق</Button>
      <span className="mono">{page} / {pages}</span>
      <Button disabled={page >= pages} onClick={() => onPage(page + 1)}>التالي</Button>
    </div>
  );
}
