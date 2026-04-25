"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import FolderIcon from "./FolderIcon";
import BotIcon from "./BotIcon";
import { useDroppable } from "@dnd-kit/core";

import { useWorkspace } from "../context/WorkspaceContext";
import { useAuth } from "../context/AuthContext";
import { botRoute } from "../lib/workspaceRoutes";
import { sortByIndex } from "../lib/workspaceOrder";

export default function WorkspaceMain() {
	const navigate = useNavigate();
	const { profile } = useAuth();
	const slug = profile?.slug;

	const { items, activeId } = useWorkspace();

	const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
	const [currentBotId, setCurrentBotId] = useState<string | null>(null);

	// 🔥 CORREÇÃO REAL AQUI
	const currentItems = sortByIndex(
		items.filter((item) => {
			if (item.id === activeId) return true;
			return item.parentId === currentFolderId;
		}),
	);

	const { setNodeRef, isOver } = useDroppable({
		id: "GRID_ROOT_MAIN",
		data: {
			zone: "GRID",
		},
	});

	useEffect(() => {
		console.log("items atualizados", items);
	}, [items]);

	return (
		<div
			ref={setNodeRef}
			className={`w-full flex-1 px-0 ${isOver ? "" : ""}`}
		>
			<div
				className={`py-3 w-full ${
					items.length > 0
						? "flex flex-col w-full items-start justify-start "
						: "flex items-center w-full "
				}`}
			>
				{currentItems.length > 0 ? (
					<div className="grid grid-cols-3 sm:grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 2xl:grid-cols-8">
						{currentItems.map((item) => (
							<div key={item.id} className="w-fit">
								{item.type === "folder" ? (
									<FolderIcon
										id={item.id}
										emojiIcon={item.emoji}
										title={item.title}
										description={item.description}
										// router={router}
										setCurrentFolderId={setCurrentFolderId}
									/>
							) : (
								<BotIcon
									id={item.id}
									emojiIcon={item.emoji}
									title={item.title}
									description={item.description}
								onClick={() => {
									setCurrentBotId(item.id);
									navigate(botRoute(slug, item.id));
								}}
								/>
							)}
							</div>
						))}
					</div>
				) : (
					<div className="text-gray-500 flex w-full flex-col justify-center  items-center">
						<p>Nenhuma pasta criada</p>
						<p>ou</p>
						<p>bot adicionado</p>
					</div>
				)}
			</div>
		</div>
	);
}
