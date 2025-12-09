# SmarterChat - Especificação de APIs

## 1. Visão Geral da API

**Base URL**: `https://api.smarterchat.com/v1`

**Autenticação**: Bearer Token (JWT)

**Formato**: JSON

**Versionamento**: Via URL path (`/v1`, `/v2`)

## 2. Autenticação

### 2.1 POST /auth/register

Registra uma nova organização e usuário admin.

**Request:**
```json
{
  "organization": {
    "name": "Minha Empresa",
    "slug": "minha-empresa"
  },
  "user": {
    "email": "admin@empresa.com",
    "password": "SenhaSegura123!",
    "full_name": "João Silva"
  }
}
```

**Response (201):**
```json
{
  "organization": {
    "id": "uuid",
    "name": "Minha Empresa",
    "slug": "minha-empresa"
  },
  "user": {
    "id": "uuid",
    "email": "admin@empresa.com",
    "full_name": "João Silva",
    "role": "admin"
  },
  "tokens": {
    "access_token": "eyJhbGc...",
    "refresh_token": "eyJhbGc...",
    "expires_in": 3600
  }
}
```

### 2.2 POST /auth/login

Autentica um usuário.

**Request:**
```json
{
  "email": "admin@empresa.com",
  "password": "SenhaSegura123!"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "admin@empresa.com",
    "full_name": "João Silva",
    "role": "admin",
    "organization_id": "uuid"
  },
  "tokens": {
    "access_token": "eyJhbGc...",
    "refresh_token": "eyJhbGc...",
    "expires_in": 3600
  }
}
```

### 2.3 POST /auth/refresh

Renova o access token.

**Request:**
```json
{
  "refresh_token": "eyJhbGc..."
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGc...",
  "expires_in": 3600
}
```

### 2.4 POST /auth/logout

Invalida os tokens.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response (204):** No content

## 3. Agents

### 3.1 GET /agents

Lista todos os agentes da organização.

**Query Parameters:**
- `page` (number): Página (default: 1)
- `limit` (number): Itens por página (default: 20)
- `status` (string): Filtrar por status (active, inactive)

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Assistente de Vendas",
      "description": "Agente para qualificação de leads",
      "avatar_url": "https://...",
      "personality": "Amigável e profissional",
      "tone": "professional",
      "status": "active",
      "is_published": true,
      "total_conversations": 150,
      "avg_response_time_ms": 1200,
      "satisfaction_score": 4.5,
      "created_at": "2025-01-15T10:00:00Z",
      "updated_at": "2025-01-20T15:30:00Z"
    }
  ],
  "meta": {
    "total": 5,
    "page": 1,
    "limit": 20,
    "total_pages": 1
  }
}
```

### 3.2 POST /agents

Cria um novo agente.

**Request:**
```json
{
  "name": "Assistente de Vendas",
  "description": "Agente para qualificação de leads",
  "personality": "Você é um assistente amigável e profissional...",
  "tone": "professional",
  "objective": "Qualificar leads e agendar reuniões",
  "system_message": "Você é um assistente de vendas...",
  "custom_scripts": [
    {
      "name": "Validar Email",
      "content": "if (email.includes('@')) { ... }"
    }
  ],
  "openai_api_key": "sk-...",
  "model": "gpt-4-turbo-preview",
  "temperature": 0.7,
  "max_tokens": 1000,
  "languages": ["pt-BR", "en"],
  "default_language": "pt-BR",
  "handoff_rules": {
    "keywords": ["falar com humano", "atendente"],
    "sentiment_threshold": -0.5
  }
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "name": "Assistente de Vendas",
  "status": "active",
  "created_at": "2025-01-15T10:00:00Z"
}
```

### 3.3 GET /agents/:id

Obtém detalhes de um agente.

**Response (200):**
```json
{
  "id": "uuid",
  "name": "Assistente de Vendas",
  "description": "Agente para qualificação de leads",
  "avatar_url": "https://...",
  "personality": "Você é um assistente amigável...",
  "tone": "professional",
  "objective": "Qualificar leads e agendar reuniões",
  "system_message": "Você é um assistente de vendas...",
  "custom_scripts": [...],
  "context_data": {},
  "model": "gpt-4-turbo-preview",
  "temperature": 0.7,
  "max_tokens": 1000,
  "languages": ["pt-BR", "en"],
  "default_language": "pt-BR",
  "handoff_rules": {...},
  "lead_qualification_rules": {...},
  "status": "active",
  "is_published": true,
  "total_conversations": 150,
  "created_at": "2025-01-15T10:00:00Z"
}
```

### 3.4 PATCH /agents/:id

Atualiza um agente.

**Request:**
```json
{
  "name": "Novo Nome",
  "system_message": "Nova mensagem de sistema...",
  "temperature": 0.8
}
```

**Response (200):** Retorna o agente atualizado

### 3.5 DELETE /agents/:id

Deleta um agente (soft delete).

**Response (204):** No content

### 3.6 POST /agents/:id/publish

Publica/despublica um agente.

**Request:**
```json
{
  "is_published": true
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "is_published": true
}
```

## 4. Channels

### 4.1 GET /channels

Lista todos os canais configurados.

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "whatsapp",
      "name": "WhatsApp Principal",
      "phone_number": "+5511999999999",
      "agent_id": "uuid",
      "status": "active",
      "last_sync_at": "2025-01-20T10:00:00Z",
      "created_at": "2025-01-15T10:00:00Z"
    }
  ]
}
```

### 4.2 POST /channels

Configura um novo canal.

**Request (WhatsApp):**
```json
{
  "type": "whatsapp",
  "name": "WhatsApp Principal",
  "agent_id": "uuid",
  "config": {
    "phone_number_id": "123456789",
    "business_account_id": "987654321",
    "access_token": "EAAx..."
  }
}
```

**Request (Instagram):**
```json
{
  "type": "instagram",
  "name": "Instagram Oficial",
  "agent_id": "uuid",
  "config": {
    "instagram_account_id": "123456789",
    "access_token": "EAAx..."
  }
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "type": "whatsapp",
  "name": "WhatsApp Principal",
  "status": "active",
  "webhook_url": "https://api.smarterchat.com/webhooks/whatsapp/uuid"
}
```

### 4.3 POST /channels/:id/test

Testa a conexão do canal.

**Response (200):**
```json
{
  "success": true,
  "message": "Conexão estabelecida com sucesso",
  "details": {
    "phone_number": "+5511999999999",
    "verified": true
  }
}
```

### 4.4 DELETE /channels/:id

Remove um canal.

**Response (204):** No content

## 5. Conversations

### 5.1 GET /conversations

Lista conversas com filtros.

**Query Parameters:**
- `status` (string): active, waiting, closed
- `mode` (string): ai, human, hybrid
- `assigned_to` (uuid): Filtrar por consultor
- `channel_id` (uuid): Filtrar por canal
- `page` (number)
- `limit` (number)

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "contact_name": "Maria Silva",
      "contact_identifier": "+5511988888888",
      "status": "active",
      "mode": "ai",
      "channel": {
        "id": "uuid",
        "type": "whatsapp",
        "name": "WhatsApp Principal"
      },
      "agent": {
        "id": "uuid",
        "name": "Assistente de Vendas"
      },
      "lead": {
        "id": "uuid",
        "name": "Maria Silva",
        "temperature": "hot"
      },
      "assigned_to": null,
      "message_count": 15,
      "last_message": "Gostaria de saber mais sobre os planos",
      "last_message_at": "2025-01-20T15:30:00Z",
      "created_at": "2025-01-20T14:00:00Z"
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "limit": 20
  }
}
```

### 5.2 GET /conversations/:id

Obtém detalhes de uma conversa.

**Response (200):**
```json
{
  "id": "uuid",
  "contact_name": "Maria Silva",
  "contact_identifier": "+5511988888888",
  "contact_metadata": {
    "profile_pic": "https://..."
  },
  "status": "active",
  "mode": "ai",
  "channel_id": "uuid",
  "agent_id": "uuid",
  "lead_id": "uuid",
  "assigned_to_user_id": null,
  "context": {
    "interesse": "Plano Premium",
    "empresa": "Tech Corp"
  },
  "summary": "Cliente interessado em plano premium...",
  "sentiment": "positive",
  "priority": "high",
  "tags": ["vendas", "premium"],
  "message_count": 15,
  "created_at": "2025-01-20T14:00:00Z"
}
```

### 5.3 GET /conversations/:id/messages

Lista mensagens de uma conversa.

**Query Parameters:**
- `page` (number)
- `limit` (number)
- `before` (timestamp): Mensagens antes de

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "sender_type": "contact",
      "content": "Olá, gostaria de informações sobre planos",
      "content_type": "text",
      "direction": "inbound",
      "status": "read",
      "created_at": "2025-01-20T14:00:00Z"
    },
    {
      "id": "uuid",
      "sender_type": "ai",
      "content": "Olá! Temos 3 planos disponíveis...",
      "content_type": "text",
      "direction": "outbound",
      "status": "delivered",
      "ai_generated": true,
      "ai_confidence": 0.95,
      "created_at": "2025-01-20T14:00:05Z"
    }
  ],
  "meta": {
    "total": 15,
    "page": 1,
    "limit": 50
  }
}
```

### 5.4 POST /conversations/:id/messages

Envia uma mensagem (consultor assumindo).

**Request:**
```json
{
  "content": "Olá! Vou te ajudar com isso.",
  "content_type": "text"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "content": "Olá! Vou te ajudar com isso.",
  "sender_type": "user",
  "created_at": "2025-01-20T15:00:00Z"
}
```

### 5.5 POST /conversations/:id/assign

Atribui conversa a um consultor.

**Request:**
```json
{
  "user_id": "uuid"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "assigned_to_user_id": "uuid",
  "mode": "human"
}
```

### 5.6 POST /conversations/:id/handoff

Transfere conversa de volta para IA.

**Response (200):**
```json
{
  "id": "uuid",
  "assigned_to_user_id": null,
  "mode": "ai"
}
```

### 5.7 PATCH /conversations/:id/status

Atualiza status da conversa.

**Request:**
```json
{
  "status": "closed"
}
```

**Response (200):** Retorna conversa atualizada

## 6. Leads (CRM)

### 6.1 GET /leads

Lista leads com filtros.

**Query Parameters:**
- `status` (string): new, contacted, qualified, converted, lost
- `temperature` (string): hot, warm, cold
- `assigned_to` (uuid)
- `search` (string): Busca por nome, email, telefone
- `page`, `limit`

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Maria Silva",
      "email": "maria@empresa.com",
      "phone": "+5511988888888",
      "status": "qualified",
      "temperature": "hot",
      "score": 85,
      "source": "whatsapp",
      "assigned_to": {
        "id": "uuid",
        "full_name": "João Consultor"
      },
      "company": "Tech Corp",
      "interest": "Plano Premium",
      "total_interactions": 5,
      "last_interaction_at": "2025-01-20T15:00:00Z",
      "created_at": "2025-01-20T14:00:00Z"
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

### 6.2 GET /leads/:id

Obtém detalhes de um lead.

**Response (200):**
```json
{
  "id": "uuid",
  "name": "Maria Silva",
  "email": "maria@empresa.com",
  "phone": "+5511988888888",
  "status": "qualified",
  "temperature": "hot",
  "score": 85,
  "source": "whatsapp",
  "assigned_to_user_id": "uuid",
  "company": "Tech Corp",
  "position": "CTO",
  "interest": "Plano Premium",
  "notes": "Cliente muito interessado...",
  "custom_fields": {
    "numero_funcionarios": "50-100",
    "orcamento": "R$ 10.000/mês"
  },
  "tags": ["premium", "tech"],
  "total_interactions": 5,
  "last_interaction_at": "2025-01-20T15:00:00Z",
  "conversion_probability": 0.85,
  "created_at": "2025-01-20T14:00:00Z"
}
```

### 6.3 POST /leads

Cria um lead manualmente.

**Request:**
```json
{
  "name": "Pedro Santos",
  "email": "pedro@empresa.com",
  "phone": "+5511977777777",
  "company": "StartupXYZ",
  "interest": "Plano Starter",
  "source": "website",
  "custom_fields": {
    "orcamento": "R$ 5.000/mês"
  }
}
```

**Response (201):** Retorna o lead criado

### 6.4 PATCH /leads/:id

Atualiza um lead.

**Request:**
```json
{
  "status": "converted",
  "temperature": "hot",
  "notes": "Cliente fechou contrato!"
}
```

**Response (200):** Retorna lead atualizado

### 6.5 POST /leads/:id/activities

Adiciona uma atividade ao lead.

**Request:**
```json
{
  "type": "call",
  "title": "Ligação de follow-up",
  "description": "Cliente confirmou interesse no plano premium",
  "metadata": {
    "duration_minutes": 15
  }
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "type": "call",
  "title": "Ligação de follow-up",
  "created_at": "2025-01-20T16:00:00Z"
}
```

### 6.6 GET /leads/:id/activities

Lista atividades de um lead.

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "note",
      "title": "Primeira conversa",
      "description": "Cliente interessado em plano premium",
      "user": {
        "id": "uuid",
        "full_name": "João Consultor"
      },
      "created_at": "2025-01-20T14:30:00Z"
    }
  ]
}
```

## 7. Webhooks

### 7.1 GET /webhooks

Lista webhooks configurados.

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Notificar CRM",
      "url": "https://meucrm.com/webhook",
      "method": "POST",
      "events": ["lead.created", "lead.qualified"],
      "status": "active",
      "last_triggered_at": "2025-01-20T15:00:00Z"
    }
  ]
}
```

### 7.2 POST /webhooks

Cria um webhook.

**Request:**
```json
{
  "name": "Notificar CRM",
  "url": "https://meucrm.com/webhook",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer token123"
  },
  "events": ["lead.created", "lead.qualified"],
  "secret": "webhook_secret_123"
}
```

**Response (201):** Retorna webhook criado

### 7.3 POST /webhooks/:id/test

Testa um webhook.

**Response (200):**
```json
{
  "success": true,
  "status_code": 200,
  "response_body": "OK",
  "duration_ms": 150
}
```

### 7.4 GET /webhooks/:id/logs

Lista logs de execução do webhook.

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "event_type": "lead.created",
      "status_code": 200,
      "duration_ms": 150,
      "attempt_number": 1,
      "created_at": "2025-01-20T15:00:00Z"
    }
  ]
}
```

## 8. Analytics

### 8.1 GET /analytics/dashboard

Obtém métricas do dashboard.

**Query Parameters:**
- `start_date` (date)
- `end_date` (date)
- `agent_id` (uuid): Filtrar por agente

**Response (200):**
```json
{
  "period": {
    "start": "2025-01-01",
    "end": "2025-01-31"
  },
  "conversations": {
    "total": 500,
    "active": 50,
    "closed": 450,
    "avg_duration_minutes": 15,
    "by_channel": {
      "whatsapp": 300,
      "instagram": 200
    }
  },
  "leads": {
    "total": 200,
    "new": 50,
    "qualified": 80,
    "converted": 30,
    "lost": 40,
    "conversion_rate": 0.15,
    "by_temperature": {
      "hot": 60,
      "warm": 80,
      "cold": 60
    }
  },
  "ai_performance": {
    "total_messages": 2500,
    "avg_response_time_ms": 1200,
    "avg_confidence": 0.92,
    "handoff_rate": 0.10
  },
  "user_performance": [
    {
      "user_id": "uuid",
      "full_name": "João Consultor",
      "conversations_handled": 50,
      "avg_response_time_ms": 30000,
      "satisfaction_score": 4.8
    }
  ]
}
```

### 8.2 GET /analytics/conversations/timeline

Obtém timeline de conversas.

**Query Parameters:**
- `start_date`, `end_date`
- `interval` (string): hour, day, week, month

**Response (200):**
```json
{
  "data": [
    {
      "timestamp": "2025-01-20T00:00:00Z",
      "total": 25,
      "ai_handled": 20,
      "human_handled": 5
    }
  ]
}
```

## 9. WebSocket Events

**Connection URL**: `wss://api.smarterchat.com/ws`

**Authentication**: Query parameter `?token={access_token}`

### 9.1 Events Emitidos pelo Servidor

**conversation.new**
```json
{
  "event": "conversation.new",
  "data": {
    "conversation_id": "uuid",
    "contact_name": "Maria Silva",
    "channel_type": "whatsapp"
  }
}
```

**message.received**
```json
{
  "event": "message.received",
  "data": {
    "conversation_id": "uuid",
    "message": {
      "id": "uuid",
      "content": "Olá!",
      "sender_type": "contact"
    }
  }
}
```

**message.sent**
```json
{
  "event": "message.sent",
  "data": {
    "conversation_id": "uuid",
    "message": {
      "id": "uuid",
      "content": "Como posso ajudar?",
      "sender_type": "ai"
    }
  }
}
```

**conversation.assigned**
```json
{
  "event": "conversation.assigned",
  "data": {
    "conversation_id": "uuid",
    "assigned_to_user_id": "uuid"
  }
}
```

**lead.created**
```json
{
  "event": "lead.created",
  "data": {
    "lead_id": "uuid",
    "name": "Maria Silva",
    "temperature": "hot"
  }
}
```

**typing.start / typing.stop**
```json
{
  "event": "typing.start",
  "data": {
    "conversation_id": "uuid",
    "user_id": "uuid"
  }
}
```

### 9.2 Events Emitidos pelo Cliente

**join.conversation**
```json
{
  "event": "join.conversation",
  "conversation_id": "uuid"
}
```

**leave.conversation**
```json
{
  "event": "leave.conversation",
  "conversation_id": "uuid"
}
```

**typing.start / typing.stop**
```json
{
  "event": "typing.start",
  "conversation_id": "uuid"
}
```

## 10. Webhooks Externos (Recebidos)

### 10.1 POST /webhooks/whatsapp/:channel_id

Recebe mensagens do WhatsApp Business API.

**Request (Meta):**
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "5511988888888",
          "id": "wamid.xxx",
          "timestamp": "1642680000",
          "text": {
            "body": "Olá!"
          },
          "type": "text"
        }]
      }
    }]
  }]
}
```

**Response (200):**
```json
{
  "success": true
}
```

### 10.2 POST /webhooks/instagram/:channel_id

Recebe mensagens do Instagram.

**Request (Meta):**
```json
{
  "object": "instagram",
  "entry": [{
    "messaging": [{
      "sender": {
        "id": "123456789"
      },
      "recipient": {
        "id": "987654321"
      },
      "timestamp": 1642680000,
      "message": {
        "mid": "mid.xxx",
        "text": "Olá!"
      }
    }]
  }]
}
```

**Response (200):**
```json
{
  "success": true
}
```

## 11. Códigos de Erro

**400 Bad Request**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos",
    "details": [
      {
        "field": "email",
        "message": "Email inválido"
      }
    ]
  }
}
```

**401 Unauthorized**
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Token inválido ou expirado"
  }
}
```

**403 Forbidden**
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Você não tem permissão para acessar este recurso"
  }
}
```

**404 Not Found**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Recurso não encontrado"
  }
}
```

**429 Too Many Requests**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Muitas requisições. Tente novamente em 60 segundos",
    "retry_after": 60
  }
}
```

**500 Internal Server Error**
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Erro interno do servidor",
    "request_id": "uuid"
  }
}
```

## 12. Rate Limiting

**Limites por Plano:**
- Free: 100 req/min
- Starter: 500 req/min
- Professional: 2000 req/min
- Enterprise: 10000 req/min

**Headers de Resposta:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642680060
```
