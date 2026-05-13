// =============================================================================
// _shared/embedJwt.ts — verificação de JWT HS256 compartilhado com o Flow-Appoint
// -----------------------------------------------------------------------------
// Cada edge function copia esses utilitários porque o runtime Deno do Supabase
// não compartilha módulos entre funções automaticamente. Mantenha em sincronia.
// =============================================================================

export function b64urlToBytes(input: string): Uint8Array {
  const pad = "=".repeat((4 - (input.length % 4)) % 4);
  const b64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyHs256Jwt(
  token: string,
  secret: string,
): Promise<
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; reason: string }
> {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "Formato JWT inválido" };
  const [headerB64, payloadB64, sigB64] = parts;

  let header: Record<string, unknown>;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(headerB64)));
  } catch {
    return { ok: false, reason: "Header inválido" };
  }
  if (header.alg !== "HS256" || header.typ !== "JWT") {
    return { ok: false, reason: "Algoritmo não suportado" };
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const expectedSig = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${headerB64}.${payloadB64}`),
    ),
  );
  const providedSig = b64urlToBytes(sigB64);
  if (!bytesEqual(expectedSig, providedSig)) {
    return { ok: false, reason: "Assinatura inválida" };
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64)));
  } catch {
    return { ok: false, reason: "Payload inválido" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp < now) {
    return { ok: false, reason: "Token expirado" };
  }
  if (typeof payload.nbf === "number" && payload.nbf > now) {
    return { ok: false, reason: "Token ainda não válido" };
  }

  return { ok: true, payload };
}

export const ALLOWED_ORIGINS = [
  "https://flow-appoint.lovable.app",
];

export function corsHeaders(origin: string | null): HeadersInit {
  const allow =
    origin &&
    (ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".lovable.app"))
      ? origin
      : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function json(status: number, body: unknown, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  });
}
