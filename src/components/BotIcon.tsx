"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
	Trash2,
	FolderPen,
	SquareMenuIcon,
	CirclePowerIcon,
} from "lucide-react";
import React, { useCallback, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useWorkspace } from "../context/WorkspaceContext";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "./ui/alert-dialog";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";

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
	description,
	emojiIcon,
	onClick,
}: BotIconProps) {
	const { setItems } = useWorkspace();

	const [isBotActive] = React.useState(true);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const [editTitle, setEditTitle] = useState(title);
	const [editEmoji, setEditEmoji] = useState(emojiIcon ?? "🤖");
	const [editDescription, setEditDescription] = useState(description ?? "");

	const { setNodeRef: setDropRef, isOver } = useDroppable({
		id: `drop-grid-${id}`,
		data: { zone: "GRID" },
	});

	const {
		attributes,
		listeners,
		setNodeRef: setDragRef,
		isDragging,
		transform,
	} = useDraggable({
		id: `grid-${id}`,
		data: { zone: "GRID", itemType: "folder", originalId: id },
	});

	const handleConfirmDelete = useCallback(() => {
		if (!id) return;
		setItems((prev) => prev.filter((i) => i.id !== id));
		setConfirmDelete(false);
	}, [id, setItems]);

	const handleSaveEdit = useCallback(() => {
		if (!id) return;
		const newTitle = editTitle.trim() || "Sem título";
		const newEmoji = editEmoji.trim() || "🤖";
		setItems((prev) =>
			prev.map((i) =>
				i.id === id
					? { ...i, title: newTitle, emoji: newEmoji, description: editDescription }
					: i,
			),
		);
		setEditOpen(false);
	}, [editTitle, editEmoji, editDescription, id, setItems]);

	const openEdit = useCallback(() => {
		setEditTitle(title);
		setEditEmoji(emojiIcon ?? "🤖");
		setEditDescription(description ?? "");
		setEditOpen(true);
	}, [title, emojiIcon, description]);

	const style: React.CSSProperties = {
		opacity: isDragging ? 0.5 : 1,
		zIndex: isDragging ? 99 : undefined,
		position: isDragging ? "absolute" : "relative",
		transform: transform
			? `translate3d(${transform.x}px, ${transform.y}px, 0)`
			: undefined,
	};

	return (
		<>
			<div ref={setDragRef}>
				<div
					ref={setDropRef}
					onClick={(e) => {
						if (isDragging) return;
						onClick?.();
					}}
					style={style}
					className={`${isDragging ? "bg-green-400/80 rounded-lg" : ""} ${isOver ? "" : ""}`}
				>
					<Card className="group hover:border-green-400 p-2 flex flex-col bg-[rgb(70,1,92)] gap-0 w-28 max-h-32 h-32 rounded-lg border border-white shadow-[3px_3px_5px_rgba(0,0,0,0.5)]">
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
										onClick={(e) => e.stopPropagation()}
										onPointerDown={(e) => e.stopPropagation()}
										className=" flex items-center justify-center p-0 "
									>
										<SquareMenuIcon className="w-5 h-5 hover:cursor-pointer text-white" />
									</DropdownMenu.Trigger>
									<DropdownMenu.Content
										onClick={(e) => e.stopPropagation()}
										className="absolute shadow-[3px_3px_5px_rgba(0,0,0,0.5)] -right-4 -top-1.5 bg-gray-600 flex flex-col w-24 max-w-20 z-10 rounded-sm p-1"
									>
										<DropdownMenu.Item
											className=" flex w-full text-sm text-white items-center justify-between gap-1 text-left cursor-pointer"
											onSelect={(e) => {
												e.preventDefault();
												setConfirmDelete(true);
											}}
										>
											<Trash2 className="w-3 h-3" />
											<span className="text-left flex flex-1">Excluir</span>
										</DropdownMenu.Item>
										<DropdownMenu.Separator className="w-full h-0 flex border border-gray-700/20" />
										<DropdownMenu.Item
											className=" flex w-full text-sm text-white items-center justify-between gap-1 text-left cursor-pointer"
											onSelect={(e) => {
												e.preventDefault();
												openEdit();
											}}
										>
											<FolderPen className="w-3 h-3" />
											<span className="text-left flex flex-1">Editar</span>
										</DropdownMenu.Item>
									</DropdownMenu.Content>
								</DropdownMenu.Root>
							</CardHeader>

							<CardContent className=" w-full flex-col items-center justify-center p-0 m-0 flex flex-1">
								<span className="text-2xl ">{emojiIcon || "🤖"}</span>
								<span className="text-sm text-center text-gray-400">{title}</span>
							</CardContent>
						</div>
					</Card>
				</div>
			</div>

			{/* Confirm delete */}
			<AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir bot "{title}"?</AlertDialogTitle>
						<AlertDialogDescription>
							Esta ação remove o bot permanentemente. Não é possível desfazer.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleConfirmDelete}
							className="bg-red-600 hover:bg-red-700"
						>
							Excluir
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Edit dialog */}
			<Dialog open={editOpen} onOpenChange={setEditOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Editar bot</DialogTitle>
						<DialogDescription>
							Atualize o nome, emoji e descrição do bot.
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-3 py-2">
						<div className="grid gap-1.5">
							<Label htmlFor="bot-emoji">Emoji</Label>
							<Input
								id="bot-emoji"
								value={editEmoji}
								onChange={(e) => setEditEmoji(e.target.value)}
								maxLength={4}
								className="w-20 text-center text-xl"
							/>
						</div>
						<div className="grid gap-1.5">
							<Label htmlFor="bot-title">Nome</Label>
							<Input
								id="bot-title"
								value={editTitle}
								onChange={(e) => setEditTitle(e.target.value)}
								placeholder="Nome do bot"
							/>
						</div>
						<div className="grid gap-1.5">
							<Label htmlFor="bot-desc">Descrição</Label>
							<Textarea
								id="bot-desc"
								value={editDescription}
								onChange={(e) => setEditDescription(e.target.value)}
								placeholder="Descrição (opcional)"
								rows={3}
							/>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setEditOpen(false)}>
							Cancelar
						</Button>
						<Button onClick={handleSaveEdit}>Salvar</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
