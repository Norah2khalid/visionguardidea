import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, ClipboardList, FileText, History, LayoutDashboard, Menu, Shield, X } from "lucide-react";
import { usePlatform } from "@/hooks/usePlatform";
import { notificationsFor } from "@/lib/derive";
import { roleLabel } from "@/lib/labels";
import { roleNote } from "@/lib/permissions";
import { Badge, Button, Toast } from "@/components/ui";
import type { DemoRole } from "@/types/domain";
import { clockStamp, todayStamp } from "@/utils/format";
import { cn } from "@/utils/cn";

const NAV = [
  { to: "/", label: "لوحة التحكم", icon: LayoutDashboard, end: true },
  { to: "/tasks", label: "المهام ومواقع التفتيش", icon: ClipboardList, end: false },
  { to: "/reports", label: "التقارير", icon: FileText, end: false },
  { to: "/history", label: "سجل التفتيش", icon: History, end: false },
];

const ROLES: DemoRole[] = ["manager", "inspector", "report_collector"];

function titleFor(pathname: string): string {
  if (pathname.startsWith("/tasks/")) return "تفاصيل المهمة";
  if (pathname.startsWith("/tasks")) return "المهام ومواقع التفتيش";
  if (pathname.startsWith("/reports/")) return "تفاصيل التقرير";
  if (pathname.startsWith("/reports")) return "التقارير";
  if (pathname.startsWith("/history/")) return "تفاصيل سجل التفتيش";
  if (pathname.startsWith("/history")) return "سجل التفتيش";
  return "لوحة التحكم";
}

export function AppLayout() {
  const { role, user, data, readIds, setRole, toast, dismissToast, markNotification, markAllNotifications, resetDemo } = usePlatform();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const notifications = notificationsFor(data, role, user.id, now);
  const unread = notifications.filter((item) => !readIds.includes(item.id)).length;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setOpen(false);
    setNotesOpen(false);
  }, [location.pathname]);

  return (
    <div className="shell min-h-screen md:grid md:grid-cols-[248px_1fr]">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-cyan focus:p-2 focus:text-navy">تخطي إلى المحتوى</a>
      {open ? <button className="no-print fixed inset-0 z-30 bg-black/50 md:hidden" aria-label="إغلاق القائمة" onClick={() => setOpen(false)} /> : null}
      <aside className={cn("no-print fixed inset-y-0 start-0 z-40 flex w-[248px] flex-col border-e border-line bg-[#07131f] transition-transform md:static md:translate-x-0", open ? "translate-x-0" : "translate-x-full md:translate-x-0")}>
        <div className="flex items-center gap-3 border-b border-line px-3 py-4">
          <span className="grid h-10 w-10 place-items-center border border-cyan/50 text-sm font-bold text-cyan" aria-hidden>VG</span>
          <div>
            <div className="text-sm font-bold tracking-[0.14em]" dir="ltr">VISIONGUARD</div>
            <div className="text-[11px] text-muted">تفتيش المنشآت الصناعية</div>
          </div>
        </div>
        <nav className="flex-1 p-2" aria-label="الأقسام الرئيسية">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cn("mb-1 flex min-h-11 items-center gap-2 px-2 text-sm text-muted", isActive && "bg-[#10283a] text-ink shadow-[inset_3px_0_0_#38bdf8]")}>
                <Icon size={18} aria-hidden />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="border-t border-line p-3 text-[11px] leading-5 text-muted">
          <div className="mb-1 flex items-center gap-1 text-cyan"><Shield size={12} aria-hidden /> وضع المحاكاة</div>
          ليست قراءات منشأة حية ولا بث درون.
          <Button className="mt-3 w-full" variant="ghost" onClick={resetDemo}>إعادة ضبط البيانات</Button>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="no-print sticky top-0 z-20 border-b border-line bg-[#061018]/95 px-3 py-2 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button className="md:hidden" variant="ghost" aria-label={open ? "إغلاق القائمة" : "فتح القائمة"} onClick={() => setOpen((value) => !value)}>
                {open ? <X size={18} /> : <Menu size={18} />}
              </Button>
              <div>
                <p className="text-[11px] text-muted">VISIONGUARD</p>
                <h1 className="text-lg font-semibold leading-6">{titleFor(location.pathname)}</h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="sim">وضع المحاكاة</Badge>
              <Badge tone="ok">النظام: عرض تجريبي</Badge>
              <div className="text-xs text-muted">
                <div>{todayStamp(now)}</div>
                <div className="mono">{clockStamp(now)}</div>
              </div>
              <div className="relative">
                <Button variant="ghost" aria-label="التنبيهات" aria-expanded={notesOpen} onClick={() => setNotesOpen((value) => !value)}>
                  <Bell size={16} />
                  {unread ? <span className="mono">{unread}</span> : null}
                </Button>
                {notesOpen ? (
                  <div className="absolute start-0 z-30 mt-1 max-h-80 w-80 overflow-auto border border-line bg-[#07131f] p-2">
                    <div className="mb-2 flex items-center justify-between">
                      <strong className="text-sm">التنبيهات</strong>
                      <button className="text-xs text-cyan" onClick={() => markAllNotifications(notifications.map((item) => item.id))}>تعليم الكل كمقروء</button>
                    </div>
                    {notifications.length === 0 ? <p className="text-sm text-muted">لا تنبيهات ضمن نطاق الدور.</p> : null}
                    {notifications.map((item) => (
                      <button key={item.id} className="mb-1 block w-full border border-line px-2 py-2 text-start text-sm hover:border-cyan/50" onClick={() => { markNotification(item.id); setNotesOpen(false); navigate(item.href); }}>
                        <span className="block text-ink">{item.title}</span>
                        <span className="block text-xs text-muted">{item.body}</span>
                        {!readIds.includes(item.id) ? <span className="text-[11px] text-amber">غير مقروء</span> : <span className="text-[11px] text-muted">مقروء</span>}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div role="group" aria-label="تبديل الدور للعرض فقط وليس صلاحية أمنية" className="flex border border-line">
                {ROLES.map((item) => (
                  <button key={item} className={cn("min-h-10 px-2 text-xs", role === item ? "bg-cyan text-navy" : "text-muted")} aria-pressed={role === item} onClick={() => setRole(item)}>
                    {roleLabel[item]}
                  </button>
                ))}
              </div>
              <div className="text-xs">
                <div>{user.full_name}</div>
                <div className="text-muted">{roleLabel[role]}</div>
              </div>
            </div>
          </div>
        </header>
        <div className="no-print border-b border-amber/30 bg-amber/10 px-3 py-1.5 text-xs text-amber">
          {roleNote(role)} تبديل الدور يغيّر الواجهة للعرض فقط ولا يُعد صلاحية أمنية. التحليل والصور والقراءات موسومة كبيانات محاكاة.
        </div>
        <main id="content" className="grid gap-3 p-3">
          <Outlet />
        </main>
      </div>
      {toast ? <Toast message={toast.message} error={toast.error} onClose={dismissToast} /> : null}
    </div>
  );
}
