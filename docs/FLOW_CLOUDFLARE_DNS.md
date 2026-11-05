# DNS dedicado do Zailom Flow

O Flow não usa o wildcard do Booking como mecanismo de provisionamento. Cada workspace recebe um registro DNS individual no Cloudflare:

- Hostname: `flow-<slug>.zailom.com`
- Tipo: `CNAME`
- Destino padrão: `flow-builder.zailom.com`
- Proxy Cloudflare: ligado

O registro específico `flow-<slug>.zailom.com` tem precedência sobre o wildcard `*.zailom.com` já existente. Assim não é necessário criar um segundo wildcard (o DNS não aceita um padrão de prefixo como `flow-*.zailom.com`).

## Secrets no projeto Supabase do Flow

Crie um API Token no Cloudflare limitado à zona `zailom.com`, com permissão **Zone / DNS / Edit**. Configure os seguintes secrets no projeto `fwoescubnnagdvwasbjl`:

- `FLOW_CLOUDFLARE_API_TOKEN`: token criado para o Flow.
- `FLOW_CLOUDFLARE_ZONE_ID`: Zone ID de `zailom.com`.

Opcional:
- `FLOW_CLOUDFLARE_TARGET`: destino do CNAME. O padrão é `flow-builder.zailom.com`.

Esses valores são lidos pelas Edge Functions `provision-account` e `signup-standalone`; não são variáveis do frontend nem precisam ser expostas no container web.

## Comportamento

- Provisionamento vindo do Booking: cria/atualiza `flow-<slug>.zailom.com` e associa o hostname ao workspace da empresa.
- Cadastro standalone: cria o mesmo padrão de hostname antes de finalizar a criação da conta.
- Reexecuções atualizam o registro CNAME existente em vez de duplicá-lo.
- Domínios personalizados não são alterados por essa rotina; precisam de validação própria.
- Traefik v3 recebe os hosts `flow-*.zailom.com` no router do frontend Flow, com prioridade superior à rota padrão do frontend.

Depois de configurar os secrets, faça deploy das Edge Functions atualizadas. O redeploy do stack Flow aplica as regras Traefik do `docker-compose.yml`.
