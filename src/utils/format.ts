export function formatNumber(value: number): string {
  return new Intl.NumberFormat("ar-SA").format(value);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(new Date(iso));
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("ar-SA", { timeStyle: "short" }).format(new Date(iso));
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(Math.round(value * 100))}٪`;
}

export function todayStamp(date = new Date()): string {
  return new Intl.DateTimeFormat("ar-SA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function clockStamp(date = new Date()): string {
  return new Intl.DateTimeFormat("ar-SA", { hour: "2-digit", minute: "2-digit" }).format(date);
}

export function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export function isPastDue(dueDate: string, now = new Date()): boolean {
  const end = new Date(`${dueDate}T23:59:59`);
  return now.getTime() > end.getTime();
}
