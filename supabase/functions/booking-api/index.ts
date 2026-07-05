// Booking Integration API for Zailom Flow
// Authenticated exclusively via API Key (header: x-api-key OR Authorization: Bearer <key>)
// All queries are automatically scoped to the workspace owning the key.
//
// Routes (all under /booking-api):
//   GET /health
//   GET /workspace
//   GET /instances
//   GET /instances/:id
//   GET /bots
//   GET /bots/:id

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-api-key, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

function extractApiKey(req: Request): string | null {
  const x = req.headers.get("x-api-key");
  if (x) return x.trim();
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return null;
}

async function resolveWorkspace(req: Request) {
  const key = extractApiKey(req);
  if (!key) return { error: json({ error: "Missing API key" }, 401) };

  const { data, error } = await supabase
    .from("api_keys")
    .select("workspace_id, is_active")
    .eq("key_value", key)
    .maybeSingle();

  if (error || !data) return { error: json({ error: "Invalid API key" }, 401) };
  if (!data.is_active)
    return { error: json({ error: "API key is disabled" }, 403) };

  // Async update of last_used_at (do not await)
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("key_value", key)
    .then(() => {});

  return { workspaceId: data.workspace_id as string };
}

async function getWorkspaceInfo(workspaceId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, slug, full_name, email, plan, embed_source, embed_company_id, embed_plan_tier, embed_max_chatbots, embed_max_messages, embed_max_integrations, created_at"
    )
    .eq("id", workspaceId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    slug: data.slug,
    name: data.full_name ?? data.slug,
    email: data.email,
    status: "active",
    plan: data.embed_plan_tier ?? data.plan ?? "starter",
    source: data.embed_source ?? "flow",
    external_company_id: data.embed_company_id ?? null,
    limits: {
      max_chatbots: data.embed_max_chatbots,
      max_messages: data.embed_max_messages,
      max_integrations: data.embed_max_integrations,
    },
    created_at: data.created_at,
  };
}

function serializeInstance(row: any) {
  const settings = (row.settings ?? {}) as Record<string, any>;
  return {
    id: row.id,
    name: row.name ?? row.instance_name,
    instance_name: row.instance_name,
    status: row.status ?? "unknown",
    connected: row.status === "connected" || row.status === "open",
    phone_number:
      settings.phone_number ??
      settings.phone ??
      settings.number ??
      settings.wid ??
      null,
    last_connected_at:
      settings.last_connected_at ?? settings.connected_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function serializeBot(row: any, detailed = false) {
  const base = {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    is_published: !!row.is_published,
    is_active: !!row.is_active,
    status: row.is_published
      ? row.is_active === false
        ? "inactive"
        : "published"
      : "draft",
    public_id: row.public_id ?? null,
    published_at: row.published_at ?? null,
    updated_at: row.updated_at,
    created_at: row.created_at,
  };
  if (!detailed) return base;
  return {
    ...base,
    settings: row.settings ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  // Strip the function prefix so routes are matched consistently
  const path =
    "/" +
    url.pathname
      .replace(/^\/+/, "")
      .replace(/^booking-api\/?/, "")
      .replace(/\/+$/, "");

  try {
    // Public health check requires a valid key too (that's the whole point of the ping)
    const auth = await resolveWorkspace(req);
    if ("error" in auth) return auth.error;
    const workspaceId = auth.workspaceId;

    // GET /health
    if (req.method === "GET" && (path === "/" || path === "/health")) {
      const ws = await getWorkspaceInfo(workspaceId);
      if (!ws) return json({ ok: false, error: "Workspace not found" }, 404);
      return json({
        ok: true,
        workspace_id: ws.id,
        workspace_slug: ws.slug,
        timestamp: new Date().toISOString(),
      });
    }

    // GET /workspace
    if (req.method === "GET" && path === "/workspace") {
      const ws = await getWorkspaceInfo(workspaceId);
      if (!ws) return json({ error: "Workspace not found" }, 404);
      return json({ workspace: ws });
    }

    // GET /instances
    if (req.method === "GET" && path === "/instances") {
      const { data, error } = await supabase
        .from("whatsapp_connections")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json({ instances: (data ?? []).map(serializeInstance) });
    }

    // GET /instances/:id
    const instanceMatch = path.match(/^\/instances\/([^/]+)$/);
    if (req.method === "GET" && instanceMatch) {
      const { data, error } = await supabase
        .from("whatsapp_connections")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("id", instanceMatch[1])
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "Instance not found" }, 404);
      return json({ instance: serializeInstance(data) });
    }

    // GET /bots
    if (req.method === "GET" && path === "/bots") {
      const onlyPublished = url.searchParams.get("published") !== "false";
      let q = supabase
        .from("chatbot_flows")
        .select(
          "id, name, description, is_published, is_active, public_id, published_at, updated_at, created_at"
        )
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false });
      if (onlyPublished) q = q.eq("is_published", true);
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 500);
      return json({ bots: (data ?? []).map((b) => serializeBot(b)) });
    }

    // GET /bots/:id
    const botMatch = path.match(/^\/bots\/([^/]+)$/);
    if (req.method === "GET" && botMatch) {
      const { data, error } = await supabase
        .from("chatbot_flows")
        .select(
          "id, name, description, is_published, is_active, public_id, published_at, updated_at, created_at, settings"
        )
        .eq("workspace_id", workspaceId)
        .eq("id", botMatch[1])
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "Bot not found" }, 404);
      return json({ bot: serializeBot(data, true) });
    }

    return json({ error: "Not found", path }, 404);
  } catch (e: any) {
    console.error("[booking-api] error", e);
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});
