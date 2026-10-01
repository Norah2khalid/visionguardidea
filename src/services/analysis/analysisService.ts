export interface ProposedObservation {
  category: "possible_leak" | "possible_corrosion" | "visible_damage" | "unusual_reading" | "equipment_condition" | "manual_observation";
  description: string;
  confidence: number | null;
}

export interface AnalysisProvider {
  id: string;
  label: string;
  isConfigured(): boolean;
  analyzeImage(input: { mediaId: string }): Promise<ProposedObservation[]>;
  analyzeSensor(input: { readingId: string }): Promise<ProposedObservation[]>;
}

export class UnavailableAnalysisProvider implements AnalysisProvider {
  id = "unconfigured";
  label = "لا يوجد مزود تحليل";

  isConfigured(): boolean {
    return false;
  }

  async analyzeImage(): Promise<ProposedObservation[]> {
    throw new Error("التحليل الآلي غير متاح. لم يُضبط مزود تحليل على الخادم.");
  }

  async analyzeSensor(): Promise<ProposedObservation[]> {
    throw new Error("التحليل الآلي غير متاح. لم يُضبط مزود تحليل على الخادم.");
  }
}

export function getAnalysisProvider(): AnalysisProvider {
  return new UnavailableAnalysisProvider();
}
