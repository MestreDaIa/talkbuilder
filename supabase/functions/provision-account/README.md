# `provision-account` — provisionamento de conta vindo do Zailom Booking

Edge function (Deno) que cria/reaproveita uma conta no builder-flow-api
(Zailom Flow) a partir dos dados de signup do **Zailom Booking**.

- Hospedagem: **Supabase externo** já configurado pelo builder
  (`VITE_SUPABASE_URL`).
- Auth: **JWT HS256** assinado com `EMBED_SHARED_SECRET` (mesmo secret que o
  embed já usa).
- Idempotente: se o email já existir, retorna o `user_id` existente em vez de
  erro.

## Pré-requisitos

No projeto Supabase externo (onde mora o banco do builder):

1. `EMBED_SHARED_SECRET` cadastrado em **Project Settings → Functions → Secrets**
   com o **mesmo valor** que está no Zailom Booking.
2. `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` — injetados automaticamente
   pelo Supabase nas edge functions.
3. Schema do `docs/supabase-setup.sql` aplicado (precisa do trigger
   `handle_new_user` que lê `slug`/`plan`/`display_name` de `raw_user_meta_data`).

## Deploy

Pré-requisito: [Supabase CLI](https://supabase.com/docs/guides/cli) instalado
e logado.

```bash
# uma vez, no diretório raiz do builder
supabase link --project-ref <SEU_PROJECT_REF>

# cadastrar o secret (se ainda não existir lá)
supabase secrets set EMBED_SHARED_SECRET="<mesmo-secret-do-flow-appoint>"

# deploy. --no-verify-jwt porque NÓS validamos nosso próprio JWT compartilhado
# (não o JWT do Supabase Auth, que não se aplica aqui).
supabase functions deploy provision-account --no-verify-jwt
```

URL final:
`https://<SEU_PROJECT_REF>.supabase.co/functions/v1/provision-account`

## Contrato

### Request

`POST /functions/v1/provision-account`

Headers:
```
Authorization: Bearer <JWT HS256>
Content-Type: application/json
```

JWT (assinado com `EMBED_SHARED_SECRET`, HS256):
```json
{
  "iss": "flow-appoint",
  "aud": "builder-flow-api",
  "purpose": "provision",
  "iat": 1730000000,
  "exp": 1730000060
}
```

> `exp` recomendado: **60s** após `iat`. Token de uso único, descartado pelo
> builder após validar.

Body:
```json
{
  "email": "fulano@empresa.com",
  "password": "<senha gerada ou igual à do flow-appoint>",
  "slug": "minha-empresa",
  "display_name": "Fulano de Tal",
  "plan": "starter",
  "company_id": "<uuid da empresa no flow-appoint>",
  "metadata": { "anything": "extra" }
}
```

| Campo | Obrigatório | Notas |
|---|---|---|
| `email` | ✅ | Lowercased no servidor |
| `password` | ✅ | 8–72 chars |
| `slug` | ✅ | `^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$` |
| `display_name` | ❌ | Default: parte antes do `@` do email |
| `plan` | ❌ | `starter` \| `pro` \| `business` (default `starter`) |
| `company_id` | ❌ | Vai pra `user_metadata.flow_appoint_company_id` |
| `metadata` | ❌ | Merge em `user_metadata` |

### Response

`200 OK`
```json
{
  "ok": true,
  "created": true,
  "user_id": "uuid",
  "email": "fulano@empresa.com",
  "slug": "minha-empresa"
}
```
`created: false` quando o usuário já existia (idempotente).

Erros:
- `400` — body inválido
- `401` — JWT ausente, expirado, assinatura errada, ou claims errados
- `500` — falha do Supabase ou config

## Exemplo: chamada do Zailom Booking (Node)

```ts
import jwt from "jsonwebtoken";

const provisionToken = jwt.sign(
  { iss: "flow-appoint", aud: "builder-flow-api", purpose: "provision" },
  process.env.EMBED_SHARED_SECRET!,
  { algorithm: "HS256", expiresIn: "60s" },
);

const res = await fetch(
  "https://<PROJECT_REF>.supabase.co/functions/v1/provision-account",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provisionToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: user.email,
      password: generatedPassword,    // ou a mesma usada no flow-appoint
      slug: company.slug,
      display_name: user.name,
      plan: "starter",
      company_id: company.id,
    }),
  },
);

const result = await res.json();
if (!result.ok) throw new Error(result.error);
// result.user_id agora é o ID do usuário no builder
```

## Notas de segurança

- O `EMBED_SHARED_SECRET` **nunca** sai do servidor do Zailom Booking. O JWT é
  gerado server-side e enviado direto pra essa function.
- Use `expiresIn: 60s` no JWT pra reduzir janela de replay. Pra hardening
  adicional, gere um `jti` único e mantenha uma blacklist curta no
  Zailom Booking, ou inclua `nonce` + cache de 1min do lado do builder.
- A function roda com **service role key** — RLS é ignorada. Mantenha o
  endpoint protegido pela validação de JWT acima.
- CORS: por padrão libera `https://flow-appoint.lovable.app` e qualquer
  `*.lovable.app`. Edite `ALLOWED_ORIGINS` em `index.ts` pra produção.
