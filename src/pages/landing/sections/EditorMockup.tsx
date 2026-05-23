import { cn } from "../../../lib/utils";
import { MessageSquare, Zap, GitBranch, Type } from "lucide-react";

type Props = {
	className?: string;
	animateNodes?: boolean;
};

/**
 * Stylized canvas mockup of the bot editor.
 * Uses divs + an SVG layer for connection lines so animations can target nodes.
 */
export default function EditorMockup({ className, animateNodes }: Props) {
	const nodeBase =
		"absolute rounded-xl border border-white/10 bg-[#1E0828]/95 backdrop-blur shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)] px-3 py-2.5 text-xs text-left";

	return (
		<div
			className={cn(
				"mx-auto w-full max-w-5xl aspect-[16/9] rounded-2xl border border-white/10 bg-[#1E0828] overflow-hidden",
				"shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.04)]",
				className,
			)}
		>
			{/* Toolbar */}
			<div className="h-9 border-b border-white/5 bg-[#1E0828] flex items-center px-3 gap-1.5">
				<span className="w-2.5 h-2.5 rounded-full bg-[#920027]" />
				<span className="w-2.5 h-2.5 rounded-full bg-[#460863]" />
				<span className="w-2.5 h-2.5 rounded-full bg-white/20" />
				<span className="ml-3 text-[10px] text-muted-foreground font-mono">
					zyloflow.com/bot/atendimento
				</span>
			</div>

			{/* Canvas with grid */}
			<div className="relative h-[calc(100%-2.25rem)] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] [background-size:18px_18px]">
				{/* Connections SVG */}
				<svg
					className="absolute inset-0 w-full h-full pointer-events-none"
					preserveAspectRatio="none"
				>
					<defs>
						<linearGradient id="line-grad" x1="0" x2="1">
							<stop offset="0%" stopColor="#460863" />
							<stop offset="100%" stopColor="#920027" />
						</linearGradient>
					</defs>
					<path
						data-node-line
						d="M 18% 32% C 28% 32%, 28% 55%, 38% 55%"
						stroke="url(#line-grad)"
						strokeWidth="2"
						fill="none"
						strokeLinecap="round"
						style={animateNodes ? { strokeDasharray: 400, strokeDashoffset: 400 } : undefined}
					/>
					<path
						data-node-line
						d="M 58% 55% C 68% 55%, 68% 30%, 78% 30%"
						stroke="url(#line-grad)"
						strokeWidth="2"
						fill="none"
						strokeLinecap="round"
						style={animateNodes ? { strokeDasharray: 400, strokeDashoffset: 400 } : undefined}
					/>
					<path
						data-node-line
						d="M 58% 55% C 68% 55%, 68% 78%, 78% 78%"
						stroke="url(#line-grad)"
						strokeWidth="2"
						fill="none"
						strokeLinecap="round"
						style={animateNodes ? { strokeDasharray: 400, strokeDashoffset: 400 } : undefined}
					/>
				</svg>

				{/* Start node */}
				<div
					data-node
					className={cn(nodeBase, "left-[6%] top-[24%] w-[12%] min-w-[110px]")}
				>
					<div className="flex items-center gap-1.5 mb-1 text-[#920027] font-medium">
						<Zap className="w-3 h-3" />
						Início
					</div>
					<div className="text-muted-foreground text-[10px]">
						Quando usuário envia mensagem
					</div>
				</div>

				{/* Message bubble */}
				<div
					data-node
					className={cn(nodeBase, "left-[38%] top-[47%] w-[20%] min-w-[160px]")}
				>
					<div className="flex items-center gap-1.5 mb-1 text-[#460863] font-medium">
						<MessageSquare className="w-3 h-3" />
						Mensagem
					</div>
					<div className="text-foreground/90 text-[11px] leading-snug">
						Olá! Como posso te ajudar hoje?
					</div>
				</div>

				{/* Input */}
				<div
					data-node
					className={cn(nodeBase, "left-[78%] top-[22%] w-[18%] min-w-[140px]")}
				>
					<div className="flex items-center gap-1.5 mb-1 text-[#920027] font-medium">
						<Type className="w-3 h-3" />
						Pergunta
					</div>
					<div className="text-muted-foreground text-[10px]">
						Captura nome do cliente
					</div>
				</div>

				{/* Condition */}
				<div
					data-node
					className={cn(nodeBase, "left-[78%] top-[70%] w-[18%] min-w-[140px]")}
				>
					<div className="flex items-center gap-1.5 mb-1 text-[#460863] font-medium">
						<GitBranch className="w-3 h-3" />
						Condição
					</div>
					<div className="text-muted-foreground text-[10px]">
						Se já é cliente → atalho
					</div>
				</div>

				{/* Floating cursor */}
				<div className="absolute left-[40%] top-[60%] pointer-events-none">
					<svg width="16" height="16" viewBox="0 0 16 16" className="drop-shadow-lg">
						<path
							d="M0 0 L0 12 L4 9 L7 14 L9 13 L6 8 L11 8 Z"
							fill="white"
							stroke="black"
							strokeWidth="0.5"
						/>
					</svg>
				</div>
			</div>
		</div>
	);
}
