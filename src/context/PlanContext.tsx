"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useWorkspace } from "./WorkspaceContext";
import { useAuth } from "./AuthContext";
import {
	PLAN_LABELS as RESOLVER_LABELS,
	PLAN_LIMITS as RESOLVER_LIMITS,
	resolveEffectivePlan,
	type EffectiveTier,
	type PlanLimits as ResolvedLimits,
} from "../lib/planResolver";

// PlanId histórico (3 tiers vendáveis no standalone). Em embedded o tier
// efetivo pode ainda ser "suspended" — use EffectiveTier para esse caso.
export type PlanId = "starter" | "pro" | "business";
export type { EffectiveTier } from "../lib/planResolver";

export type PlanLimits = {
	bots: number;
	messages: number;
};

export const PLAN_LIMITS: Record<EffectiveTier, PlanLimits> = {
	starter:   { bots: RESOLVER_LIMITS.starter.bots,   messages: RESOLVER_LIMITS.starter.messagesPerMonth },
	pro:       { bots: RESOLVER_LIMITS.pro.bots,       messages: RESOLVER_LIMITS.pro.messagesPerMonth },
	business:  { bots: RESOLVER_LIMITS.business.bots,  messages: RESOLVER_LIMITS.business.messagesPerMonth },
	suspended: { bots: RESOLVER_LIMITS.suspended.bots, messages: RESOLVER_LIMITS.suspended.messagesPerMonth },
};

export const PLAN_LABELS = RESOLVER_LABELS;

type PlanContextType = {
	currentPlan: EffectiveTier;
	setCurrentPlan: (plan: PlanId) => void;
	limits: PlanLimits;
	resolvedLimits: ResolvedLimits;
	botsUsed: number;
	canAddBot: boolean;
	remainingBots: number;
	managedBy: "booking" | "internal";
	isSuspended: boolean;
	syncedAt: string | null;
};

const PlanContext = createContext<PlanContextType | null>(null);

const STORAGE_KEY = "workspace_current_plan_v1";

export function PlanProvider({ children }: { children: React.ReactNode }) {
	const { items } = useWorkspace();
	const { profile } = useAuth();

	// Override standalone via localStorage (mantém compatibilidade com a UI
	// de testes de plano). Ignorado quando o workspace é gerenciado pelo
	// Zailom Booking — neste caso o tier vem do JWT/sync.
	const [overridePlan, setOverridePlan] = useState<PlanId>("starter");

	useEffect(() => {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw === "starter" || raw === "pro" || raw === "business") {
				setOverridePlan(raw);
			}
		} catch (e) {
			console.error("Falha ao ler plano do localStorage", e);
		}
	}, []);

	const resolved = useMemo(() => {
		const base = resolveEffectivePlan(profile);
		// Standalone: permite o override local sobrescrever (debug/teste).
		if (base.managedBy === "internal") {
			return resolveEffectivePlan({
				plan: overridePlan,
				embed_source: null,
				embed_plan_tier: null,
				embed_plan_synced_at: null,
			});
		}
		return base;
	}, [profile, overridePlan]);

	const setCurrentPlan = (plan: PlanId) => {
		// Em workspaces gerenciados pelo Zailom Booking, ignora a alteração local.
		if (resolved.managedBy === "booking") {
			console.warn("[Plan] Tentativa de alterar plano em workspace gerenciado pelo Zailom Booking — ignorado.");
			return;
		}
		setOverridePlan(plan);
		try {
			localStorage.setItem(STORAGE_KEY, plan);
		} catch (e) {
			console.error("Falha ao salvar plano no localStorage", e);
		}
	};

	const limits = PLAN_LIMITS[resolved.tier];
	const botsUsed = useMemo(
		() => items.filter((i) => i.type === "bot").length,
		[items]
	);
	const canAddBot = !resolved.isSuspended && botsUsed < limits.bots;
	const remainingBots = Number.isFinite(limits.bots)
		? Math.max(0, limits.bots - botsUsed)
		: Infinity;

	return (
		<PlanContext.Provider
			value={{
				currentPlan: resolved.tier,
				setCurrentPlan,
				limits,
				resolvedLimits: resolved.limits,
				botsUsed,
				canAddBot,
				remainingBots,
				managedBy: resolved.managedBy,
				isSuspended: resolved.isSuspended,
				syncedAt: resolved.syncedAt,
			}}
		>
			{children}
		</PlanContext.Provider>
	);
}

export function usePlan() {
	const ctx = useContext(PlanContext);
	if (!ctx) throw new Error("usePlan must be used within a PlanProvider");
	return ctx;
}
