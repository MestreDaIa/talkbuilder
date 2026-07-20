// =============================================================================
// admin-api — Edge Function (Deno) para deploy MANUAL no Supabase Dashboard
// -----------------------------------------------------------------------------
// Nome da function: admin-api
// verify_jwt: TRUE  (autenticação obrigatória — validação extra da role é feita no código)
//
// Pré-requisitos:
//   - Rodar docs/super-admin-setup.sql antes.
//   - Ter ao menos um user com role 'super_admin' em public.user_roles.
//
// Deploy:
//   Supabase Dashboard → Edge Functions → Deploy new function
//   Name: admin-api
//   Verify JWT: ON
//   Cole o conteúdo INTEIRO deste arquivo em index.ts.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json(401, { error: "missing_bearer" });
  }

  // Cliente autenticado como o usuário (para getUser)
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json(401, { error: "invalid_token" });
  }
  const user = userData.user;

  // Cliente admin (service role) para operações sensíveis
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Checa role super_admin
  const { data: roles, error: roleErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .maybeSingle();
  if (roleErr || !roles) {
    return json(403, { error: "forbidden", detail: "super_admin role required" });
  }

  async function audit(
    action: string,
    target_type: string | null,
    target_id: string | null,
    payload: Record<string, unknown> | null,
  ) {
    await admin.from("admin_audit_log").insert({
      actor_id: user.id,
      actor_email: user.email ?? null,
      action,
      target_type,
      target_id,
      payload,
    });
  }

  const url = new URL(req.url);
  // path após /functions/v1/admin-api
  const path = url.pathname.replace(/^.*\/admin-api/, "") || "/";
  const method = req.method.toUpperCase();

  let body: any = null;
  if (method !== "GET" && method !== "DELETE") {
    try {
      body = await req.json();
    } catch {
      body = null;
    }
  }

  try {
    // -------------------------- STATS ---------------------------------------
    if (path === "/stats" && method === "GET") {
      // Precisa rodar com o JWT do usuário, porque admin_get_stats() valida
      // public.is_super_admin() via auth.uid(). Usar service role aqui deixa
      // auth.uid() nulo e a função retorna "forbidden" mesmo após a role estar correta.
      const { data, error } = await userClient.rpc("admin_get_stats");
      if (error) throw error;
      return json(200, data);
    }

    // -------------------------- WORKSPACES ----------------------------------
    if (path === "/workspaces" && method === "GET") {
      const search = url.searchParams.get("search")?.trim() ?? "";
      const embedFilter = url.searchParams.get("embed"); // 'true' | 'false' | null
      let q = admin.from("v_admin_workspaces").select("*").order("created_at", { ascending: false }).limit(500);
      if (search) {
        q = q.or(
          `name.ilike.%${search}%,slug.ilike.%${search}%,owner_email.ilike.%${search}%`,
        );
      }
      if (embedFilter === "true") q = q.eq("is_embed", true);
      if (embedFilter === "false") q = q.eq("is_embed", false);
      const { data, error } = await q;
      if (error) throw error;
      return json(200, { workspaces: data });
    }

    // POST /workspaces  body: { name, slug, owner_email, owner_password?, owner_name?, plan? }
    if (path === "/workspaces" && method === "POST") {
      const name = String(body?.name ?? "").trim();
      const slugRaw = String(body?.slug ?? "").trim().toLowerCase();
      const slug = slugRaw.replace(/[^a-z0-9-]+/g, "-").replace(/(^-+|-+$)/g, "");
      const ownerEmail = String(body?.owner_email ?? "").trim().toLowerCase();
      const ownerName = body?.owner_name ? String(body.owner_name) : null;
      const ownerPassword = body?.owner_password ? String(body.owner_password) : null;
      const plan = ["starter", "pro", "business"].includes(body?.plan) ? body.plan : "starter";
      if (!name || !slug || !ownerEmail) return json(400, { error: "missing_fields" });

      // Find or create user
      let ownerId: string | null = null;
      const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = existing?.users?.find((u) => u.email?.toLowerCase() === ownerEmail);
      if (found) {
        ownerId = found.id;
      } else {
        const { data: created, error: cErr } = await admin.auth.admin.createUser({
          email: ownerEmail,
          password: ownerPassword ?? crypto.randomUUID(),
          email_confirm: true,
          user_metadata: { full_name: ownerName, slug },
        });
        if (cErr) return json(400, { error: "create_user_failed", detail: cErr.message });
        ownerId = created.user?.id ?? null;
      }
      if (!ownerId) return json(500, { error: "owner_id_null" });

      // Upsert profile
      await admin.from("profiles").upsert({
        id: ownerId, email: ownerEmail, full_name: ownerName, slug, plan,
      }, { onConflict: "id" });

      // Create workspace
      const { data: ws, error: wsErr } = await admin.from("workspaces").insert({
        name, slug, owner_id: ownerId,
      }).select().single();
      if (wsErr) return json(400, { error: "create_workspace_failed", detail: wsErr.message });

      await admin.from("workspace_members").insert({
        workspace_id: ws.id, user_id: ownerId, role: "owner",
      });

      await audit("workspace.create", "workspace", ws.id, { name, slug, owner_email: ownerEmail, plan });
      return json(200, { workspace: ws, owner_id: ownerId });
    }

    const wsSuspend = path.match(/^\/workspaces\/([^/]+)\/(suspend|unsuspend)$/);

    if (wsSuspend && method === "POST") {
      const wsId = wsSuspend[1];
      const action = wsSuspend[2];
      const { data: ws, error: wsErr } = await admin
        .from("workspaces").select("owner_id, slug").eq("id", wsId).maybeSingle();
      if (wsErr || !ws) return json(404, { error: "workspace_not_found" });

      const patch: Record<string, unknown> = action === "suspend"
        ? {
          is_suspended: true,
          suspended_at: new Date().toISOString(),
          suspended_reason: body?.reason ?? null,
        }
        : { is_suspended: false, suspended_at: null, suspended_reason: null };

      const { error } = await admin.from("profiles").update(patch).eq("id", ws.owner_id);
      if (error) throw error;
      await audit(`workspace.${action}`, "workspace", wsId, { slug: ws.slug, ...patch });
      return json(200, { ok: true });
    }

    const wsDelete = path.match(/^\/workspaces\/([^/]+)$/);
    if (wsDelete && method === "DELETE") {
      const wsId = wsDelete[1];
      const { error } = await admin.from("workspaces").delete().eq("id", wsId);
      if (error) throw error;
      await audit("workspace.delete", "workspace", wsId, null);
      return json(200, { ok: true });
    }

    // -------------------------- USERS ---------------------------------------
    if (path === "/users" && method === "GET") {
      const page = Number(url.searchParams.get("page") ?? "1");
      const perPage = Number(url.searchParams.get("perPage") ?? "50");
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      const ids = data.users.map((u) => u.id);
      const { data: profiles } = await admin
        .from("profiles").select("id, slug, display_name, plan, embed_source, embed_plan_tier, is_suspended")
        .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
      const users = data.users.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        banned_until: (u as any).banned_until ?? null,
        profile: pmap.get(u.id) ?? null,
      }));
      return json(200, { users, total: (data as any).total ?? users.length });
    }

    const userReset = path.match(/^\/users\/([^/]+)\/reset-password$/);
    if (userReset && method === "POST") {
      const uid = userReset[1];
      const { data: u } = await admin.auth.admin.getUserById(uid);
      if (!u?.user?.email) return json(404, { error: "user_or_email_not_found" });
      const { data: link, error } = await admin.auth.admin.generateLink({
        type: "recovery",
        email: u.user.email,
      });
      if (error) throw error;
      await audit("user.reset_password", "user", uid, { email: u.user.email });
      return json(200, { ok: true, link: link.properties?.action_link ?? null });
    }

    const userBan = path.match(/^\/users\/([^/]+)\/(ban|unban)$/);
    if (userBan && method === "POST") {
      const uid = userBan[1];
      const action = userBan[2];
      const banDuration = action === "ban" ? (body?.duration ?? "876000h") : "none";
      const { error } = await admin.auth.admin.updateUserById(uid, {
        ban_duration: banDuration,
      } as any);
      if (error) throw error;
      await audit(`user.${action}`, "user", uid, { duration: banDuration });
      return json(200, { ok: true });
    }

    // -------------------------- PLANS ---------------------------------------
    // POST /plans/:workspace_id   body: { plan, custom_bots_limit?, custom_messages_limit?, custom_integrations_limit?, reason? }
    const planUpdate = path.match(/^\/plans\/([^/]+)$/);
    if (planUpdate && method === "POST") {
      const wsId = planUpdate[1];
      const { data: ws, error: wsErr } = await admin
        .from("workspaces").select("id, owner_id").eq("id", wsId).maybeSingle();
      if (wsErr || !ws) return json(404, { error: "workspace_not_found" });

      const { data: p, error: pErr } = await admin.from("profiles")
        .select("id, plan, embed_source, embed_plan_tier, custom_bots_limit, custom_messages_limit, custom_integrations_limit")
        .eq("id", ws.owner_id).maybeSingle();
      if (pErr || !p) return json(404, { error: "profile_not_found" });

      // REGRA: workspaces embed (Booking) são READ-ONLY para plano/limites.
      if (p.embed_source === "booking") {
        return json(409, {
          error: "embed_read_only",
          detail: "Workspace gerenciado pelo Zailom Booking — plano/limites não podem ser alterados aqui.",
        });
      }

      const newPlan = body?.plan;
      if (newPlan && !["starter", "pro", "business"].includes(newPlan)) {
        return json(400, { error: "invalid_plan" });
      }

      const patch: Record<string, unknown> = {};
      if (newPlan) patch.plan = newPlan;
      if ("custom_bots_limit" in (body ?? {})) patch.custom_bots_limit = body.custom_bots_limit;
      if ("custom_messages_limit" in (body ?? {})) patch.custom_messages_limit = body.custom_messages_limit;
      if ("custom_integrations_limit" in (body ?? {})) patch.custom_integrations_limit = body.custom_integrations_limit;

      if (Object.keys(patch).length === 0) return json(400, { error: "no_changes" });

      const { error } = await admin.from("profiles").update(patch).eq("id", p.id);
      if (error) throw error;

      await admin.from("plan_override_history").insert({
        workspace_id: wsId,
        profile_id: p.id,
        old_plan: p.plan,
        new_plan: newPlan ?? p.plan,
        old_limits: {
          bots: p.custom_bots_limit,
          messages: p.custom_messages_limit,
          integrations: p.custom_integrations_limit,
        },
        new_limits: {
          bots: patch.custom_bots_limit ?? p.custom_bots_limit,
          messages: patch.custom_messages_limit ?? p.custom_messages_limit,
          integrations: patch.custom_integrations_limit ?? p.custom_integrations_limit,
        },
        reason: body?.reason ?? null,
        changed_by: user.id,
      });

      await audit("plan.override", "workspace", wsId, patch);
      return json(200, { ok: true });
    }

    // -------------------------- NOTIFICATIONS -------------------------------
    if (path === "/notifications" && method === "GET") {
      const { data, error } = await admin
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return json(200, { notifications: data });
    }

    if (path === "/notifications" && method === "POST") {
      const {
        title, body: text, level, target_type, target_value, expires_at,
        is_clickable, preview, image_url, video_url, link_url,
      } = body ?? {};
      if (!title || !text || !target_type) return json(400, { error: "missing_fields" });
      if (!["global", "plan", "workspace", "user"].includes(target_type)) {
        return json(400, { error: "invalid_target_type" });
      }
      const { data, error } = await admin.from("notifications").insert({
        title,
        body: text,
        level: level ?? "info",
        target_type,
        target_value: target_value ?? null,
        expires_at: expires_at ?? null,
        is_clickable: !!is_clickable,
        preview: preview ?? null,
        image_url: image_url ?? null,
        video_url: video_url ?? null,
        link_url:  link_url  ?? null,
        created_by: user.id,
      }).select().single();
      if (error) throw error;
      await audit("notification.create", "notification", data.id, {
        target_type, target_value, level, is_clickable,
      });
      return json(200, { notification: data });
    }

    const notifDelete = path.match(/^\/notifications\/([^/]+)$/);
    if (notifDelete && method === "DELETE") {
      const nid = notifDelete[1];
      const { error } = await admin.from("notifications").delete().eq("id", nid);
      if (error) throw error;
      await audit("notification.delete", "notification", nid, null);
      return json(200, { ok: true });
    }

    // -------------------------- AUDIT ---------------------------------------
    if (path === "/audit" && method === "GET") {
      const limit = Math.min(Number(url.searchParams.get("limit") ?? "200"), 1000);
      const { data, error } = await admin
        .from("admin_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return json(200, { entries: data });
    }

    // -------------------------- BOTS ----------------------------------------
    if (path === "/bots" && method === "GET") {
      const search = url.searchParams.get("search")?.trim() ?? "";
      const status = url.searchParams.get("status") ?? ""; // published|unpublished|blocked|banned
      let q = admin.from("v_admin_bots").select("*").order("created_at", { ascending: false }).limit(500);
      if (search) q = q.or(`title.ilike.%${search}%,workspace_name.ilike.%${search}%,owner_email.ilike.%${search}%`);
      if (status === "published") q = q.eq("is_published", true);
      if (status === "unpublished") q = q.eq("is_published", false);
      if (status === "blocked") q = q.eq("is_blocked", true);
      if (status === "banned") q = q.eq("is_banned", true);
      const { data, error } = await q;
      if (error) throw error;
      return json(200, { bots: data });
    }

    const botExport = path.match(/^\/bots\/([^/]+)\/export$/);
    if (botExport && method === "GET") {
      const bid = botExport[1];
      const { data, error } = await admin.from("chatbot_flows").select("*").eq("id", bid).maybeSingle();
      if (error) throw error;
      if (!data) return json(404, { error: "bot_not_found" });
      await audit("bot.export", "bot", bid, { name: data.name });
      return new Response(JSON.stringify(data, null, 2), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="bot-${data.public_id ?? bid}.json"`,
        },
      });
    }

    const botAction = path.match(/^\/bots\/([^/]+)\/(publish|unpublish|block|unblock|ban|unban)$/);
    if (botAction && method === "POST") {
      const bid = botAction[1];
      const act = botAction[2];
      const reason = body?.reason ?? null;
      const now = new Date().toISOString();
      const patch: Record<string, unknown> =
        act === "publish"   ? { is_published: true } :
        act === "unpublish" ? { is_published: false } :
        act === "block"     ? { is_blocked: true,  blocked_at: now, blocked_reason: reason } :
        act === "unblock"   ? { is_blocked: false, blocked_at: null, blocked_reason: null } :
        act === "ban"       ? { is_banned: true,   banned_at: now,  banned_reason: reason, is_published: false } :
                              { is_banned: false,  banned_at: null, banned_reason: null };
      const { error } = await admin.from("chatbot_flows").update(patch).eq("id", bid);
      if (error) throw error;
      await audit(`bot.${act}`, "bot", bid, patch);
      return json(200, { ok: true });
    }

    const botDelete = path.match(/^\/bots\/([^/]+)$/);
    if (botDelete && method === "DELETE") {
      const bid = botDelete[1];
      const { error } = await admin.from("chatbot_flows").delete().eq("id", bid);
      if (error) throw error;
      await audit("bot.delete", "bot", bid, null);
      return json(200, { ok: true });
    }

    // -------------------------- BILLING -------------------------------------
    if (path === "/billing" && method === "GET") {
      const { data: rows, error } = await admin.from("v_admin_billing").select("*");
      if (error) throw error;
      const { data: prices } = await admin.from("plan_prices").select("*").order("plan");
      const mrr = (rows ?? []).reduce((s: number, r: any) => s + Number(r.mrr_brl || 0), 0);
      return json(200, { rows, prices, mrr_brl_total: mrr });
    }

    if (path === "/billing/prices" && method === "POST") {
      const plan = String(body?.plan ?? "");
      const price = Number(body?.price_brl ?? 0);
      if (!plan) return json(400, { error: "missing_plan" });
      const { error } = await admin.from("plan_prices").upsert({
        plan, price_brl: price, updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      await audit("billing.price_update", "plan", plan, { price_brl: price });
      return json(200, { ok: true });
    }

    return json(404, { error: "route_not_found", path, method });
  } catch (err: any) {
    console.error("[admin-api] error:", err);
    return json(500, { error: "internal", detail: err?.message ?? String(err) });
  }
});
