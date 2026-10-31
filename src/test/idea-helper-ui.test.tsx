import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdeaHelper } from "@/components/site/IdeaHelper";
import { HELPERS, UI } from "@/lib/content";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }),
  },
}));

describe("idea helper controls", () => {
  const writeText = vi.fn<(value: string) => Promise<void>>().mockResolvedValue(undefined);

  beforeEach(() => {
    writeText.mockClear();
    Object.assign(navigator, { clipboard: { writeText } });
  });

  it("builds a participant-specific result and copies the prompt and the result separately", async () => {
    const helper = HELPERS[0];
    if (!helper) throw new Error("missing helper");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <IdeaHelper helper={helper} />
      </QueryClientProvider>,
    );

    expect(screen.getByText(helper.summary)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: UI.openHelper }));
    fireEvent.click(screen.getByRole("button", { name: UI.copyResult }));
    expect(writeText).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(UI.idea), {
      target: { value: "فكرتي الخاصة للتحقق المبكر" },
    });
    fireEvent.click(screen.getByRole("button", { name: UI.prepare }));

    const guidance = screen.getByLabelText(UI.promptLabel) as HTMLTextAreaElement;
    const result = screen.getByLabelText(UI.resultLabel) as HTMLTextAreaElement;
    expect(guidance.value).not.toContain("فكرتي الخاصة للتحقق المبكر");
    expect(result.value).toContain("فكرتي الخاصة للتحقق المبكر");
    expect(result.value).toContain("لا تستبدل فكرة المشارك بفكرة أخرى.");

    fireEvent.click(screen.getByRole("button", { name: UI.copy }));
    fireEvent.click(screen.getByRole("button", { name: UI.copyResult }));
    expect(writeText).toHaveBeenNthCalledWith(
      1,
      expect.not.stringContaining("فكرتي الخاصة للتحقق المبكر"),
    );
    expect(writeText).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("فكرتي الخاصة للتحقق المبكر"),
    );
    expect(await screen.findByRole("button", { name: UI.copiedResult })).toBeInTheDocument();
  });
});
