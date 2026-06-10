"use client";

import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

/**
 * Modos de operação do Zailom Flow / builder-flow-api:
 * - "standalone": app rodando sozinho — usuário usa via login normal.
 * - "embedded":   app rodando dentro de iframe de um host (BookingFy ou Zailom Booking).
 *                 Identidade vem do host via JWT.
 */
export type EmbedMode = "standalone" | "embedded";

export type EmbedHost = "bookingfy" | "booking" | null;

/**
 * Sessão derivada do JWT do host.
 * Os campos variam por host: BookingFy usa tenantId/userId/slug,
 * Zailom Booking usa companyId/workspaceSlug/userEmail.
 * Mantemos um shape unificado pra facilitar o consumo na UI.
 */
export type EmbedSession = {
	host: Exclude<EmbedHost, null>;
	// Identificador da empresa/tenant no host
	companyId: string;
	// Slug do workspace que esse embed está autorizado a ver/editar
	workspaceSlug: string;
	// Email do usuário (Zailom Booking) ou ID (BookingFy)
	userIdentifier: string;
	plan?: "starter" | "pro" | "business";
	expiresAt?: number; // unix seconds
	featureOverrides?: Partial<EmbedFeatureFlags>;
	// Token original — útil pra reenviar pro backend quando ele existir
	rawToken: string;
};

export type EmbedFeatureFlags = {
	showHeader: boolean;
	showProfile: boolean;
	showBilling: boolean;
	showCompanyTab: boolean;
	showBookingfyIntegrationCard: boolean;
	showPlanLimitsBanner: boolean;
	showSignup: boolean;
	allowLogout: boolean;
	// Trava o seletor de workspace no slug recebido pelo JWT
	lockWorkspaceSelector: boolean;
};

type EmbedContextType = {
	mode: EmbedMode;
	host: EmbedHost;
	session: EmbedSession | null;
	flags: EmbedFeatureFlags;
	isReady: boolean;
	error: string | null;
};

const STANDALONE_FLAGS: EmbedFeatureFlags = {
	showHeader: true,
	showProfile: true,
	showBilling: true,
	showCompanyTab: true,
	showBookingfyIntegrationCard: true,
	showPlanLimitsBanner: true,
	showSignup: true,
	allowLogout: true,
	lockWorkspaceSelector: false,
};

const EMBEDDED_DEFAULT_FLAGS: EmbedFeatureFlags = {
	showHeader: false,
	showProfile: false,
	showBilling: false,
	showCompanyTab: false,
	showBookingfyIntegrationCard: false,
	showPlanLimitsBanner: false,
	showSignup: false,
	allowLogout: false,
	lockWorkspaceSelector: true,
};

const EmbedContext = createContext<EmbedContextType | null>(null);

/**
 * Decodifica payload de JWT SEM validar assinatura.
 * A validação real (HS256 com EMBED_SHARED_SECRET) deve acontecer no backend
 * — atualmente esse projeto não tem backend próprio, então fica como TODO.
 * Veja src/lib/embedValidation.ts para o ponto de extensão.
 */
function decodeJwtPayload(token: string): Record<string, any> | null {
	try {
		const parts = token.split(".");
		if (parts.length !== 3) return null;
		return JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
	} catch {
		return null;
	}
}

function buildSession(
	host: Exclude<EmbedHost, null>,
	token: string
): { session: EmbedSession | null; error: string | null } {
	const payload = decodeJwtPayload(token);
	if (!payload) return { session: null, error: "Token inválido (formato)." };

	// Verifica expiração
	const now = Math.floor(Date.now() / 1000);
	if (payload.exp && payload.exp < now) {
		return { session: null, error: "Sessão expirada." };
	}

	if (host === "booking") {
		// Esperado: { iss: "zailom-booking", aud: "zailom-flow-api",
		//           company_id, workspace_slug, user_email, exp }
		if (payload.iss !== "zailom-booking" || payload.aud !== "zailom-flow-api") {
			return { session: null, error: "Token com issuer/audience inválido." };
		}
		if (!payload.company_id || !payload.workspace_slug || !payload.user_email) {
			return { session: null, error: "Token sem claims obrigatórias." };
		}
		return {
			error: null,
			session: {
				host,
				companyId: payload.company_id,
				workspaceSlug: payload.workspace_slug,
				userIdentifier: payload.user_email,
				plan: payload.plan,
				expiresAt: payload.exp,
				featureOverrides: payload.featureOverrides,
				rawToken: token,
			},
		};
	}

	// BookingFy (contrato legado: tenantId/userId/slug)
	if (!payload.tenantId || !payload.userId || !payload.slug) {
		return { session: null, error: "Token BookingFy sem claims obrigatórias." };
	}
	return {
		error: null,
		session: {
			host: "bookingfy",
			companyId: payload.tenantId,
			workspaceSlug: payload.slug,
			userIdentifier: payload.userId,
			plan: payload.plan ?? "starter",
			expiresAt: payload.exp,
			featureOverrides: payload.featureOverrides,
			rawToken: token,
		},
	};
}

function detectInitialMode(): {
	mode: EmbedMode;
	host: EmbedHost;
	session: EmbedSession | null;
	error: string | null;
} {
	if (typeof window === "undefined") {
		return { mode: "standalone", host: null, session: null, error: null };
	}

	try {
		const hash = window.location.hash.startsWith("#")
			? window.location.hash.slice(1)
			: window.location.hash;
		const params = new URLSearchParams(hash);
		const token = params.get("embed_token");
		const hostParam = params.get("host");

		// Aceita "flow-appoint" e "bookingfy". Default = flow-appoint
		// (já que é o novo host principal).
		const host: EmbedHost =
			hostParam === "bookingfy"
				? "bookingfy"
				: hostParam === "booking" || (token && !hostParam)
					? "booking"
					: null;

		if (token && host) {
			const { session, error } = buildSession(host, token);
			// limpa o hash pra não vazar o token em logs/screenshots
			window.history.replaceState(
				null,
				"",
				window.location.pathname + window.location.search
			);
			if (session) {
				return { mode: "embedded", host, session, error: null };
			}
			return { mode: "standalone", host: null, session: null, error };
		}
	} catch (e) {
		console.warn("[Embed] Falha ao parsear token do hash:", e);
	}

	return { mode: "standalone", host: null, session: null, error: null };
}

export function EmbedProvider({ children }: { children: React.ReactNode }) {
	const [{ mode, host, session, error }, setState] = useState(() =>
		detectInitialMode()
	);
	const [isReady] = useState(true);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const allowedOrigins = [
			"https://bookingfy.com.br",
			"https://www.bookingfy.com.br",
			"https://flow-appoint.lovable.app",
			// dev:
			"http://localhost:3000",
			"http://localhost:5173",
		];
		// Permite previews do Lovable (qualquer subdomínio *.lovable.app)
		function isAllowed(origin: string) {
			if (allowedOrigins.includes(origin)) return true;
			try {
				const url = new URL(origin);
				return url.hostname.endsWith(".lovable.app");
			} catch {
				return false;
			}
		}

		function handleMessage(event: MessageEvent) {
			if (!isAllowed(event.origin)) return;
			const data = event.data;
			if (!data || typeof data !== "object") return;

			if (data.type === "talkmap:embed:init" && data.token) {
				// Tenta detectar o host pela origem
				const inferredHost: Exclude<EmbedHost, null> = event.origin.includes(
					"booking"
				)
					? "booking"
					: "bookingfy";
				const { session: newSession, error: newError } = buildSession(
					inferredHost,
					data.token
				);
				if (newSession) {
					setState({
						mode: "embedded",
						host: inferredHost,
						session: newSession,
						error: null,
					});
				} else {
					setState({
						mode: "standalone",
						host: null,
						session: null,
						error: newError,
					});
				}
			}

			if (data.type === "talkmap:embed:logout") {
				setState({
					mode: "standalone",
					host: null,
					session: null,
					error: null,
				});
			}
		}

		window.addEventListener("message", handleMessage);

		if (window.parent !== window) {
			window.parent.postMessage({ type: "talkmap:embed:ready" }, "*");
		}

		return () => window.removeEventListener("message", handleMessage);
	}, []);

	const flags = useMemo<EmbedFeatureFlags>(() => {
		if (mode === "standalone") return STANDALONE_FLAGS;
		return { ...EMBEDDED_DEFAULT_FLAGS, ...(session?.featureOverrides ?? {}) };
	}, [mode, session]);

	return (
		<EmbedContext.Provider
			value={{ mode, host, session, flags, isReady, error }}
		>
			{children}
		</EmbedContext.Provider>
	);
}

export function useEmbed() {
	const ctx = useContext(EmbedContext);
	if (!ctx) throw new Error("useEmbed must be used within EmbedProvider");
	return ctx;
}

export function useFeatureFlag(flag: keyof EmbedFeatureFlags): boolean {
	return useEmbed().flags[flag];
}

/** True quando o app está rodando dentro de um iframe (independente de ter token válido). */
export function isInIframe(): boolean {
	if (typeof window === "undefined") return false;
	try {
		return window.self !== window.top;
	} catch {
		return true;
	}
}
