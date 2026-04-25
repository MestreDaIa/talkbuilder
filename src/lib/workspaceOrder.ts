import type { WorkspaceItemType } from "../types/workspace/workspaceTypes";

/**
 * Ordena itens irmãos por indexItem (asc) e desempata por título.
 * Funciona para qualquer subset de items.
 */
export function sortByIndex<T extends { indexItem?: number; title?: string }>(
	list: T[],
): T[] {
	return [...list].sort((a, b) => {
		const ai = a.indexItem ?? 0;
		const bi = b.indexItem ?? 0;
		if (ai !== bi) return ai - bi;
		return (a.title ?? "").localeCompare(b.title ?? "");
	});
}

/**
 * Calcula o próximo indexItem disponível para um novo item dentro de um parentId.
 */
export function nextIndexFor(
	items: Pick<WorkspaceItemType, "parentId" | "indexItem">[],
	parentId: string | null,
): number {
	let max = -1;
	for (const it of items) {
		if (it.parentId === parentId) {
			const v = it.indexItem ?? 0;
			if (v > max) max = v;
		}
	}
	return max + 1;
}

/**
 * Reordena os irmãos de um parentId movendo `draggedId` para a posição imediatamente
 * antes de `overId`. Retorna a lista completa atualizada (apenas os índices dos
 * irmãos afetados são reescritos sequencialmente 0..n-1, garantindo consistência).
 */
export function reorderSiblings<
	T extends { id: string; parentId: string | null; indexItem?: number },
>(items: T[], parentId: string | null, draggedId: string, overId: string): T[] {
	const siblings = items
		.filter((i) => i.parentId === parentId)
		.sort((a, b) => (a.indexItem ?? 0) - (b.indexItem ?? 0));

	const fromIdx = siblings.findIndex((i) => i.id === draggedId);
	const toIdx = siblings.findIndex((i) => i.id === overId);
	if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return items;

	const reordered = [...siblings];
	const [moved] = reordered.splice(fromIdx, 1);
	reordered.splice(toIdx, 0, moved);

	const indexById = new Map<string, number>();
	reordered.forEach((s, i) => indexById.set(s.id, i));

	return items.map((it) =>
		indexById.has(it.id) ? { ...it, indexItem: indexById.get(it.id)! } : it,
	);
}
