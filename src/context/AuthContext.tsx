"use client";

import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "../lib/supabaseClient";

export type PlanId = "starter" | "pro" | "business";

export type Profile = {
	id: string;
	slug: string;
	display_name: string | null;
	avatar_url: string | null;
	plan: PlanId;
	embed_source: string | null;
	embed_company_id: string | null;
	embed_plan_tier: string | null;
	embed_plan_synced_at: string | null;
};

type AuthContextType = {
	user: User | null;
	session: Session | null;
	profile: Profile | null;
	loading: boolean;
	isConfigured: boolean;
	signOut: () => Promise<void>;
	refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [session, setSession] = useState<Session | null>(null);
	const [user, setUser] = useState<User | null>(null);
	const [profile, setProfile] = useState<Profile | null>(null);
	const [loading, setLoading] = useState(true);

	const isConfigured = useMemo(() => isSupabaseConfigured(), []);

	useEffect(() => {
		const supabase = getSupabase();
		if (!supabase) {
			setLoading(false);
			return;
		}

		// IMPORTANT: register listener BEFORE getSession (knowledge rule)
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, newSession) => {
			setSession(newSession);
			setUser(newSession?.user ?? null);
			if (newSession?.user) {
				// defer to avoid deadlock per Supabase guidance
				setTimeout(() => loadProfile(newSession.user.id), 0);
			} else {
				setProfile(null);
			}
		});

		supabase.auth.getSession().then(({ data: { session: s } }) => {
			setSession(s);
			setUser(s?.user ?? null);
			if (s?.user) {
				loadProfile(s.user.id).finally(() => setLoading(false));
			} else {
				setLoading(false);
			}
		});

		return () => subscription.unsubscribe();
	}, []);

	async function loadProfile(userId: string) {
		const supabase = getSupabase();
		if (!supabase) return;
		const { data, error } = await supabase
			.from("profiles")
			.select("id, slug, display_name, avatar_url, plan, embed_source, embed_company_id, embed_plan_tier, embed_plan_synced_at")
			.eq("id", userId)
			.maybeSingle();
		if (error) {
			console.error("[Auth] Falha ao carregar profile:", error);
			return;
		}
		setProfile(data as Profile | null);
	}

	async function refreshProfile() {
		if (user) await loadProfile(user.id);
	}

	async function signOut() {
		const supabase = getSupabase();
		if (!supabase) return;
		await supabase.auth.signOut();
	}

	return (
		<AuthContext.Provider
			value={{
				user,
				session,
				profile,
				loading,
				isConfigured,
				signOut,
				refreshProfile,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within AuthProvider");
	return ctx;
}
