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
	workspaces: any[];
	currentWorkspace: any | null;
	switchWorkspace: (slug: string) => void;
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

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, newSession) => {
			setSession(newSession);
			const newUser = newSession?.user ?? null;
			setUser(newUser);
			
			if (newUser) {
				// Avoid refresh loop by checking if we already have the profile/workspaces for this user
				// But for simplicity, we just trigger the load
				loadAll(newUser.id);
			} else {
				setProfile(null);
				setWorkspaces([]);
				setCurrentWorkspace(null);
				setLoading(false);
			}
		});

		async function loadAll(userId: string) {
			setLoading(true);
			await Promise.all([
				loadProfile(userId),
				loadWorkspaces(userId)
			]);
			setLoading(false);
		}

		supabase.auth.getSession().then(({ data: { session: s } }) => {
			setSession(s);
			setUser(s?.user ?? null);
			if (s?.user) {
				loadAll(s.user.id);
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

	const [workspaces, setWorkspaces] = useState<any[]>([]);
	const [currentWorkspace, setCurrentWorkspace] = useState<any | null>(null);

	async function loadWorkspaces(userId: string) {
		console.log("[Auth] Carregando workspaces para:", userId);
		const supabase = getSupabase();
		if (!supabase) return;
		
		let { data, error } = await supabase
			.rpc("get_my_workspaces");

		if (error) {
			console.warn("[Auth] RPC get_my_workspaces falhou, tentando fallback:", error);
			const fallback = await supabase
				.from("workspace_members")
				.select("role, workspaces(id, name, slug)")
				.eq("user_id", userId);
			data = fallback.data;
			error = fallback.error;
		}
		
		if (error) {
			console.error("[Auth] Erro ao carregar workspaces:", error);
			setWorkspaces([]);
			setCurrentWorkspace(null);
			return;
		}

		const mapped = (data ?? [])
			.map((m: any) => m.workspaces ? ({ ...m.workspaces, role: m.role }) : ({ id: m.id, name: m.name, slug: m.slug, role: m.role }))
			.filter((workspace: any) => Boolean(workspace.id));
		setWorkspaces(mapped);
		console.log("[Auth] Workspaces carregados:", mapped);
		
		// Auto-select based on URL or first available
		const hash = window.location.hash || "";
		const cleanHash = hash.startsWith('#') ? hash.substring(1) : hash;
		const pathParts = cleanHash.split("/").filter(p => p && p !== "workspace" && p !== "configs");
		const pathSlug = pathParts[0];
		
		const found = mapped.find((w: any) => w.slug === pathSlug);
		setCurrentWorkspace(found || mapped[0] || null);
	}

	function switchWorkspace(slug: string) {
		const found = workspaces.find(w => w.slug === slug);
		if (found) setCurrentWorkspace(found);
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
				workspaces,
				currentWorkspace,
				switchWorkspace,
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
