import { useEmbed, isInIframe } from "../context/EmbedContext";

/**
 * Mostrado quando estamos dentro de um iframe mas o token de embed
 * é inválido/expirado/ausente. Bloqueia o app pra evitar uso indevido.
 */
export default function EmbedErrorScreen() {
	const { mode, error } = useEmbed();

	// Só renderiza se está em iframe E não tem sessão válida
	if (mode === "embedded") return null;
	if (!isInIframe()) return null;
	if (!error) return null;

	return (
		<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background p-6">
			<div className="max-w-md text-center space-y-4">
				<div className="text-5xl">🔒</div>
				<h1 className="text-xl font-semibold text-foreground">
					Sessão inválida
				</h1>
				<p className="text-sm text-muted-foreground">{error}</p>
				<p className="text-xs text-muted-foreground">
					Volte ao Zailom Booking e tente abrir o builder novamente.
				</p>
			</div>
		</div>
	);
}
