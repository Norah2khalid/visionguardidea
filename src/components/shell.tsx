import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, ClipboardList, FileText, History, LayoutDashboard, Menu } from "lucide-react";
import { useSession } from "@/app/session";
import { Button } from "@/components/ui";
import { can, type Permission } from "@/lib/permissions";
import { roleLabel } from "@/lib/labels";
import type { RoleCode } from "@/types/domain";

const NAV: { to: string; label: string; icon: typeof Bell; permission: Permission; end?: boolean }[] = [
  { to: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard, permission: "dashboard.view" },
  { to: "/work", label: "المهام ومواقع التفتيش", icon: ClipboardList, permission: "inspections.view" },
  { to: "/reports", label: "التقارير", icon: FileText, permission: "reports.view" },
  { to: "/history", label: "سجل التفتيش", icon: History, permission: "history.view" },
];

function crumbs(pathname: string): string[] {
  const map: Record<string, string> = {
    "/": "لوحة التحكم",
    "/dashboard": "لوحة التحكم",
    "/work": "المهام ومواقع التفتيش",
    "/inspections": "التفتيشات",
    "/inspections/new": "تفتيش جديد",
    "/missions": "المهام",
    "/facilities": "المنشآت",
    "/zones": "المناطق",
    "/equipment": "المعدات",
    "/drones": "الدرون",
    "/robots": "الروبوتات",
    "/live": "البيانات الحية",
    "/alerts": "التنبيهات",
    "/history": "السجل",
    "/reports": "التقارير",
    "/users": "المستخدمون",
    "/settings": "الإعدادات",
  };
  if (map[pathname]) return ["VISIONGUARD", map[pathname]];
  if (pathname.includes("/control")) return ["VISIONGUARD", "المهام", "مركز التحكم"];
  if (pathname.includes("/checklist")) return ["VISIONGUARD", "التفتيشات", "قائمة الفحص"];
  if (pathname.includes("/field")) return ["VISIONGUARD", "التفتيشات", "التفتيش الميداني"];
  if (pathname.startsWith("/inspections/")) return ["VISIONGUARD", "التفتيشات", "التفاصيل"];
  if (pathname.startsWith("/missions/")) return ["VISIONGUARD", "المهام", "التفاصيل"];
  if (pathname.startsWith("/facilities/") && pathname.endsWith("/layout")) return ["VISIONGUARD", "المنشآت", "المخطط"];
  if (pathname.startsWith("/facilities/")) return ["VISIONGUARD", "المنشآت", "التفاصيل"];
  if (pathname.startsWith("/reports/")) return ["VISIONGUARD", "التقارير", "عرض التقرير"];
  if (pathname.startsWith("/zones/")) return ["VISIONGUARD", "المناطق", "التفاصيل"];
  if (pathname.startsWith("/equipment/")) return ["VISIONGUARD", "المعدات", "التفاصيل"];
  if (pathname.startsWith("/drones/")) return ["VISIONGUARD", "الدرون", "التفاصيل"];
  if (pathname.startsWith("/robots/")) return ["VISIONGUARD", "الروبوتات", "التفاصيل"];
  return ["VISIONGUARD"];
}

export function AppShell() {
  const { profile, account, backend, signOut, setViewRole, viewRole } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const alerts = useQuery({
    queryKey: ["alerts-count"],
    enabled: Boolean(backend),
    queryFn: async () => (await backend!.db.list("alerts")).filter((alert) => !alert.read_at && alert.resolution_status !== "resolved").length,
  });
  const items = NAV.filter((item) => profile && can(profile.role_code, item.permission));

  return (
    <div className="shell" data-collapsed={collapsed ? "true" : "false"}>
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand" dir="ltr">
          <span className="mark">VG</span>
          {!collapsed ? <span className="logo-word"><span className="vision">VISION</span><span className="guard">GUARD</span></span> : null}
        </div>
        <nav>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`} onClick={() => setOpen(false)}>
                <Icon size={18} />
                {!collapsed ? <span>{item.label}</span> : null}
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Button className="mobile-only" variant="ghost" aria-label="القائمة" onClick={() => setOpen((value) => !value)}><Menu size={18} /></Button>
            <Button className="no-print" variant="ghost" onClick={() => setCollapsed((value) => !value)}>طي</Button>
            <div className="crumbs">{crumbs(location.pathname).map((part, index) => <span key={part}>{index ? " / " : ""}{part}</span>)}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {backend?.mode === "demo" ? <span className="badge warn">وضع المحاكاة — البيانات تجريبية</span> : <span className="badge info">Supabase</span>}
            <Button variant="ghost" aria-label="التنبيهات" onClick={() => navigate("/dashboard#alerts")}>
              <Bell size={18} /> {alerts.data ? <span className="mono">{alerts.data}</span> : null}
            </Button>
            {backend?.mode === "demo" && viewRole ? (
              <select className="select" aria-label="عرض الدور" style={{ width: "auto", minHeight: 36 }} value={viewRole} onChange={(event) => setViewRole(event.target.value as RoleCode)}>
                {(["ADMIN", "INSPECTOR", "OPERATOR"] as RoleCode[]).map((role) => <option key={role} value={role}>{roleLabel[role]}</option>)}
              </select>
            ) : null}
            <div className="menu">
              <Button variant="ghost" onClick={() => setMenu((value) => !value)}>{account?.full_name}</Button>
              {menu ? (
                <div className="menu-pop">
                  <div className="muted">{profile ? roleLabel[profile.role_code] : ""}</div>
                  <div className="muted">{account?.email}</div>
                  <Button variant="ghost" onClick={() => { setMenu(false); navigate("/settings"); }}>الإعدادات</Button>
                  <Button variant="danger" onClick={() => void signOut()}>تسجيل الخروج</Button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
