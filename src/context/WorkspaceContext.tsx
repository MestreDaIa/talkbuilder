"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { getSupabase } from "../lib/supabaseClient";
import { useAuth } from "./AuthContext";

type typeItem = {
	id: string;
	title: string;
	description: string;
	emoji: string;
	parentId: string | null;
	type: "folder" | "bot";
	indexItem?: number;
};

type WorkspaceContextType = {
	items: typeItem[];
	setItems: React.Dispatch<React.SetStateAction<typeItem[]>>;
	activeId: string | null;
	setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
	loading: boolean;
};

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

type DBRow = {
	id: string;
	user_id: string;
	type: "folder" | "bot";
	title: string;
	description: string | null;
	emoji: string | null;
	parent_id: string | null;
	index_item: number | null;
};

function rowToItem(row: DBRow): typeItem {
	return {
		id: row.id,
		type: row.type,
		title: row.title,
		description: row.description ?? "",
		emoji: row.emoji ?? (row.type === "folder" ? "📁" : "🤖"),
		parentId: row.parent_id,
		indexItem: row.index_item ?? 0,
	};
}

export function WorkspaceProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const { user, currentWorkspace } = useAuth();
	const [items, setItemsState] = useState<typeItem[]>([]);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const itemsRef = useRef<typeItem[]>([]);
	itemsRef.current = items;

	// Carrega do banco quando logar
	useEffect(() => {
		const supabase = getSupabase();
		if (!supabase || !user || !currentWorkspace) {
			setItemsState([]);
			setLoading(false);
			return;
		}

		let cancelled = false;
		setLoading(true);
		supabase
			.from("workspace_items")
			.select("id,user_id,type,title,description,emoji,parent_id,index_item")
			.eq("workspace_id", currentWorkspace.id)
			.order("created_at", { ascending: true })
			.then(({ data, error }) => {
				if (cancelled) return;
				if (error) {
					console.error("[Workspace] load error", error);
					setItemsState([]);
				} else {
					setItemsState((data ?? []).map(rowToItem));
				}
				setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [user?.id, currentWorkspace?.id]);

	// setItems "smart": detecta diff entre antigo/novo e propaga ao Supabase.
	// Mantém compatibilidade com toda a UI legada que faz setItems(prev => ...).
	const setItems = useCallback<
		React.Dispatch<React.SetStateAction<typeItem[]>>
	>((updater) => {
		const supabase = getSupabase();
		const prev = itemsRef.current;
		const next =
			typeof updater === "function"
				? (updater as (p: typeItem[]) => typeItem[])(prev)
				: updater;

		setItemsState(next);
		itemsRef.current = next; // Update ref immediately to prevent race conditions

		if (!supabase || !user || !currentWorkspace) {
			console.warn("[Workspace] setItems called but dependencies missing", { 
				hasSupabase: !!supabase, 
				hasUser: !!user, 
				hasWorkspace: !!currentWorkspace 
			});
			return;
		}

		const prevById = new Map(prev.map((i) => [i.id, i]));
		const nextById = new Map(next.map((i) => [i.id, i]));

		// INSERTs
		const inserts = next.filter((i) => !prevById.has(i.id));
		if (inserts.length) {
			console.log("[Workspace] inserting items:", inserts);
			supabase
				.from("workspace_items")
				.insert(
					inserts.map((i) => ({
						id: i.id,
						workspace_id: currentWorkspace.id,
						user_id: user.id,
						type: i.type,
						title: i.title,
						description: i.description,
						emoji: i.emoji,
						parent_id: i.parentId,
						index_item: i.indexItem ?? 0,
					})),
				)
				.then(({ error }) => {
					if (error) {
						console.error("[Workspace] insert error", error);
						// Rollback local logic
						// Only rollback if it's NOT a duplicate key error (which can happen with fast UI interactions)
						if (error.code !== '23505') {
							setItemsState((current) => current.filter(item => !inserts.some(ins => ins.id === item.id)));
						}
					}
				});
		}

		// DELETEs
		const deletes = prev.filter((i) => !nextById.has(i.id));
		if (deletes.length) {
			supabase
				.from("workspace_items")
				.delete()
				.in(
					"id",
					deletes.map((i) => i.id),
				)
				.then(({ error }) => {
					if (error) console.error("[Workspace] delete error", error);
				});
		}

		// UPDATEs (campos que mudaram)
		for (const item of next) {
			const old = prevById.get(item.id);
			if (!old) continue;
			if (
				old.title !== item.title ||
				old.description !== item.description ||
				old.emoji !== item.emoji ||
				old.parentId !== item.parentId ||
				(old.indexItem ?? 0) !== (item.indexItem ?? 0)
			) {
				supabase
					.from("workspace_items")
					.update({
						title: item.title,
						description: item.description,
						emoji: item.emoji,
						parent_id: item.parentId,
						index_item: item.indexItem ?? 0,
					})
					.eq("id", item.id)
					.then(({ error }) => {
						if (error) console.error("[Workspace] update error", error);
					});
			}
		}
	}, [user?.id, currentWorkspace?.id]);

	return (
		<WorkspaceContext.Provider
			value={{ items, setItems, activeId, setActiveId, loading }}
		>
			{children}
		</WorkspaceContext.Provider>
	);
}

export function useWorkspace() {
	const context = useContext(WorkspaceContext);
	if (!context) {
		throw new Error("useWorkspace must be used within a WorkspaceProvider");
	}
	return context;
}
