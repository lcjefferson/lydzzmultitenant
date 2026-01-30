# 🚀 Lydzz - Plataforma de Atendimento Inteligente Multitenant

Bem-vindo ao **Lydzz**, a solução definitiva para escalar o atendimento ao cliente da sua empresa usando Inteligência Artificial.

O Lydzz é uma plataforma SaaS (Software as a Service) que permite criar, treinar e gerenciar **Agentes de IA** que atuam como sua primeira linha de atendimento no WhatsApp e Instagram. Nossa tecnologia qualifica leads, tira dúvidas e automatiza processos, transferindo para um atendente humano apenas quando necessário.

---

## 💡 O que o Lydzz faz?

Imagine ter seus melhores vendedores trabalhando 24 horas por dia, 7 dias por semana, sem filas de espera. O Lydzz torna isso possível:

1.  **Atendimento Instantâneo**: Seus clientes nunca ficam sem resposta. O Lydzz responde imediatamente, a qualquer hora do dia ou da noite.
2.  **Inteligência Artificial Personalizada**: Crie agentes que "pensam" como sua empresa. Treine-os com seus documentos, manuais e regras de negócio para respostas precisas e humanizadas.
3.  **Híbrido (IA + Humano)**: A IA resolve a maioria das demandas repetitivas. Quando um caso complexo surge ou uma venda precisa ser fechada, o sistema transfere a conversa suavemente para um atendente humano no nosso chat em tempo real.
4.  **CRM e Organização**: Cada conversa se torna uma oportunidade. O sistema organiza contatos automaticamente em um funil de vendas (Kanban), ajudando sua equipe a focar no que importa: fechar negócios.

---

## ✨ Principais Funcionalidades

*   🤖 **Agentes de IA Customizáveis**: Defina a personalidade, tom de voz e base de conhecimento do seu assistente.
*   💬 **Multi-Canal Centralizado**: Gerencie conversas de WhatsApp e Instagram em uma única tela.
*   🔄 **Transbordo Inteligente (Hand-off)**: A IA sabe quando passar a vez para um humano e notifica sua equipe.
*   📊 **Dashboard Analítico**: Métricas em tempo real sobre volume de atendimentos, tempo de resposta e satisfação.
*   🏢 **Multi-Tenancy**: Ideal para agências e grandes corporações que precisam gerenciar múltiplas organizações ou departamentos isoladamente.
*   👥 **Gestão de Equipe**: Controle de permissões para administradores e atendentes.

---

## 🛠️ Como Funciona?

O fluxo é simples e eficiente:

1.  **Conexão**: Você conecta suas contas de WhatsApp Business e Instagram à plataforma.
2.  **Treinamento**: Você faz o upload de materiais (PDFs, textos, FAQs) para a IA aprender sobre seu produto/serviço.
3.  **Automação**: O Agente entra em ação, respondendo clientes, tirando dúvidas e qualificando leads.
4.  **Monitoramento & Intervenção**: Sua equipe acompanha as conversas pelo painel. Se necessário, um atendente pode assumir o controle da conversa com um clique ("Sussurro" ou "Assumir Conversa").

---

## 💻 Stack Tecnológico

Para desenvolvedores e equipe técnica, o Lydzz é construído com tecnologias modernas e robustas:

*   **Frontend**: Next.js 14, React, TailwindCSS, TypeScript.
*   **Backend**: NestJS, Node.js, Prisma ORM.
*   **Banco de Dados**: PostgreSQL (Dados), Redis (Cache/Filas).
*   **IA**: Integração nativa com OpenAI (GPT-4 Turbo).
*   **Infraestrutura**: Docker, Nginx (Proxy Reverso), Suporte a SSL/HTTPS.

---

## 📚 Documentação Detalhada

Para detalhes técnicos, arquitetura e guias de implantação, consulte nossa pasta de documentação:

*   [Resumo Executivo](docs/00-RESUMO-EXECUTIVO.md)
*   [Arquitetura do Sistema](docs/01-ARQUITETURA.md)
*   [Banco de Dados](docs/02-DATABASE.md)
*   [API Reference](docs/03-API.md)
*   [Fluxos de Usuário](docs/04-FLUXOS.md)
*   [Guia de Instalação e Deploy](deploy.sh)

---

## 🚀 Instalação Rápida (Dev)

1.  Clone o repositório.
2.  Configure o `.env` baseando-se no `.env.example`.
3.  Suba o ambiente com Docker:
    ```bash
    docker-compose up -d --build
    ```
4.  Acesse:
    *   Frontend: `http://localhost:3001`
    *   Backend API: `http://localhost:3000`

---

Desenvolvido com ❤️ para revolucionar o atendimento ao cliente.
