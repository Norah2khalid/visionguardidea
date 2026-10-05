import type { DemoRole } from "@/types/domain";

export type Capability =
  | "task.create"
  | "task.edit"
  | "task.cancel"
  | "inspection.operate"
  | "finding.review"
  | "report.generate"
  | "report.manage"
  | "report.export"
  | "records.view_all";

const MATRIX: Record<DemoRole, Capability[]> = {
  manager: [
    "task.create",
    "task.edit",
    "task.cancel",
    "inspection.operate",
    "finding.review",
    "report.generate",
    "report.manage",
    "report.export",
    "records.view_all",
  ],
  inspector: ["inspection.operate", "finding.review", "report.export"],
  report_collector: ["report.generate", "report.manage", "report.export", "records.view_all"],
};

export function can(role: DemoRole, capability: Capability): boolean {
  return MATRIX[role].includes(capability);
}

export function roleNote(role: DemoRole): string {
  if (role === "manager") return "عرض تشغيلي كامل لكل السجلات والإجراءات.";
  if (role === "inspector") return "التركيز على المهام المسندة وقائمة الفحص والصور ومراجعة الملاحظات.";
  return "التركيز على استكمال التقارير والتحقق والأرشفة والطباعة والتصدير.";
}
