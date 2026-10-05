import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { personaForRole } from "@/lib/derive";
import { emptyState, loadState, saveState, stateWith } from "@/services/platform/repository";
import type { ActorContext, AppData, DemoRole, MutationResult, PersistedState, User } from "@/types/domain";

interface PlatformValue {
  ready: boolean;
  recovered: boolean;
  role: DemoRole;
  user: User;
  data: AppData;
  readIds: string[];
  toast: { message: string; error: boolean } | null;
  setRole: (role: DemoRole) => void;
  resetDemo: () => void;
  run: (fn: (data: AppData, ctx: ActorContext) => MutationResult) => boolean;
  notify: (message: string, error?: boolean) => void;
  dismissToast: () => void;
  markNotification: (id: string) => void;
  markAllNotifications: (ids: string[]) => void;
}

export const PlatformContext = createContext<PlatformValue | null>(null);

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState | null>(null);
  const stateRef = useRef<PersistedState | null>(null);
  const [recovered, setRecovered] = useState(false);
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);

  const commit = useCallback((next: PersistedState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    const loaded = loadState();
    stateRef.current = loaded.state;
    setState(loaded.state);
    setRecovered(loaded.recovered);
    if (loaded.recovered) setToast({ message: "استُعيدت بيانات المحاكاة بعد تعذر قراءة النسخة المحلية.", error: true });
  }, []);

  useEffect(() => {
    if (state) saveState(state);
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = useCallback((message: string, error = false) => setToast({ message, error }), []);

  const value = useMemo<PlatformValue | null>(() => {
    if (!state) return null;
    const user = personaForRole(state.data, state.role);
    return {
      ready: true,
      recovered,
      role: state.role,
      user,
      data: state.data,
      readIds: state.read_notification_ids,
      toast,
      setRole: (role) => {
        const current = stateRef.current;
        if (current) commit({ ...current, role });
      },
      resetDemo: () => {
        commit(emptyState());
        setToast({ message: "أُعيد ضبط بيانات المحاكاة.", error: false });
      },
      run: (fn) => {
        const current = stateRef.current;
        if (!current) return false;
        const actor = personaForRole(current.data, current.role);
        const result = fn(current.data, { actor });
        if (result.ok) commit(stateWith(result.data, current.role, current.read_notification_ids));
        setToast({ message: result.message, error: !result.ok });
        return result.ok;
      },
      notify,
      dismissToast: () => setToast(null),
      markNotification: (id) => {
        const current = stateRef.current;
        if (!current || current.read_notification_ids.includes(id)) return;
        commit({ ...current, read_notification_ids: [...current.read_notification_ids, id] });
      },
      markAllNotifications: (ids) => {
        const current = stateRef.current;
        if (!current) return;
        commit({ ...current, read_notification_ids: [...new Set([...current.read_notification_ids, ...ids])] });
      },
    };
  }, [commit, notify, recovered, state, toast]);

  if (!value) {
    return (
      <div className="grid min-h-screen place-items-center text-muted">
        <p>جارٍ تحميل وضع المحاكاة…</p>
      </div>
    );
  }

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}
