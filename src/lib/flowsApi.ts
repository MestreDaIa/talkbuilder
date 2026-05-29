// =============================================================================
// flowsApi — operações sobre a tabela `chatbot_flows`.
// O bot do workspace (workspace_items.type='bot') tem (no máximo) um flow
// associado via workspace_item_id. Aqui ficam todas as queries usadas pelo
// editor: load, ensure (cria se faltar), salvar rascunho, publicar, etc.
// =============================================================================

import { getSupabase } from "./supabaseClient";
import type { Container, Edge } from "@/types/chatbot";

export interface ChatbotFlowRow {
  id: string;
  user_id: string;
  workspace_item_id: string;
  name: string;
  description: string | null;
  settings: Record<string, any>;
  draft_containers: Container[];
  draft_edges: Edge[];
  draft_updated_at: string;
  published_containers: Container[] | null;
  published_edges: Edge[] | null;
  published_at: string | null;
  public_id: string | null;
  is_published: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

class NoSupabaseError extends Error {
  constructor() {
    super("Supabase não configurado");
    this.name = "NoSupabaseError";
  }
}

function client() {
  const c = getSupabase();
  if (!c) throw new NoSupabaseError();
  return c;
}

export type FlowStatus = "draft" | "draft_changes" | "published";

export function deriveStatus(row: Pick<ChatbotFlowRow, "is_published" | "draft_updated_at" | "published_at">): FlowStatus {
  if (!row.is_published) return "draft";
  if (row.published_at && new Date(row.draft_updated_at) > new Date(row.published_at)) {
    return "draft_changes"; // publicado, mas com alterações pendentes
  }
  return "published";
}

/**
 * Garante que existe uma linha em chatbot_flows para o item de workspace.
 * Se não existir, cria com defaults usando o título/descrição do workspace_item.
 */
export async function ensureFlow(workspaceItemId: string, fallbackName: string, workspaceId: string): Promise<ChatbotFlowRow> {
  const c = client();
  const { data: existing, error: selErr } = await c
    .from("chatbot_flows")
    .select("*")
    .eq("workspace_item_id", workspaceItemId)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing as ChatbotFlowRow;

  const { data: userRes } = await c.auth.getUser();
  const userId = userRes.user?.id;
  if (!userId) throw new Error("Usuário não autenticado");

  const { data, error } = await c
    .from("chatbot_flows")
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      workspace_item_id: workspaceItemId,
      name: fallbackName,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ChatbotFlowRow;
}

export async function getFlowByWorkspaceItem(workspaceItemId: string): Promise<ChatbotFlowRow | null> {
  const c = client();
  const { data, error } = await c
    .from("chatbot_flows")
    .select("*")
    .eq("workspace_item_id", workspaceItemId)
    .maybeSingle();
  if (error) throw error;
  return (data as ChatbotFlowRow) ?? null;
}

/**
 * Remove conexões (edges) que apontam para containers ou nodes que não existem mais.
 * Garante que o banco de dados não acumule lixo e evita logs de erro no runtime.
 */
function sanitizeEdges(containers: Container[], edges: Edge[]): Edge[] {
  const validContainerIds = new Set<string>(containers.map(c => c.id));
  const validNodeIds = new Set<string>();
  for (const c of containers) {
    for (const n of c.nodes || []) {
      validNodeIds.add(n.id);
    }
  }

  return edges.filter(e => {
    // A origem e o destino podem ser um container ou um node (ex: botão dentro do container).
    // O React Flow às vezes mantém referências a nodes que já foram removidos do seu container pai,
    // então verificamos se tanto a origem quanto o destino existem no conjunto de IDs válidos.
    const sourceOk = validContainerIds.has(e.source) || validNodeIds.has(e.source);
    const targetOk = validContainerIds.has(e.target) || validNodeIds.has(e.target);
    return sourceOk && targetOk;
  });
}

/** Salva o rascunho (containers + edges). Se o fluxo já estiver publicado,
 *  espelha imediatamente para a versão publicada — assim canais como WhatsApp
 *  passam a executar a versão mais recente sem precisar re-publicar manualmente. */
export async function saveDraft(flowId: string, containers: Container[], edges: Edge[]): Promise<ChatbotFlowRow> {
  const c = client();

  // Garantimos que os dados estão limpos de referências circulares ou estados do React Flow
  // e removemos edges órfãs antes de enviar para o banco de dados.
  const cleanContainers = JSON.parse(JSON.stringify(containers));
  const cleanEdges = sanitizeEdges(cleanContainers, JSON.parse(JSON.stringify(edges)));

  console.log("[flowsApi] Salvando rascunho para flow:", flowId, "Nodes:", cleanContainers.length, "Edges:", cleanEdges.length);

  // Verificamos se o fluxo está publicado para decidir se devemos espelhar.
  const { data: current } = await c
    .from("chatbot_flows")
    .select("is_published")
    .eq("id", flowId)
    .maybeSingle();

  const now = new Date().toISOString();
  const updatePayload: Record<string, any> = {
    draft_containers: cleanContainers,
    draft_edges: cleanEdges,
    draft_updated_at: now,
  };
  if (current?.is_published) {
    updatePayload.published_containers = cleanContainers;
    updatePayload.published_edges = cleanEdges;
    updatePayload.published_at = now;
  }

  const { data, error } = await c
    .from("chatbot_flows")
    .update(updatePayload)
    .eq("id", flowId)
    .select("*")
    .single();

  if (error) {
    console.error("[flowsApi] Erro ao salvar rascunho:", error);
    throw error;
  }

  // O reset agressivo foi removido para evitar reinícios indesejados durante testes.
  // O runtime agora valida se o current_node_id ainda existe no fluxo.


  return data as ChatbotFlowRow;
}


export async function updateFlowMeta(
  flowId: string,
  patch: Partial<Pick<ChatbotFlowRow, "name" | "description" | "settings">>
): Promise<ChatbotFlowRow> {
  const c = client();
  const { data, error } = await c
    .from("chatbot_flows")
    .update(patch)
    .eq("id", flowId)
    .select("*")
    .single();
  if (error) throw error;
  return data as ChatbotFlowRow;
}

/**
 * Promove o rascunho atual para versão pública.
 * publicId obrigatório. Verifica unicidade por usuário antes.
 */
export async function publishFlow(
  flowId: string,
  publicId: string,
  containers: Container[],
  edges: Edge[]
): Promise<ChatbotFlowRow> {
  const c = client();

  // Conflito de public_id no mesmo usuário
  const { data: userRes } = await c.auth.getUser();
  const userId = userRes.user?.id;
  if (!userId) throw new Error("Usuário não autenticado");

  const { data: conflict } = await c
    .from("chatbot_flows")
    .select("id")
    .eq("user_id", userId)
    .eq("public_id", publicId)
    .neq("id", flowId)
    .maybeSingle();
  if (conflict) throw new Error("Este ID público já está em uso por outro bot seu.");

  const now = new Date().toISOString();
  const cleanContainers = JSON.parse(JSON.stringify(containers));
  const cleanEdges = sanitizeEdges(cleanContainers, JSON.parse(JSON.stringify(edges)));

  const { data, error } = await c
    .from("chatbot_flows")
    .update({
      public_id: publicId,
      is_published: true,
      is_active: true,
      published_at: now,
      published_containers: cleanContainers,
      published_edges: cleanEdges,
      // espelha rascunho — garante que o JSON salvo é o mesmo do canvas
      draft_containers: cleanContainers,
      draft_edges: cleanEdges,
      draft_updated_at: now,
    })
    .eq("id", flowId)
    .select("*")
    .single();
  if (error) throw error;
  return data as ChatbotFlowRow;
}

export async function unpublishFlow(flowId: string): Promise<ChatbotFlowRow> {
  const c = client();
  const { data, error } = await c
    .from("chatbot_flows")
    .update({ is_published: false, is_active: false })
    .eq("id", flowId)
    .select("*")
    .single();
  if (error) throw error;
  return data as ChatbotFlowRow;
}

export interface PublicFlowResult {
  id: string;
  name: string;
  description: string | null;
  settings: Record<string, any>;
  containers: Container[];
  edges: Edge[];
  owner_slug: string;
}

/** Carrega versão publicada via slug do dono + public_id (RPC pública). */
export async function getPublicFlow(slug: string, publicId: string): Promise<PublicFlowResult | null> {
  const c = client();
  const { data, error } = await c.rpc("get_public_flow", {
    p_slug: slug,
    p_public_id: publicId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as PublicFlowResult) ?? null;
}
