export function uid(): string {
  return crypto.randomUUID();
}

export function fixedId(group: number, n: number): string {
  return `${group.toString(16).padStart(8, "0")}-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

export function nextCode(existing: string[], prefix: string, pad = 4): string {
  const numbers = existing.map((code) => {
    const match = code.match(/(\d+)\s*$/);
    return match ? Number(match[1]) : 0;
  });
  const next = Math.max(0, ...numbers) + 1;
  return `${prefix}${String(next).padStart(pad, "0")}`;
}
