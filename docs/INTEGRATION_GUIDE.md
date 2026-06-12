# Documentação Técnica: Integração Zailom Flow x Zailom Booking

Este documento descreve a arquitetura híbrida do **Zailom Flow**, permitindo seu funcionamento como produto independente ou como módulo gerenciado pelo **Zailom Booking**.

---

## 1. Visão Geral da Arquitetura

O Zailom Flow opera em dois modos:
- **Modo Flow (Nativo):** Gestão completa de ciclo de vida, billing e limites interna.
- **Modo Booking (Gerenciado):** O Booking atua como "Master Tenant", provisionando contas e definindo limites via API/Edge Functions.

### Campos de Controle (Tabela `profiles`)
- `embed_source`: Identifica a origem da conta (ex: `'booking'`). Se nulo, a conta é nativa do Flow.
- `embed_company_id`: ID único da empresa no sistema de origem.
- `embed_plan_tier`: Tier de plano definido pelo sistema mestre (`starter`, `pro`, `business`, `suspended`).
- `embed_max_chatbots`, `embed_max_messages`, `embed_max_integrations`: Overrides de limites específicos para esta conta.

---

## 2. Fluxos de Integração

### 2.1. Provisionamento de Conta (`provision-account`)
Sempre que um novo cliente assina no Booking, ele deve chamar este endpoint para garantir que o acesso ao Flow esteja pronto.

**Endpoint:** `POST /functions/v1/provision-account`  
**Autenticação:** JWT HS256 assinado com `EMBED_SHARED_SECRET`.

**Payload Exemplo:**
```json
{
  "email": "cliente@exemplo.com",
  "display_name": "Minha Empresa",
  "company_id": "BK-12345",
  "embed_source": "booking",
  "embed_plan_tier": "pro",
  "limits": {
    "max_chatbots": 5,
    "max_messages": 10000,
    "max_integrations": 10
  }
}
```

**Comportamento:**
1. Verifica se o usuário já existe (por email).
2. Se não existir, cria o usuário no Auth e o Profile.
3. Se existir, atualiza os limites e o plano.
4. Retorna o `workspace_id` e a `api_key` para que o Booking possa realizar ações em nome do usuário.

### 2.2. Sincronização de Plano (`sync-embed-plan`)
Usado para upgrades, downgrades ou suspensão (inadimplência) sem necessidade de re-provisionar.

**Endpoint:** `POST /functions/v1/sync-embed-plan`  
**Payload:**
```json
{
  "company_id": "BK-12345",
  "tier": "suspended",
  "source": "booking"
}
```

---

## 3. Estrutura do Banco de Dados (Zailom Flow)

| Tabela | Função Principal | Colunas Chave |
| :--- | :--- | :--- |
| `profiles` | Perfil e Limites | `id`, `plan`, `embed_source`, `embed_plan_tier`, `embed_max_chatbots` |
| `workspaces` | Organização lógica | `id`, `name`, `slug` |
| `workspace_members` | Vínculo Usuário x Workspace | `workspace_id`, `user_id`, `role` |
| `chatbot_flows` | Definição dos bots | `id`, `workspace_id`, `published_containers` |
| `api_keys` | Acesso Programático | `workspace_id`, `key_value`, `is_active` |
| `flow_executions` | Sessões ativas de conversa | `flow_id`, `contact_id`, `variables` |

---

## 4. Segurança e Restrições (Modo Booking)

Quando `embed_source = 'booking'`:
1. **Billing Bloqueado:** A interface do Flow oculta opções de upgrade e cartões de crédito.
2. **Gestão de Plano:** Só pode ser alterada via Edge Functions autenticadas.
3. **Identidade:** O `company_id` é usado como chave de busca para garantir isolamento.

---

## 5. Ordem de Implementação Recomendada

1. **Configuração de Secrets:** Definir `EMBED_SHARED_SECRET` em ambos os ambientes.
2. **Deploy das Edge Functions:** `provision-account`, `sync-embed-plan` e `embed-plan-status`.
3. **Backfill de Metadados:** Se houver usuários antigos, atualizar `embed_source` no banco.
4. **Trigger de Cadastro:** Configurar o Booking para disparar o `provision-account` após o commit do cadastro.

---
*Gerado por Zailom Flow Architect - 12/06/2026*
