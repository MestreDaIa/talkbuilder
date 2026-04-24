## Problema

Há três sintomas relacionados ao link público do bot:

1. **Botão "abrir" (ícone ↗) ao lado do copy → "page not found"** dentro do navegador in-app do preview Lovable.
2. **Cole-e-vá manual na barra do preview interno** carrega a rota mas exibe **tela preta sem informação** (imagem 4).
3. **URL gerada usa o host errado**: dentro do iframe do preview o `window.location.origin` é `…lovableproject.com`, mas o domínio que realmente serve a SPA fora do preview é `id-preview--<id>.lovable.app` (e, quando publicado, o `.lovable.app` final). Isso quebra ao compartilhar.

## Causa-raiz

### Sintoma 1 (botão "abrir")
O `navigate(getPublicPath())` é executado dentro do editor que vive sob `ProtectedRoute` + `WorkspaceProvider`. A rota `/:slug/flow/:publicId` está fora desses providers no `App.tsx`, mas como o React Router **não desmonta/monta automaticamente os providers do nível pai** quando você navega entre rotas-irmãs no mesmo `<Routes>`, o `PublicFlowPage` monta corretamente — exceto que, na visualização in-app do navegador móvel, certos handlers do preview interceptam navegações com hosts diferentes do iframe pai e mostram "page not found" porque o caminho `/teste02/flow/...` é colidido com a rota `/workspace/...` quando tem state residual. Na prática: a navegação interna funciona em desktop, mas no in-app browser do iOS o `window.open`/redirect falha. Precisamos garantir que o link aberto seja **absoluto** com host correto, e que o ícone ↗ abra em **nova aba** com `target="_blank"` em vez de navegação SPA (que dentro do in-app browser estava perdendo contexto).

### Sintoma 2 (tela preta)
O `PublicFlowPage` tem três estados visuais (loading/error/empty/TestPanel). Quando o RPC `get_public_flow` retorna erro (por exemplo, função ainda não aplicada no Supabase, ou nenhum bot publicado com `is_active=true`), o componente cai no ramo `error`, mas o texto do erro é renderizado com `text-muted-foreground` sobre `bg-background` no tema escuro — fica visível, mas o usuário relata "tela preta sem informações". Provavelmente o RPC está retornando `null` silenciosamente (bot existe mas `is_active=false`, ou slug não bate). Precisamos:
- Logar mais explicitamente o que veio do RPC.
- Mostrar uma mensagem mais útil (qual slug, qual publicId, sugerir verificar se está publicado).
- Garantir que `published_at` e `is_active=true` estejam setados (já estão no `handlePublish`).

### Sintoma 3 (host errado na URL pública)
`window.location.origin` no iframe do preview é `https://<id>.lovableproject.com` (domínio interno que não responde a deep links de SPA fora do contexto do editor). A URL compartilhável deve ser:
- Em preview: `https://id-preview--<id>.lovable.app/<slug>/flow/<publicId>`
- Quando publicado: `https://<custom-domain-ou-app-host>/<slug>/flow/<publicId>`

Precisamos derivar o host público correto a partir do hostname atual em vez de usar `window.location.origin` cru.

## Solução

### 1. Corrigir host na URL pública (`PublishDialog.tsx`)
Criar helper `getPublicOrigin()` que:
- Se `hostname` termina em `.lovableproject.com` (preview interno do editor) → mapeia para `https://id-preview--<projectId>.lovable.app`.
- Caso contrário usa `window.location.origin` (já é o domínio correto: `id-preview--*.lovable.app`, `*.lovable.app` publicado, ou domínio customizado).

Aplicar tanto no campo "URL Pública" exibido, no `copyUrl`, quanto no `openPreview`.

### 2. Trocar navegação SPA por nova aba no botão ↗
Em vez de `navigate(getPublicPath())`, usar `window.open(getPublicUrl(), '_blank', 'noopener')`. Motivo: dentro do in-app browser do iOS o SPA navigate perdia contexto; abrindo em nova aba o navegador resolve o deep link via fallback SPA da hospedagem Lovable, que serve `index.html` corretamente.

### 3. Melhorar feedback de erro em `PublicFlowPage`
- Mostrar slug/publicId tentados na mensagem de erro.
- Adicionar `console.warn` com payload bruto retornado pelo RPC.
- Botão "Tentar novamente" simples.
- Garantir contraste do texto (usar `text-foreground` no título em vez de só `muted`).

### 4. Validação prática (sem mudar código)
Antes de testar de novo, confirmar no Supabase:
- A função `get_public_flow` foi aplicada (Section 12 do `docs/supabase-setup.sql`).
- A linha em `chatbot_flows` do bot tem: `is_published=true`, `is_active=true`, `public_id='teste-de-bot001-01'`, `published_containers` não vazio.
- A linha em `profiles` do dono tem `slug='teste02'` (lowercase).

## Arquivos modificados

- `src/components/chatbot/PublishDialog.tsx` — helper `getPublicOrigin()`, `openPreview` usa `window.open`, remove `useNavigate`/`getPublicPath`.
- `src/pages/public/flow/page.tsx` — melhorar tela de erro (mostrar slug/publicId, contraste), log do RPC.

## Detalhes técnicos

```ts
// PublishDialog.tsx
function getPublicOrigin(): string {
  const { hostname, origin } = window.location;
  // Preview interno do editor: <projectId>.lovableproject.com
  // Mapeia para o host servido fora do editor: id-preview--<projectId>.lovable.app
  const m = hostname.match(/^([0-9a-f-]+)\.lovableproject\.com$/i);
  if (m) return `https://id-preview--${m[1]}.lovable.app`;
  return origin;
}

const getPublicUrl = () =>
  `${getPublicOrigin()}/${resolvedSlug}/flow/${publicId}`;

const openPreview = () => {
  if (!slugReady) { toast.error('…'); return; }
  window.open(getPublicUrl(), '_blank', 'noopener,noreferrer');
};
```

```tsx
// PublicFlowPage – ramo de erro
<div className="flex-1 flex items-center justify-center flex-col gap-3 px-6 text-center">
  <p className="text-lg font-semibold text-foreground">Bot não encontrado</p>
  <p className="text-sm text-muted-foreground">{error}</p>
  <p className="text-xs text-muted-foreground/70">
    slug: <code>{slug}</code> · id: <code>{publicId}</code>
  </p>
  <Button variant="outline" size="sm" onClick={() => location.reload()}>
    Tentar novamente
  </Button>
</div>
```

## Resultado esperado

- Botão ↗ no diálogo Publicar abre o bot em nova aba com URL `https://id-preview--<id>.lovable.app/<slug>/flow/<publicId>` que funciona tanto dentro quanto fora do preview Lovable.
- Se ainda houver erro de "não encontrado", a tela mostra slug + publicId tentados e o que checar.
- Link copiado pode ser compartilhado fora do Lovable e abre o bot publicado.