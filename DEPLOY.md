# Checklist de Deploy - Lydzz

## Pré-requisitos

- [ ] **Variáveis de ambiente** preenchidas (nunca commitar `.env` com segredos)
- [ ] **PostgreSQL** e **Redis** disponíveis (Docker ou serviço gerenciado)
- [ ] **Domínio/URL pública** para APP_URL e webhook WhatsApp (não usar localhost em produção)

---

## 1. Backend

### Build e execução

```bash
cd backend
npm ci
npx prisma migrate deploy
npm run build
PORT=3000 node dist/src/main.js
```

### Variáveis obrigatórias (produção)

| Variável | Descrição |
|----------|-----------|
| `NODE_ENV` | `production` |
| `PORT` | Ex: `3000` |
| `DATABASE_URL` | URL do Postgres (ex: `postgresql://user:pass@host:5432/smarterchat`) |
| `REDIS_HOST` / `REDIS_PORT` | Redis para filas/sessão |
| `JWT_SECRET` | Chave forte (≥32 caracteres) |
| `JWT_REFRESH_SECRET` | Outra chave forte |
| `ENCRYPTION_KEY` | Exatamente 32 caracteres |
| `APP_URL` | URL pública do backend (ex: `https://api.seudominio.com`) |
| `FRONTEND_URL` | URL do frontend (para CORS) |

### WhatsApp (se usar canal oficial)

- `WHATSAPP_API_URL` (opcional, default: graph.facebook.com)
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN`
- Webhook no Meta apontando para `https://SEU_DOMINIO/api/webhooks/whatsapp`

---

## 2. Frontend

### Build

As variáveis `NEXT_PUBLIC_*` são embutidas no build. Passe no build:

```bash
cd frontend
NEXT_PUBLIC_API_URL=https://api.seudominio.com/api \
NEXT_PUBLIC_WS_URL=https://api.seudominio.com \
npm run build
npm run start
```

### Em Docker

No build da imagem, passe os ARGs:

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.seudominio.com/api \
  --build-arg NEXT_PUBLIC_WS_URL=https://api.seudominio.com \
  --build-arg BACKEND_URL=http://backend:3000 \
  -t lydzz-frontend .
```

`BACKEND_URL` é usada no servidor Next para rewrites (/api, /uploads, /socket.io). Em Docker Compose use o nome do serviço do backend (ex: `http://backend:3000`).

---

## 3. Docker Compose (exemplo produção)

- Ajuste `docker-compose.yml` para incluir serviços `backend` e `frontend` se quiser subir tudo junto.
- Backend: exponha a porta (ex: 3000), configure `DATABASE_URL` e `REDIS_HOST` apontando para os serviços postgres/redis.
- Frontend: build com `BACKEND_URL=http://backend:3000` (nome do serviço).
- Use um proxy reverso (Nginx, Caddy, Traefik) com HTTPS na frente do frontend e do backend.

---

## 4. Segurança

- [ ] Trocar todas as senhas e tokens dos `.env.example`
- [ ] `APP_URL` e `FRONTEND_URL` em produção **não** devem ser localhost
- [ ] CORS no backend já usa `origin` do request; em produção restrinja por `FRONTEND_URL` se necessário
- [ ] Redis: usar senha em produção (`REDIS_PASSWORD`)

---

## 5. Após o deploy

- [ ] Rodar migrations: `npx prisma migrate deploy` (no backend)
- [ ] Criar primeiro admin: `npx ts-node prisma/create-admin.ts` (se ainda não tiver)
- [ ] Testar login, conversas, webhook WhatsApp e envio de mensagens
- [ ] Verificar logs do backend (erros 5xx, falhas de envio WhatsApp)

---

## Resumo rápido

| Item | Status |
|------|--------|
| Dockerfiles (backend + frontend) | ✅ Prontos |
| Backend PORT em produção | ✅ PORT=3000 no Dockerfile |
| Next.js rewrites configuráveis | ✅ BACKEND_URL no next.config |
| Migrations Prisma | ✅ `prisma migrate deploy` |
| Variáveis de ambiente documentadas | ✅ .env.example e este DEPLOY.md |

O sistema **está preparado para deploy** desde que você configure corretamente as variáveis de ambiente, o banco, o Redis e as URLs públicas (incluindo webhook do WhatsApp).
