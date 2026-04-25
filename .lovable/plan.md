## Diagnóstico (descoberta importante)

Comparei lado-a-lado seu projeto com o **flow-appoint**:

| Item | flow-appoint | talkbuilder (este projeto) |
|---|---|---|
| Stack | Vite + React + react-router-dom | **Idêntico** |
| `BrowserRouter` montado | sim | sim |
| Config Vite | padrão | padrão |
| `vite.config.ts` | padrão SPA | padrão SPA |
| Rota `/:slug/flow/:publicId` | existe no `<Routes>` | existe no `<Routes>` |

**Os dois projetos são SPAs Vite praticamente idênticos.** Não há diferença de código que justifique um funcionar e o outro não.

Testei via `curl` direto nos domínios publicados:

```text
GET https://flow-appoint.lovable.app/teste02/flow/atendimento-personalizado
→ 200 OK  (x-deployment-id presente)  ✅ SPA fallback OK

GET https://talkbuilder.lovable.app/teste02/flow/teste-de-bot001-01
→ 404      (sem x-deployment-id)        ❌ SPA fallback NÃO está rodando

GET https://talkbuilder.lovable.app/
→ 200 OK  (x-deployment-id presente)   ✅ root carrega

GET https://talkbuilder.lovable.app/qualquer-rota-aleatoria-xyz
→ 404      (sem x-deployment-id)        ❌ qualquer caminho não-root falha
```

**Conclusão:** o SPA fallback do hosting da Lovable está quebrado **especificamente neste deployment** do `talkbuilder.lovable.app`. Qualquer rota diferente de `/` retorna 404 do Cloudflare antes de chegar no app. Por isso a única solução que funcionou foi o hash (`#`) — porque o hash nunca é enviado ao servidor.

Isso **não pode ser resolvido apenas por código**, porque a requisição nem chega ao JavaScript. É preciso forçar uma nova publicação para regenerar o deployment com o fallback funcionando — exatamente como funciona no flow-appoint.

## Plano

### 1. Reverter o workaround do hash e voltar à URL limpa
Voltar a gerar links no formato igual ao flow-appoint:

```text
https://talkbuilder.lovable.app/teste02/flow/teste-de-bot001-01
```

Arquivos a alterar:
- `src/components/chatbot/PublishDialog.tsx` → `getPublicUrl()` retorna `${baseUrl}/${slug}/flow/${publicId}` (sem `#`, sem query).
- `src/App.tsx` → remover a detecção de `publicSlug`/`publicId` por query e por hash em `HomeRoute`. A rota `/:slug/flow/:publicId` já existe no `<Routes>` e basta.
- `src/pages/public/flow/page.tsx` → remover o parsing de hash/query, voltar a usar apenas `useParams()`.
- `src/lib/publicFlowRoute.ts` → deletar (não é mais necessário).

### 2. Forçar novo deployment para reparar o SPA fallback
Depois de reverter o código, fazer uma pequena mudança "no-op" (ex: comentário em `index.html` ou pequeno ajuste de CSS) para garantir que o build gere um artefato novo, e então pedir para você clicar em **Publicar → Atualizar** novamente. O novo deployment substituirá o atual (que está com o fallback quebrado) por um deployment novo que vai se comportar como o flow-appoint.

### 3. Validar via `curl` após sua republicação
Assim que você publicar, eu rodo:
```bash
curl -I https://talkbuilder.lovable.app/teste02/flow/teste-de-bot001-01
```
Esperado: `HTTP 200` com header `x-deployment-id`. Se ainda vier 404, o problema é do lado da Lovable (hosting) e abrimos um chamado em vez de seguir tentando workarounds.

### 4. Plano B (caso a republicação NÃO conserte o fallback)
Se mesmo após uma nova publicação o `curl` continuar retornando 404 para rotas profundas, isso é um bug de infraestrutura da Lovable neste projeto específico. Nesse caso eu mantenho o workaround do hash (que já está funcionando) e te oriento a abrir um ticket no suporte da Lovable mencionando:
- Projeto ID: `a74b5844-8bce-4e28-911e-ab440ae4c4a7`
- Domínio: `talkbuilder.lovable.app`
- Sintoma: SPA fallback não retorna `index.html` em rotas profundas; apenas `/` responde 200.

## Por que isso vai funcionar

O hosting da Lovable tem SPA fallback automático (documentado). O flow-appoint comprova isso na prática — mesma stack, mesma estrutura, URL idêntica funcionando. Republicar regenera o deployment e tem alta probabilidade de restaurar o comportamento padrão do hosting.

## Detalhes técnicos

- A rota já está corretamente declarada como `<Route path="/:slug/flow/:publicId" element={<PublicFlowPage />} />` em `src/App.tsx` linha 68 — não precisa mexer nela.
- Removendo o suporte a hash, links antigos compartilhados no formato `/#/...` deixarão de funcionar. Como a feature é nova e poucos links foram distribuídos, o impacto é mínimo. Posso opcionalmente manter um shim no `HomeRoute` que detecta hash antigo e redireciona para a URL limpa — me avise se quiser.
