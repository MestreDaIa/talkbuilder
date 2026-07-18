// ============================================================
// Shared helper: autenticação de Flow API Keys
// Uso: chame `authenticateFlowRequest(req, { requireScope: 'bots:run' })`
// no início de cada edge function do produto Zailom Flow.
//
// Segurança:
//   • Aceita apenas o header `Authorization: Bearer zf_live_...`
//     (ou fallback `x-flow-api-key`).
//   • Valida via RPC `validate_flow_api_key` (service_role) — nunca busca
//     por plaintext direto em tabela.
//   • Registra evento na tabela de auditoria `flow_api_key_audit`.
//   • Escopo obrigatório: se a chave não tiver, retorna 403.
//   • Nunca loga o plaintext.
// ============================================================
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-flow-api-key, x-client-info, apikey, content-type",
	"Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

export type FlowScope =
	| "bots:read"
	| "bots:run"
	| "bots:write"
	| "flows:read"
	| "flows:write"
	| "sessions:read"
	| "sessions:write";

export interface FlowAuthContext {
	keyId: string;
	workspaceId: string;
	scopes: FlowScope[];
	ip: string | null;
	userAgent: string | null;
	supabase: SupabaseClient;
}

export interface FlowAuthError {
	status: number;
	body: { error: string; code: string };
}

let cached: SupabaseClient | null = null;
function getServiceClient(): SupabaseClient {
	if (cached) return cached;
	const url = Deno.env.get("SUPABASE_URL");
	const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
	if (!url || !key) {
		throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados");
	}
	cached = createClient(url, key, { auth: { persistSession: false } });
	return cached;
}

function extractKey(req: Request): string | null {
	const auth = req.headers.get("authorization") || req.headers.get("Authorization");
	if (auth) {
		const m = /^Bearer\s+(zf_live_[a-f0-9]{64})$/.exec(auth.trim());
		if (m) return m[1];
	}
	const alt = req.headers.get("x-flow-api-key");
	if (alt && /^zf_live_[a-f0-9]{64}$/.test(alt.trim())) return alt.trim();
	return null;
}

function clientIp(req: Request): string | null {
	const fwd = req.headers.get("x-forwarded-for");
	if (fwd) return fwd.split(",")[0].trim();
	return req.headers.get("x-real-ip");
}

export async function authenticateFlowRequest(
	req: Request,
	opts: { requireScope: FlowScope; route?: string }
): Promise<{ ctx: FlowAuthContext } | { error: FlowAuthError }> {
	const supabase = getServiceClient();
	const ip = clientIp(req);
	const userAgent = req.headers.get("user-agent");
	const route = opts.route || new URL(req.url).pathname;

	const plaintext = extractKey(req);
	if (!plaintext) {
		return {
			error: {
				status: 401,
				body: { error: "Chave de API ausente ou mal formatada", code: "missing_key" },
			},
		};
	}

	const { data, error } = await supabase.rpc("validate_flow_api_key", {
		_plaintext: plaintext,
	});

	if (error || !data || !Array.isArray(data) || data.length === 0) {
		return {
			error: {
				status: 401,
				body: { error: "Falha ao validar a chave", code: "validation_error" },
			},
		};
	}

	const row = data[0] as {
		key_id: string | null;
		workspace_id: string | null;
		scopes: string[] | null;
		is_valid: boolean;
		reason: string;
	};

	if (!row.is_valid) {
		// Auditoria de falha (sem plaintext)
		await supabase.from("flow_api_key_audit").insert({
			key_id: row.key_id,
			workspace_id: row.workspace_id,
			event: "auth_failed",
			ip,
			user_agent: userAgent,
			route,
			metadata: { reason: row.reason },
		});
		return {
			error: {
				status: 401,
				body: { error: `Chave inválida (${row.reason})`, code: row.reason },
			},
		};
	}

	const scopes = (row.scopes || []) as FlowScope[];
	if (!scopes.includes(opts.requireScope)) {
		await supabase.from("flow_api_key_audit").insert({
			key_id: row.key_id,
			workspace_id: row.workspace_id,
			event: "auth_failed",
			ip,
			user_agent: userAgent,
			route,
			metadata: { reason: "insufficient_scope", required: opts.requireScope, granted: scopes },
		});
		return {
			error: {
				status: 403,
				body: {
					error: `Chave sem escopo necessário: ${opts.requireScope}`,
					code: "insufficient_scope",
				},
			},
		};
	}

	// Toca last_used e registra uso (não bloqueia response se falhar)
	await Promise.all([
		supabase.rpc("touch_flow_api_key", { _key_id: row.key_id, _ip: ip }),
		supabase.from("flow_api_key_audit").insert({
			key_id: row.key_id,
			workspace_id: row.workspace_id,
			event: "used",
			scope_used: opts.requireScope,
			ip,
			user_agent: userAgent,
			route,
		}),
	]);

	return {
		ctx: {
			keyId: row.key_id!,
			workspaceId: row.workspace_id!,
			scopes,
			ip,
			userAgent,
			supabase,
		},
	};
}

export function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeaders, "Content-Type": "application/json" },
	});
}
