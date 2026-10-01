import type { InspectionMethod, InspectionZone } from "@/types/domain";

export interface MethodRecommendation {
  recommended: InspectionMethod[];
  discouraged: InspectionMethod[];
  advisory: string;
  requiresAcknowledgement: boolean;
}

export function recommendInspectionMethods(zone: Pick<InspectionZone, "risk_level" | "human_access" | "recommended_method">): MethodRecommendation {
  const highRisk = zone.risk_level === "high" || zone.human_access === "prohibited";
  if (highRisk) {
    const recommended = Array.from(new Set<InspectionMethod>([zone.recommended_method, "drone_human", "robot_human"]));
    return {
      recommended,
      discouraged: ["human"],
      requiresAcknowledgement: true,
      advisory:
        "المنطقة عالية الخطورة أو الدخول البشري إليها غير مسموح. التوجيه هو إبقاء المفتش خارج المنطقة وإسناد المسح لجهاز مع مراجعة بشرية. هذا توجيه استشاري ولا يُعد تصريحًا تلقائيًا لدخول المنطقة.",
    };
  }
  if (zone.risk_level === "medium" || zone.human_access === "restricted") {
    return {
      recommended: [zone.recommended_method, "human", "drone_human"],
      discouraged: [],
      requiresAcknowledgement: false,
      advisory: "الدخول مقيّد. راجع متطلبات الوقاية وملاحظات السلامة قبل اختيار أسلوب التفتيش. التوجيه استشاري.",
    };
  }
  return {
    recommended: ["human", zone.recommended_method],
    discouraged: [],
    requiresAcknowledgement: false,
    advisory: "منطقة عادية الخطورة. يمكن توثيق التفتيش رقميًا من الميدان دون إرسال جهاز.",
  };
}
