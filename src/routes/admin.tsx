import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Loader2, LogOut, ShieldAlert } from "lucide-react";
import { BarcodeManager } from "@/components/site/BarcodeManager";
import { supabase } from "@/integrations/supabase/client";

import { UI } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: UI.adminTitle },
      { name: "description", content: UI.adminDescription },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: UI.adminTitle },
      { property: "og:description", content: UI.adminDescription },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const supabaseConfigured = Boolean(
  import.meta.env["VITE_SUPABASE_URL"] && import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
);

function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) {
      setReady(true);
      return;
    }
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabaseConfigured || !session) {
      setIsAdmin(null);
      return;
    }
    supabase
      .rpc("claim_first_admin")
      .then(({ data, error }) => setIsAdmin(!error && data === true));
  }, [session]);

  if (!supabaseConfigured) {
    return (
      <Center>
        <div className="max-w-md rounded-lg border bg-card p-8 text-center shadow-soft">
          <h1 className="text-xl font-bold">{UI.adminTitle}</h1>
          <p className="mt-2 text-muted-foreground">{UI.configError}</p>
          <Link to="/" className="mt-6 inline-block text-sm text-primary">
            {UI.back}
          </Link>
        </div>
      </Center>
    );
  }

  if (!ready)
    return (
      <Center>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </Center>
    );
  if (!session) return <Login />;
  if (isAdmin === null)
    return (
      <Center>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </Center>
    );
  if (!isAdmin)
    return (
      <Center>
        <div className="max-w-md rounded-lg border bg-card p-8 text-center shadow-soft">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <h1 className="text-xl font-bold">{UI.denied}</h1>
          <p className="mt-2 text-muted-foreground">{UI.deniedText}</p>
          <Button className="mt-6" variant="outline" onClick={() => supabase.auth.signOut()}>
            {UI.signOut}
          </Button>
        </div>
      </Center>
    );
  return (
    <div className="min-h-screen bg-muted">
      <header className="bg-gradient-navy text-navy-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6">
          <h1 className="text-2xl font-bold">{UI.adminTitle}</h1>
          <Button variant="secondary" onClick={() => supabase.auth.signOut()}>
            <LogOut className="h-4 w-4" />
            {UI.signOut}
          </Button>
        </div>
      </header>
      <BarcodeManager />
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">{children}</div>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) setError(UI.loginError);
  }
  return (
    <Center>
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-8 shadow-soft"
      >
        <h1 className="text-center text-2xl font-extrabold">{UI.login}</h1>
        <Input
          type="email"
          dir="ltr"
          aria-label={UI.email}
          placeholder={UI.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-12"
        />
        <Input
          type="password"
          dir="ltr"
          aria-label={UI.password}
          placeholder={UI.password}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="h-12"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={loading} className="h-12 w-full bg-gradient-brand">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : UI.signIn}
        </Button>
        <Link to="/" className="block text-center text-sm text-muted-foreground hover:text-primary">
          {UI.back}
        </Link>
      </form>
    </Center>
  );
}
