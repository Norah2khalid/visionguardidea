import { describe, expect, it } from "vitest";
import { HELPERS, HELPER_RULES, UI } from "@/lib/content";
import { buildIdeaPrompt, validBarcodeFile } from "@/lib/idea-helpers";

describe("participant-owned idea guidance", () => {
  it("provides four problem helpers and two distinct challenge-two helpers", () => {
    expect(HELPERS.map((h) => h.id)).toEqual([
      "problem_1",
      "problem_2",
      "problem_3",
      "problem_4",
      "application",
      "ai_assistant",
    ]);
  });
  it.each(HELPERS)("preserves full specialist text and ownership rules for $id", (helper) => {
    const prompt = buildIdeaPrompt(helper, "فكرتي الخاصة", "تقنيتي");
    expect(prompt.startsWith(helper.prompt + "\n\n")).toBe(true);
    expect(prompt).toContain(HELPER_RULES);
    expect(prompt).toContain("لا تستبدل فكرة المشارك بفكرة أخرى.");
    expect(prompt).toContain("اطلب توضيح المعلومات الناقصة بدل اختراع تفاصيل غير موجودة.");
    expect(prompt).toContain("فكرتي الخاصة");
  });
  it("customizes guidance to each participant input", () => {
    const helper = HELPERS[0];
    if (!helper) throw new Error("missing helper");
    expect(buildIdeaPrompt(helper, "تحليل النص", "بايثون")).not.toBe(
      buildIdeaPrompt(helper, "تحليل الصورة", "جافاسكربت"),
    );
    expect(buildIdeaPrompt(helper, "تحليل النص", "")).toContain(UI.missing);
  });
  it("does not create guidance without the participant's idea", () => {
    const helper = HELPERS[0];
    if (!helper) throw new Error("missing helper");
    expect(() => buildIdeaPrompt(helper, " ", "")).toThrow();
  });
});

describe("original barcode images", () => {
  it.each(["qr.png", "qr.jpg", "qr.jpeg"])("accepts %s", (name) => {
    expect(
      validBarcodeFile({
        name,
        type: name.endsWith("png") ? "image/png" : "image/jpeg",
        size: 100,
      }),
    ).toBe(true);
  });
  it("rejects non-image files", () => {
    expect(validBarcodeFile({ name: "qr.svg", type: "image/svg+xml", size: 100 })).toBe(false);
  });
});
