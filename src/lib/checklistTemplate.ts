export interface ChecklistTemplateItem {
  key: string;
  label: string;
  numeric: boolean;
  unit: string | null;
}

export const CHECKLIST_TEMPLATE: ChecklistTemplateItem[] = [
  { key: "condition", label: "حالة المعدة", numeric: false, unit: null },
  { key: "temperature", label: "درجة الحرارة", numeric: true, unit: "°C" },
  { key: "pressure", label: "الضغط", numeric: true, unit: "bar" },
  { key: "visual", label: "الحالة البصرية", numeric: false, unit: null },
  { key: "leak", label: "مؤشرات التسرب", numeric: false, unit: null },
  { key: "corrosion", label: "مؤشرات التآكل", numeric: false, unit: null },
  { key: "structural", label: "الحالة الإنشائية", numeric: false, unit: null },
  { key: "safety", label: "ملاحظات السلامة", numeric: false, unit: null },
];
