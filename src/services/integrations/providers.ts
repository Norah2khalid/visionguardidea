export interface IntegrationDescriptor {
  id: string;
  name: string;
  configured: boolean;
  detail: string;
}

export function integrationCatalog(): IntegrationDescriptor[] {
  const gateway = import.meta.env.VITE_DEVICE_GATEWAY_URL;
  return [
    {
      id: "drone-gateway",
      name: "بوابة الدرون والروبوت",
      configured: Boolean(gateway),
      detail: gateway
        ? "العنوان مُعرّف. الإرسال الفعلي غير مفعّل في هذا الإصدار، والمحاكاة تبقى المسار التشغيلي."
        : "غير متصل — وضع المحاكاة متاح",
    },
    {
      id: "iot",
      name: "مستشعرات صناعية",
      configured: false,
      detail: "غير متصل — وضع المحاكاة متاح",
    },
    {
      id: "camera",
      name: "كاميرات حقلية",
      configured: false,
      detail: "غير متصل — وضع المحاكاة متاح",
    },
    {
      id: "vision",
      name: "تحليل بصري",
      configured: false,
      detail: "التحليل الآلي غير متاح. المراجعة البشرية هي المسار المعتمد.",
    },
    {
      id: "gis",
      name: "نظام معلومات جغرافية",
      configured: false,
      detail: "لا توجد إحداثيات جغرافية موثوقة. المخطط التخطيطي هو العرض المعتمد.",
    },
    {
      id: "cmms",
      name: "نظام إدارة الصيانة",
      configured: false,
      detail: "غير متصل. سجلات الصيانة تُحفظ داخل VISIONGUARD.",
    },
  ];
}

export async function probeDeviceGateway(): Promise<"unconfigured" | "reachable" | "unreachable"> {
  const url = import.meta.env.VITE_DEVICE_GATEWAY_URL;
  if (!url) return "unconfigured";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(url, { method: "GET", signal: controller.signal });
    clearTimeout(timer);
    return response.ok ? "reachable" : "unreachable";
  } catch {
    return "unreachable";
  }
}
