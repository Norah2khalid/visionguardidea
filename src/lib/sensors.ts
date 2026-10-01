import type { SensorReading, SensorThreshold } from "@/types/domain";

export interface ReadingInterpretation {
  label: string;
  tone: "success" | "warning" | "critical" | "neutral";
  comparable: boolean;
}

export function interpretReading(
  reading: Pick<SensorReading, "numeric_value" | "quality" | "unit"> | null | undefined,
  threshold: Pick<SensorThreshold, "min_value" | "max_value" | "unit" | "is_active"> | null | undefined,
): ReadingInterpretation {
  if (!reading || reading.quality === "missing" || reading.numeric_value == null) {
    return { label: "غير متوفر", tone: "neutral", comparable: false };
  }
  if (reading.quality === "invalid") {
    return { label: "قراءة غير صالحة", tone: "critical", comparable: false };
  }
  if (reading.quality === "stale") {
    return { label: "قراءة قديمة", tone: "warning", comparable: false };
  }
  if (!threshold || !threshold.is_active) {
    return { label: "لا يوجد حد مُعد", tone: "warning", comparable: false };
  }
  if (threshold.unit !== reading.unit) {
    return { label: "وحدة الحد لا تطابق القراءة", tone: "warning", comparable: false };
  }
  if (threshold.max_value != null && reading.numeric_value > threshold.max_value) {
    return { label: "تجاوز الحد الأعلى", tone: "critical", comparable: true };
  }
  if (threshold.min_value != null && reading.numeric_value < threshold.min_value) {
    return { label: "دون الحد الأدنى", tone: "warning", comparable: true };
  }
  return { label: "ضمن الحد الطبيعي", tone: "success", comparable: true };
}
