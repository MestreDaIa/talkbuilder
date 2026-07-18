import { Badge } from "@/components/ui/badge";

/* ------------------------------------------------------------------ */
/* Guias do sistema (Sistema tab)                                      */
/* Referências textuais reutilizando o ReferenceDoc do page.tsx.       */
/* ------------------------------------------------------------------ */

export type SystemGuide = {
  id: string;
  title: string;
  body: React.ReactNode;
};

function Code({ children }: { children: string }) {
  return (
    <pre className="docs-code__pre my-3">
      <code>{children}</code>
    </pre>
  );
}

export const systemGuides: SystemGuide[] = [
  {
    id: "arquitetura",
    title: "Arquitetura geral",
    body: (
      <div className="space-y-4 text-sm leading-relaxed">
        <p>
          O Zailom Flow é uma plataforma multi-tenant para construção e execução
          de fluxos conversacionais. A stack está dividida em quatro camadas:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
          <li>
            <strong>Frontend (React + Vite + Tailwind)</strong> — editor visual
            de fluxos, painel de testes, workspace, configurações e chat widget
            público.
          </li>
          <li>
            <strong>Backend serverless (Edge Functions)</strong> — runtime do
            chatbot, webhooks da Evolution API, provisionamento externo,
            sincronização de planos, crawler de base de conhecimento e
            gerenciador de contexto.
          </li>
          <li>
            <strong>Banco de dados relacional</strong> — modelo multi-tenant por
            <code> workspace_id</code>, com <em>Row Level Security</em> e
            políticas por membro/papel.
          </li>
          <li>
            <strong>Proxy público (Nginx)</strong> em{" "}
            <code>api-flowbuilder.zailom.com</code>, expondo a Booking
            Integration API e o endpoint público do runtime.
          </li>
        </ul>
        <div className="docs-callout">
          <div className="docs-callout__title">Fronteira de escopo</div>
          <p>
            Toda leitura autenticada resolve o tenant <strong>exclusivamente</strong>
            a partir do credencial (API Key, JWT ou sessão). Parâmetros do
            cliente nunca influenciam o escopo do workspace.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "inicio-rapido",
    title: "Início rápido",
    body: (
      <div className="space-y-4 text-sm leading-relaxed">
        <ol className="list-decimal pl-5 space-y-2">
          <li>Crie sua conta em <code>/signup</code> ou receba um convite.</li>
          <li>No workspace, crie um novo bot pelo botão <strong>Novo bot</strong>.</li>
          <li>
            Monte o fluxo arrastando <em>nodes</em> da sidebar esquerda e
            conectando-os pelas alças (handles).
          </li>
          <li>
            Use o <strong>Painel de Teste</strong> (canto direito) para simular
            uma conversa antes de publicar.
          </li>
          <li>
            Publique pelo botão <strong>Publicar</strong>. O bot ganha um{" "}
            <code>public_id</code> acessível em <code>/:slug/flow/:public_id</code>.
          </li>
          <li>
            Para WhatsApp, conecte uma instância em{" "}
            <strong>Configurações → WhatsApp</strong> e escaneie o QR Code.
          </li>
        </ol>
      </div>
    ),
  },
  {
    id: "multi-tenant",
    title: "Multi-tenant e permissões",
    body: (
      <div className="space-y-4 text-sm leading-relaxed">
        <p>
          Cada conta pode participar de vários <strong>workspaces</strong>. O
          workspace é o container de bots, instâncias, integrações, membros e
          faturamento.
        </p>
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-semibold">Papel</th>
                <th className="text-left p-3 font-semibold">Permissões</th>
              </tr>
            </thead>
            <tbody className="[&_td]:p-3 [&_tr]:border-t [&_tr]:border-border">
              <tr>
                <td><Badge variant="outline">owner</Badge></td>
                <td>Acesso total: faturamento, exclusão de workspace, gestão de membros.</td>
              </tr>
              <tr>
                <td><Badge variant="outline">admin</Badge></td>
                <td>Gerencia bots, membros e integrações. Sem acesso a faturamento.</td>
              </tr>
              <tr>
                <td><Badge variant="outline">editor</Badge></td>
                <td>Cria e edita bots. Sem acesso a configurações administrativas.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground">
          Convites são enviados por e-mail e aceitos em <code>/invite/:token</code>.
        </p>
      </div>
    ),
  },
  {
    id: "runtime-contexto",
    title: "Runtime: Contexto, Memória e Live Data",
    body: (
      <div className="space-y-4 text-sm leading-relaxed">
        <p>
          O runtime carrega três camadas de estado ao executar um bot:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
          <li>
            <strong>Contexto de conversa</strong> — variáveis coletadas pelos
            inputs e resultados de nodes (histórico da sessão).
          </li>
          <li>
            <strong>Memória persistente</strong> — chave/valor por{" "}
            <code>conversation_id</code>, sobrevive a reinícios; gerenciada pela
            função <code>context-manager</code>.
          </li>
          <li>
            <strong>Live Data</strong> — resultados marcados como voláteis
            (estoque, agenda, saldo). O agente IA <strong>sempre reconsulta</strong>{" "}
            esses skills antes de operar sobre eles, nunca reutiliza cache.
          </li>
        </ul>
        <div className="docs-callout">
          <div className="docs-callout__title">Anti-alucinação de IDs</div>
          <p>
            IDs retornados por chamadas GET são catalogados na sessão. Quando o
            agente propõe um <code>*_id</code> em POST/PUT/DELETE, o runtime
            valida contra a lista verificada. Em <strong>modo estrito</strong>,
            IDs não verificados abortam a chamada com{" "}
            <code>strict_unverified_id</code>.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "whatsapp",
    title: "WhatsApp (Evolution API)",
    body: (
      <div className="space-y-4 text-sm leading-relaxed">
        <p>
          A integração com WhatsApp usa a{" "}
          <a href="https://doc.evolution-api.com" target="_blank" rel="noreferrer" className="text-primary underline">Evolution API</a>{" "}
          como gateway. Cada instância do workspace mantém sua própria sessão.
        </p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>Crie uma instância em <strong>Configurações → WhatsApp</strong>.</li>
          <li>Configure o webhook da instância para apontar para:</li>
        </ol>
        <Code>{`POST https://api-flowbuilder.zailom.com/functions/v1/whatsapp-webhook
Events: MESSAGES_UPSERT`}</Code>
        <ol start={3} className="list-decimal pl-5 space-y-2">
          <li>Escaneie o QR Code exibido no painel.</li>
          <li>Vincule um bot publicado à instância na aba <strong>WhatsApp</strong>.</li>
        </ol>
        <div className="docs-callout">
          <div className="docs-callout__title">Filtros automáticos</div>
          <p>Mensagens de grupos e <code>fromMe</code> são ignoradas pelo webhook.</p>
        </div>
      </div>
    ),
  },
  {
    id: "embedded",
    title: "Modo Embedded (Booking)",
    body: (
      <div className="space-y-4 text-sm leading-relaxed">
        <p>
          O Zailom Flow pode rodar embutido em outra aplicação (ex: Zailom
          Booking). Nesse modo a sessão é confiada ao host via JWT HS256 —
          nenhuma tela de login é exibida.
        </p>
        <p>Fluxo:</p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>Sistema host chama <code>/functions/v1/provision-account</code> assinando com <code>EMBED_SHARED_SECRET</code>.</li>
          <li>Recebe <code>user_id</code>, <code>workspace_id</code> e <code>slug</code>.</li>
          <li>Abre o Flow via iframe apontando para <code>/{"{slug}"}/workspace</code> passando o JWT.</li>
          <li>Sincroniza planos periodicamente com <code>/functions/v1/sync-embed-plan</code>.</li>
        </ol>
        <p className="text-muted-foreground">
          Ver contrato completo em <em>Referências → Autenticação JWT HS256</em>.
        </p>
      </div>
    ),
  },
  {
    id: "ia-provedores",
    title: "Provedores de IA suportados",
    body: (
      <div className="space-y-3 text-sm leading-relaxed">
        <p>Modelos são configurados por node <strong>AI Completion</strong> ou <strong>AI Agent</strong>.</p>
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-semibold">Provedor</th>
                <th className="text-left p-3 font-semibold">Modelos comuns</th>
                <th className="text-left p-3 font-semibold">API Key</th>
              </tr>
            </thead>
            <tbody className="[&_td]:p-3 [&_tr]:border-t [&_tr]:border-border">
              <tr><td>OpenAI</td><td>gpt-4o, gpt-4o-mini, gpt-4-turbo</td><td>sk-…</td></tr>
              <tr><td>Google Gemini</td><td>gemini-flash-latest, gemini-2.5-pro</td><td>AIza…</td></tr>
              <tr><td>Anthropic</td><td>claude-3-5-sonnet, claude-3-haiku</td><td>sk-ant-…</td></tr>
              <tr><td>Groq</td><td>llama3-70b, mixtral-8x7b</td><td>gsk_…</td></tr>
              <tr><td>DeepSeek</td><td>deepseek-chat, deepseek-coder</td><td>sk-…</td></tr>
              <tr><td>Mistral</td><td>mistral-large-latest</td><td>—</td></tr>
              <tr><td>OpenRouter</td><td>auto</td><td>sk-or-…</td></tr>
              <tr><td>Ollama (local)</td><td>llama3, mistral, phi3</td><td>não requer</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground">
          Chaves são armazenadas por workspace e criptografadas em repouso.
        </p>
      </div>
    ),
  },
  {
    id: "knowledge-base",
    title: "Base de Conhecimento (RAG)",
    body: (
      <div className="space-y-3 text-sm leading-relaxed">
        <p>
          O node <strong>AI Completion</strong> aceita uma <code>knowledgeBaseId</code>.
          A base pode ser criada a partir de:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Upload de PDF/DOCX/TXT.</li>
          <li>URL de site — usa o crawler <code>/functions/v1/crawl</code>, que rastreia até 12 páginas priorizando conteúdo relevante (preços, planos, sobre).</li>
          <li>Texto colado manualmente.</li>
        </ul>
        <p>O conteúdo é fatiado em <em>chunks</em>, indexado e injetado no prompt como contexto.</p>
      </div>
    ),
  },
  {
    id: "human-handoff",
    title: "Human Handoff",
    body: (
      <div className="space-y-3 text-sm leading-relaxed">
        <p>
          O node <strong>Human Handoff</strong> pausa a execução do bot para uma
          sessão específica. O atendente recebe a conversa com todo o
          histórico e variáveis coletadas.
        </p>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li><code>department</code>: fila que recebe a conversa.</li>
          <li><code>tags</code>: skills/prioridade para roteamento.</li>
          <li><code>resumeOnTimeout</code>: retoma o bot se ninguém responder no tempo definido.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "widget-embed",
    title: "Embedar o chat no seu site",
    body: (
      <div className="space-y-3 text-sm leading-relaxed">
        <p>Cole o snippet abaixo em qualquer página HTML — substitua <code>PUBLIC_ID</code> pelo do seu bot publicado:</p>
        <Code>{`<script
  src="https://api-flowbuilder.zailom.com/widget.js"
  data-flow-id="PUBLIC_ID"
  data-theme="light"
  defer
></script>`}</Code>
        <p className="text-muted-foreground">
          O widget cria uma bolha flutuante que abre um chat com o bot. Configure
          cores, avatar e mensagem inicial na aba <strong>Publicar</strong>.
        </p>
      </div>
    ),
  },
  {
    id: "seguranca-lgpd",
    title: "Segurança e LGPD",
    body: (
      <div className="space-y-3 text-sm leading-relaxed">
        <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
          <li>Row Level Security ativa em todas as tabelas com <code>workspace_id</code>.</li>
          <li>API Keys nunca aparecem em plaintext depois da criação — apenas prefixo.</li>
          <li>Provisionamento e sync usam JWT HS256 com <code>iss</code>, <code>aud</code>, <code>purpose</code> e <code>exp</code> obrigatórios.</li>
          <li>Sessões do agente IA podem operar em modo estrito, bloqueando IDs não verificados em operações mutativas.</li>
          <li>Dados podem ser exportados/eliminados por titular via <strong>Configurações → Segurança</strong>.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "deploy",
    title: "Deploy e infraestrutura",
    body: (
      <div className="space-y-3 text-sm leading-relaxed">
        <p>O projeto entrega três imagens Docker principais:</p>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li><code>frontend</code> — SPA React servida por Nginx.</li>
          <li><code>booking-proxy</code> — Nginx que expõe <code>api-flowbuilder.zailom.com/booking-api</code> e <code>/functions/v1/*</code>.</li>
          <li><code>server</code> — worker Node opcional para runtime dedicado (Bun/tsx).</li>
        </ul>
        <p>Suba com Docker Compose:</p>
        <Code>{`docker compose up -d --build`}</Code>
        <p className="text-muted-foreground">
          Variáveis obrigatórias: <code>SUPABASE_URL</code>, <code>SUPABASE_ANON_KEY</code>,
          <code> EMBED_SHARED_SECRET</code>, <code>EVO_GLOBAL_KEY</code> (opcional).
        </p>
      </div>
    ),
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    body: (
      <div className="space-y-3 text-sm leading-relaxed">
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-semibold">Sintoma</th>
                <th className="text-left p-3 font-semibold">Causa provável / ação</th>
              </tr>
            </thead>
            <tbody className="[&_td]:p-3 [&_tr]:border-t [&_tr]:border-border align-top">
              <tr><td>401 na Booking API</td><td>API Key ausente ou header errado. Use <code>x-api-key</code> ou <code>Authorization: Bearer</code>.</td></tr>
              <tr><td>403 na Booking API</td><td>Chave desativada. Rotacione em <strong>Configurações → API Keys</strong>.</td></tr>
              <tr><td>Agente IA retorna 429</td><td>Cota do provedor esgotada. Troque a chave ou espere a janela.</td></tr>
              <tr><td>Agente IA retorna 503 (Gemini)</td><td>Instabilidade temporária do provedor. Repetir a chamada após alguns segundos.</td></tr>
              <tr><td>Bot no WhatsApp não responde</td><td>Verifique se o webhook aponta para <code>/functions/v1/whatsapp-webhook</code> e se a instância está <code>connected</code>.</td></tr>
              <tr><td>HTTP Dinâmico não substitui <code>:id</code></td><td>Confirme que o argumento foi declarado no schema e existe no contexto. Veja auditoria no console.</td></tr>
              <tr><td>Fluxo sumiu depois de logout</td><td>Rascunho estava só em cache local (comportamento antigo). Novos rascunhos são gravados no servidor.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
  {
    id: "changelog",
    title: "Changelog resumido",
    body: (
      <div className="space-y-3 text-sm leading-relaxed">
        <div className="space-y-4">
          <div>
            <div className="font-semibold text-foreground">2026-07 · Runtime Context v2</div>
            <p className="text-muted-foreground">Live Data, memória persistente por conversa, modo estrito de IDs e auditoria de substituições em chamadas mutativas.</p>
          </div>
          <div>
            <div className="font-semibold text-foreground">2026-06 · HTTP Dinâmico</div>
            <p className="text-muted-foreground">Editor de Argument Schema, sync a partir de URL/cURL, endpoints expostos como skills independentes ao agente.</p>
          </div>
          <div>
            <div className="font-semibold text-foreground">2026-05 · Booking Integration API</div>
            <p className="text-muted-foreground">API pública read-only autenticada por API Key para consumo pelo Zailom Booking.</p>
          </div>
        </div>
      </div>
    ),
  },
];
