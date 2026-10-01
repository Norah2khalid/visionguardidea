export function uid(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatSequence(prefix: string, year: number, value: number): string {
  return `${prefix}-${year}-${String(value).padStart(4, "0")}`;
}
