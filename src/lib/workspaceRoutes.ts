// Helpers centralizados pras rotas do workspace.
// Formato novo:
//   /                                  → Landing pública
//   /login | /signup                   → Auth
//   /:slug/workspace                   → Workspace raiz do usuário
//   /:slug/workspace/folder/:folderId  → Pasta
//   /:slug/workspace/bot/:id           → Editor do bot
//   /:slug/workspace/configs           → Configurações
//   /:slug/workspace/perfil            → Perfil
//   /:slug/flow/:publicId              → Bot publicado (público)

const FALLBACK_SLUG = "u";

export function workspaceRoot(slug: string | null | undefined) {
	return `/${slug || FALLBACK_SLUG}/workspace`;
}

export function folderRoute(slug: string | null | undefined, folderId: string) {
	return `/${slug || FALLBACK_SLUG}/workspace/folder/${folderId}`;
}

export function botRoute(slug: string | null | undefined, botId: string) {
	return `/${slug || FALLBACK_SLUG}/workspace/bot/${botId}`;
}

export function rememberBotBackRoute(botId: string, route: string) {
	if (typeof window === "undefined") return;
	window.sessionStorage.setItem(`bot_back_route_${botId}`, route);
}

export function rememberedBotBackRoute(botId: string) {
	if (typeof window === "undefined") return null;
	return window.sessionStorage.getItem(`bot_back_route_${botId}`);
}

export function browserHrefForRoute(route: string) {
	if (typeof window === "undefined") return route;
	return `${window.location.origin}${route}`;
}

export function hardReloadToRoute(route: string) {
	if (typeof window === "undefined") return;
	window.history.replaceState(null, "", browserHrefForRoute(route));
	window.location.reload();
}

export function configsRoute(slug: string | null | undefined) {
	return `/${slug || FALLBACK_SLUG}/workspace/configs`;
}

export function perfilRoute(slug: string | null | undefined) {
	return `/${slug || FALLBACK_SLUG}/workspace/perfil`;
}

/** Extrai folderId da URL no formato /:slug/workspace/folder/:folderId(/...) */
export function folderIdFromPath(pathname: string): string | null {
	const match = pathname.match(/\/workspace\/folder\/([^/?#]+)/);
	return match?.[1] ?? null;
}

/** Extrai slug da URL no formato /:slug/workspace... */
export function slugFromPath(pathname: string): string | null {
	const match = pathname.match(/^\/([^/?#]+)\/workspace/);
	return match?.[1] ?? null;
}
