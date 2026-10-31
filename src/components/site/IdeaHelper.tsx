import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { UI } from "@/lib/content";
import { buildIdeaPrompt, specialistPrompt, type Helper } from "@/lib/idea-helpers";
import { BarcodeImage } from "./BarcodeImage";

async function copyText(value: string, success: string, empty: string) {
  if (!value.trim()) {
    toast.error(empty);
    return false;
  }
  try {
    await navigator.clipboard.writeText(value);
    toast.success(success);
    return true;
  } catch {
    toast.error(UI.copyFailed);
    return false;
  }
}

export function IdeaHelper({
  helper,
  flush = false,
  showTitle = true,
}: {
  helper: Helper;
  flush?: boolean;
  showTitle?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [idea, setIdea] = useState("");
  const [details, setDetails] = useState("");
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState<"" | "prompt" | "result">("");
  const guidance = specialistPrompt(helper);
  const { data: barcodes = [] } = useQuery({
    queryKey: ["published-barcodes", helper.id],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barcodes")
        .select("*")
        .eq("published", true)
        .eq("section", helper.id)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  function improve() {
    if (!idea.trim()) {
      toast.error(UI.ideaRequired);
      return;
    }
    setResult(buildIdeaPrompt(helper, idea, details));
  }

  async function copy(kind: "prompt" | "result") {
    const value = kind === "prompt" ? guidance : result;
    const ok = await copyText(
      value,
      kind === "prompt" ? UI.copied : UI.copiedResult,
      kind === "prompt" ? UI.copyFailed : UI.resultRequired,
    );
    if (!ok) return;
    setCopied(kind);
    window.setTimeout(() => setCopied((current) => (current === kind ? "" : current)), 2500);
  }

  return (
    <div
      id={helper.id}
      className={
        flush ? "scroll-mt-28" : "mt-5 scroll-mt-28 border-t border-navy-foreground/20 pt-4"
      }
    >
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          {showTitle && <h4 className="text-lg font-bold leading-snug">{helper.title}</h4>}
          <p className="mt-2 text-sm leading-relaxed text-navy-foreground/80">{helper.summary}</p>
          <p className="mt-2 text-sm leading-relaxed text-navy-foreground/70">{UI.intro}</p>
          <Button
            variant="secondary"
            className="mt-4 h-auto whitespace-normal text-right"
            aria-expanded={open}
            aria-controls={`${helper.id}-panel`}
            onClick={() => setOpen((value) => !value)}
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            {open ? UI.close : UI.openHelper}
          </Button>
        </div>
        {barcodes.map((barcode) => (
          <div key={barcode.id} className="rounded-md bg-card p-2 text-card-foreground">
            <BarcodeImage barcode={barcode} compact />
          </div>
        ))}
      </div>
      <div
        id={`${helper.id}-panel`}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        inert={!open}
      >
        <div className="overflow-hidden">
          <div className="mt-4 space-y-4 text-card-foreground">
            <p className="text-sm leading-relaxed text-navy-foreground/80">{UI.mode}</p>
            <div>
              <label
                htmlFor={`${helper.id}-idea`}
                className="mb-2 block text-sm text-navy-foreground"
              >
                {UI.idea}
              </label>
              <Textarea
                className="bg-card text-card-foreground"
                id={`${helper.id}-idea`}
                value={idea}
                onChange={(e) => {
                  setIdea(e.target.value);
                  setResult("");
                }}
                rows={4}
              />
            </div>
            <div>
              <label
                htmlFor={`${helper.id}-details`}
                className="mb-2 block text-sm text-navy-foreground"
              >
                {UI.details}
              </label>
              <Textarea
                className="bg-card text-card-foreground"
                id={`${helper.id}-details`}
                value={details}
                onChange={(e) => {
                  setDetails(e.target.value);
                  setResult("");
                }}
                rows={2}
              />
            </div>
            <Button variant="secondary" className="h-11 whitespace-normal" onClick={improve}>
              <Sparkles className="h-4 w-4" />
              {UI.prepare}
            </Button>
            <div>
              <label
                htmlFor={`${helper.id}-prompt`}
                className="mb-2 block text-sm text-navy-foreground"
              >
                {UI.promptLabel}
              </label>
              <Textarea
                id={`${helper.id}-prompt`}
                className="bg-card text-card-foreground"
                aria-label={UI.promptLabel}
                value={guidance}
                readOnly
                rows={8}
              />
              <Button variant="secondary" className="mt-3 h-11" onClick={() => copy("prompt")}>
                {copied === "prompt" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied === "prompt" ? UI.copied : UI.copy}
              </Button>
            </div>
            <div>
              <label
                htmlFor={`${helper.id}-result`}
                className="mb-2 block text-sm text-navy-foreground"
              >
                {UI.resultLabel}
              </label>
              <Textarea
                id={`${helper.id}-result`}
                className="bg-card text-card-foreground"
                aria-label={UI.resultLabel}
                value={result}
                placeholder={UI.resultRequired}
                readOnly
                rows={8}
              />
              <Button variant="secondary" className="mt-3 h-11" onClick={() => copy("result")}>
                {copied === "result" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied === "result" ? UI.copiedResult : UI.copyResult}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
