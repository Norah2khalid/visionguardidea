import { useState } from "react";
import { Badge, Button, Empty } from "@/components/ui";
import { usePlatform } from "@/hooks/usePlatform";
import { CHECKLIST_TEMPLATE } from "@/lib/checklistTemplate";
import { checklistFor } from "@/lib/derive";
import { checkResultLabel } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { answerChecklistItem, completeChecklist } from "@/services/platform/mutations";
import type { CheckResult } from "@/types/domain";
import { formatDateTime } from "@/utils/format";

const RESULTS: CheckResult[] = ["pass", "warning", "fail", "not_applicable"];

export function ChecklistEditor({ inspectionId }: { inspectionId: string }) {
  const { data, role, run } = usePlatform();
  const { checklist, items } = checklistFor(data, inspectionId);
  const [drafts, setDrafts] = useState<Record<string, { numeric: string; notes: string }>>({});
  if (!checklist) return <Empty title="لا توجد قائمة فحص" />;
  const locked = Boolean(checklist.completed_at) || !can(role, "inspection.operate");

  return (
    <div className="grid gap-3">
      {checklist.completed_at ? <Badge tone="ok">أُغلقت القائمة {formatDateTime(checklist.completed_at)}</Badge> : <Badge tone="warn">القائمة مفتوحة</Badge>}
      {items.map((item) => {
        const template = CHECKLIST_TEMPLATE.find((row) => row.key === item.item_key);
        const draft = drafts[item.id] ?? { numeric: item.numeric_value?.toString() ?? "", notes: item.notes };
        return (
          <fieldset key={item.id} className="border border-line p-3" disabled={locked}>
            <legend className="px-1 text-sm font-semibold">{item.label}</legend>
            <div className="mb-2 flex flex-wrap gap-1">
              {RESULTS.map((result) => (
                <Button key={result} type="button" aria-pressed={item.response === result} variant={item.response === result ? "primary" : "default"} onClick={() => run((current, ctx) => answerChecklistItem(current, item.id, result, draft.numeric === "" ? null : Number(draft.numeric), draft.notes, ctx))}>
                  {checkResultLabel[result]}
                </Button>
              ))}
            </div>
            {template?.numeric ? (
              <label className="mb-2 grid gap-1 text-xs text-muted">القيمة ({template.unit})
                <input className="mono min-h-10 border border-line bg-[#07111c] px-2" inputMode="decimal" value={draft.numeric} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, numeric: event.target.value } }))} />
              </label>
            ) : null}
            <label className="grid gap-1 text-xs text-muted">ملاحظة البند
              <textarea className="min-h-16 border border-line bg-[#07111c] p-2" value={draft.notes} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, notes: event.target.value } }))} />
            </label>
            {item.response ? <p className="mt-2 text-xs text-muted">الحالة المحفوظة: {checkResultLabel[item.response]}</p> : <p className="mt-2 text-xs text-amber">لم يُحفظ رد بعد</p>}
          </fieldset>
        );
      })}
      {!locked ? <Button variant="primary" onClick={() => run((current, ctx) => completeChecklist(current, inspectionId, ctx))}>إكمال قائمة الفحص</Button> : null}
    </div>
  );
}
