import type { CheckResult, FindingCategory, Severity } from "@/types/domain";
import type { FrameKind } from "@/data/imagery";

export interface AnalysisChecklistItem {
  key: string;
  label: string;
  response: CheckResult | null;
  numeric: number | null;
}

export interface AnalysisInput {
  inspectionId: string;
  inspectionCode: string;
  facilityId: string;
  facilityName: string;
  equipmentId: string;
  equipmentCode: string;
  items: AnalysisChecklistItem[];
  existingCategories: FindingCategory[];
}

export interface AnalysisFindingDraft {
  category: FindingCategory;
  severity: Severity;
  confidence: number;
  summary: string;
  frame: FrameKind;
  heat: number;
}

export interface AnalysisOutput {
  provider: string;
  isDemo: true;
  summary: string;
  findings: AnalysisFindingDraft[];
}

export interface AiService {
  readonly providerId: string;
  readonly isDemo: boolean;
  analyze(input: AnalysisInput): Promise<AnalysisOutput>;
}
