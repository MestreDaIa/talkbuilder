"use client";

import { useState, type CSSProperties  } from "react";
import { useWorkspace } from "../context/WorkspaceContext";
import { ChevronDown, ChevronRight, Menu } from "lucide-react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { folderRoute, botRoute, folderIdFromPath, rememberBotBackRoute, workspaceRoot } from "../lib/workspaceRoutes";
import { sortByIndex } from "../lib/workspaceOrder";

export default function FoldersSidebarNavigation({ onToggleMenu, showMenuToggle = true, compact = false }: { onToggleMenu?: () => void; showMenuToggle?: boolean; compact?: boolean }) {
	const { items } = useWorkspace();
	const router = useNavigate();
	

	const [openFolders, setOpenFolders] = useState<string[]>([]);

	function toggleFolder(id: string) {
		setOpenFolders((prev) =>
			prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
		);
	}

	const { pathname } = useLocation();

	const currentFolderId = folderIdFromPath(pathname);

	function folderHasSelectedDescendant(folderId: string) {
		if (!currentFolderId) return false;

		let node = items.find((it) => it.id === currentFolderId);

		while (node) {
			if (node.parentId === folderId) return true;
			node = node.parentId
				? items.find((it) => it.id === node!.parentId)
				: undefined;
		}

		return false;
	}

	// 🔥 REGRA: só renderiza se tiver pasta OU bot
	const { setNodeRef } = useDroppable({
		id: "SIDEBAR_ROOT",
	});

	const hasSidebarContent = items.some(
		(item) => item.type === "folder" || item.type === "bot",
	);
	function renderTree(parentId: string | null, level = 0) {
		return sortByIndex(items.filter((i) => i.parentId === parentId && i.type))
			.map((folder) => (
				<SidebarItem
					key={folder.id}
					folder={folder}
					level={level}
					isOpen={openFolders.includes(folder.id)}
					onToggle={() => toggleFolder(folder.id)}
					renderTree={renderTree}
					currentFolderId={currentFolderId}
					childSelected={folderHasSelectedDescendant(folder.id)}
					hasChildren={items.some(
						(item) => item.parentId === folder.id && item.type,
					)}
				/>
			));
	}

	return (
		<div
			ref={setNodeRef}
			className={`${compact ? "w-[104px] min-w-[104px] max-w-[104px] sm:w-28 sm:min-w-28 sm:max-w-28 lg:w-32 lg:min-w-32 lg:max-w-32" : "w-28 min-w-28 max-w-28 sm:w-32 sm:min-w-32 sm:max-w-32 md:w-36 md:min-w-36 md:max-w-36"} flex shrink-0 bg-gray-800 h-full min-h-0 overflow-hidden`}
			style={{ userSelect: "none" }}
		>
			<div className="w-full min-w-0 min-h-0 flex-1 flex flex-col py-2 px-1 sm:px-2 pb-6 gap-2 overflow-x-hidden overflow-y-auto overscroll-contain">
				{showMenuToggle && (
				<button type="button" onClick={onToggleMenu} title="Abrir menu Workspace" aria-label="Abrir menu Workspace" className="sticky top-0 z-10 flex min-[840px]:hidden h-8 w-full shrink-0 items-center justify-center rounded-md border border-white/10 bg-gray-900 text-gray-200 hover:bg-gray-700">
					<Menu className="h-4 w-4" />
				</button>
				)}
				{hasSidebarContent ? renderTree(null) : <p className="px-2 py-3 text-xs text-gray-300/70">Nenhuma pasta ou bot criado</p>}
			</div>
		</div>
	);
}

interface SidebarItemProps {
	folder: any;
	level: number;
	isOpen: boolean;
	onToggle: () => void;
	renderTree: (parentId: string | null, level?: number) => React.ReactNode;
	currentFolderId: string | null;
	childSelected: boolean;
	hasChildren: boolean;
}

function SidebarItem({
	folder,
	level,
	isOpen,
	onToggle,
	renderTree,
	currentFolderId,
	childSelected,
	hasChildren,
}: SidebarItemProps) {
	const router = useNavigate();
	const { profile, currentWorkspace } = useAuth();
  const slug = currentWorkspace?.slug ?? profile?.slug;

	const {
		attributes,
		listeners,
		setNodeRef: setDragRef,
		transform,
		isDragging,
	} = useDraggable({
		id: `sidebar-${folder.id}`,
		data: {
			originalId: folder.id,
			itemType: folder.type,
		},
	});

	const { setNodeRef: setDropRef, isOver } = useDroppable({
		id: `drop-sidebar-${folder.id}`,
		data: {
			originalId: folder.id,
		},
	});

	const style: CSSProperties = {
		transform: transform
			? `translate3d(${Math.min(transform.x, 0)}px, ${transform.y}px, 0)`
			: undefined,
		opacity: isDragging ? 0.5 : 1,
	};

	const isSelected = currentFolderId === folder.id;

	const containerBg = isSelected
		? "bg-gray-700"
		: childSelected
			? "bg-gray-600"
			: "bg-white";

	const titleColor =
		isSelected || childSelected ? "text-white" : "text-gray-500";

	const borderClass = isSelected ? "border border-white" : "border border-black";

	let stateClass = "";
	if (isOpen && isSelected) {
		stateClass = "bg-green-600 text-white";
	} else if (!isOpen && childSelected) {
		stateClass = "bg-green-800 text-white";
	} else if (isOpen && !isSelected) {
		stateClass = "bg-green-400 text-white";
	} else if (childSelected) {
		stateClass = "bg-yellow-500 text-black ";
	} else {
		stateClass = "bg-green-400 text-white border border-red-400";
	}

	const iconClass = `w-4 h-4 rounded-full ${stateClass} ${borderClass}`;

	return (
		<div
			ref={setDropRef}
			style={{
				paddingLeft: `${level * 8 + 0}px`,
				display: "flex",
				flexDirection: "column",
				gap: "3px",
			}}
			className={`shrink-0 rounded-md ${isOver ? "bg-blue-400/50 relative" : ""}`}
		>
			<div
			ref={setDragRef}
				{...listeners}
				{...attributes}
				style={style}
				onClick={() => {
					if (isDragging) return;
					if (folder.type === "bot") {
						rememberBotBackRoute(folder.id, folder.parentId ? folderRoute(slug, folder.parentId) : workspaceRoot(slug));
						router(botRoute(slug, folder.id));
					} else {
						router(folderRoute(slug, folder.id));
					}
				}}
				className={`flex  items-center gap-2 px-1 py-1 rounded-lg cursor-grab active:cursor-grabbing select-none shadow-[0px_0px_5px_1px] shadow-black ${containerBg} ${
					isOver ? "ring-2 ring-blue-400" : ""
				}`}
			>
				<span>{folder.emoji || ""}</span>

				<span
					className={`flex-1 text-left text-sm overflow-hidden text-ellipsis whitespace-nowrap ${titleColor}`}
				>
					{folder.title}
				</span>
				{hasChildren ? (
					<span
						onClick={(e) => {
							e.stopPropagation();
							onToggle();
						}}
					>
						{isOpen ? (
							<ChevronDown className={iconClass} />
						) : (
							<ChevronRight className={iconClass} />
						)}
					</span>
				) : null}
			</div>
			{isOpen && renderTree(folder.id, level + 1)}
		</div>
	);
}
