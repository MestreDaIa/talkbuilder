// =============================================================================
// planResolver.ts — fonte única de verdade para o plano efetivo do workspace
// -----------------------------------------------------------------------------
// Workspaces criados via Zailom Booking (embed) têm o plano gerenciado pelo host.
// Workspaces standalone usam o plano interno (profiles.plan).
//
// Sempre que o app for ler "plano atual" (limites, gating de UI, billing,
// execução de bots), use resolveEffectivePlan(profile) — NUNCA leia profile.plan
// diretamente.
// =============================================================================

export type StandaloneTier = "starter" | "pro" | "business";
export type EmbedTier = StandaloneTier | "suspended";
export type EffectiveTier = EmbedTier;

export type PlanLimits = {
  bots: number;          // Infinity = ilimitado
  messagesPerMonth: number;
  integrations: number;  // Infinity = ilimitado
  /** Quando true, bloqueia execução de bots e edição (kill switch). */
  suspended: boolean;
};

export const PLAN_LIMITS: Record<EffectiveTier, PlanLimits> = {
  starter:   { bots: 1,        messagesPerMonth: 1000,  integrations: 2,        suspended: false },
  pro:       { bots: 5,        messagesPerMonth: 10000, integrations: 10,       suspended: false },
  business:  { bots: 20,       messagesPerMonth: 50000, integrations: Infinity, suspended: false },
  suspended: { bots: 0,        messagesPerMonth: 0,     integrations: 0,        suspended: true  },
};

export const PLAN_LABELS: Record<EffectiveTier, string> = {
  starter:   "Starter",
  pro:       "Pro",
  business:  "Business",
  suspended: "Suspenso",
};

export type ProfileForPlan = {
  plan?: string | null;
  embed_source?: string | null;
  embed_plan_tier?: string | null;
  embed_plan_synced_at?: string | null;
  embed_max_chatbots?: number | null;
  embed_max_messages?: number | null;
  embed_max_integrations?: number | null;
};

export type ResolvedPlan = {
  tier: EffectiveTier;
  managedBy: "booking" | "internal";
  syncedAt: string | null;
  limits: PlanLimits;
  isSuspended: boolean;
};

function asEffectiveTier(value: string | null | undefined, fallback: EffectiveTier): EffectiveTier {
  if (value === "starter" || value === "pro" || value === "business" || value === "suspended") {
    return value;
  }
  return fallback;
}

export function resolveEffectivePlan(profile: ProfileForPlan | null | undefined): ResolvedPlan {
  if (profile?.embed_source === "booking") {
    const tier = asEffectiveTier(profile.embed_plan_tier, "starter");
    
    // Para usuários embedados, os limites provisionados são a fonte oficial da verdade.
    // Se não existirem, usamos os limites padrão do tier.
    const limits: PlanLimits = {
      bots: profile.embed_max_chatbots ?? PLAN_LIMITS[tier].bots,
      messagesPerMonth: profile.embed_max_messages ?? PLAN_LIMITS[tier].messagesPerMonth,
      integrations: profile.embed_max_integrations ?? PLAN_LIMITS[tier].integrations,
      suspended: tier === "suspended"
    };

    return {
      tier,
      managedBy: "booking",
      syncedAt: profile.embed_plan_synced_at ?? null,
      limits,
      isSuspended: tier === "suspended",
    };
  }
  const tier = asEffectiveTier(profile?.plan, "starter");
  return {
    tier,
    managedBy: "internal",
    syncedAt: null,
    limits: PLAN_LIMITS[tier],
    isSuspended: tier === "suspended",
  };
}
