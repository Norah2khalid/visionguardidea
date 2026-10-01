import type { ChecklistResponse, ScoringRules } from "@/types/domain";

export interface ScoreItemInput {
  id?: string;
  category: string;
  label?: string;
  weight: number;
  critical: boolean;
  response: ChecklistResponse | null;
}

export interface CategoryScore {
  category: string;
  score: number;
  weight: number;
  scored_items: number;
}

export interface ScoreResult {
  overall: number | null;
  band: string | null;
  categories: CategoryScore[];
  hasCriticalFailure: boolean;
  completionRatio: number;
  unanswered: number;
  applicable: number;
  explanation: string[];
}

const DEFAULT_BANDS = [
  { min: 90, label: "ممتاز" },
  { min: 80, label: "جيد جدًا" },
  { min: 70, label: "جيد" },
  { min: 0, label: "يحتاج تحسين" },
];

export function responsePoints(response: ChecklistResponse | null, rules: ScoringRules): number | null {
  if (!response || response === "not_applicable") return null;
  if (response === "pass") return rules.passValue ?? 100;
  if (response === "fail") return rules.failValue ?? 0;
  return rules.needsReviewValue ?? 50;
}

export function scoreBand(overall: number | null, rules: ScoringRules): string | null {
  if (overall == null) return null;
  const bands = [...(rules.bands?.length ? rules.bands : DEFAULT_BANDS)].sort((a, b) => b.min - a.min);
  return bands.find((band) => overall >= band.min)?.label ?? null;
}

function weightedAverage(parts: { value: number; weight: number }[]): number | null {
  const weight = parts.reduce((sum, part) => sum + part.weight, 0);
  if (weight <= 0) return null;
  const total = parts.reduce((sum, part) => sum + part.value * part.weight, 0);
  return Math.round(total / weight);
}

export function scoreChecklist(items: ScoreItemInput[], rules: ScoringRules = {}): ScoreResult {
  const explanation: string[] = [];
  let unanswered = 0;
  let applicable = 0;
  const byCategory = new Map<string, { value: number; weight: number }[]>();

  for (const item of items) {
    const points = responsePoints(item.response, rules);
    if (item.response === "not_applicable") {
      explanation.push(`«${item.category} / ${item.label || "بند"}»: لا ينطبق، واستُبعد من الدرجة.`);
      continue;
    }
    applicable += 1;
    if (points == null) {
      unanswered += 1;
      continue;
    }
    const weight = item.weight > 0 ? item.weight : 1;
    const bucket = byCategory.get(item.category) ?? [];
    bucket.push({ value: points, weight });
    byCategory.set(item.category, bucket);
    explanation.push(`«${item.label || item.category}»: ${item.response} = ${points} بوزن ${weight}.`);
  }

  const categories: CategoryScore[] = [];
  for (const [category, parts] of byCategory) {
    const score = weightedAverage(parts);
    if (score == null) continue;
    const configured = rules.categoryWeights?.[category];
    const weight = configured ?? parts.reduce((sum, part) => sum + part.weight, 0);
    categories.push({
      category,
      score,
      weight,
      scored_items: parts.length,
    });
    explanation.push(`فئة «${category}»: ${score}% من متوسط البنود الموزون.`);
  }

  let overall: number | null = null;
  if (categories.length) {
    if (rules.categoryWeights) {
      const weighted = categories
        .filter((category) => (rules.categoryWeights?.[category.category] ?? 0) > 0)
        .map((category) => ({
          value: category.score,
          weight: rules.categoryWeights?.[category.category] ?? 0,
        }));
      overall = weightedAverage(weighted);
      explanation.push("الدرجة الكلية = متوسط الفئات حسب أوزان القالب، ثم التقريب لأقرب عدد صحيح.");
    } else {
      const parts = [...byCategory.values()].flat();
      overall = weightedAverage(parts);
      explanation.push("الدرجة الكلية = متوسط كل البنود حسب أوزانها، ثم التقريب لأقرب عدد صحيح.");
    }
  }

  const hasCriticalFailure = items.some((item) => item.critical && item.response === "fail");
  if (hasCriticalFailure) {
    explanation.push("توجد بنود حرجة غير مطابقة. الدرجة الرقمية لا تُلغي هذه الملاحظات ولا تُعد الحالة مقبولة.");
  }

  const completionRatio = applicable === 0 ? 1 : (applicable - unanswered) / applicable;

  return {
    overall,
    band: scoreBand(overall, rules),
    categories,
    hasCriticalFailure,
    completionRatio,
    unanswered,
    applicable,
    explanation,
  };
}
