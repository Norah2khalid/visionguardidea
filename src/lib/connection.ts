import type { Mission, TelemetryRecord } from "@/types/domain";

export type ConnectionMode = "simulation" | "live" | "stale" | "offline" | "unavailable" | "demo_record";

export function connectionMode(input: {
  mission: Pick<Mission, "is_simulation" | "status"> | null;
  latest: Pick<TelemetryRecord, "source" | "recorded_at" | "quality"> | null;
  gatewayConfigured: boolean;
  now?: number;
}): ConnectionMode {
  if (!input.mission && !input.latest) return "unavailable";
  if (input.latest?.source === "seed") return "demo_record";
  if (input.mission?.is_simulation || input.latest?.source === "simulation") return "simulation";
  if (!input.gatewayConfigured) return "unavailable";
  if (!input.latest || input.latest.quality === "missing") return "offline";
  const age = (input.now ?? Date.now()) - Date.parse(input.latest.recorded_at);
  if (input.latest.quality === "stale" || age > 30_000) return "stale";
  if (input.latest.source === "device") return "live";
  return "unavailable";
}

export const connectionLabel: Record<ConnectionMode, string> = {
  simulation: "وضع المحاكاة — البيانات تجريبية",
  live: "مصدر جهاز متصل",
  stale: "بيانات قديمة",
  offline: "المصدر غير متصل",
  unavailable: "غير متصل — وضع المحاكاة متاح",
  demo_record: "سجل بيانات تجريبية",
};
