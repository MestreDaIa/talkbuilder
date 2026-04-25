"use client";

import { useState, type CSSProperties  } from "react";
import { useWorkspace } from "../context/WorkspaceContext";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { folderRoute, botRoute, folderIdFromPath } from "../lib/workspaceRoutes";
import { sortByIndex } from "../lib/workspaceOrder";

export default function FoldersSidebarNavigation() {
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

	if (!hasSidebarContent) return null;

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
			className=" max-w-44 min-w-44 flex  bg-gray-800 h-full overflow-x-hidden"
			style={{ userSelect: "none" }}
		>
			<div className="py-3 max-w-44 min-w-44 flex flex-col h-full px-2 gap-2 overflow-x-hidden ">
				{renderTree(null)}
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
	const { profile } = useAuth();
	const slug = profile?.slug;

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
		},
	});

	const { setNodeRef: setDropRef, isOver } = useDroppable({
		id: folder.id,
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
			className={` rounded-md ${isOver ? "bg-blue-400/50 relative" : ""}`}
		>
			<div
			ref={setDragRef}
				{...listeners}
				{...attributes}
				style={style}
				onClick={() => {
					if (isDragging) return;
					if (folder.type === "bot") {
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
					className={`flex-1 text-sm overflow-hidden text-ellipsis whitespace-nowrap ${titleColor}`}
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
