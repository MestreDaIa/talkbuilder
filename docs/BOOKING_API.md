# Booking Integration API (Zailom Flow → Zailom Booking)

API pública **read-only** do Zailom Flow, destinada exclusivamente ao consumo pelo Zailom Booking. Autenticação é feita pela API Key gerada em `Configurações → API Keys` do workspace. Todos os endpoints são escopados automaticamente ao workspace dono da chave — não é possível acessar recursos de outro workspace.

## Base URL

```
https://api-flowbuilder.zailom.com/booking-api
```

Use sempre essa URL pública profissional nos exemplos, integrações e testes. A URL interna do backend externo não precisa aparecer para os usuários.

## Autenticação

Toda requisição precisa enviar a API Key em **um** dos formatos:

```
x-api-key: <API_KEY>
```
ou
```
Authorization: Bearer <API_KEY>
```

Respostas de erro de autenticação:

| HTTP | Quando |
| ---- | ------ |
| 401  | Header ausente ou chave inválida |
| 403  | Chave desativada (`is_active = false`) |

---

## Endpoints

### `GET /health`
Ping rápido para confirmar que a API pública está online. Não exige API Key.

**200**
```json
{
  "ok": true,
  "service": "booking-api",
  "timestamp": "2026-07-05T12:00:00.000Z"
}
```

---

### `GET /workspace`
Retorna informações do workspace autenticado.

**200**
```json
{
  "workspace": {
    "id": "9b4fce4a-...",
    "slug": "testando-03",
    "name": "Empresa Teste",
    "email": "user@empresa.com",
    "status": "active",
    "plan": "pro",
    "source": "booking",
    "external_company_id": "fefb4d36-...",
    "limits": {
      "max_chatbots": 5,
      "max_messages": 5000,
      "max_integrations": 3
    },
    "created_at": "2026-06-11T20:17:10Z"
  }
}
```

---

### `GET /instances`
Lista todas as instâncias de WhatsApp do workspace.

**200**
```json
{
  "instances": [
    {
      "id": "uuid",
      "name": "Atendimento",
      "instance_name": "atendimento-01",
      "status": "connected",
      "connected": true,
      "phone_number": "5511999999999",
      "last_connected_at": "2026-07-05T10:00:00Z",
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

### `GET /instances/:id`
Detalhe de uma instância específica. `404` se a instância não pertencer ao workspace.

---

### `GET /bots`
Lista bots do workspace. Por padrão devolve apenas bots **publicados**. Para incluir rascunhos: `?published=false`.

**200**
```json
{
  "bots": [
    {
      "id": "uuid",
      "name": "Bot de Agendamento",
      "description": "Fluxo principal",
      "is_published": true,
      "is_active": true,
      "status": "published",
      "public_id": "abc123",
      "published_at": "2026-07-01T12:00:00Z",
      "updated_at": "...",
      "created_at": "..."
    }
  ]
}
```

`status` pode ser: `published`, `draft`, `inactive`.

### `GET /bots/:id`
Detalhe de um bot específico (inclui `settings`). `404` se o bot não pertencer ao workspace.

---

## Códigos HTTP

| Código | Significado |
| ------ | ----------- |
| 200 | OK |
| 401 | API Key ausente ou inválida |
| 403 | API Key desativada |
| 404 | Recurso não encontrado (ou não pertence ao workspace) |
| 500 | Erro interno |

## Regras de segurança

- Toda leitura descobre o workspace **exclusivamente** a partir da API Key — nenhum parâmetro do cliente é usado para determinar escopo.
- Não há endpoints de escrita nesta API. Provisionamento e sincronização de planos continuam nas edge functions existentes (`provision-account`, `sync-embed-plan`).
- `last_used_at` da API Key é atualizado a cada request bem-sucedida.
