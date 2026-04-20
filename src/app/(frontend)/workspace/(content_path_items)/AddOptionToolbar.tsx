"use client"

import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { Plus } from "lucide-react"

type Props = {
  onAddFolder: () => void
  onAddBot: () => void
}

export default function AddOptionToolbar({ onAddFolder, onAddBot }: Props) {
  return (
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
					className="p-2 bg-white rounded-md shadow-md"
				>
					<DropdownMenu.Item
						onSelect={onAddFolder}
						className="p-2 rounded-md hover:bg-gray-100"
					>
						Adicionar Pasta
					</DropdownMenu.Item>

					<DropdownMenu.Item
						onSelect={onAddBot}
						className="p-2 rounded-md hover:bg-gray-100"
					>
						Adicionar Bot
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		);
}