# Configurando Backend com Neon.tech

## Passos para Conectar ao Neon

### 1. Obter Connection String do Neon

1. Acesse https://console.neon.tech
2. Selecione seu projeto (ou crie um novo)
3. Vá em **Dashboard** → **Connection Details**
4. Copie a **Connection String** (formato: `postgresql://user:password@host/database`)

### 2. Configurar .env

Abra o arquivo `.env` no backend e atualize a `DATABASE_URL`:

```env
DATABASE_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
```

**Importante:** Certifique-se de incluir `?sslmode=require` no final da URL

### 3. Gerar Prisma Client

```bash
cd backend
npx prisma generate
```

### 4. Rodar Migrations (Criar Tabelas)

```bash
npx prisma migrate dev --name init
```

Isso vai:
- Criar todas as 14 tabelas no Neon
- Gerar o histórico de migrations
- Sincronizar o schema

### 5. (Opcional) Visualizar Banco

```bash
npx prisma studio
```

Abre interface visual para ver/editar dados

---

## Comandos Rápidos

```bash
# No diretório backend
cd /Users/jefferson/Documents/PROGRAMACAO/SmarterChat/backend

# Gerar client
npx prisma generate

# Criar tabelas
npx prisma migrate dev --name init

# Iniciar servidor
npm run start:dev
```

---

## Testando a API

Depois que as tabelas forem criadas, teste o registro:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@smarterchat.com",
    "password": "senha123",
    "name": "Admin User",
    "organizationName": "Minha Empresa"
  }'
```

---

## ✅ Checklist

- [ ] Copiar connection string do Neon
- [ ] Atualizar DATABASE_URL no .env
- [ ] Rodar `npx prisma generate`
- [ ] Rodar `npx prisma migrate dev --name init`
- [ ] Iniciar servidor `npm run start:dev`
- [ ] Testar endpoint de registro

---

**Quer que eu te ajude com algum desses passos?**
