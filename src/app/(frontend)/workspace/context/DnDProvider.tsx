"use client";

import { useWorkspace } from "./WorkspaceContext";
import {
	DndContext,
	closestCenter,
	DragEndEvent,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";

import { usePathname } from "next/navigation";

export default function DnDProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const { setItems } = useWorkspace();
	const pathname = usePathname();

	function getCurrentFolderId() {
		if (!pathname.includes("/folder/")) return null;
		return pathname.split("/folder/")[1];
	}

	const currentFolderId = getCurrentFolderId();

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
		const overIdRaw = over.id as string;
		const overId = cleanId(overIdRaw);

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

			let newParentId: string | null = activeItem.parentId;

			// ROOT SIDEBAR
			if (overIdRaw === "SIDEBAR_ROOT") {
				newParentId = null;
			}

			// ROOT GRID
			else if (
				overIdRaw === "GRID_ROOT_MAIN" ||
				overIdRaw === "GRID_ROOT_FOLDER"
			) {
				newParentId = currentFolderId;
			}

			// DROP EM PASTA
			else {
				if (!overItem) return prev;

				// ❌ não pode dropar dentro de bot
				if (overItem.type === "bot") return prev;

				// ❌ evitar loop infinito de hierarquia
				if (isDescendant(draggedId, overItem.id)) return prev;

				newParentId = overItem.id;
			}

			// 🔥 evita loop de render
			if (newParentId === activeItem.parentId) return prev;

			return prev.map((item) =>
				item.id === draggedId ? { ...item, parentId: newParentId } : item,
			);
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
