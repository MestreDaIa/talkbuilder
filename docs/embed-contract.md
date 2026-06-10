# Zailom Flow ↔ BookingFy — Contrato de Embed

Este documento descreve como o **BookingFy** embute o **Zailom Flow** dentro de
sua interface, de forma que os dois sistemas continuem sendo produtos
independentes mas trabalhem juntos quando o cliente possui ambos.

---

## 1. Modelo de operação

| Modo | Quando | Quem hospeda | Quem controla auth/billing |
|---|---|---|---|
| **Standalone** | Cliente comprou só o Zailom Flow | `app.talkmap.com.br` | Zailom Flow |
| **Embedded** | Cliente comprou BookingFy (Zailom Flow vem junto) | `bookingfy.com.br` via `<iframe>` | BookingFy |

No modo embedded, algumas seções do Zailom Flow são escondidas porque o BookingFy
já oferece equivalente: pagamentos, perfil do usuário, dados da empresa,
gestão de plano e o card de "integração com BookingFy" (não faz sentido
integrar com quem já é o host).

---

## 2. Arquitetura de hospedagem (Docker)

```
VPS
├── Traefik (reverse proxy + SSL)
├── 📦 bookingfy           → bookingfy.com.br
├── 📦 talkmap-builder     → app.talkmap.com.br      (este projeto)
└── 📦 talkmap-viewer      → chat.talkmap.com.br/{slug}/{bot}
```

Cada container é deployado independentemente. O BookingFy aponta o iframe
para `app.talkmap.com.br/embed`.

---

## 3. Fluxo de embed

```
┌──────────────┐                       ┌────────────────┐
│  BookingFy   │                       │    Zailom Flow     │
│  (parent)    │                       │   (iframe)     │
└──────┬───────┘                       └────────┬───────┘
       │                                        │
       │  1. Usuário clica "Chatbot → Zailom Flow"  │
       │                                        │
       │  2. Gera JWT HS256 (5min, claims abaixo)
       │                                        │
       │  3. Renderiza:                         │
       │     <iframe src="app.talkmap.com.br/embed
       │              #embed_token=eyJ...&host=bookingfy">
       │ ─────────────────────────────────────► │
       │                                        │
       │                            4. Lê token do hash,
       │                               decodifica claims,
       │                               limpa hash da URL
       │                                        │
       │ ◄─ postMessage("talkmap:embed:ready") ─│
       │                                        │
       │ ── postMessage("talkmap:embed:init", { token }) ─►
       │                                        │
       │                            5. (opcional) atualiza
       │                               sessão se necessário
       │                                        │
```

### Por que token no hash (`#embed_token=...`) e não na query?

- Hash não é enviado ao servidor (não aparece em access logs)
- Não é enviado em headers `Referer` quando o iframe faz outra requisição
- Zailom Flow limpa o hash via `history.replaceState` logo após ler

---

## 4. Contrato do JWT

### Algoritmo
**HS256** com chave simétrica compartilhada (`EMBED_SHARED_SECRET`).

A chave fica:
- No BookingFy: variável de ambiente do container
- No Zailom Flow: variável de ambiente do container `talkmap-builder`

Rotação: alterar a chave nos dois containers e fazer redeploy. Considerar
janela de aceitação dual durante a rotação se houver sessões ativas.

### Claims

```json
{
  "iss": "bookingfy",
  "aud": "talkmap",
  "sub": "user_uuid",
  "exp": 1234567890,
  "iat": 1234567000,

  "tenantId": "tenant_uuid",
  "userId":   "user_uuid",
  "slug":     "minha-empresa",
  "plan":     "pro",

  "featureOverrides": {
    "showPlanLimitsBanner": true
  }
}
```

| Claim | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `iss` | string | ✅ | Sempre `"bookingfy"` |
| `aud` | string | ✅ | Sempre `"talkmap"` |
| `sub` | string | ✅ | ID do usuário no BookingFy |
| `exp` | number | ✅ | Timestamp de expiração (recomendado: +5min) |
| `iat` | number | ✅ | Timestamp de emissão |
| `tenantId` | string | ✅ | ID da conta/empresa no BookingFy |
| `userId` | string | ✅ | Mesmo valor de `sub` |
| `slug` | string | ✅ | Slug da empresa (usado em URLs do viewer) |
| `plan` | string | ✅ | `"starter"` \| `"pro"` \| `"business"` |
| `featureOverrides` | object | ❌ | Permite ligar/desligar features específicas |

---

## 5. Validação no servidor (Zailom Flow)

A validação real (assinatura, expiração, audience) **deve** acontecer numa
server function do Zailom Flow, não no client. O `EmbedContext` no front só lê
claims pra UI condicional — nunca confia neles pra decisões de segurança.

```ts
// pseudo-código de uma server function
import jwt from "jsonwebtoken";

const claims = jwt.verify(token, process.env.EMBED_SHARED_SECRET, {
  algorithms: ["HS256"],
  issuer: "bookingfy",
  audience: "talkmap",
});
```

Após validar, o Zailom Flow troca o JWT por uma sessão própria (cookie httpOnly,
duração ~1h) pra evitar revalidar o JWT em todo request.

---

## 6. PostMessage API

### Origins permitidas
Zailom Flow só aceita mensagens das origens listadas em `EmbedContext.tsx`:
- `https://bookingfy.com.br`
- `https://www.bookingfy.com.br`
- `http://localhost:*` (dev)

### Mensagens

| Direção | `type` | Payload | Quando |
|---|---|---|---|
| Zailom Flow → Parent | `talkmap:embed:ready` | — | Iframe carregou, pronto pra receber token |
| Parent → Zailom Flow | `talkmap:embed:init` | `{ token: string }` | Injeta/atualiza JWT |
| Parent → Zailom Flow | `talkmap:embed:logout` | — | Força sair do modo embed |
| Zailom Flow → Parent | `talkmap:embed:resize` | `{ height: number }` | (futuro) ajustar altura do iframe |
| Zailom Flow → Parent | `talkmap:embed:navigate` | `{ path: string }` | (futuro) avisar mudança de rota |

---

## 7. Feature flags por modo

| Flag | Standalone | Embedded (default) |
|---|:-:|:-:|
| `showHeader` | ✅ | ❌ |
| `showProfile` | ✅ | ❌ |
| `showBilling` | ✅ | ❌ |
| `showCompanyTab` | ✅ | ❌ |
| `showBookingfyIntegrationCard` | ✅ | ❌ |
| `showPlanLimitsBanner` | ✅ | ❌ |
| `showSignup` | ✅ | ❌ |
| `allowLogout` | ✅ | ❌ |

Sempre visível em ambos os modos: Workspace, bots, fluxos, integrações
(WhatsApp/Telegram/Instagram), API keys, notificações, segurança.

O BookingFy pode sobrescrever via `featureOverrides` no JWT se quiser
liberar algo específico (ex: mostrar banner de limites mesmo em embed).

---

## 8. URLs

| Propósito | URL |
|---|---|
| Builder standalone | `https://app.talkmap.com.br` |
| Builder embedded   | `https://app.talkmap.com.br/embed` (em iframe) |
| Chat público       | `https://chat.talkmap.com.br/{slug}/{bot-slug}` |
| Chat público (BookingFy) | `https://bookingfy.com.br/{slug}/chat/{bot-slug}` |

---

## 9. Zailom Booking (host adicional)

Mesma arquitetura do BookingFy, com claims diferentes:

```json
{
  "iss": "flow-appoint",
  "aud": "builder-flow-api",
  "company_id": "<uuid>",
  "workspace_slug": "<string>",
  "user_email": "<string>",
  "exp": 1234567890
}
```

### URL do iframe
```
https://app.talkmap.com.br/#embed_token=<JWT>&host=flow-appoint
```
(O parâmetro `host` é opcional — se omitido, o builder assume `flow-appoint`.)

### Origens postMessage permitidas
- `https://flow-appoint.lovable.app`
- `https://*.lovable.app` (previews)

### Validação atual (LIMITAÇÃO)
Este projeto roda em Vite + HashRouter, **sem servidor próprio**. A
assinatura HS256 do JWT NÃO é verificada — apenas issuer/audience/exp são
checados no client (`src/context/EmbedContext.tsx`).

Para validação real, suba um backend (Node/Edge Function) e:

1. Configure `VITE_BACKEND_URL` apontando pra ele.
2. Implemente `POST {VITE_BACKEND_URL}/api/embed/validate` que verifica
   o JWT com `EMBED_SHARED_SECRET` (HS256) e devolve a sessão.
3. `src/lib/embedValidation.ts` já tem o cliente pronto — chame
   `validateEmbedTokenRemote(token)` no `EmbedProvider` antes de aceitar
   a sessão.

O secret `EMBED_SHARED_SECRET` já está cadastrado neste projeto (Lovable
Cloud), pronto pra ser injetado no backend quando ele existir.

### Endpoint `/api/keys/validate` (também requer backend)

Tabela já modelada em `docs/supabase-setup.sql` (seção API Keys).
Cliente em `src/lib/apiKeysClient.ts`.
