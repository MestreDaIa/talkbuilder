"use client";

import { createContext, useContext, useEffect, useState } from "react";

type typeItem = {
	id: string;
	title: string;
	description: string;
	emoji: string;
	parentId: string | null;
	type: "folder" | "bot";
};

type WorkspaceContextType = {
	items: typeItem[];
	setItems: React.Dispatch<React.SetStateAction<typeItem[]>>;

	// 🔥 NOVO
	activeId: string | null;
	setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
};

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export function WorkspaceProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [items, setItems] = useState<typeItem[]>([]);

	// 🔥 NOVO
	const [activeId, setActiveId] = useState<string | null>(null);

	useEffect(() => {
		try {
			const raw = localStorage.getItem("workspace_folders_v1");
			if (raw) {
				const parsed = JSON.parse(raw) as typeItem[];

				if (Array.isArray(parsed)) {
					setItems(parsed);
				}
			}
		} catch (error) {
			console.error("Falha ao ler pastas do localStorage", error);
		}
	}, []);

	useEffect(() => {
		try {
			localStorage.setItem("workspace_folders_v1", JSON.stringify(items));
		} catch (error) {
			console.error("Falha ao salvar pastas no localStorage", error);
		}
	}, [items]);

	return (
		<WorkspaceContext.Provider
			value={{
				items,
				setItems,
				activeId,
				setActiveId,
			}}
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