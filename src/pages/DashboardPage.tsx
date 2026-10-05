import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, Building2, CheckCheck, Plane, Radar } from "lucide-react";
import { Badge, Panel } from "@/components/ui";
import { AiPanel } from "@/features/dashboard/AiPanel";
import { DeviceStrip } from "@/features/dashboard/DeviceStrip";
import { ImagingPanel } from "@/features/dashboard/ImagingPanel";
import { MonitoringMap } from "@/features/dashboard/MonitoringMap";
import { usePlatform } from "@/hooks/usePlatform";
import { IDS } from "@/data/seed";
import { computeKpis, visibleInspections, visibleTasks } from "@/lib/derive";
import { roleLabel } from "@/lib/labels";
import { formatNumber } from "@/utils/format";

export function DashboardPage() {
  const { data, role, user } = usePlatform();
  const [params] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(IDS.locT04);
  const tasks = visibleTasks(data, role, user.id);
  const inspections = visibleInspections(data, role, user.id);
  const kpis = computeKpis(data, tasks, inspections);
  const scope = role === "manager" ? "كل السجلات" : `نطاق ${roleLabel[role]}`;

  useEffect(() => {
    const section = params.get("section");
    if (!section) return;
    document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [params]);

  const cards = [
    { label: "إجمالي مواقع التفتيش", value: kpis.locations, hint: `${formatNumber(data.zones.length)} مناطق`, icon: Building2, to: "/tasks?tab=locations", tone: "border-cyan" },
    { label: "المهام النشطة", value: kpis.activeTasks, hint: `${formatNumber(kpis.overdueTasks)} متأخرة`, icon: Radar, to: "/tasks?status=active", tone: "border-amber" },
    { label: "عمليات التفتيش المكتملة", value: kpis.completedInspections, hint: scope, icon: CheckCheck, to: "/history?status=completed", tone: "border-ok" },
    { label: "التنبيهات والمخاطر", value: kpis.alerts, hint: `${formatNumber(kpis.criticalAlerts)} مرتفعة أو حرجة`, icon: AlertTriangle, to: "/?section=ai", tone: "border-danger" },
    { label: "الأجهزة والدرون", value: kpis.devices, hint: `${formatNumber(kpis.drones)} درون وروبوت`, icon: Plane, to: "/?section=devices", tone: "border-cyan" },
  ];

  return (
    <div className="grid gap-3">
      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} to={card.to} className={`border border-line border-s-4 ${card.tone} bg-panel p-3 hover:border-cyan`}>
              <div className="flex items-center justify-between text-muted">
                <span className="text-xs">{card.label}</span>
                <Icon size={16} aria-hidden />
              </div>
              <div className="mt-2 text-3xl font-semibold">{formatNumber(card.value)}</div>
              <div className="mt-1 text-xs text-muted">{card.hint}</div>
            </Link>
          );
        })}
      </section>
      <section id="map" className="grid gap-3 xl:grid-cols-[1.35fr_0.85fr]">
        <Panel title="خريطة المتابعة" action={<Badge tone="sim">بيانات محاكاة</Badge>}>
          <MonitoringMap selectedId={selectedId} onSelect={setSelectedId} />
        </Panel>
        <Panel title="التصوير والمتابعة" action={<Badge tone="sim">بيانات تصوير تجريبية</Badge>}>
          <ImagingPanel locationId={selectedId} />
        </Panel>
      </section>
      <section id="ai">
        <Panel title="تحليل الذكاء الاصطناعي">
          <AiPanel />
        </Panel>
      </section>
      <DeviceStrip />
    </div>
  );
}
