# SmarterChat - Fluxos de Atendimento

## 1. Fluxo Principal de Atendimento Híbrido (IA + Humano)

```mermaid
flowchart TD
    Start([Cliente envia mensagem]) --> CheckChannel{Canal configurado?}
    
    CheckChannel -->|Não| Error[Retorna erro]
    CheckChannel -->|Sim| ReceiveMsg[Webhook recebe mensagem]
    
    ReceiveMsg --> Queue[Adiciona à fila de processamento]
    Queue --> CheckConv{Conversa existe?}
    
    CheckConv -->|Não| CreateConv[Cria nova conversa]
    CheckConv -->|Sim| LoadConv[Carrega conversa existente]
    
    CreateConv --> CreateLead[Cria lead automático]
    CreateLead --> LoadAgent
    LoadConv --> LoadAgent[Carrega configuração do agente]
    
    LoadAgent --> CheckMode{Modo da conversa?}
    
    CheckMode -->|AI| ProcessAI[Processa com IA]
    CheckMode -->|Human| NotifyHuman[Notifica consultor]
    CheckMode -->|Hybrid| CheckContext{Contexto requer humano?}
    
    CheckContext -->|Sim| NotifyHuman
    CheckContext -->|Não| ProcessAI
    
    ProcessAI --> LoadContext[Carrega contexto e histórico]
    LoadContext --> ApplyScripts[Aplica scripts personalizados]
    ApplyScripts --> BuildPrompt[Monta prompt com system message]
    BuildPrompt --> CallOpenAI[Chama OpenAI API]
    
    CallOpenAI --> AnalyzeResponse[Analisa resposta]
    AnalyzeResponse --> ExtractIntent[Extrai intenção e entidades]
    ExtractIntent --> UpdateContext[Atualiza contexto da conversa]
    
    UpdateContext --> CheckHandoff{Necessita transferência?}
    
    CheckHandoff -->|Sim - Palavras-chave| TransferHuman[Transfere para humano]
    CheckHandoff -->|Sim - Sentimento negativo| TransferHuman
    CheckHandoff -->|Sim - Complexidade alta| TransferHuman
    CheckHandoff -->|Não| UpdateLead[Atualiza lead com informações]
    
    UpdateLead --> ClassifyLead[Classifica temperatura do lead]
    ClassifyLead --> SendResponse[Envia resposta ao cliente]
    
    SendResponse --> TriggerWebhooks[Dispara webhooks configurados]
    TriggerWebhooks --> NotifyDashboard[Notifica dashboard via WebSocket]
    NotifyDashboard --> End([Fim])
    
    TransferHuman --> ChangeMode[Muda modo para 'human']
    ChangeMode --> NotifyConsultant[Notifica consultor disponível]
    NotifyConsultant --> WaitHuman[Aguarda resposta do consultor]
    
    WaitHuman --> HumanResponds[Consultor responde]
    HumanResponds --> SendHumanMsg[Envia mensagem do consultor]
    SendHumanMsg --> SuggestResponse[IA sugere próximas respostas]
    SuggestResponse --> NotifyDashboard
    
    NotifyHuman --> QueueHuman[Adiciona à fila de atendimento]
    QueueHuman --> End
    
    Error --> End
    
    style ProcessAI fill:#4CAF50
    style NotifyHuman fill:#FF9800
    style TransferHuman fill:#F44336
    style SendResponse fill:#2196F3
```

## 2. Fluxo de Criação e Qualificação de Lead

```mermaid
flowchart TD
    Start([Nova conversa iniciada]) --> CheckLead{Lead existe?}
    
    CheckLead -->|Sim| LoadLead[Carrega lead existente]
    CheckLead -->|Não| ExtractInfo[Extrai informações da mensagem]
    
    ExtractInfo --> ParseData[Parse de dados]
    ParseData --> CreateLead[Cria novo lead]
    
    CreateLead --> SetInitialTemp[Define temperatura inicial: COLD]
    SetInitialTemp --> LinkConv[Vincula lead à conversa]
    
    LoadLead --> LinkConv
    LinkConv --> AnalyzeConv[Analisa conversa em andamento]
    
    AnalyzeConv --> ExtractEntities[Extrai entidades]
    ExtractEntities --> UpdateFields{Novos dados coletados?}
    
    UpdateFields -->|Sim| UpdateLead[Atualiza campos do lead]
    UpdateFields -->|Não| AnalyzeIntent
    
    UpdateLead --> AnalyzeIntent[Analisa intenção e interesse]
    
    AnalyzeIntent --> CalcScore[Calcula score do lead]
    CalcScore --> CheckCriteria{Atende critérios?}
    
    CheckCriteria -->|Alta intenção de compra| SetHot[Temperatura: HOT]
    CheckCriteria -->|Interesse moderado| SetWarm[Temperatura: WARM]
    CheckCriteria -->|Baixo interesse| SetCold[Temperatura: COLD]
    
    SetHot --> Score80[Score: 80-100]
    SetWarm --> Score40[Score: 40-79]
    SetCold --> Score0[Score: 0-39]
    
    Score80 --> AutoAssign{Auto-atribuição ativa?}
    Score40 --> SaveLead
    Score0 --> SaveLead
    
    AutoAssign -->|Sim| FindConsultant[Busca consultor disponível]
    AutoAssign -->|Não| SaveLead[Salva lead]
    
    FindConsultant --> AssignLead[Atribui lead ao consultor]
    AssignLead --> NotifyConsultant[Notifica consultor]
    NotifyConsultant --> SaveLead
    
    SaveLead --> LogActivity[Registra atividade]
    LogActivity --> TriggerWebhook[Dispara webhook 'lead.updated']
    TriggerWebhook --> UpdateDashboard[Atualiza dashboard CRM]
    UpdateDashboard --> End([Fim])
    
    style SetHot fill:#F44336
    style SetWarm fill:#FF9800
    style SetCold fill:#2196F3
    style AssignLead fill:#4CAF50
```

## 3. Fluxo de Consultor Assumindo Conversa

```mermaid
sequenceDiagram
    participant C as Cliente
    participant S as Sistema
    participant AI as IA
    participant WS as WebSocket
    participant Cons as Consultor
    participant DB as Database
    
    C->>S: Envia mensagem
    S->>AI: Processa mensagem
    AI->>AI: Detecta necessidade de humano
    AI->>DB: Atualiza conversa (mode: human)
    AI->>WS: Emite evento 'conversation.waiting'
    WS->>Cons: Notificação de nova conversa
    
    Cons->>S: GET /conversations/:id
    S->>Cons: Retorna detalhes + histórico
    
    Cons->>S: POST /conversations/:id/assign
    S->>DB: Atribui conversa ao consultor
    S->>WS: Emite 'conversation.assigned'
    WS->>Cons: Confirmação
    
    Note over Cons: Consultor lê histórico
    
    Cons->>S: POST /conversations/:id/messages
    S->>DB: Salva mensagem
    S->>C: Envia mensagem ao cliente
    S->>AI: Solicita sugestões de resposta
    AI->>WS: Envia sugestões ao consultor
    
    loop Conversa em andamento
        C->>S: Responde
        S->>WS: Notifica consultor
        WS->>Cons: Nova mensagem
        AI->>WS: Sugestões de resposta
        Cons->>S: Envia resposta
        S->>C: Entrega resposta
    end
    
    Cons->>S: POST /conversations/:id/handoff
    S->>DB: Atualiza (mode: ai, assigned_to: null)
    S->>WS: Emite 'conversation.handoff'
    
    Note over AI: IA retoma atendimento
    
    C->>S: Nova mensagem
    S->>AI: Processa com IA
    AI->>C: Responde automaticamente
```

## 4. Fluxo de Configuração de Agente

```mermaid
flowchart TD
    Start([Admin acessa configuração]) --> LoadForm[Carrega formulário de agente]
    
    LoadForm --> FillBasic[Preenche informações básicas]
    FillBasic --> FillPersonality[Define personalidade e tom]
    FillPersonality --> WriteSystem[Escreve system message]
    
    WriteSystem --> AddScripts{Adicionar scripts?}
    AddScripts -->|Sim| WriteScripts[Escreve scripts personalizados]
    AddScripts -->|Não| ConfigAI
    
    WriteScripts --> TestScripts[Testa scripts]
    TestScripts --> ConfigAI[Configura API Key OpenAI]
    
    ConfigAI --> SelectModel[Seleciona modelo GPT]
    SelectModel --> SetParams[Define temperatura e max_tokens]
    
    SetParams --> ConfigHandoff[Configura regras de transferência]
    ConfigHandoff --> DefineKeywords[Define palavras-chave]
    DefineKeywords --> SetSentiment[Define threshold de sentimento]
    
    SetSentiment --> ConfigLead[Configura qualificação de leads]
    ConfigLead --> DefineRules[Define regras de classificação]
    
    DefineRules --> AddWebhooks{Adicionar webhooks?}
    AddWebhooks -->|Sim| ConfigWebhook[Configura URL e eventos]
    AddWebhooks -->|Não| Preview
    
    ConfigWebhook --> TestWebhook[Testa webhook]
    TestWebhook --> Preview[Preview do agente]
    
    Preview --> TestChat[Testa chat com IA]
    TestChat --> Satisfied{Satisfeito?}
    
    Satisfied -->|Não| AdjustConfig[Ajusta configurações]
    AdjustConfig --> Preview
    
    Satisfied -->|Sim| SaveAgent[Salva agente]
    SaveAgent --> EncryptKey[Criptografa API Key]
    EncryptKey --> PublishAgent{Publicar agente?}
    
    PublishAgent -->|Sim| SetPublished[is_published = true]
    PublishAgent -->|Não| SaveDraft[Salva como rascunho]
    
    SetPublished --> LinkChannels[Vincula canais]
    SaveDraft --> End([Fim])
    
    LinkChannels --> ActivateAgent[Ativa agente]
    ActivateAgent --> End
    
    style TestChat fill:#4CAF50
    style EncryptKey fill:#F44336
    style ActivateAgent fill:#2196F3
```

## 5. Fluxo de Integração com WhatsApp

```mermaid
flowchart TD
    Start([Admin configura canal WhatsApp]) --> EnterTokens[Insere tokens da Meta]
    
    EnterTokens --> InputPhone[Insere Phone Number ID]
    InputPhone --> InputBusiness[Insere Business Account ID]
    InputBusiness --> InputToken[Insere Access Token]
    
    InputToken --> TestConnection[Testa conexão]
    TestConnection --> CallMetaAPI[Chama Meta Graph API]
    
    CallMetaAPI --> CheckResponse{Resposta válida?}
    CheckResponse -->|Não| ShowError[Exibe erro]
    ShowError --> EnterTokens
    
    CheckResponse -->|Sim| RegisterWebhook[Registra webhook na Meta]
    RegisterWebhook --> WebhookURL[URL: /webhooks/whatsapp/:channel_id]
    
    WebhookURL --> VerifyWebhook[Meta verifica webhook]
    VerifyWebhook --> CheckVerify{Verificação OK?}
    
    CheckVerify -->|Não| ShowWebhookError[Erro na verificação]
    ShowWebhookError --> RegisterWebhook
    
    CheckVerify -->|Sim| SaveChannel[Salva configuração do canal]
    SaveChannel --> LinkAgent[Vincula ao agente]
    LinkAgent --> ActivateChannel[Ativa canal]
    
    ActivateChannel --> Ready[Canal pronto]
    Ready --> WaitMsg[Aguarda mensagens]
    
    WaitMsg --> ReceiveMsg[Webhook recebe mensagem]
    ReceiveMsg --> ValidateSignature[Valida assinatura Meta]
    
    ValidateSignature --> SignatureOK{Assinatura válida?}
    SignatureOK -->|Não| Reject[Rejeita requisição]
    SignatureOK -->|Sim| ParsePayload[Parse do payload]
    
    ParsePayload --> ExtractMsg[Extrai dados da mensagem]
    ExtractMsg --> QueueProcess[Adiciona à fila]
    QueueProcess --> ProcessMsg[Processa mensagem]
    
    ProcessMsg --> GenerateResponse[Gera resposta]
    GenerateResponse --> SendToMeta[Envia via Meta API]
    
    SendToMeta --> CheckSend{Envio OK?}
    CheckSend -->|Não| RetryQueue[Adiciona à fila de retry]
    CheckSend -->|Sim| UpdateStatus[Atualiza status: sent]
    
    UpdateStatus --> WaitDelivery[Aguarda confirmação]
    WaitDelivery --> DeliveryWebhook[Webhook de status]
    DeliveryWebhook --> UpdateDelivered[Status: delivered]
    
    UpdateDelivered --> WaitRead[Aguarda leitura]
    WaitRead --> ReadWebhook[Webhook de leitura]
    ReadWebhook --> UpdateRead[Status: read]
    
    UpdateRead --> WaitMsg
    RetryQueue --> WaitMsg
    Reject --> WaitMsg
    
    style ValidateSignature fill:#F44336
    style ActivateChannel fill:#4CAF50
    style SendToMeta fill:#2196F3
```

## 6. Fluxo de Webhook Customizado

```mermaid
flowchart TD
    Start([Evento ocorre no sistema]) --> CheckWebhooks{Webhooks configurados?}
    
    CheckWebhooks -->|Não| End([Fim])
    CheckWebhooks -->|Sim| FilterWebhooks[Filtra por tipo de evento]
    
    FilterWebhooks --> BuildPayload[Monta payload do evento]
    BuildPayload --> SignPayload[Assina payload com secret]
    
    SignPayload --> Loop[Para cada webhook]
    Loop --> PrepareRequest[Prepara requisição HTTP]
    
    PrepareRequest --> AddHeaders[Adiciona headers customizados]
    AddHeaders --> AddSignature[Adiciona X-Webhook-Signature]
    AddSignature --> SendRequest[Envia requisição]
    
    SendRequest --> StartTimer[Inicia timer]
    StartTimer --> WaitResponse[Aguarda resposta]
    
    WaitResponse --> Timeout{Timeout?}
    Timeout -->|Sim - 30s| LogTimeout[Registra timeout]
    Timeout -->|Não| CheckStatus{Status code?}
    
    CheckStatus -->|2xx| LogSuccess[Registra sucesso]
    CheckStatus -->|4xx| LogClientError[Registra erro do cliente]
    CheckStatus -->|5xx| LogServerError[Registra erro do servidor]
    
    LogSuccess --> NextWebhook
    LogClientError --> NextWebhook
    
    LogServerError --> CheckRetry{Retry habilitado?}
    LogTimeout --> CheckRetry
    
    CheckRetry -->|Não| NextWebhook
    CheckRetry -->|Sim| CheckAttempts{Tentativas < max?}
    
    CheckAttempts -->|Não| LogFailed[Registra falha definitiva]
    CheckAttempts -->|Sim| ScheduleRetry[Agenda retry]
    
    ScheduleRetry --> WaitDelay[Aguarda delay]
    WaitDelay --> IncrementAttempt[Incrementa tentativa]
    IncrementAttempt --> SendRequest
    
    LogFailed --> NotifyAdmin[Notifica admin]
    NotifyAdmin --> NextWebhook
    
    NextWebhook --> MoreWebhooks{Mais webhooks?}
    MoreWebhooks -->|Sim| Loop
    MoreWebhooks -->|Não| End
    
    style LogSuccess fill:#4CAF50
    style LogFailed fill:#F44336
    style ScheduleRetry fill:#FF9800
```

## 7. Fluxo de Processamento de IA

```mermaid
flowchart TD
    Start([Mensagem recebida]) --> LoadAgent[Carrega configuração do agente]
    
    LoadAgent --> LoadConv[Carrega conversa e contexto]
    LoadConv --> LoadHistory[Carrega histórico de mensagens]
    LoadHistory --> LimitHistory[Limita últimas 20 mensagens]
    
    LimitHistory --> ApplyScripts[Aplica scripts personalizados]
    ApplyScripts --> ModifyContext{Script modifica contexto?}
    
    ModifyContext -->|Sim| UpdateContext[Atualiza contexto]
    ModifyContext -->|Não| BuildPrompt
    
    UpdateContext --> BuildPrompt[Monta prompt]
    BuildPrompt --> AddSystem[Adiciona system message]
    AddSystem --> AddPersonality[Adiciona personalidade]
    AddPersonality --> AddObjective[Adiciona objetivo]
    AddObjective --> AddContext[Adiciona contexto da conversa]
    AddContext --> AddHistory[Adiciona histórico]
    AddHistory --> AddCurrent[Adiciona mensagem atual]
    
    AddCurrent --> CallOpenAI[Chama OpenAI API]
    CallOpenAI --> CheckResponse{Resposta OK?}
    
    CheckResponse -->|Erro| HandleError[Trata erro]
    HandleError --> RetryLogic{Retry?}
    RetryLogic -->|Sim| CallOpenAI
    RetryLogic -->|Não| FallbackMsg[Mensagem de fallback]
    
    CheckResponse -->|OK| ExtractResponse[Extrai resposta]
    ExtractResponse --> LogTokens[Registra tokens usados]
    LogTokens --> AnalyzeIntent[Analisa intenção]
    
    AnalyzeIntent --> ExtractEntities[Extrai entidades]
    ExtractEntities --> ClassifyIntent{Tipo de intenção?}
    
    ClassifyIntent -->|Informação| ResponseInfo
    ClassifyIntent -->|Dúvida| ResponseQuestion
    ClassifyIntent -->|Interesse comercial| ResponseSales
    ClassifyIntent -->|Reclamação| ResponseComplaint
    ClassifyIntent -->|Transferência| TriggerHandoff
    
    ResponseInfo --> ApplyFilters[Aplica filtros de resposta]
    ResponseQuestion --> ApplyFilters
    ResponseSales --> UpdateLeadScore[Atualiza score do lead]
    ResponseComplaint --> CheckSentiment[Analisa sentimento]
    
    UpdateLeadScore --> ApplyFilters
    CheckSentiment --> NegativeSentiment{Muito negativo?}
    
    NegativeSentiment -->|Sim| TriggerHandoff[Aciona transferência]
    NegativeSentiment -->|Não| ApplyFilters
    
    ApplyFilters --> ValidateResponse[Valida resposta]
    ValidateResponse --> SaveMessage[Salva mensagem no DB]
    SaveMessage --> SendToChannel[Envia ao canal]
    
    SendToChannel --> UpdateMetrics[Atualiza métricas]
    UpdateMetrics --> End([Fim])
    
    TriggerHandoff --> NotifyTransfer[Notifica transferência]
    NotifyTransfer --> End
    
    FallbackMsg --> SaveMessage
    
    style CallOpenAI fill:#4CAF50
    style TriggerHandoff fill:#F44336
    style UpdateLeadScore fill:#2196F3
```

## 8. Decisões de Transferência para Humano

```mermaid
flowchart TD
    Start([Analisar necessidade de transferência]) --> CheckKeywords{Palavras-chave detectadas?}
    
    CheckKeywords -->|Sim| Keywords[Palavras como: 'falar com humano', 'atendente', 'gerente']
    Keywords --> Transfer[TRANSFERIR]
    
    CheckKeywords -->|Não| CheckSentiment{Sentimento muito negativo?}
    CheckSentiment -->|Sim - Score < -0.5| Transfer
    CheckSentiment -->|Não| CheckComplexity{Pergunta complexa?}
    
    CheckComplexity -->|Sim - Confiança < 0.6| Transfer
    CheckComplexity -->|Não| CheckLoop{Loop detectado?}
    
    CheckLoop -->|Sim - 3+ msgs similares| Transfer
    CheckLoop -->|Não| CheckHighValue{Lead de alto valor?}
    
    CheckHighValue -->|Sim - Score > 80| CheckRules{Regra de negócio?}
    CheckHighValue -->|Não| ContinueAI[Continuar com IA]
    
    CheckRules -->|Negociação de preço| Transfer
    CheckRules -->|Fechamento de contrato| Transfer
    CheckRules -->|Outros| ContinueAI
    
    Transfer --> SelectConsultant[Seleciona consultor]
    SelectConsultant --> CheckAvailability{Consultor disponível?}
    
    CheckAvailability -->|Sim| AssignNow[Atribui imediatamente]
    CheckAvailability -->|Não| QueueConv[Adiciona à fila]
    
    AssignNow --> NotifyConsultant[Notifica consultor]
    QueueConv --> SendQueueMsg[Envia msg: 'Em breve um consultor...']
    
    NotifyConsultant --> End([Fim])
    SendQueueMsg --> End
    ContinueAI --> End
    
    style Transfer fill:#F44336
    style ContinueAI fill:#4CAF50
```

## 9. Resumo dos Principais Gatilhos

### Gatilhos de Transferência para Humano:
1. **Palavras-chave**: "falar com humano", "atendente", "gerente", "supervisor"
2. **Sentimento negativo**: Score < -0.5
3. **Baixa confiança da IA**: < 60%
4. **Loop de conversa**: 3+ mensagens similares sem progresso
5. **Lead de alto valor**: Score > 80 + negociação comercial
6. **Tópicos sensíveis**: Reclamações, cancelamentos, problemas técnicos

### Gatilhos de Criação de Lead:
1. **Nova conversa** iniciada
2. **Informações coletadas**: Nome, email, telefone
3. **Interesse demonstrado**: Perguntas sobre produtos/serviços

### Gatilhos de Atualização de Score:
1. **Perguntas sobre preços**: +10 pontos
2. **Interesse em demonstração**: +15 pontos
3. **Urgência expressa**: +20 pontos
4. **Orçamento mencionado**: +15 pontos
5. **Autoridade de decisão**: +10 pontos
6. **Mensagens negativas**: -10 pontos
7. **Demora em responder**: -5 pontos

### Gatilhos de Webhooks:
1. `conversation.new`: Nova conversa criada
2. `message.received`: Mensagem recebida
3. `message.sent`: Mensagem enviada
4. `lead.created`: Novo lead criado
5. `lead.qualified`: Lead qualificado (score > 60)
6. `lead.hot`: Lead quente (score > 80)
7. `conversation.assigned`: Conversa atribuída a consultor
8. `conversation.closed`: Conversa encerrada
