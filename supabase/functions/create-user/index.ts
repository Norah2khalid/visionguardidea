import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return new Response(JSON.stringify({ error: "server environment is incomplete" }), { status: 500, headers: cors });
  }
  const authorization = request.headers.get("Authorization") ?? "";
  const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
  }
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: profile } = await admin.from("profiles").select("role_code,is_active").eq("id", userData.user.id).single();
  if (!profile || profile.role_code !== "ADMIN" || !profile.is_active) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: cors });
  }
  const body = await request.json();
  const role = body.role_code ?? body.role;
  if (!["ADMIN", "INSPECTOR", "OPERATOR"].includes(role)) {
    return new Response(JSON.stringify({ error: "invalid role" }), { status: 400, headers: cors });
  }
  const created = await admin.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    user_metadata: { full_name: body.fullName ?? body.full_name },
  });
  if (created.error || !created.data.user) {
    return new Response(JSON.stringify({ error: created.error?.message ?? "create failed" }), { status: 400, headers: cors });
  }
  const inserted = await admin.from("profiles").insert({
    id: created.data.user.id,
    full_name: body.fullName ?? body.full_name,
    email: body.email,
    role_code: role,
  });
  if (inserted.error) {
    return new Response(JSON.stringify({ error: inserted.error.message }), { status: 400, headers: cors });
  }
  await admin.from("audit_logs").insert({
    actor_id: userData.user.id,
    action: "user.created",
    target_table: "profiles",
    target_id: created.data.user.id,
    metadata: { role },
  });
  return new Response(JSON.stringify({ id: created.data.user.id }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
});
