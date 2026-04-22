"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useWorkspace } from "./WorkspaceContext";

export type PlanId = "starter" | "pro" | "business";

export type PlanLimits = {
	bots: number; // Infinity = ilimitado
	messages: number;
};

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
	starter: { bots: 1, messages: 1000 },
	pro: { bots: 3, messages: 10000 },
	business: { bots: Infinity, messages: 50000 },
};

export const PLAN_LABELS: Record<PlanId, string> = {
	starter: "Starter",
	pro: "Pro",
	business: "Business",
};

type PlanContextType = {
	currentPlan: PlanId;
	setCurrentPlan: (plan: PlanId) => void;
	limits: PlanLimits;
	botsUsed: number;
	canAddBot: boolean;
	remainingBots: number;
};

const PlanContext = createContext<PlanContextType | null>(null);

const STORAGE_KEY = "workspace_current_plan_v1";

export function PlanProvider({ children }: { children: React.ReactNode }) {
	const { items } = useWorkspace();
	const [currentPlan, setCurrentPlanState] = useState<PlanId>("starter");

	useEffect(() => {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw === "starter" || raw === "pro" || raw === "business") {
				setCurrentPlanState(raw);
			}
		} catch (e) {
			console.error("Falha ao ler plano do localStorage", e);
		}
	}, []);

	const setCurrentPlan = (plan: PlanId) => {
		setCurrentPlanState(plan);
		try {
			localStorage.setItem(STORAGE_KEY, plan);
		} catch (e) {
			console.error("Falha ao salvar plano no localStorage", e);
		}
	};

	const limits = PLAN_LIMITS[currentPlan];
	const botsUsed = useMemo(
		() => items.filter((i) => i.type === "bot").length,
		[items]
	);
	const canAddBot = botsUsed < limits.bots;
	const remainingBots = Number.isFinite(limits.bots)
		? Math.max(0, limits.bots - botsUsed)
		: Infinity;

	return (
		<PlanContext.Provider
			value={{
				currentPlan,
				setCurrentPlan,
				limits,
				botsUsed,
				canAddBot,
				remainingBots,
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
