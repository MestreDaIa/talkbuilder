"use client";

import { useWorkspace } from "./WorkspaceContext";
import {
	DndContext,
	closestCenter,
	PointerSensor,
	useSensor,
	type DragEndEvent,
	useSensors,
} from "@dnd-kit/core";

import { useLocation } from "react-router-dom";
import { folderIdFromPath } from "../lib/workspaceRoutes";
import { nextIndexFor, reorderSiblings } from "../lib/workspaceOrder";

export default function DnDProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const { setItems } = useWorkspace();
	const { pathname } = useLocation();

	const currentFolderId = folderIdFromPath(pathname);

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: { distance: 6 },
		}),
	);

	function cleanId(id: string) {
		return id
			.replace("sidebar-", "")
			.replace("grid-", "")
			.replace("drop-sidebar-", "")
			.replace("drop-grid-", "")
			.replace("drop-", "");
	}

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;

		if (!active?.data?.current || !over?.id) return;

		const draggedId = active.data.current.originalId as string;
		const overData = over.data.current;
		const overIdRaw = over.id as string;
		const overId = overData?.originalId || cleanId(overIdRaw);

		if (draggedId === overId) return;

		setItems((prev) => {
			const activeItem = prev.find((i) => i.id === draggedId);
			if (!activeItem) return prev;

			const overItem = prev.find((i) => i.id === overId);

			function isDescendant(parentId: string, childId: string) {
				let current = prev.find((i) => i.id === childId);

				while (current?.parentId) {
					if (current.parentId === parentId) return true;
					current = prev.find((i) => i.id === current!.parentId);
				}

				return false;
			}

			// 1) ROOT zones — move pra raiz / pasta atual e coloca no fim
			if (overIdRaw === "SIDEBAR_ROOT") {
				if (activeItem.parentId === null) return prev;
				const newIndex = nextIndexFor(prev, null);
				return prev.map((i) =>
					i.id === draggedId
						? { ...i, parentId: null, indexItem: newIndex }
						: i,
				);
			}

			if (
				overIdRaw === "GRID_ROOT_MAIN" ||
				overIdRaw === "GRID_ROOT_FOLDER"
			) {
				if (activeItem.parentId === currentFolderId) return prev;
				const newIndex = nextIndexFor(prev, currentFolderId);
				return prev.map((i) =>
					i.id === draggedId
						? { ...i, parentId: currentFolderId, indexItem: newIndex }
						: i,
				);
			}

			// 2) Drop sobre outro item
			if (!overItem) return prev;

			// 🔥 REGRA: Se o item que está por baixo é uma PASTA, o comportamento padrão é MOVER PARA DENTRO.
			if (overItem.type === "folder") {
				if (isDescendant(draggedId, overItem.id)) return prev;

				const newIndex = nextIndexFor(prev, overItem.id);
				return prev.map((item) =>
					item.id === draggedId
						? { ...item, parentId: overItem.id, indexItem: newIndex }
						: item,
				);
			}

			// Se soltar em cima de um BOT, o comportamento é reordenar (trocar de posição) se forem irmãos
			if (overItem.parentId === activeItem.parentId) {
				return reorderSiblings(
					prev,
					activeItem.parentId,
					draggedId,
					overItem.id,
				);
			}
		});
	}

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={closestCenter}
			onDragEnd={handleDragEnd}
		>
			{children}
		</DndContext>
	);
}
