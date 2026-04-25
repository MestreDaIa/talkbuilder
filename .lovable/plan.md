## Objetivo

Reativar temporariamente o `HashRouter` para que os links públicos dos bots voltem a funcionar imediatamente (`/#/slug/flow/publicId`), sem depender do SPA fallback do hosting que está quebrado para o projeto `talkbuilder.lovable.app`.

A intenção é deixar o código pronto para voltar a `BrowserRouter` (URLs limpas) com uma única troca de uma linha, assim que o suporte da Lovable corrigir o fallback.

## Mudanças

### 1. `src/main.tsx` — trocar router
- Substituir `BrowserRouter` por `HashRouter` (de `react-router-dom`).
- Adicionar um comentário acima da importação explicando que é temporário enquanto o SPA fallback do hosting não é restaurado, e como reverter.

### 2. `src/components/chatbot/PublishDialog.tsx` — gerar URL com `#`
- Ajustar `getPublicUrl()` para retornar `${baseUrl}/#/${slug}/flow/${publicId}` em vez de `${baseUrl}/${slug}/flow/${publicId}`.
- Manter o `encodeURIComponent` em slug e publicId.
- Comentário curto indicando que o `#` é temporário.

### 3. `src/pages/public/flow/page.tsx` — sem mudanças
- O componente continua funcionando igual: `useParams()` lê `slug` e `publicId` normalmente porque o `HashRouter` reconhece a mesma definição de rota `/:slug/flow/:publicId` no `App.tsx`.

### 4. `src/App.tsx` — sem mudanças
- A definição `<Route path="/:slug/flow/:publicId" />` segue idêntica.

## Como reverter (quando o suporte arrumar)

Apenas duas linhas:
1. Em `src/main.tsx`: trocar `HashRouter` de volta por `BrowserRouter`.
2. Em `PublishDialog.tsx`: remover o `/#` da função `getPublicUrl()`.

Vou deixar comentários `// TEMP: hash router` em ambos os pontos para facilitar localizar.

## Resultado esperado

- Links publicados ficam no formato:
  `https://talkbuilder.lovable.app/#/teste02/flow/atendimento-personalizado`
- Funcionam imediatamente em qualquer hosting (incluindo o atual com fallback quebrado), porque o servidor só recebe `/` e o React assume o resto.
- Botões "copiar URL" e "abrir preview" no `PublishDialog` passam a copiar/abrir já no formato com `#`.
- Links antigos sem `#` que o usuário tenha compartilhado continuarão dando 404 enquanto o fallback não for arrumado — não há como contornar isso do lado do app.