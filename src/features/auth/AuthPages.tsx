import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, Navigate } from "react-router-dom";
import { useSession } from "@/app/session";
import { Button, ErrorState, Field, Loading } from "@/components/ui";

const loginSchema = z.object({
  email: z.string().email("بريد غير صالح"),
  password: z.string().min(1, "أدخل كلمة المرور"),
});

const setupSchema = z.object({
  fullName: z.string().min(3, "الاسم مطلوب"),
  email: z.string().email("بريد غير صالح"),
  password: z.string().min(10, "10 خانات على الأقل").regex(/[A-Za-z\u0600-\u06FF]/, "يلزم حرف").regex(/\d/, "يلزم رقم"),
});

export function LoginPage() {
  const session = useSession();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const form = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  useEffect(() => {
    if (!session.backend) return;
    void session.adminExists().then((exists) => setNeedsSetup(!exists)).catch(() => setNeedsSetup(false));
  }, [session]);
  if (!session.ready) return <Loading />;
  if (session.profile) return <Navigate to="/dashboard" replace />;
  return (
    <AuthFrame title="دخول غرفة العمليات" subtitle="البيانات تُحفظ في وضع العرض على هذا المتصفح إلى أن يُربط Supabase.">
      <form className="grid" onSubmit={form.handleSubmit(async (values) => {
        setSubmitError(null);
        try { await session.signIn(values.email, values.password); } catch (error) { setSubmitError(error instanceof Error ? error.message : "تعذر الدخول"); }
      })}>
        <Field label="البريد" error={form.formState.errors.email?.message}><input className="input" dir="ltr" {...form.register("email")} /></Field>
        <Field label="كلمة المرور" error={form.formState.errors.password?.message}><input className="input" type="password" dir="ltr" {...form.register("password")} /></Field>
        {submitError ? <ErrorState message={submitError} /> : null}
        <Button variant="primary" type="submit">دخول</Button>
        {needsSetup ? <Link to="/setup">تهيئة أول مدير للنظام</Link> : null}
      </form>
    </AuthFrame>
  );
}

export function SetupPage() {
  const session = useSession();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof setupSchema>>({ resolver: zodResolver(setupSchema) });
  if (!session.ready) return <Loading />;
  if (session.profile) return <Navigate to="/dashboard" replace />;
  return (
    <AuthFrame title="تهيئة المدير الأول" subtitle="لا يُنشأ حساب مدير عام. أول حساب يُنشأ من هذه الشاشة يصبح مديرًا فقط إذا لم يوجد مدير.">
      <form className="grid" onSubmit={form.handleSubmit(async (values) => {
        setSubmitError(null);
        try { await session.bootstrap(values); } catch (error) { setSubmitError(error instanceof Error ? error.message : "تعذرت التهيئة"); }
      })}>
        <Field label="الاسم" error={form.formState.errors.fullName?.message}><input className="input" {...form.register("fullName")} /></Field>
        <Field label="البريد" error={form.formState.errors.email?.message}><input className="input" dir="ltr" {...form.register("email")} /></Field>
        <Field label="كلمة المرور" error={form.formState.errors.password?.message}><input className="input" type="password" dir="ltr" {...form.register("password")} /></Field>
        {submitError ? <ErrorState message={submitError} /> : null}
        <Button variant="primary" type="submit">إنشاء المدير</Button>
        <Link to="/login">لدي حساب</Link>
      </form>
    </AuthFrame>
  );
}

function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div className="panel" style={{ width: "min(460px, 100%)" }}>
        <div className="brand" dir="ltr" style={{ paddingInline: 0 }}>
          <img className="brand-logo" src="/visionguard-logo.png" alt="VISIONGUARD" />
        </div>
        <h1 style={{ marginTop: 8 }}>{title}</h1>
        <p className="muted">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
