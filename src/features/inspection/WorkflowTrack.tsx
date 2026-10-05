import { workflowLabel } from "@/lib/labels";
import type { WorkflowStage } from "@/types/domain";
import { cn } from "@/utils/cn";

const STAGES: WorkflowStage[] = ["created", "assigned", "started", "checklist", "media", "ai", "review", "completed", "reported", "recorded"];

export function WorkflowTrack({ stage }: { stage: WorkflowStage }) {
  const current = STAGES.indexOf(stage);
  return (
    <ol className="flex gap-2 overflow-x-auto pb-1">
      {STAGES.map((item, index) => (
        <li key={item} className={cn("min-w-36 border px-2 py-2 text-xs", index < current && "border-ok/50 text-ok", index === current && "border-cyan text-cyan", index > current && "border-line text-muted")}>
          <div className="mono">{String(index + 1).padStart(2, "0")}</div>
          <div>{workflowLabel[item]}</div>
          <div>{index < current ? "تم" : index === current ? "الحالي" : "لاحق"}</div>
        </li>
      ))}
    </ol>
  );
}
