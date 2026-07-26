/**
 * Resolução de rota de canal por instância WhatsApp.
 *
 * Uma instância pode ser "dona" do Booking (rota `direct`), do Flow (rota
 * `flow`) ou estar desligada (`none`). Como o wa-service só aceita UM webhook
 * por instância, o Flow precisa saber se deve processar o evento ou ignorá-lo.
 *
 * Estratégia híbrida (a + b), nesta ordem:
 *   (a) wa-service — se a instância já expuser metadado de rota
 *       (`route`, `channel_preference`, `owner`, `product`, `metadata.route`),
 *       essa é a fonte da verdade compartilhada. Zero dependência do Booking.
 *   (b) Booking API — se o wa-service não souber, consulta o Booking
 *       (BOOKING_API_URL + BOOKING_API_KEY). É o caminho que funciona hoje,
 *       sem precisar mexer no wa-service.
 *
 * Se nenhuma das duas responder, devolve `unknown` — e o chamador decide
 * (por padrão o Flow processa, para não quebrar quem usa só o Flow).
 */
import { findWorkspaceByInstance, waApi } from "./waService.js";

export type ChannelRoute = "flow" | "direct" | "none" | "unknown";

const BOOKING_API_URL = (process.env.BOOKING_API_URL || "").replace(/\/$/, "");
const BOOKING_API_KEY = process.env.BOOKING_API_KEY || "";
/** Path do endpoint de rota no Booking. `{instance}` é substituído. */
const BOOKING_ROUTE_PATH =
  process.env.BOOKING_ROUTE_PATH || "/v1/whatsapp/instances/{instance}/route";

const TTL_MS = Number(process.env.CHANNEL_ROUTE_TTL_MS || 60_000);
const cache = new Map<string, { value: ChannelRoute; source: string; at: number }>();

function normalize(raw: any): ChannelRoute | null {
  if (raw == null) return null;
  const v = String(raw).trim().toLowerCase();
  if (!v) return null;
  if (["flow", "flow_only", "chatbot", "zailom_flow", "flowbuilder"].includes(v)) return "flow";
  if (["direct", "direct_only", "booking", "zailom_booking", "notifications"].includes(v)) return "direct";
  if (["none", "off", "disabled", "channel_disabled", "false"].includes(v)) return "none";
  if (["both", "hybrid", "flow_and_direct"].includes(v)) return "flow";
  return null;
}

function fromInstancePayload(inst: any): ChannelRoute | null {
  if (!inst || typeof inst !== "object") return null;
  const candidates = [
    inst.route,
    inst.channel_route,
    inst.channel_preference,
    inst.owner,
    inst.owner_product,
    inst.metadata?.route,
    inst.metadata?.channel_preference,
    inst.metadata?.owner,
    inst.settings?.route,
    inst.settings?.channel_preference,
  ];
  for (const c of candidates) {
    const n = normalize(c);
    if (n) return n;
  }
  return null;
}

/** (a) Pergunta ao wa-service. Silencioso em caso de erro. */
async function fromWaService(instanceName: string): Promise<ChannelRoute | null> {
  try {
    const creds = await findWorkspaceByInstance(instanceName);
    if (!creds?.apiKey) return null;
    const inst = await waApi(creds.apiKey).getInstance(instanceName);
    return fromInstancePayload(inst?.data ?? inst);
  } catch (err: any) {
    console.warn("[channel-route] wa-service não respondeu rota:", err?.message || err);
    return null;
  }
}

/** (b) Pergunta ao Zailom Booking. Silencioso em caso de erro. */
async function fromBooking(instanceName: string): Promise<ChannelRoute | null> {
  if (!BOOKING_API_URL || !BOOKING_API_KEY) return null;
  try {
    const path = BOOKING_ROUTE_PATH.replace("{instance}", encodeURIComponent(instanceName));
    const res = await fetch(`${BOOKING_API_URL}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${BOOKING_API_KEY}`,
        "x-api-key": BOOKING_API_KEY,
        Accept: "application/json",
      },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      console.warn(`[channel-route] Booking respondeu ${res.status} para ${instanceName}`);
      return null;
    }
    const body: any = await res.json().catch(() => null);
    const payload = body?.data ?? body;
    return (
      normalize(payload?.route) ||
      normalize(payload?.channel) ||
      normalize(payload?.channel_preference) ||
      fromInstancePayload(payload)
    );
  } catch (err: any) {
    console.warn("[channel-route] falha ao consultar Booking:", err?.message || err);
    return null;
  }
}

export async function resolveChannelRoute(
  instanceName: string
): Promise<{ route: ChannelRoute; source: string }> {
  if (!instanceName) return { route: "unknown", source: "no-instance" };

  const hit = cache.get(instanceName);
  if (hit && Date.now() - hit.at < TTL_MS) return { route: hit.value, source: `${hit.source}:cache` };

  let route = await fromWaService(instanceName);
  let source = "wa-service";
  if (!route) {
    route = await fromBooking(instanceName);
    source = "booking";
  }
  if (!route) {
    route = "unknown";
    source = "fallback";
  }

  cache.set(instanceName, { value: route, source, at: Date.now() });
  return { route, source };
}

/** Invalida cache (usado ao vincular/desvincular bot de uma instância). */
export function invalidateChannelRoute(instanceName?: string) {
  if (instanceName) cache.delete(instanceName);
  else cache.clear();
}

/**
 * O Flow deve processar mensagens desta instância?
 * - `flow`    → sim
 * - `direct`  → não (o Booking é o dono do canal)
 * - `none`    → não (canal desligado)
 * - `unknown` → sim, a menos que STRICT_CHANNEL_ROUTE=true
 */
export async function shouldFlowHandle(
  instanceName: string
): Promise<{ handle: boolean; route: ChannelRoute; source: string }> {
  const { route, source } = await resolveChannelRoute(instanceName);
  const strict = String(process.env.STRICT_CHANNEL_ROUTE || "").toLowerCase() === "true";
  const handle = route === "flow" || (route === "unknown" && !strict);
  return { handle, route, source };
}
