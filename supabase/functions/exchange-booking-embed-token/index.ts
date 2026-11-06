import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function decodeBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function verifyBookingToken(token: string, secret: string): Promise<Record<string, any> | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = new Uint8Array(await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(parts[0] + "." + parts[1]),
    ));
    const supplied = decodeBase64Url(parts[2]);
    if (signature.length !== supplied.length) return null;

    let difference = 0;
    for (let index = 0; index < signature.length; index++) {
      difference |= signature[index] ^ supplied[index];
    }
    if (difference !== 0) return null;

    const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
    const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
    if (
      header.alg !== "HS256" ||
      claims.iss !== "zailom-booking" ||
      claims.aud !== "zailom-flow-api" ||
      !claims.company_id ||
      !claims.workspace_slug ||
      !claims.user_email ||
      !claims.exp ||
      claims.exp <= Math.floor(Date.now() / 1000)
    ) return null;

    return claims;
  } catch {
    return null;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const sharedSecret = Deno.env.get("EMBED_SHARED_SECRET") ?? "";
  if (!supabaseUrl || !serviceRoleKey || !sharedSecret) {
    return json({ success: false, error: "Flow embed authentication is not configured." }, 500);
  }

  const body = await request.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  const claims = await verifyBookingToken(token, sharedSecret);
  if (!claims) return json({ success: false, error: "Booking access token is invalid or expired." }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, slug, embed_company_id")
    .eq("embed_company_id", claims.company_id)
    .maybeSingle();

  if (profileError) return json({ success: false, error: "Could not resolve the Flow account.", details: profileError.message }, 500);
  if (!profile?.id || profile.slug !== claims.workspace_slug) {
    return json({ success: false, error: "The Booking company is not linked to this Flow workspace." }, 403);
  }

  const { data: workspace, error: workspaceError } = await admin
    .from("workspaces")
    .select("id, slug")
    .eq("slug", claims.workspace_slug)
    .maybeSingle();

  if (workspaceError) return json({ success: false, error: "Could not resolve the Flow workspace.", details: workspaceError.message }, 500);
  if (!workspace?.id) return json({ success: false, error: "Flow workspace not found." }, 404);

  const { data: membership, error: membershipError } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspace.id)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (membershipError) return json({ success: false, error: "Could not verify workspace membership.", details: membershipError.message }, 500);
  if (!membership) return json({ success: false, error: "Flow account is not a member of this workspace." }, 403);

  const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(profile.id);
  if (authUserError || !authUser.user?.email) {
    return json({ success: false, error: "Flow owner account was not found." }, 404);
  }
  if (authUser.user.email.trim().toLowerCase() !== String(claims.user_email).trim().toLowerCase()) {
    return json({ success: false, error: "Booking user does not match the linked Flow owner." }, 403);
  }

  const { data: generated, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: authUser.user.email,
  });

  const tokenHash = generated?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    return json({ success: false, error: "Could not create a secure Flow session.", details: linkError?.message }, 500);
  }

  return json({ success: true, token_hash: tokenHash, workspace_id: workspace.id, workspace_slug: workspace.slug });
});
