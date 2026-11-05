const API = "https://api.cloudflare.com/client/v4";

function normalizeHostname(value: string): string {
  const host = value.trim().toLowerCase().replace(/\.$/, "");
  if (!/^flow-[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.zailom\.com$/.test(host)) {
    throw new Error("Hostname Flow inválido. Esperado: flow-<identificador>.zailom.com");
  }
  return host;
}

/**
 * Creates or reconciles the dedicated Flow DNS record.
 * Each tenant receives an individual CNAME; Booking's wildcard record is untouched.
 */
export async function ensureFlowDnsRecord(input: string): Promise<{ hostname: string; record_id: string }> {
  const hostname = normalizeHostname(input);
  const token = Deno.env.get("FLOW_CLOUDFLARE_API_TOKEN") || "";
  const zoneId = Deno.env.get("FLOW_CLOUDFLARE_ZONE_ID") || "";
  const target = (Deno.env.get("FLOW_CLOUDFLARE_TARGET") || "flow-builder.zailom.com").trim().toLowerCase();

  if (!token || !zoneId) {
    throw new Error("Cloudflare do Flow não configurado: defina FLOW_CLOUDFLARE_API_TOKEN e FLOW_CLOUDFLARE_ZONE_ID nos secrets do projeto Supabase.");
  }
  if (!/^[a-z0-9.-]+$/.test(target) || target === hostname) {
    throw new Error("FLOW_CLOUDFLARE_TARGET inválido.");
  }

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const query = new URLSearchParams({ type: "CNAME", name: hostname });
  const listResponse = await fetch(`${API}/zones/${encodeURIComponent(zoneId)}/dns_records?${query}`, { headers });
  const list = await listResponse.json().catch(() => null);
  if (!listResponse.ok || !list?.success) {
    throw new Error(`Cloudflare: não foi possível consultar o DNS (${list?.errors?.[0]?.message || listResponse.status}).`);
  }

  const existing = Array.isArray(list.result) ? list.result[0] : null;
  const payload = { type: "CNAME", name: hostname, content: target, ttl: 1, proxied: true };
  const url = existing
    ? `${API}/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(existing.id)}`
    : `${API}/zones/${encodeURIComponent(zoneId)}/dns_records`;
  const response = await fetch(url, {
    method: existing ? "PATCH" : "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success || !result?.result?.id) {
    throw new Error(`Cloudflare: falha ao ${existing ? "atualizar" : "criar"} o DNS de ${hostname} (${result?.errors?.[0]?.message || response.status}).`);
  }
  return { hostname, record_id: result.result.id };
}
