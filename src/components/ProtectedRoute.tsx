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
		return <Navigate to="/setup" replace />;
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
