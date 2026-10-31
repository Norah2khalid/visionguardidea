import { HELPERS, HELPER_RULES, UI } from "@/lib/content";

export type Helper = (typeof HELPERS)[number];

export function specialistPrompt(helper: Helper) {
  return `${helper.prompt}\n\n${HELPER_RULES}`;
}

export function buildIdeaPrompt(helper: Helper, idea: string, details: string) {
  if (!idea.trim()) throw new Error(UI.ideaRequired);
  return `${specialistPrompt(helper)}\n\n${UI.ideaLabel}:\n${idea.trim()}\n\n${UI.detailsLabel}:\n${details.trim() || UI.missing}\n\n${UI.output}`;
}

export function validBarcodeFile(file: Pick<File, "name" | "type" | "size">) {
  const nameOk = /\.(png|jpe?g)$/i.test(file.name);
  const typeOk = file.type === "" || ["image/png", "image/jpeg", "image/jpg"].includes(file.type);
  return nameOk && typeOk && file.size > 0 && file.size <= 10 * 1024 * 1024;
}
