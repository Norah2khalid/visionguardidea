import type { MissionStatus, PointCategory, Severity } from "@/types/domain";

export interface SimulationStep {
  to_status: MissionStatus;
  stage: number;
  progress: number;
  message: string;
  telemetry?: {
    altitude_m: number;
    speed_mps: number;
    battery_percent: number;
    signal_quality: number;
  };
  sensors?: {
    sensor_code: string;
    measurement_type: string;
    numeric_value: number;
    unit: string;
  }[];
  mediaCaption?: string;
  point?: {
    category: PointCategory;
    description: string;
    severity: Severity;
  };
}

export interface SimulationScenario {
  id: string;
  name: string;
  steps: SimulationStep[];
}

export const TANK_PATROL_SCENARIO: SimulationScenario = {
  id: "tank-patrol-b",
  name: "دورية الخزانات — القطاع B",
  steps: [
    {
      to_status: "DISPATCHED",
      stage: 2,
      progress: 15,
      message: "تم إرسال الجهاز نحو المنطقة المستهدفة ضمن وضع المحاكاة.",
      telemetry: { altitude_m: 2.4, speed_mps: 1.2, battery_percent: 76, signal_quality: 96 },
    },
    {
      to_status: "INSPECTING",
      stage: 3,
      progress: 40,
      message: "وصل الجهاز إلى نطاق الخزانات وبدأ المسح والتصوير.",
      telemetry: { altitude_m: 14.2, speed_mps: 0.8, battery_percent: 74, signal_quality: 94 },
      mediaCaption: "لقطة محاكاة — بداية المسح",
    },
    {
      to_status: "DATA_TRANSMISSION",
      stage: 4,
      progress: 68,
      message: "جارٍ إرسال القراءات والصور التجريبية إلى المنصة.",
      telemetry: { altitude_m: 14.2, speed_mps: 0, battery_percent: 72, signal_quality: 93 },
      sensors: [
        { sensor_code: "TEMP-SURF", measurement_type: "surface_temperature", numeric_value: 42, unit: "°C" },
        { sensor_code: "GAS-TANK-B", measurement_type: "gas_concentration", numeric_value: 12, unit: "ppm" },
      ],
      mediaCaption: "لقطة محاكاة — الخزان ضمن المشهد",
    },
    {
      to_status: "REVIEW_REQUIRED",
      stage: 5,
      progress: 88,
      message: "رُصدت نقطة تحتاج فحصًا. هذه ملاحظة محاكاة وليست تشخيصًا مؤكدًا.",
      telemetry: { altitude_m: 14.2, speed_mps: 0, battery_percent: 71, signal_quality: 92 },
      point: {
        category: "possible_corrosion",
        description: "مؤشر تآكل محتمل على السطح الظاهر. يتطلب مراجعة المفتش ولا يُعد عطلًا مؤكدًا.",
        severity: "medium",
      },
    },
  ],
};

export function simulationStepCount(events: { origin: string; event_type: string }[]): number {
  return events.filter((event) => event.origin === "simulation" && event.event_type === "simulation_step").length;
}
