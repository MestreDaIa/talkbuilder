"use client"

import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { Plus, Lock, Crown, Sparkles } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { usePlan, PLAN_LABELS } from "../context/PlanContext"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog"
import { Button } from "./ui/button"

type Props = {
	onAddFolder: () => void
	onAddBot: () => void
}

export default function AddOptionToolbar({ onAddFolder, onAddBot }: Props) {
	const { canAddBot, limits, botsUsed, currentPlan } = usePlan()
	const [showUpgradeModal, setShowUpgradeModal] = useState(false)
	const navigate = useNavigate()

	const limitLabel = Number.isFinite(limits.bots) ? limits.bots : "ilimitados"

	function handleBotSelect(e: Event) {
		if (!canAddBot) {
			e.preventDefault()
			setShowUpgradeModal(true)
			return
		}
		onAddBot()
	}

	return (
		<>
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
								navigate("/workspace/configs")
							}}
						>
							<Crown className="w-4 h-4 mr-2" />
							Fazer upgrade
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}
