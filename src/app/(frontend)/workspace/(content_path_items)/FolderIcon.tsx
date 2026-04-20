"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import React, { useState, useCallback } from "react";
import { Trash2, FolderPen, SquareMenuIcon } from "lucide-react";
import { useRouter } from "next/navigation";


function FolderIconComponent({
	id,
	title,
	emojiIcon,
	
	setCurrentFolderId,
}: any) {
	const [optionBot, setOptionBot] = useState<"Excluir" | "Editar">("Editar");
	
	const router = useRouter();

	const onClick = useCallback(() => {
		router.push(`/workspace/folder/${id}`);
		// setCurrentFolderId(id);
	}, [router, id, setCurrentFolderId]);

	// 🔥 DRAG (somente no container externo)
	const {
		attributes,
		listeners,
		setNodeRef: setDragRef,
		isDragging,
		transform,
	} = useDraggable({
		id: `grid-${id}`, // 🔥 ID DIFERENTE
		data: {
			zone: "GRID",
			itemType: "folder",
			originalId: id, // 🔥 ID REAL
		},
	});

	const { setNodeRef: setDropRef, isOver } = useDroppable({
		id: `drop-grid-${id}`, // 🔥 DROPPABLE GRID
		data: {
			zone: "GRID",
			// itemType: "folder",
		},
	});


	const style: React.CSSProperties = {
		opacity: isDragging ? 0.5 : 1,
		zIndex: isDragging ? 99 : undefined,
		position: isDragging ? "absolute" : "relative",
		transform: transform
			? `translate3d(${transform.x}px, ${transform.y}px, 0)`
			: undefined,
	};


	return (
		<div ref={setDragRef} style={style}>
			{/* <div > */}
			<div ref={setDropRef}>
				<Card
					onClick={(e) => {
						e.stopPropagation();
						// if (isDragging) return;
						onClick?.();
					}}
					className={`p-2 w-28 h-32 ${isOver ? "bg-green-300 " : ""}
			
					${isDragging ? "bg-green-400/40 z-[999] relative" : ""}`}
				>
					{/* HANDLE */}
					<div
						{...listeners}
						{...attributes}
						className="cursor-grab active:cursor-grabbing w-full h-full flex flex-col justify-between"
					>
						<CardHeader className="p-0 relative items-end justify-end">
							<DropdownMenu.Root>
								<DropdownMenu.Trigger asChild>
									<SquareMenuIcon className="w-5 h-5 hover:cursor-pointer text-black" />
								</DropdownMenu.Trigger>

								<DropdownMenu.Content className="absolute shadow-[3px_3px_5px_rgba(0,0,0,0.5)] -right-4 -top-1.5 bg-gray-600 flex flex-col w-24 max-w-20 z-10 rounded-sm p-1">
									<DropdownMenu.Item
										className="flex w-full text-sm text-white items-center justify-between gap-1"
										onClick={() => setOptionBot("Excluir")}
									>
										<Trash2 className="w-3 h-3" />
										<span className="flex-1">Excluir</span>
									</DropdownMenu.Item>

									<DropdownMenu.Separator className="border border-gray-700/20" />

									<DropdownMenu.Item
										className="flex w-full text-sm text-white items-center justify-between gap-1"
										onClick={() => setOptionBot("Editar")}
									>
										<FolderPen className="w-3 h-3" />
										<span className="flex-1">Editar</span>
									</DropdownMenu.Item>
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						</CardHeader>

						<CardContent className="flex flex-col items-center justify-center p-0 flex-1">
							<span className="text-3xl">{emojiIcon || "📁"}</span>
							<span className="text-sm text-center text-gray-700">{title}</span>
						</CardContent>
					</div>
				</Card>
			</div>
		</div>
	);
}

export default React.memo(FolderIconComponent);
