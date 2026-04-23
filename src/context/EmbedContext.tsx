"use client";

import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

/**
 * Modos de operação do TalkMap:
 * - "standalone": app rodando sozinho (talkmap.com.br) — usuário compra TalkMap direto.
 * - "embedded":   app rodando dentro de iframe do BookingFy.
 *                 Identidade, billing e algumas configs vêm do host.
 */
export type EmbedMode = "standalone" | "embedded";

export type EmbedHost = "bookingfy" | null;

/**
 * Claims que esperamos receber do JWT emitido pelo BookingFy.
 * Veja docs/embed-contract.md para o contrato completo.
 */
export type EmbedSession = {
	tenantId: string;
	userId: string;
	slug: string;
	plan: "starter" | "pro" | "business";
	// Se o BookingFy quiser desligar features específicas por conta/plano,
	// pode mandar overrides aqui. Caso contrário usamos defaults do modo.
	featureOverrides?: Partial<EmbedFeatureFlags>;
};

export type EmbedFeatureFlags = {
	showHeader: boolean;
	showProfile: boolean;
	showBilling: boolean; // aba "Pagamentos" + página de plano
	showCompanyTab: boolean; // aba "Empresa" das configs
	showBookingfyIntegrationCard: boolean; // card BookingFy nas integrações
	showPlanLimitsBanner: boolean; // banner "seu plano permite X bots"
	showSignup: boolean;
	allowLogout: boolean;
};

type EmbedContextType = {
	mode: EmbedMode;
	host: EmbedHost;
	session: EmbedSession | null;
	flags: EmbedFeatureFlags;
	isReady: boolean;
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
};

const EMBEDDED_DEFAULT_FLAGS: EmbedFeatureFlags = {
	showHeader: false, // BookingFy já tem o próprio header
	showProfile: false, // perfil é gerenciado pelo BookingFy
	showBilling: false, // BookingFy controla billing
	showCompanyTab: false, // BookingFy já tem dados da empresa
	showBookingfyIntegrationCard: false, // não faz sentido integrar com quem já te hospeda
	showPlanLimitsBanner: false, // limites vêm do BookingFy
	showSignup: false,
	allowLogout: false,
};

const EmbedContext = createContext<EmbedContextType | null>(null);

/**
 * Detecta o modo no boot do app.
 *
 * Ordem de prioridade:
 * 1. Token no hash da URL: #embed_token=eyJ...&host=bookingfy
 *    (hash não vai pro servidor/logs, ideal pra JWT curto)
 * 2. Postmessage handshake do parent (caso o BookingFy injete o token depois)
 * 3. Fallback → standalone
 *
 * Em produção a validação real do JWT (assinatura HS256) acontece no servidor,
 * não aqui. Esse contexto serve só pra UI condicional.
 */
function detectInitialMode(): {
	mode: EmbedMode;
	host: EmbedHost;
	session: EmbedSession | null;
} {
	if (typeof window === "undefined") {
		return { mode: "standalone", host: null, session: null };
	}

	try {
		const hash = window.location.hash.startsWith("#")
			? window.location.hash.slice(1)
			: window.location.hash;
		const params = new URLSearchParams(hash);
		const token = params.get("embed_token");
		const host = params.get("host") as EmbedHost;

		if (token && host === "bookingfy") {
			const session = decodeJwtPayload(token);
			if (session) {
				// limpa o hash pra não vazar o token em screenshots
				window.history.replaceState(
					null,
					"",
					window.location.pathname + window.location.search
				);
				return { mode: "embedded", host: "bookingfy", session };
			}
		}
	} catch (e) {
		console.warn("[Embed] Falha ao parsear token do hash:", e);
	}

	// Heurística: se estamos dentro de um iframe, provavelmente é embed.
	// Mantemos standalone até receber handshake confirmando o host.
	return { mode: "standalone", host: null, session: null };
}

/**
 * Decodifica o payload de um JWT SEM validar assinatura.
 * A validação real é responsabilidade do backend/server function.
 * Aqui só queremos os claims pra UI.
 */
function decodeJwtPayload(token: string): EmbedSession | null {
	try {
		const parts = token.split(".");
		if (parts.length !== 3) return null;
		const payload = JSON.parse(
			atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
		);
		if (!payload.tenantId || !payload.userId || !payload.slug) return null;
		return {
			tenantId: payload.tenantId,
			userId: payload.userId,
			slug: payload.slug,
			plan: payload.plan ?? "starter",
			featureOverrides: payload.featureOverrides,
		};
	} catch {
		return null;
	}
}

export function EmbedProvider({ children }: { children: React.ReactNode }) {
	const [{ mode, host, session }, setState] = useState(() =>
		detectInitialMode()
	);
	const [isReady, setIsReady] = useState(true);

	// Postmessage handshake: BookingFy pode injetar/atualizar a sessão depois
	useEffect(() => {
		if (typeof window === "undefined") return;

		const allowedOrigins = [
			"https://bookingfy.com.br",
			"https://www.bookingfy.com.br",
			// dev:
			"http://localhost:3000",
			"http://localhost:5173",
		];

		function handleMessage(event: MessageEvent) {
			if (!allowedOrigins.includes(event.origin)) return;
			const data = event.data;
			if (!data || typeof data !== "object") return;

			if (data.type === "talkmap:embed:init" && data.token) {
				const newSession = decodeJwtPayload(data.token);
				if (newSession) {
					setState({
						mode: "embedded",
						host: "bookingfy",
						session: newSession,
					});
					setIsReady(true);
				}
			}

			if (data.type === "talkmap:embed:logout") {
				setState({ mode: "standalone", host: null, session: null });
			}
		}

		window.addEventListener("message", handleMessage);

		// Avisa o parent que já estamos prontos pra receber o token
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
		<EmbedContext.Provider value={{ mode, host, session, flags, isReady }}>
			{children}
		</EmbedContext.Provider>
	);
}

export function useEmbed() {
	const ctx = useContext(EmbedContext);
	if (!ctx) throw new Error("useEmbed must be used within EmbedProvider");
	return ctx;
}

/**
 * Hook utilitário pra checar uma flag específica.
 * Ex: const showBilling = useFeatureFlag("showBilling")
 */
export function useFeatureFlag(flag: keyof EmbedFeatureFlags): boolean {
	return useEmbed().flags[flag];
}
