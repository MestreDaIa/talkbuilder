"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
	Trash2,
	FolderPen,
	SquareMenuIcon,
	CirclePowerIcon,
	Download,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useWorkspace } from "../context/WorkspaceContext";
import { getSupabase } from "../lib/supabaseClient";
import {
	getFlowByWorkspaceItem,
	publishFlow,
	unpublishFlow,
	type ChatbotFlowRow,
} from "../lib/flowsApi";
import { toast } from "sonner";
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

	const [flow, setFlow] = useState<ChatbotFlowRow | null>(null);
	const [isPublished, setIsPublished] = useState<boolean>(false);
	const [toggling, setToggling] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [confirmUnpublish, setConfirmUnpublish] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const [editTitle, setEditTitle] = useState(title);
	const [editEmoji, setEditEmoji] = useState(emojiIcon ?? "🤖");
	const [editDescription, setEditDescription] = useState(description ?? "");

	// Carrega o flow associado para refletir o status real (on/off)
	useEffect(() => {
		if (!id) return;
		let cancelled = false;
		getFlowByWorkspaceItem(id)
			.then((f) => {
				if (cancelled) return;
				setFlow(f);
				setIsPublished(!!f?.is_published);
			})
			.catch((err) => {
				console.error("[BotIcon] load flow error", err);
			});
		return () => {
			cancelled = true;
		};
	}, [id]);

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
		data: { zone: "GRID", itemType: "bot", originalId: id },
	});

	const handleConfirmDelete = useCallback(() => {
		if (!id) return;
		setItems((prev) => prev.filter((i) => i.id !== id));
		setConfirmDelete(false);
	}, [id, setItems]);

	const handleSaveEdit = useCallback(async () => {
		if (!id) return;
		const newTitle = editTitle.trim() || "Sem título";
		const newEmoji = editEmoji.trim() || "🤖";
		const newDescription = editDescription?.trim() || "";

		// O WorkspaceContext já cuida da persistência no Supabase via diff algorithm
		// Basta atualizar o estado local.
		setItems((prev) =>
			prev.map((i) =>
				i.id === id
					? { ...i, title: newTitle, emoji: newEmoji, description: newDescription }
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

	const doPublish = useCallback(async () => {
		if (!flow || toggling) return;
		setToggling(true);
		try {
			if (!flow.public_id) {
				toast.error(
					"Este bot ainda não tem ID público. Abra o editor e publique a primeira vez.",
				);
				return;
			}
			const updated = await publishFlow(
				flow.id,
				flow.public_id,
				flow.draft_containers ?? [],
				flow.draft_edges ?? [],
			);
			setFlow(updated);
			setIsPublished(true);
			toast.success("Bot publicado");
		} catch (err: any) {
			console.error("[BotIcon] publish", err);
			toast.error(err?.message || "Erro ao publicar");
		} finally {
			setToggling(false);
		}
	}, [flow, toggling]);

	const doUnpublish = useCallback(async () => {
		if (!flow || toggling) return;
		setToggling(true);
		try {
			const updated = await unpublishFlow(flow.id);
			setFlow(updated);
			setIsPublished(false);
			toast.success("Bot despublicado");
		} catch (err: any) {
			console.error("[BotIcon] unpublish", err);
			toast.error(err?.message || "Erro ao despublicar");
		} finally {
			setToggling(false);
			setConfirmUnpublish(false);
		}
	}, [flow, toggling]);

	const handleTogglePublish = useCallback(
		(e: React.MouseEvent | React.PointerEvent) => {
			e.stopPropagation();
			e.preventDefault();
			if (!flow || toggling) return;
			if (isPublished) {
				setConfirmUnpublish(true);
			} else {
				void doPublish();
			}
		},
		[flow, isPublished, toggling, doPublish],
	);

	const handleExport = useCallback(() => {
		if (!flow) {
			toast.error("Nenhum fluxo para exportar.");
			return;
		}
		const exportData = {
			version: "1.0",
			exportedAt: new Date().toISOString(),
			flow: {
				name: flow.name,
				description: flow.description,
				emoji: emojiIcon,
				containers: flow.draft_containers ?? [],
				edges: flow.draft_edges ?? [],
				settings: flow.settings ?? {},
			},
		};
		const blob = new Blob([JSON.stringify(exportData, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${(flow.name || title).replace(/[^a-z0-9]/gi, "_").toLowerCase()}.json`;
		a.click();
		URL.revokeObjectURL(url);
		toast.success("Bot exportado");
	}, [flow, emojiIcon, title]);

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
					onClick={() => {
						if (isDragging) return;
						onClick?.();
					}}
					style={style}
					className={`${isDragging ? "bg-green-400/80 rounded-lg" : ""} ${isOver ? "" : ""}`}
				>
					<Card
						className={`group p-2 flex flex-col bg-[rgb(70,1,92)] gap-0 w-28 max-h-32 h-32 rounded-lg border shadow-[3px_3px_5px_rgba(0,0,0,0.5)] transition-colors ${
							isPublished
								? "border-white hover:border-green-400"
								: "border-red-400/80 hover:border-red-300"
						}`}
					>
						<div className="w-full h-full flex flex-col justify-between">
							<CardHeader className=" p-0 flex flex-row items-center h-fit space-y-0">
								<button
									type="button"
									onClick={handleTogglePublish}
									onPointerDown={(e) => e.stopPropagation()}
									onMouseDown={(e) => e.stopPropagation()}
									disabled={toggling || !flow}
									title={
										!flow
											? "Carregando..."
											: isPublished
												? "Clique para despublicar"
												: "Clique para publicar"
									}
									className={`flex flex-1 gap-1 items-center text-sm h-5 cursor-pointer disabled:opacity-60 ${
										isPublished ? "text-green-400" : "text-red-400"
									}`}
								>
									<CirclePowerIcon
										className={`w-4 h-4 text-white rounded-full ${
											isPublished ? "bg-green-400" : "bg-red-400"
										}`}
									/>
									{isPublished ? "On" : "Off"}
								</button>

								<DropdownMenu.Root>
									<DropdownMenu.Trigger
										asChild
										onClick={(e) => e.stopPropagation()}
										onPointerDown={(e) => e.stopPropagation()}
										onMouseDown={(e) => e.stopPropagation()}
										className=" flex items-center justify-center p-0 "
									>
										<SquareMenuIcon className="w-5 h-5 hover:cursor-pointer text-white" />
									</DropdownMenu.Trigger>
									<DropdownMenu.Content
										onClick={(e) => e.stopPropagation()}
										className="absolute shadow-[3px_3px_5px_rgba(0,0,0,0.5)] -right-4 -top-1.5 bg-gray-600 flex flex-col w-28 max-w-28 z-10 rounded-sm p-1"
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
										<DropdownMenu.Separator className="w-full h-0 flex border border-gray-700/20" />
										<DropdownMenu.Item
											className=" flex w-full text-sm text-white items-center justify-between gap-1 text-left cursor-pointer"
											onSelect={(e) => {
												e.preventDefault();
												handleExport();
											}}
										>
											<Download className="w-3 h-3" />
											<span className="text-left flex flex-1">Exportar</span>
										</DropdownMenu.Item>
									</DropdownMenu.Content>
								</DropdownMenu.Root>
							</CardHeader>

							<CardContent
								{...listeners}
								{...attributes}
								className="cursor-grab active:cursor-grabbing w-full flex-col items-center justify-center p-0 m-0 flex flex-1"
								title={!isPublished ? "Bot despublicado — rota pública desativada" : undefined}
							>
								<span className="text-2xl ">{emojiIcon || "🤖"}</span>
								<span className={`text-sm text-center ${isPublished ? "text-gray-400" : "text-red-300"}`}>
									{title}
								</span>
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

			{/* Confirm unpublish */}
			<AlertDialog open={confirmUnpublish} onOpenChange={setConfirmUnpublish}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Despublicar "{title}"?</AlertDialogTitle>
						<AlertDialogDescription>
							Ao despublicar, a rota pública do bot deixa de funcionar imediatamente
							e qualquer link compartilhado retornará erro até que você publique novamente.
							Você pode publicar de volta a qualquer momento.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={toggling}>Cancelar</AlertDialogCancel>
						<AlertDialogAction
							onClick={(e) => {
								e.preventDefault();
								void doUnpublish();
							}}
							disabled={toggling}
							className="bg-red-600 hover:bg-red-700"
						>
							{toggling ? "Despublicando..." : "Despublicar"}
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
