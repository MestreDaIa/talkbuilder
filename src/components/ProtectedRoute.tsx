"use client";

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEmbed } from "../context/EmbedContext";

export default function ProtectedRoute({
	children,
}: {
	children: React.ReactNode;
}) {
	const { user, loading, isConfigured } = useAuth();
	const { mode } = useEmbed();
	const location = useLocation();

	// No modo embedded, a sessão vem do BookingFy via JWT — auth interna não bloqueia
	if (mode === "embedded") return <>{children}</>;

	if (!isConfigured) {
		return (
			<div className="min-h-svh flex items-center justify-center p-6 text-center">
				<div className="max-w-md">
					<h1 className="text-xl font-semibold mb-2">
						Conecte seu Supabase
					</h1>
					<p className="text-muted-foreground text-sm">
						Vá em Configurações → Integrações e conecte seu projeto
						Supabase pra começar.
					</p>
				</div>
			</div>
		);
	}

	if (loading) {
		return (
			<div className="min-h-svh flex items-center justify-center">
				<div className="text-muted-foreground text-sm">Carregando...</div>
			</div>
		);
	}

	if (!user) {
		return (
			<Navigate
				to="/login"
				replace
				state={{ from: location.pathname + location.search }}
			/>
		);
	}

	return <>{children}</>;
}
