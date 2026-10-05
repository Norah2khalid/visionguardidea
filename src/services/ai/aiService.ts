import { mockAiService } from "@/services/ai/mockAIService";
import type { AiService } from "@/services/ai/types";

export function getAiService(): AiService {
  return mockAiService;
}
