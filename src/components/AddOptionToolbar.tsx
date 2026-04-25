"use client"

import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { Plus, Lock, Crown, Sparkles, Upload, AlertCircle, FileJson, Check } from "lucide-react"
import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { usePlan, PLAN_LABELS } from "../context/PlanContext"
import { useAuth } from "../context/AuthContext"
import { useWorkspace } from "../context/WorkspaceContext"
import { configsRoute, folderIdFromPath } from "../lib/workspaceRoutes"
import { useLocation } from "react-router-dom"
import { getSupabase } from "../lib/supabaseClient"
import { toast } from "sonner"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

type Props = {
	onAddFolder: () => void
	onAddBot: () => void
}

interface FlowExportData {
	version: string
	exportedAt: string
	flow: {
		name: string
		description?: string | null
		emoji?: string
		containers: any[]
		edges: any[]
		settings?: Record<string, any>
	}
}

export default function AddOptionToolbar({ onAddFolder, onAddBot }: Props) {
	const { canAddBot, limits, botsUsed, currentPlan } = usePlan()
	const [showUpgradeModal, setShowUpgradeModal] = useState(false)
	const [showImportModal, setShowImportModal] = useState(false)
	const [importData, setImportData] = useState<FlowExportData | null>(null)
	const [importError, setImportError] = useState<string | null>(null)
	const [importing, setImporting] = useState(false)
	const fileInputRef = useRef<HTMLInputElement>(null)
	const navigate = useNavigate()
	const { profile, user } = useAuth()
	const { setItems } = useWorkspace()
	const { pathname } = useLocation()
	const slug = profile?.slug

	const limitLabel = Number.isFinite(limits.bots) ? limits.bots : "ilimitados"

	function handleBotSelect(e: Event) {
		if (!canAddBot) {
			e.preventDefault()
			setShowUpgradeModal(true)
			return
		}
		onAddBot()
	}

	function handleImportClick() {
		if (!canAddBot) {
			setShowUpgradeModal(true)
			return
		}
		setImportError(null)
		setImportData(null)
		setShowImportModal(true)
	}

	async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0]
		if (!file) return
		setImportError(null)
		try {
			const text = await file.text()
			const data = JSON.parse(text) as FlowExportData
			if (!data.flow || !Array.isArray(data.flow.containers)) {
				throw new Error("Arquivo inválido: não contém um fluxo válido.")
			}
			setImportData(data)
		} catch (err: any) {
			setImportError(err?.message || "Erro ao ler arquivo")
			setImportData(null)
		}
	}

	async function handleConfirmImport() {
		if (!importData || !user) return
		const supabase = getSupabase()
		if (!supabase) {
			toast.error("Supabase não configurado")
			return
		}
		setImporting(true)
		try {
			const newBotId = crypto.randomUUID()
			const currentFolderId = folderIdFromPath(pathname)
			const emoji = importData.flow.emoji || "🤖"
			const name = importData.flow.name || "Bot importado"
			const description = importData.flow.description || ""

			// 1) cria o workspace_item (bot)
			const { error: wsErr } = await supabase.from("workspace_items").insert({
				id: newBotId,
				user_id: user.id,
				type: "bot",
				title: name,
				description,
				emoji,
				parent_id: currentFolderId,
				index_item: 0,
			})
			if (wsErr) throw wsErr

			// 2) cria o chatbot_flows com os dados importados
			const { error: flowErr } = await supabase.from("chatbot_flows").insert({
				user_id: user.id,
				workspace_item_id: newBotId,
				name,
				description: description || null,
				draft_containers: importData.flow.containers,
				draft_edges: importData.flow.edges || [],
				settings: importData.flow.settings || {},
			})
			if (flowErr) throw flowErr

			// 3) sincroniza estado local sem disparar insert duplicado
			setItems((prev) => [
				...prev,
				{
					id: newBotId,
					type: "bot",
					title: name,
					description,
					emoji,
					parentId: currentFolderId,
					indexItem: 0,
				},
			])

			toast.success("Bot importado com sucesso!")
			setShowImportModal(false)
			setImportData(null)
			if (fileInputRef.current) fileInputRef.current.value = ""
		} catch (err: any) {
			console.error("[Import] erro", err)
			setImportError(err?.message || "Erro ao importar")
			toast.error("Erro ao importar bot")
		} finally {
			setImporting(false)
		}
	}

	return (
		<>
			<div className="flex flex-col gap-2 items-center">
				<DropdownMenu.Root>
					<DropdownMenu.Trigger asChild>
						<button className="group hover:border-green-400 flex flex-col bg-green-400 hover:bg-transparent gap-2 items-center justify-center w-28 p-6 rounded-lg border border-black">
							<Plus className="w-8 h-8 group-hover:text-green-400 text-white" />
							<span className=" group-hover:text-green-400 text-white text-sm font-bold uppercase">
								Adicionar Novo
							</span>
						</button>
					</DropdownMenu.Trigger>

					<DropdownMenu.Content
						sideOffset={6}
						className="p-2 bg-white rounded-md shadow-md min-w-[200px] z-50"
					>
						<DropdownMenu.Item
							onSelect={onAddFolder}
							className="p-2 rounded-md hover:bg-gray-100 cursor-pointer outline-none"
						>
							Adicionar Pasta
						</DropdownMenu.Item>

						<DropdownMenu.Item
							onSelect={handleBotSelect}
							disabled={!canAddBot}
							className={`p-2 rounded-md outline-none flex items-center justify-between gap-2 ${
								canAddBot
									? "hover:bg-gray-100 cursor-pointer"
									: "opacity-50 cursor-not-allowed text-gray-500"
							}`}
						>
							<span>Adicionar Bot</span>
							{!canAddBot && <Lock className="w-3.5 h-3.5" />}
						</DropdownMenu.Item>

						{!canAddBot && (
							<div className="px-2 pt-2 mt-1 border-t border-gray-100 text-[11px] text-gray-500 leading-tight">
								Limite do plano {PLAN_LABELS[currentPlan]} atingido
								<br />
								({botsUsed}/{limitLabel} bots)
							</div>
						)}
					</DropdownMenu.Content>
				</DropdownMenu.Root>

				{/* Botão Importar Bot */}
				<button
					onClick={handleImportClick}
					disabled={!canAddBot}
					title={
						canAddBot
							? "Importar bot a partir de arquivo JSON"
							: `Limite atingido (${botsUsed}/${limitLabel})`
					}
					className={`flex items-center gap-1.5 w-28 justify-center px-2 py-2 rounded-lg border text-xs font-semibold transition ${
						canAddBot
							? "border-green-400 text-green-400 hover:bg-green-400 hover:text-white cursor-pointer"
							: "border-gray-400 text-gray-400 cursor-not-allowed opacity-60"
					}`}
				>
					{canAddBot ? <Upload className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
					Importar
				</button>
			</div>

			{/* Upgrade modal */}
			<Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white mb-2">
							<Crown className="w-7 h-7" />
						</div>
						<DialogTitle className="text-center text-xl">
							Limite do plano atingido
						</DialogTitle>
						<DialogDescription className="text-center">
							Seu plano <strong>{PLAN_LABELS[currentPlan]}</strong> permite
							apenas <strong>{String(limitLabel)}</strong>{" "}
							{limits.bots === 1 ? "bot" : "bots"} por workspace. Faça upgrade
							para criar mais bots.
						</DialogDescription>
					</DialogHeader>

					<div className="bg-gray-100 rounded-lg p-4 flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 rounded-lg bg-cyan-500/15 text-cyan-600 flex items-center justify-center">
								<Sparkles className="w-5 h-5" />
							</div>
							<div className="text-left">
								<p className="text-sm font-medium">Bots em uso</p>
								<p className="text-xs text-gray-500">
									Inclui ativos e inativos
								</p>
							</div>
						</div>
						<span className="text-lg font-bold">
							{botsUsed}/{String(limitLabel)}
						</span>
					</div>

					<DialogFooter className="flex-col sm:flex-row gap-2">
						<Button
							variant="outline"
							onClick={() => setShowUpgradeModal(false)}
							className="w-full sm:w-auto"
						>
							Agora não
						</Button>
						<Button
							className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:opacity-90"
							onClick={() => {
								setShowUpgradeModal(false)
								navigate(configsRoute(slug))
							}}
						>
							<Crown className="w-4 h-4 mr-2" />
							Fazer upgrade
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Import modal */}
			<Dialog open={showImportModal} onOpenChange={setShowImportModal}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Upload className="w-5 h-5" />
							Importar Bot
						</DialogTitle>
						<DialogDescription>
							Selecione um arquivo .json exportado de outro bot.
						</DialogDescription>
					</DialogHeader>

					{/* Plan usage */}
					<div className="rounded-lg border border-gray-200 bg-gray-50 p-3 flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Sparkles className="w-4 h-4 text-cyan-600" />
							<div>
								<p className="text-xs font-medium text-gray-700">
									Plano {PLAN_LABELS[currentPlan]}
								</p>
								<p className="text-[11px] text-gray-500">
									Bots usados / limite
								</p>
							</div>
						</div>
						<span
							className={`text-sm font-bold ${
								canAddBot ? "text-gray-800" : "text-red-600"
							}`}
						>
							{botsUsed}/{String(limitLabel)}
						</span>
					</div>

					{!canAddBot && (
						<div className="bg-red-50 border border-red-200 rounded-lg p-2 flex items-center gap-2">
							<AlertCircle className="w-4 h-4 text-red-600" />
							<p className="text-xs text-red-700">
								Limite atingido. Faça upgrade para importar mais bots.
							</p>
						</div>
					)}

					<div className="space-y-3 py-2">
						<div className="space-y-1.5">
							<Label>Arquivo JSON</Label>
							<Input
								ref={fileInputRef}
								type="file"
								accept=".json,application/json"
								onChange={handleFileChange}
							/>
						</div>

						{importError && (
							<div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2">
								<AlertCircle className="w-4 h-4 text-destructive" />
								<p className="text-sm text-destructive">{importError}</p>
							</div>
						)}

						{importData && (
							<div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
								<p className="flex items-center gap-2">
									<Check className="w-4 h-4" />
									<span>
										Bot encontrado: <strong>{importData.flow.name}</strong>
									</span>
								</p>
								{importData.flow.description && (
									<p className="text-xs text-green-700 mt-1">
										{importData.flow.description}
									</p>
								)}
								<p className="text-xs text-green-700 mt-1 flex items-center gap-1">
									<FileJson className="w-3 h-3" />
									{importData.flow.containers.length} container(s)
								</p>
							</div>
						)}
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setShowImportModal(false)}>
							Cancelar
						</Button>
						<Button
							onClick={handleConfirmImport}
							disabled={!importData || importing || !canAddBot}
						>
							<Upload className="w-4 h-4 mr-2" />
							{importing ? "Importando..." : "Importar"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}
