// @ts-nocheck
// ============================================================
// Zailom Flow — Public API (MVP)
// verify_jwt = FALSE  (autenticação feita via Flow API Key própria)
//
// Endpoints:
//   GET  /flow-api/v1/bots
//        → escopo: bots:read
//        → lista bots do workspace da chave
//
//   GET  /flow-api/v1/bots/:botId
//        → escopo: bots:read
//
//   POST /flow-api/v1/bots/:botId/run
//        → escopo: bots:run
//        → body: { contact_id: string, message?: string, channel_id?: string, reset?: boolean }
//        → invoca o runtime interno (chatbot-runtime) com o payload
//
//   GET  /flow-api/v1/sessions?bot_id=&contact_id=
//        → escopo: sessions:read
// ============================================================
import {
	authenticateFlowRequest,
	corsHeaders,
	jsonResponse,
} from "../_shared/flowAuth.ts";

Deno.serve(async (req: Request) => {
	if (req.method === "OPTIONS") {
		return new Response("ok", { headers: corsHeaders });
	}

	const url = new URL(req.url);
	// Path esperado: /flow-api/v1/...  (Supabase encaminha /functions/v1/flow-api/...)
	const parts = url.pathname.split("/").filter(Boolean);
	// Descarta prefixo até "v1"
	const vIdx = parts.indexOf("v1");
	const route = vIdx >= 0 ? parts.slice(vIdx + 1) : parts;

	try {
		// ---- GET /v1/bots ----
		if (req.method === "GET" && route.length === 1 && route[0] === "bots") {
			const auth = await authenticateFlowRequest(req, {
				requireScope: "bots:read",
				route: "/v1/bots",
			});
			if ("error" in auth) return jsonResponse(auth.error.body, auth.error.status);

			const { supabase, workspaceId } = auth.ctx;
			const { data, error } = await supabase
				.from("chatbot_flows")
				.select("id, name, description, is_published, updated_at, created_at")
				.eq("workspace_id", workspaceId)
				.order("updated_at", { ascending: false })
				.limit(200);

			if (error) return jsonResponse({ error: error.message }, 500);
			return jsonResponse({ data });
		}

		// ---- GET /v1/bots/:id ----
		if (req.method === "GET" && route.length === 2 && route[0] === "bots") {
			const botId = route[1];
			const auth = await authenticateFlowRequest(req, {
				requireScope: "bots:read",
				route: `/v1/bots/${botId}`,
			});
			if ("error" in auth) return jsonResponse(auth.error.body, auth.error.status);

			const { supabase, workspaceId } = auth.ctx;
			const { data, error } = await supabase
				.from("chatbot_flows")
				.select("id, name, description, is_published, updated_at, created_at, public_id")
				.eq("workspace_id", workspaceId)
				.eq("id", botId)
				.maybeSingle();

			if (error) return jsonResponse({ error: error.message }, 500);
			if (!data) return jsonResponse({ error: "Bot não encontrado" }, 404);
			return jsonResponse({ data });
		}

		// ---- POST /v1/bots/:id/run ----
		if (
			req.method === "POST" &&
			route.length === 3 &&
			route[0] === "bots" &&
			route[2] === "run"
		) {
			const botId = route[1];
			const auth = await authenticateFlowRequest(req, {
				requireScope: "bots:run",
				route: `/v1/bots/${botId}/run`,
			});
			if ("error" in auth) return jsonResponse(auth.error.body, auth.error.status);
			const { supabase, workspaceId } = auth.ctx;

			// Confirma que o bot pertence ao workspace da chave
			const { data: bot, error: botErr } = await supabase
				.from("chatbot_flows")
				.select("id")
				.eq("workspace_id", workspaceId)
				.eq("id", botId)
				.maybeSingle();
			if (botErr) return jsonResponse({ error: botErr.message }, 500);
			if (!bot) return jsonResponse({ error: "Bot não encontrado" }, 404);

			// Valida payload
			let body: any = {};
			try {
				body = await req.json();
			} catch {
				return jsonResponse({ error: "Body inválido (JSON esperado)" }, 400);
			}
			const contactId = typeof body.contact_id === "string" ? body.contact_id.trim() : "";
			const message = typeof body.message === "string" ? body.message : "";
			const channelId =
				typeof body.channel_id === "string" && body.channel_id.trim()
					? body.channel_id.trim()
					: "api";
			const reset = body.reset === true;

			if (!contactId || contactId.length > 128) {
				return jsonResponse({ error: "contact_id obrigatório (1..128 chars)" }, 400);
			}
			if (message.length > 8000) {
				return jsonResponse({ error: "message excede 8000 caracteres" }, 400);
			}

			// Invoca runtime interno via functions.invoke (usa service role já configurado)
			const { data: runResult, error: runErr } = await supabase.functions.invoke(
				"chatbot-runtime",
				{
					body: {
						flow_id: botId,
						contact_id: contactId,
						message,
						channel_id: channelId,
						reset,
					},
				}
			);
			if (runErr) return jsonResponse({ error: runErr.message }, 502);
			return jsonResponse({ data: runResult });
		}

		// ---- GET /v1/sessions ----
		if (req.method === "GET" && route.length === 1 && route[0] === "sessions") {
			const auth = await authenticateFlowRequest(req, {
				requireScope: "sessions:read",
				route: "/v1/sessions",
			});
			if ("error" in auth) return jsonResponse(auth.error.body, auth.error.status);
			const { supabase, workspaceId } = auth.ctx;

			const botId = url.searchParams.get("bot_id");
			const contactId = url.searchParams.get("contact_id");
			let q = supabase
				.from("conversation_sessions")
				.select("*")
				.eq("workspace_id", workspaceId)
				.order("last_interaction_at", { ascending: false })
				.limit(100);
			if (botId) q = q.eq("flow_id", botId);
			if (contactId) q = q.eq("contact_id", contactId);

			const { data, error } = await q;
			if (error) return jsonResponse({ error: error.message }, 500);
			return jsonResponse({ data });
		}

		return jsonResponse({ error: "Rota não encontrada" }, 404);
	} catch (e) {
		console.error("[flow-api] erro não tratado:", e);
		return jsonResponse({ error: "Erro interno" }, 500);
	}
});
