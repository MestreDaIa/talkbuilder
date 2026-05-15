"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import React, { useCallback, useState } from "react";
import { Trash2, FolderPen, SquareMenuIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "./ui/card";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { getSupabase } from "../lib/supabaseClient";
import { folderRoute } from "../lib/workspaceRoutes";
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

interface FolderIconProps {
	id: string;
	title: string;
	emojiIcon?: string;
	description?: string;
	onCLick?: () => void;
	setCurrentFolderId?: (id: string) => void;
}

function FolderIconComponent({
	id,
	title,
	emojiIcon,
	description,
}: FolderIconProps) {
	const router = useNavigate();
	const { profile } = useAuth();
	const { items, setItems } = useWorkspace();
	const slug = profile?.slug;

	const [confirmDelete, setConfirmDelete] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const [editTitle, setEditTitle] = useState(title);
	const [editEmoji, setEditEmoji] = useState(emojiIcon ?? "📁");
	const [editDescription, setEditDescription] = useState(description ?? "");

	const onClick = useCallback(() => {
		router(folderRoute(slug, id));
	}, [router, id, slug]);

	const handleConfirmDelete = useCallback(() => {
		// Remove a pasta + todos os descendentes (folders e bots)
		const toDelete = new Set<string>([id]);
		let added = true;
		while (added) {
			added = false;
			for (const it of items) {
				if (it.parentId && toDelete.has(it.parentId) && !toDelete.has(it.id)) {
					toDelete.add(it.id);
					added = true;
				}
			}
		}
		setItems((prev) => prev.filter((i) => !toDelete.has(i.id)));
		setConfirmDelete(false);
	}, [id, items, setItems]);

	const handleSaveEdit = useCallback(async () => {
		const newTitle = editTitle.trim() || "Sem título";
		const newEmoji = editEmoji.trim() || "📁";
		const newDescription = editDescription ?? "";
		setItems((prev) =>
			prev.map((i) =>
				i.id === id
					? { ...i, title: newTitle, emoji: newEmoji, description: newDescription }
					: i,
			),
		);
		const supabase = getSupabase();
		if (supabase) {
			const { error } = await supabase
				.from("workspace_items")
				.update({ title: newTitle, emoji: newEmoji, description: newDescription })
				.eq("id", id);
			if (error) console.error("[FolderIcon] update error", error);
		}
		setEditOpen(false);
	}, [editTitle, editEmoji, editDescription, id, setItems]);

	const openEdit = useCallback(() => {
		setEditTitle(title);
		setEditEmoji(emojiIcon ?? "📁");
		setEditDescription(description ?? "");
		setEditOpen(true);
	}, [title, emojiIcon, description]);

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

	const { setNodeRef: setDropRef, isOver } = useDroppable({
		id: `drop-grid-${id}`,
		data: { zone: "GRID" },
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
		<>
			<div ref={setDragRef} style={style}>
				<div ref={setDropRef}>
					<Card
						onClick={(e) => {
							e.stopPropagation();
							onClick?.();
						}}
						className={`p-2 w-28 h-32 ${isOver ? "bg-green-300 " : ""}
				${isDragging ? "bg-green-400/40 z-[999] relative" : ""}`}
					>
						<div
							{...listeners}
							{...attributes}
							className="cursor-grab active:cursor-grabbing w-full h-full flex flex-col justify-between"
						>
							<CardHeader className="p-0 relative items-end justify-end">
								<DropdownMenu.Root>
									<DropdownMenu.Trigger
										asChild
										onClick={(e) => e.stopPropagation()}
										onPointerDown={(e) => e.stopPropagation()}
									>
										<SquareMenuIcon className="w-5 h-5 hover:cursor-pointer text-black" />
									</DropdownMenu.Trigger>

									<DropdownMenu.Content
										onClick={(e) => e.stopPropagation()}
										className="absolute shadow-[3px_3px_5px_rgba(0,0,0,0.5)] -right-4 -top-1.5 bg-gray-600 flex flex-col w-24 max-w-20 z-10 rounded-sm p-1"
									>
										<DropdownMenu.Item
											className="flex w-full text-sm text-white items-center justify-between gap-1 cursor-pointer"
											onSelect={(e) => {
												e.preventDefault();
												setConfirmDelete(true);
											}}
										>
											<Trash2 className="w-3 h-3" />
											<span className="flex-1">Excluir</span>
										</DropdownMenu.Item>

										<DropdownMenu.Separator className="border border-gray-700/20" />

										<DropdownMenu.Item
											className="flex w-full text-sm text-white items-center justify-between gap-1 cursor-pointer"
											onSelect={(e) => {
												e.preventDefault();
												openEdit();
											}}
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

			{/* Confirm delete */}
			<AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir pasta "{title}"?</AlertDialogTitle>
						<AlertDialogDescription>
							Esta ação remove a pasta e todo o seu conteúdo (subpastas e bots).
							Não é possível desfazer.
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
						<DialogTitle>Editar pasta</DialogTitle>
						<DialogDescription>
							Atualize o nome, emoji e descrição da pasta.
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-3 py-2">
						<div className="grid gap-1.5">
							<Label htmlFor="folder-emoji">Emoji</Label>
							<Input
								id="folder-emoji"
								value={editEmoji}
								onChange={(e) => setEditEmoji(e.target.value)}
								maxLength={4}
								className="w-20 text-center text-xl"
							/>
						</div>
						<div className="grid gap-1.5">
							<Label htmlFor="folder-title">Nome</Label>
							<Input
								id="folder-title"
								value={editTitle}
								onChange={(e) => setEditTitle(e.target.value)}
								placeholder="Nome da pasta"
							/>
						</div>
						<div className="grid gap-1.5">
							<Label htmlFor="folder-desc">Descrição</Label>
							<Textarea
								id="folder-desc"
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

export default React.memo(FolderIconComponent);
