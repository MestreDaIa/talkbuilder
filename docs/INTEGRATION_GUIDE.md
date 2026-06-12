# Documentação Técnica de Integração: Zailom Flow ↔ Zailom Booking

Este guia detalha como sincronizar os limites e planos do **Zailom Booking** (Sistema Mestre) com o **Zailom Flow** (Construtor de Bots).

---

## 1. Conceito de Sincronização
O Zailom Flow não gerencia o billing de usuários vindos do Booking. Ele apenas obedece aos limites enviados via API. A sincronização deve ocorrer em dois momentos:
1. **No Cadastro:** Quando a empresa é criada no Booking.
2. **Na Mudança de Plano:** Quando o Admin do Booking altera o plano ou limites manualmente.

---

## 2. Endpoints de Sincronização

### 2.1. Provisionamento e Atualização Completa (`provision-account`)
Deve ser chamado no primeiro acesso ou quando houver mudança estrutural (como troca de e-mail).

**URL:** `https://[SEU-PROJETO].supabase.co/functions/v1/provision-account`
**Método:** `POST`
**Headers:** `Authorization: Bearer <JWT_HS256>`

**Payload:**
```json
{
  "email": "fernandiimsoua@gmail.com",
  "display_name": "Nome da Empresa",
  "company_id": "9b4fce4a-05f7-494d-aaf8-c2159244e99d",
  "embed_source": "booking",
  "embed_plan_tier": "pro",
  "limits": {
    "max_chatbots": 5,
    "max_messages": 5000,
    "max_integrations": 3
  }
}
```

### 2.2. Atualização Rápida de Plano/Limites (`sync-embed-plan`)
Use este endpoint para forçar a atualização de limites sem precisar enviar a senha ou dados de cadastro novamente.

**URL:** `https://[SEU-PROJETO].supabase.co/functions/v1/sync-embed-plan`
**Método:** `POST`

**Payload:**
```json
{
  "company_id": "9b4fce4a-05f7-494d-aaf8-c2159244e99d",
  "source": "booking",
  "tier": "pro",
  "limits": {
    "max_chatbots": 10,
    "max_messages": 20000,
    "max_integrations": 5
  }
}
```

---

## 3. Como Gerar o Token de Segurança (JWT HS256)

O Booking deve assinar um token usando a chave `EMBED_SHARED_SECRET` (configurada nos dois sistemas).

**Algoritmo:** HS256
**Payload Sugerido:**
```json
{
  "iss": "zailom-booking",
  "iat": 1718190000,
  "exp": 1718193600
}
```

---

## 4. Mapeamento de Colunas no Banco (Zailom Flow)

Se você precisar verificar via SQL no banco do Flow, as colunas estão na tabela `profiles`:

| Coluna | Descrição |
| :--- | :--- |
| `embed_source` | Deve ser sempre `'booking'` |
| `embed_company_id` | O ID da empresa vindo do Booking |
| `embed_plan_tier` | `starter`, `pro`, `business` ou `suspended` |
| `embed_max_chatbots` | Quantidade máxima de bots permitidos |
| `embed_max_messages` | Quantidade máxima de mensagens por mês |
| `embed_max_integrations` | Quantidade máxima de integrações (WhatsApp, etc) |

**Exemplo de Query de Verificação:**
```sql
SELECT email, embed_plan_tier, embed_max_chatbots 
FROM public.profiles 
WHERE email = 'fernandiimsoua@gmail.com';
```

---

## 5. Resolução de Problemas (FAQ)

**1. Mudei no Booking mas não atualizou no Flow.**
* O Booking **PRECISA** fazer um disparo HTTP para um dos endpoints acima sempre que houver mudança. A atualização não é automática via banco de dados pois os bancos são isolados.

**2. O endpoint retorna 401 Unauthorized.**
* Verifique se o `EMBED_SHARED_SECRET` no Flow é exatamente o mesmo usado para assinar o JWT no Booking.

**3. O plano aparece como 'starter' mesmo eu enviando 'pro'.**
* Verifique se a chave `embed_plan_tier` está sendo enviada corretamente no JSON (veja o payload no item 2.1).

---
*Documentação atualizada em 12/06/2026 para refletir suporte a limites dinâmicos.*
