/**
 * Validação do JWT de embed (Flow-Appoint / BookingFy).
 *
 * ATUAL: client-side — só decodifica payload e checa exp/iss/aud.
 *        A assinatura HS256 NÃO é verificada porque o secret
 *        EMBED_SHARED_SECRET não pode ficar no bundle do browser.
 *
 * FUTURO (quando o backend próprio existir):
 *        Apontar VITE_BACKEND_URL pra ele e descomentar a chamada
 *        a `validateEmbedTokenRemote`. Esse endpoint deve:
 *          POST {VITE_BACKEND_URL}/api/embed/validate
 *          body: { token: string }
 *          → 200 { valid: true, session: {...} }
 *          → 401 { valid: false, error: "..." }
 *        Implementação server-side em Node:
 *          import jwt from "jsonwebtoken";
 *          jwt.verify(token, process.env.EMBED_SHARED_SECRET, {
 *            algorithms: ["HS256"],
 *            issuer: "flow-appoint",
 *            audience: "builder-flow-api",
 *          });
 */

export type RemoteValidationResult =
	| { valid: true; session: Record<string, unknown> }
	| { valid: false; error: string };

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL as string | undefined;

export async function validateEmbedTokenRemote(
	token: string
): Promise<RemoteValidationResult | null> {
	if (!BACKEND_URL) return null; // backend ainda não existe — fica só client-side
	try {
		const res = await fetch(`${BACKEND_URL}/api/embed/validate`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ token }),
			credentials: "include",
		});
		return (await res.json()) as RemoteValidationResult;
	} catch (e) {
		console.error("[embedValidation] Falha na validação remota:", e);
		return { valid: false, error: "Falha de rede ao validar sessão." };
	}
}
