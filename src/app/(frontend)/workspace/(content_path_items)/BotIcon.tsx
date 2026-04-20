"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
	Trash2,
	FolderPen,
	SquareMenuIcon,
	CirclePowerIcon,
} from "lucide-react";
import React, { useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";

interface BotIconProps {
	id?: string;
	title: string;
	description: string;
	emojiIcon: string;
	onClick?: () => void;
}

export default function BotIcon({
	id,
	title,
	emojiIcon,
	onClick,
}: BotIconProps) {
	const [optionBot, setOptionBot] = useState<"Excluir" | "Editar">("Editar");

	const [isBotActive, setIsBotActive] = React.useState(true);

	const { setNodeRef: setDropRef, isOver } = useDroppable({
			id: `drop-grid-${id}`, // 🔥 DROPPABLE GRID
			data: {
				zone: "GRID",
				// itemType: "folder",
			},
		});

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

	const style: React.CSSProperties = {
			opacity: isDragging ? 0.5 : 1,
			zIndex: isDragging ? 99 : undefined,
			position: isDragging ? "absolute" : "relative",
			transform: transform
				? `translate3d(${transform.x}px, ${transform.y}px, 0)`
				: undefined,
	};

	return (
		<div ref={setDragRef}>
			<div
				ref={setDropRef}
				onClick={(e) => {
					if (isDragging) return;
					onClick?.();
				}}
				style={style}
				className={`
			
					${isDragging ? "bg-green-400/80 rounded-lg" : ""}`}
			>
				<Card className="group hover:border-green-400 p-2 flex flex-col bg-[rgb(70,1,92)] gap-0 w-28 max-h-32 h-32 rounded-lg border border-white shadow-[3px_3px_5px_rgba(0,0,0,0.5)]">
					{/* 🔥 HANDLE */}
					<div
						{...listeners}
						{...attributes}
						className="cursor-grab active:cursor-grabbing w-full h-full flex flex-col justify-between "
					>
						<CardHeader className=" p-0 flex flex-row items-center h-fit space-y-0">
							<div
								className={`flex flex-1 gap-1 items-center text-sm h-5 ${isBotActive ? "text-green-400" : "text-red-400"}`}
							>
								<CirclePowerIcon
									className={`w-4 h-4 text-white rounded-full ${isBotActive ? "bg-green-400" : "bg-red-400"}`}
								/>
								{isBotActive ? "On" : "Off"}
							</div>

							<DropdownMenu.Root>
								<DropdownMenu.Trigger
									asChild
									className=" flex items-center justify-center p-0 "
								>
									<SquareMenuIcon className="w-5 h-5 hover:cursor-pointer text-white" />
								</DropdownMenu.Trigger>
								<DropdownMenu.Content className="absolute shadow-[3px_3px_5px_rgba(0,0,0,0.5)] -right-4 -top-1.5 bg-gray-600 flex flex-col w-24 max-w-20 z-10 rounded-sm p-1">
									{/* <DropdownMenu.Item className='divide-y-2 text-sm text-white' onClick={() => setOptionFolder('Renomear')}> Renomear</DropdownMenu.Item> */}
									<DropdownMenu.Item
										className=" flex w-full text-sm text-white items-center justify-between gap-1 text-left"
										onClick={() => setOptionBot("Excluir")}
									>
										<Trash2 className="w-3 h-3" />
										<span className="text-left flex flex-1">Excluir</span>
									</DropdownMenu.Item>
									<DropdownMenu.Separator className="w-full h-0 flex border border-gray-700/20" />
									<DropdownMenu.Item
										className=" flex w-full text-sm text-white items-center justify-between gap-1 text-left"
										onClick={() => setOptionBot("Editar")}
									>
										<FolderPen className="w-3 h-3" />
										<span className="text-left flex flex-1">Editar</span>
									</DropdownMenu.Item>
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						</CardHeader>

						<CardContent className=" w-full flex-col items-center justify-center p-0 m-0 flex flex-1">
							<span className="text-2xl ">{emojiIcon || "📁"}</span>
							<span className="text-sm text-center text-gray-400">{title}</span>
						</CardContent>
					</div>
				</Card>
			</div>
		</div>
	);
}
