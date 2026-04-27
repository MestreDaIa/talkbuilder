/**
 * Cliente para o endpoint POST /api/keys/validate.
 *
 * STATUS: Não implementado server-side neste projeto (não há backend próprio).
 * Quando o backend existir, configure VITE_BACKEND_URL e essa função
 * passa a funcionar automaticamente.
 *
 * Contrato esperado:
 *   POST {VITE_BACKEND_URL}/api/keys/validate
 *   body: { api_key: string }
 *   → 200 { valid: true, workspace_slug, user_id, user_email }
 *   → 401 { valid: false, error: string }
 *
 * O backend precisa:
 *   - Aceitar CORS de https://flow-appoint.lovable.app e https://*.lovable.app
 *   - Comparar hash da chave (nunca armazenar plaintext)
 *   - Atualizar last_used_at na tabela api_keys
 */

export type ApiKeyValidationResult =
	| {
			valid: true;
			workspace_slug: string;
			user_id: string;
			user_email: string;
	  }
	| { valid: false; error: string };

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL as string | undefined;

export async function validateApiKey(
	apiKey: string
): Promise<ApiKeyValidationResult> {
	if (!BACKEND_URL) {
		return {
			valid: false,
			error:
				"Validação de API key requer backend próprio (VITE_BACKEND_URL não configurado).",
		};
	}
	try {
		const res = await fetch(`${BACKEND_URL}/api/keys/validate`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ api_key: apiKey }),
		});
		return (await res.json()) as ApiKeyValidationResult;
	} catch {
		return { valid: false, error: "Falha de rede." };
	}
}
