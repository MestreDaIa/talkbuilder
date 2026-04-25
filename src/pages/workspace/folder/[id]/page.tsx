"use client";

import { useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useWorkspace } from "../../../../context/WorkspaceContext";
import { useAuth } from "../../../../context/AuthContext";
import { folderRoute, botRoute } from "../../../../lib/workspaceRoutes";
import FolderIcon from "../../../../components/FolderIcon";
import BotIcon from "../../../../components/BotIcon";
import { sortByIndex } from "../../../../lib/workspaceOrder";


export default function FolderPage() {
	const router = useNavigate();
	const params = useParams();
	const folderId = params.id as string;
	const { profile } = useAuth();
	const slug = profile?.slug;

	const { items } = useWorkspace();
	const [currentBotId, setCurrentBotId] = useState<string | null>(null);

	const currentItems = sortByIndex(
		items.filter((item) => item.parentId === folderId),
	);

	// 🔥 ROOT DA GRID (IMPORTANTE)
	const { setNodeRef, isOver } = useDroppable({
		id: "GRID_ROOT_FOLDER",
		data: {
			zone: "GRID",
		},
	});

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
									onCLick={() => {
										router(folderRoute(slug, item.id));
									}}
								/>
							) : (
								<BotIcon
									id={item.id}
									onClick={() => {
										setCurrentBotId(item.id);
										router(botRoute(slug, item.id));
									}}
									title={item.title}
									emojiIcon={item.emoji ?? "🤖"}
									description={item.description}
								/>
							)}
							</div>
						))}
					</div>
				) : (
					<div className="text-gray-500 flex w-full h-full flex-col justify-start items-center">
						<p>Nenhuma pasta criada</p>
						<p>ou</p>
						<p>bot adicionado</p>
					</div>
				)}
			</div>
		</div>
	);
}
