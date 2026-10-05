import type { AnalysisFindingDraft, AnalysisInput, AnalysisOutput, AiService } from "@/services/ai/types";

const DISCLAIMER = "تحليل تجريبي مبني على قائمة الفحص المخزنة، وليس نموذج رؤية حاسوبية متصلًا.";

export const mockAiService: AiService = {
  providerId: "mock",
  isDemo: true,
  async analyze(input: AnalysisInput): Promise<AnalysisOutput> {
    return analyzeDemo(input);
  },
};

export function analyzeDemo(input: AnalysisInput): AnalysisOutput {
  const drafts: AnalysisFindingDraft[] = [];
  const response = (key: string) => input.items.find((item) => item.key === key)?.response ?? null;
  const numeric = (key: string) => input.items.find((item) => item.key === key)?.numeric ?? null;
  const leak = response("leak");
  const corrosion = response("corrosion");
  const visual = response("visual");
  const condition = response("condition");
  const temperature = numeric("temperature");

  if (leak === "fail") {
    drafts.push({
      category: "possible_leak",
      severity: "critical",
      confidence: 0.84,
      summary: `مؤشر تسرب محتمل على ${input.equipmentCode} وفق بند قائمة الفحص. ${DISCLAIMER}`,
      frame: "tank",
      heat: temperature ?? 70,
    });
  } else if (leak === "warning") {
    drafts.push({
      category: "possible_leak",
      severity: "medium",
      confidence: 0.66,
      summary: `مؤشر تسرب يحتاج معاينة بشرية على ${input.equipmentCode}. ${DISCLAIMER}`,
      frame: "pipe",
      heat: temperature ?? 60,
    });
  }

  if (corrosion === "fail" || corrosion === "warning") {
    drafts.push({
      category: "corrosion",
      severity: corrosion === "fail" ? "high" : "medium",
      confidence: corrosion === "fail" ? 0.8 : 0.72,
      summary: `علامات تآكل مسجلة في قائمة الفحص للمعدة ${input.equipmentCode}. ${DISCLAIMER}`,
      frame: "corrosion",
      heat: 48,
    });
  }

  if (temperature != null && temperature >= 80) {
    drafts.push({
      category: "abnormal_heat",
      severity: temperature >= 90 ? "high" : "medium",
      confidence: 0.88,
      summary: `القراءة الحرارية المخزنة ${temperature}°C أعلى من عتبة العرض التجريبية 80°C.`,
      frame: "thermal",
      heat: temperature,
    });
  }

  if (condition === "fail" || visual === "fail") {
    drafts.push({
      category: condition === "fail" ? "equipment_fault" : "visual_change",
      severity: "high",
      confidence: 0.7,
      summary: `خلل أو تغير بصري مسجل ميدانيًا على ${input.equipmentCode}. ${DISCLAIMER}`,
      frame: condition === "fail" ? "pump" : "valve",
      heat: temperature ?? 50,
    });
  }

  if (!drafts.length && input.items.some((item) => item.response === "warning")) {
    drafts.push({
      category: "needs_followup",
      severity: "low",
      confidence: 0.61,
      summary: `توجد بنود تحذيرية في القائمة دون مؤشر حرج. ${DISCLAIMER}`,
      frame: "tower",
      heat: temperature ?? 45,
    });
  }

  const findings = drafts.filter((draft) => !input.existingCategories.includes(draft.category));
  const summary = findings.length
    ? `تحليل تجريبي: ${findings.length} ملاحظة مرشحة للمراجعة البشرية. ليست تنبؤًا تشغيليًا معتمدًا.`
    : "تحليل تجريبي: لا ملاحظات إضافية في هذه العينة. القرار النهائي يبقى بشريًا.";

  return { provider: "mock", isDemo: true, summary, findings };
}
