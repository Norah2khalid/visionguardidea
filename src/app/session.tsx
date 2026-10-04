import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { initBackend, type Backend } from "@/app/backend";
import { bootstrapDemoAdmin, clearDemoHold, clearDemoSession, createDemoUser, demoSignIn, hasActiveAdmin, holdDemoEntry, isDemoHeld, openDemoSession, readDemoSession, updateDemoUser } from "@/services/auth";
import { assertPasswordPolicy } from "@/lib/password";
import type { Actor } from "@/services/platform/context";
import type { Profile, RoleCode } from "@/types/domain";

interface SessionValue {
  ready: boolean;
  backend: Backend | null;
  profile: Profile | null;
  actor: Actor | null;
  error: string | null;
  account: Profile | null;
  viewRole: RoleCode | null;
  setViewRole: (role: RoleCode) => void;
  enterDemo: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  bootstrap: (input: { fullName: string; email: string; password: string }) => Promise<void>;
  adminExists: () => Promise<boolean>;
  createUser: (input: { fullName: string; email: string; password: string; role: RoleCode }) => Promise<void>;
  updateUser: (id: string, patch: { role_code?: RoleCode; is_active?: boolean; full_name?: string }) => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

function toActor(profile: Profile): Actor {
  return { id: profile.id, role_code: profile.role_code, full_name: profile.full_name, email: profile.email };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [backend, setBackend] = useState<Backend | null>(null);
  const [account, setAccount] = useState<Profile | null>(null);
  const [viewRole, setViewRoleState] = useState<RoleCode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop: () => void = () => undefined;
    void (async () => {
      try {
        const next = await initBackend();
        setBackend(next);
        stop = next.db.subscribe(() => {
          void queryClient.invalidateQueries();
        });
        if (next.mode === "demo") {
          if (!isDemoHeld()) setAccount(await openDemoSession(next.db));
          else {
            const session = readDemoSession();
            if (session) setAccount(await next.db.get("profiles", session.profileId));
          }
        } else if (next.supabase) {
          const { data } = await next.supabase.auth.getSession();
          const userId = data.session?.user.id;
          if (userId) setAccount(await next.db.get("profiles", userId));
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "تعذر تشغيل المنصة.");
      } finally {
        setReady(true);
      }
    })();
    return () => stop();
  }, [queryClient]);

  const value = useMemo<SessionValue>(() => {
    const profile = account && backend?.mode === "demo" && viewRole ? { ...account, role_code: viewRole } : account;
    return {
    ready,
    backend,
    profile,
    account,
    viewRole: backend?.mode === "demo" ? viewRole ?? account?.role_code ?? null : account?.role_code ?? null,
    setViewRole(role) {
      if (backend?.mode !== "demo") return;
      setViewRoleState(role);
    },
    async enterDemo() {
      if (!backend || backend.mode !== "demo") return;
      clearDemoHold();
      setAccount(await openDemoSession(backend.db));
    },
    actor: profile ? toActor(profile) : null,
    error,
    async signIn(email, password) {
      if (!backend) throw new Error("المنصة غير جاهزة.");
      clearDemoHold();
      if (backend.mode === "demo") {
        if (!backend.credentials) throw new Error("مخزن الهوية المحلي غير متاح.");
        setAccount(await demoSignIn(backend.db, backend.credentials, email, password));
        return;
      }
      const { data, error: authError } = await backend.supabase!.auth.signInWithPassword({ email, password });
      if (authError || !data.user) throw new Error(authError?.message ?? "تعذر تسجيل الدخول.");
      const nextProfile = await backend.db.get("profiles", data.user.id);
      if (!nextProfile) throw new Error("لا يوجد ملف صلاحيات لهذا الحساب. أكمل تهيئة المدير أولًا.");
      setAccount(nextProfile);
    },
    async signOut() {
      if (backend?.mode === "supabase") await backend.supabase?.auth.signOut();
      if (backend?.mode === "demo") holdDemoEntry();
      clearDemoSession();
      setAccount(null);
      setViewRoleState(null);
    },
    async bootstrap(input) {
      if (!backend) throw new Error("المنصة غير جاهزة.");
      if (backend.mode === "demo") {
        if (!backend.credentials) throw new Error("مخزن الهوية المحلي غير متاح.");
        clearDemoHold();
        setAccount(await bootstrapDemoAdmin(backend.db, backend.credentials, input));
        return;
      }
      assertPasswordPolicy(input.password);
      const { data, error: signError } = await backend.supabase!.auth.signUp({
        email: input.email,
        password: input.password,
        options: { data: { full_name: input.fullName } },
      });
      if (signError) throw new Error(signError.message);
      if (!data.session) throw new Error("أُنشئ الحساب لكن الجلسة غير متاحة. عطّل تأكيد البريد في بيئة التطوير ثم أعد المحاولة.");
      const { error: rpcError } = await backend.supabase!.rpc("bootstrap_first_admin");
      if (rpcError) throw new Error(rpcError.message);
      const nextProfile = await backend.db.get("profiles", data.user!.id);
      if (!nextProfile) throw new Error("لم يُنشأ ملف المدير.");
      setAccount(nextProfile);
    },
    async adminExists() {
      if (!backend) return false;
      if (backend.mode === "demo") return hasActiveAdmin(backend.db);
      const { data, error: rpcError } = await backend.supabase!.rpc("admin_exists");
      if (rpcError) throw new Error(rpcError.message);
      return Boolean(data);
    },
    async createUser(input) {
      if (!backend || !profile) throw new Error("يلزم تسجيل الدخول.");
      if (backend.mode === "demo") {
        if (!backend.credentials) throw new Error("مخزن الهوية المحلي غير متاح.");
        await createDemoUser(backend.db, backend.credentials, toActor(profile), input);
        await queryClient.invalidateQueries();
        return;
      }
      const { error: fnError } = await backend.supabase!.functions.invoke("create-user", { body: input });
      if (fnError) throw new Error(`${fnError.message} — دالة create-user غير منشورة أو رفضت الطلب.`);
      await queryClient.invalidateQueries();
    },
    async updateUser(id, patch) {
      if (!backend || !profile) throw new Error("يلزم تسجيل الدخول.");
      if (backend.mode === "demo") {
        await updateDemoUser(backend.db, toActor(profile), id, patch);
      } else {
        const { error: updateError } = await backend.supabase!.from("profiles").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
        if (updateError) throw new Error(updateError.message);
      }
      if (id === profile.id) {
        const next = await backend.db.get("profiles", id);
        if (next) setAccount(next);
      }
      await queryClient.invalidateQueries();
    },
  };
  }, [account, backend, queryClient, ready, error, viewRole]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("جلسة المستخدم غير مهيأة.");
  return value;
}
