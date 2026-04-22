"use client";

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "../components/ui/dialog";

import { useState } from "react";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useWorkspace, WorkspaceProvider } from "../context/WorkspaceContext";
import { PlanProvider } from "../context/PlanContext";
import DnDProvider from "../context/DnDProvider";
import { useLocation } from "react-router-dom";
import FoldersSidebarNavigation from "./FoldersSidebarNavigation";
import AddOptionToolbar from "./AddOptionToolbar";
import Breadcrumb from "./Breadcrumb";
import Header from "./Header";
import { Toaster } from "./ui/toaster";

export default function WorkspaceLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<WorkspaceProvider>
			<PlanProvider>
				<DnDProvider>
					<WorkspaceLayoutContent>{children}</WorkspaceLayoutContent>
				</DnDProvider>
			</PlanProvider>
		</WorkspaceProvider>
	);
		function WorkspaceLayoutContent({ children }: { children: React.ReactNode }) {
			const { items, setItems } = useWorkspace();
		
			const { pathname } = useLocation();

			const isBotEditor = pathname.startsWith("/workspace/bot/");

			const showBreadcrumb =
				!isBotEditor &&
				(pathname === "/" ||
					pathname === "/workspace" ||
					pathname.startsWith("/workspace/folder/"));

			const showToolbar = showBreadcrumb;
		
			const [openModalADD, setOpenModalADD] = useState(false);
			const [addOption, setAddOption] = useState<"folder" | "bot">("folder");
		
			const [folderName, setFolderName] = useState("");
			const [folderDescription, setFolderDescription] = useState("");
		
			const [botName, setBotName] = useState("");
			const [botDescription, setBotDescription] = useState("");
		
			function getCurrentFolderId() {
				if (!pathname.includes("/folder/")) return null;
				return pathname.split("/folder/")[1];
			}
		
			const defaultFolderEmoji = "📁";
			const defaultBotEmoji = "🤖";
		
			const folderEmojis = ["📁", "📂", "🗂️", "🗃️", "🧾"];
			const botEmojis = ["🤖", "🦾", "🧠", "🛰️", "🛠️"];
		
			const [folderEmoji, setFolderEmoji] = useState<string>(defaultFolderEmoji);
			const [botEmoji, setBotEmoji] = useState<string>(defaultBotEmoji);
		
			const currentFolderId = getCurrentFolderId();
		
			function createFolder() {
				setItems((prev) => [
					...prev,
					{
						id: crypto.randomUUID(),
						type: "folder",
						indexItem: 0,
						title: folderName,
						description: folderDescription,
						emoji: folderEmoji,
						parentId: currentFolderId,
					},
				]);
		
				setFolderName("");
				setFolderDescription("");
				setOpenModalADD(false);
				setFolderEmoji(defaultFolderEmoji);
			}
		
			function createBot() {
				setItems((prev) => [
					...prev,
					{
						id: crypto.randomUUID(),
						type: "bot",
						indexItem: 0,
						emoji: botEmoji,
						title: botName,
						description: botDescription,
						parentId: currentFolderId,
					},
				]);
		
				setBotName("");
				setBotDescription("");
				setOpenModalADD(false);
				setBotEmoji(defaultBotEmoji);
			}
		
			return (
				<div className="flex flex-col h-svh relative overflow-y-hidden">
				{!isBotEditor && <Header />}
					{showBreadcrumb && <Breadcrumb />}
					<div className="flex-1 flex relative overflow-hidden">
						{showBreadcrumb && (
							<div className="flex ">
								<FoldersSidebarNavigation />
								{showToolbar && (
									<div className="px-3 pt-3 ">
										<AddOptionToolbar
											onAddFolder={() => {
												setAddOption("folder");
												setOpenModalADD(true);
											}}
											onAddBot={() => {
												setAddOption("bot");
												setOpenModalADD(true);
											}}
										/>
									</div>
								)}
							</div>
						)}
						<main className="flex flex-1 overflow-hidden">
							<div className=" w-full px-0 overflow-y-auto">{children}</div>
							<Toaster />
						</main>
					</div>

					<Dialog open={openModalADD} onOpenChange={setOpenModalADD}>
						<DialogContent>
							{addOption === "folder" && (
								<>
									<DialogHeader>
										<DialogTitle>Adicionar Nova Pasta</DialogTitle>
									</DialogHeader>
		
									{/* SELETOR DE EMOJI (PASTA) */}
									<div className="mb-2 flex items-center gap-2">
										<DropdownMenu.Root>
											<DropdownMenu.Trigger asChild>
												<button className="px-3 py-2 rounded-md border flex items-center gap-2">
													<span className="text-xl">{folderEmoji}</span>
													<span className="text-sm">Selecionar emoji</span>
												</button>
											</DropdownMenu.Trigger>
		
											<DropdownMenu.Content
												sideOffset={6}
												className="p-2 bg-white rounded-md shadow-md"
											>
												{folderEmojis.map((emo) => (
													<DropdownMenu.Item
														key={emo}
														className="p-1 rounded-md hover:bg-gray-100"
														onSelect={() => setFolderEmoji(emo)}
													>
														<button className="w-full text-left">{emo}</button>
													</DropdownMenu.Item>
												))}
											</DropdownMenu.Content>
										</DropdownMenu.Root>
		
										{/* input do nome da pasta com preview do emoji */}
										<div className="flex-1">
											<div className="flex items-center gap-2">
												<span className="text-2xl">{folderEmoji}</span>
												<input
													placeholder="Nome da pasta"
													value={folderName}
													onChange={(e) => setFolderName(e.target.value)}
													className="border p-2 rounded-md w-full"
												/>
											</div>
										</div>
									</div>
		
									<input
										placeholder="Descrição"
										value={folderDescription}
										onChange={(e) => setFolderDescription(e.target.value)}
										className="border p-2 rounded-md w-full mt-2"
									/>
		
									<button
										onClick={createFolder}
										className="bg-blue-500 text-white p-2 rounded-md mt-2"
									>
										Criar pasta
									</button>
								</>
							)}
		
							{addOption === "bot" && (
								<>
									<DialogHeader>
										<DialogTitle>Adicionar Novo Bot</DialogTitle>
									</DialogHeader>
		
									{/* SELETOR DE EMOJI (BOT) */}
									<div className="mb-2 flex items-center gap-2">
										<DropdownMenu.Root>
											<DropdownMenu.Trigger asChild>
												<button className="px-3 py-2 rounded-md border flex items-center gap-2">
													<span className="text-xl">{botEmoji}</span>
													<span className="text-sm">Selecionar emoji</span>
												</button>
											</DropdownMenu.Trigger>
		
											<DropdownMenu.Content
												sideOffset={6}
												className="p-2 bg-white rounded-md shadow-md"
											>
												{botEmojis.map((emo) => (
													<DropdownMenu.Item
														key={emo}
														className="p-1 rounded-md hover:bg-gray-100"
														onSelect={() => setBotEmoji(emo)}
													>
														<button className="w-full text-left">{emo}</button>
													</DropdownMenu.Item>
												))}
											</DropdownMenu.Content>
										</DropdownMenu.Root>
		
										{/* input do nome do bot com preview do emoji */}
										<div className="flex-1">
											<div className="flex items-center gap-2">
												<span className="text-2xl">{botEmoji}</span>
												<input
													placeholder="Nome do bot"
													value={botName}
													onChange={(e) => setBotName(e.target.value)}
													className="border p-2 rounded-md w-full"
												/>
											</div>
										</div>
									</div>
		
									<input
										placeholder="Descrição"
										value={botDescription}
										onChange={(e) => setBotDescription(e.target.value)}
										className="border p-2 rounded-md w-full mt-2"
									/>
		
									<button
										onClick={createBot}
										className="bg-blue-500 text-white p-2 rounded-md mt-2"
									>
										Criar bot
									</button>
								</>
							)}
						</DialogContent>
					</Dialog>
				</div>
			);
		}
}

