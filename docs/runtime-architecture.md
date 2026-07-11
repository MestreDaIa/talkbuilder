# Runtime · Context Schema + Session Memory + Live Data

## Deploy manual (Supabase externo)

### 1. SQL

Rode `docs/runtime-context-schema.sql` no SQL Editor do seu projeto Supabase externo.  
É idempotente (pode reexecutar sem quebrar dados).

Cria:

| Tabela                  | Papel                                                        |
| ----------------------- | ------------------------------------------------------------ |
| `context_schema`        | Catálogo de conceitos POR bot (ex.: `especialidade`).        |
| `session_memory`        | Valores POR conversation (isolados por usuário).             |
| `skill_execution_log`   | Registro de execuções de Skills (usado por Live Data).       |
| `skill_registry`        | Cache dos endpoints do HTTP Dinâmico.                        |

RLS ligado. Edge function usa `service_role` (bypass).

### 2. Edge Functions

| Nome              | Path                                        | `verify_jwt` |
| ----------------- | ------------------------------------------- | :----------: |
| `context-manager` | `supabase/functions/context-manager/index.ts` | **false**    |
| `chatbot-runtime` | (já existente)                              | **false**    |

Deploy via Supabase CLI:

```bash
supabase functions deploy context-manager --no-verify-jwt --project-ref <SEU_PROJECT_REF>
```

Variáveis necessárias no projeto Supabase (Secrets):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Ambas já são injetadas automaticamente em qualquer projeto Supabase.

---

## Contrato do Runtime ↔ Agente IA

O Agente **nunca** manipula memória diretamente. Toda operação passa pelo Runtime,
que traduz para chamadas ao `context-manager`.

### Operações

```
POST /functions/v1/context-manager
{
  "op": "schema.list" | "schema.register"
       | "memory.get" | "memory.list" | "memory.set" | "memory.delete"
       | "skill.log" | "skill.last"   | "skill.livePending",
  "bot_id":          "string",
  "conversation_id": "string?",
  "key":             "string?",
  "value":           any?,
  "description":     "string?",
  "skill_id":        "string?",
  "skill_name":      "string?",
  "result_type":     "context | live",
  "input":           any?,
  "output":          any?,
  "since_seconds":   3600
}
```

### Fluxo "criar contexto"

```
Agente → Runtime: "quero registrar 'produtoSelecionado'"
Runtime → context-manager.schema.list(bot_id)
Runtime → Agente: lista de keys existentes
Agente escolhe reutilizar OU criar nova
Runtime → context-manager.memory.set(conversation_id, key, value)
Runtime → confirma
```

### Live Data (revalidação antes de operação crítica)

Antes de executar `POST /appointments`, `DELETE /reservation`, pagamento, etc:

```
Runtime → context-manager.skill.livePending(conversation_id)
Para cada skill retornada: reexecuta via HTTP Dinâmico
Se resultado mudou → devolve para o Agente decidir
Se manteve → prossegue com a operação crítica
```

---

## HTTP Request · Modo Dinâmico

Toggle **Modo de Operação** no node HTTP Request:

- **Genérico** → comportamento atual (100% compatível).
- **Dinâmico** → o node vira provedor de Skills:
  1. `URL Base da API` + `Analisar API` (lê OpenAPI/Swagger).
  2. Lista de endpoints descobertos → o usuário adiciona os que quer expor.
  3. Cada endpoint aceita **Importar CURL** (parser extrai método, headers,
     query, path params, body, auth automaticamente).
  4. Permissões por campo: `Authorization` / `Headers` / `Query` / `Path` /
     `Body`. Só campos autorizados podem ser alterados pelo Agente em runtime.
  5. **Testar** → mapeia resposta JSON → variáveis do flow **e/ou** chave de
     contexto (`context_key`) que vai para `session_memory` via Context Manager.
  6. Marca **Tipo de Resultado**: `Context Data` (memorizável) ou
     `Live Data` (sempre reconsultar).

O Agente envia apenas a *intenção* (`use skill X com estes parâmetros`).
Montagem, execução e mapeamento são responsabilidade exclusiva do Runtime.

---

## Sincronização Contexto → Variável

Qualquer valor da `session_memory` pode ser espelhado como variável do flow:

```
memory.get(conversation_id, "produtoSelecionado.id")
  → variables["produto_id"]
```

Isto permite que nodes Guiados (Condition, HTTP genérico, Set Variable, etc.)
usem contextos criados pelo Agente sem conhecer o Context Manager.

---

## Princípios

- Runtime **não** conhece regras de negócio (nunca sabe o que é "barbearia",
  "clínica", "restaurante").
- Toda semântica é criada dinamicamente pelo Agente IA conforme o domínio.
- Session Memory é **isolada por conversation**; Context Schema é
  **compartilhado por bot**.
- Live Data **nunca** é reaproveitado como memória permanente.
- Credenciais (Bearer, API Key) **nunca** podem ser alteradas pelo Agente
  sem permissão explícita.
