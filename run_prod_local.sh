#!/bin/bash
# Script para rodar o ambiente de produção localmente com Docker
# Versão v2 - Com diagnósticos

echo "=== Iniciando Deploy Local de Produção (v2) ==="

# Funções de cor
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Verificar se o Docker está instalado e RODANDO
echo "🔍 Verificando Docker..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Erro: Docker não encontrado.${NC}"
    echo "Por favor instale o Docker Desktop: https://www.docker.com/products/docker-desktop/"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Erro: O Docker está instalado mas NÃO está rodando.${NC}"
    echo "Por favor abra o Docker Desktop e aguarde ele iniciar."
    exit 1
fi
echo -e "${GREEN}✅ Docker está rodando.${NC}"

# 2. Verificar Portas
check_port() {
    local port=$1
    if lsof -i :$port > /dev/null; then
        echo -e "${RED}❌ Erro: Porta $port já está em uso.${NC}"
        echo "Por favor, pare o processo que está usando esta porta e tente novamente."
        echo "Você pode usar 'lsof -i :$port' para ver quem está usando."
        return 1
    fi
    return 0
}

echo "🔍 Verificando portas..."
PORTS_OK=true
check_port 4000 || PORTS_OK=false
check_port 4001 || PORTS_OK=false
# Não verificamos 5432/6379 estritamente pois o docker pode mapear para outras se quisermos,
# mas no docker-compose.prod.yml não estamos expondo portas do postgres/redis para o host (apenas interno),
# exceto se definirmos 'ports'. Vamos checar o arquivo.
# No docker-compose.prod.yml atual:
# postgres e redis NÃO têm seção 'ports', então não conflitam com o host.
# Apenas backend (4001) e frontend (4000) expõem portas.

if [ "$PORTS_OK" = false ]; then
    echo -e "${YELLOW}⚠️  Atenção: Portas ocupadas detectadas.${NC}"
    echo "O script tentará continuar, mas pode falhar se as portas 4000/4001 forem necessárias."
    # Opcional: exit 1
fi

# 3. Preparar .env
# Backup do .env atual
if [ -f .env ] && [ ! -f .env.dev.bak ]; then
    cp .env .env.dev.bak
    echo "✅ Backup do .env de desenvolvimento salvo em .env.dev.bak"
fi

# Criar .env temporário para produção local
echo "📝 Criando configuração de produção..."
cat <<EOF > .env
NODE_ENV=production

# URLs Locais
APP_URL=http://localhost:4001
FRONTEND_URL=http://localhost:4000
NEXT_PUBLIC_API_URL=http://localhost:4001/api
NEXT_PUBLIC_WS_URL=http://localhost:4001

# Banco de Dados
POSTGRES_USER=postgres
POSTGRES_PASSWORD=PTHUDcdqHwajYP2Q5bkVWU1s
POSTGRES_DB=smarterchat

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Segredos (Copiados da configuração atual)
JWT_SECRET=549b486a2cffac0e66079f8bd4f7b9359f42cd801ade32433b4e389951d0b24a
JWT_REFRESH_SECRET=9ab77ea039637add5741157598694926fb2c970b557676ea0d17230ca2c2d4b5
ENCRYPTION_KEY=4efd895edeabba916d723936c2e50a24
MASTER_SECRET_KEY=lydzz_master_secret_2025
OPENAI_API_KEY=sk-your-openai-api-key

# Integrações
UAZAPI_API_URL=https://fortalabs.uazapi.com
UAZAPI_INSTANCE_TOKEN=a235279d-5a23-433b-a8c0-ca9b6da76e4a

# Portas
BACKEND_PORT=4001
FRONTEND_PORT=4000
EOF

echo "🚀 Iniciando containers (Isso pode levar alguns minutos)..."
echo "ℹ️  Executando build e up..."

# Limpeza e Correção para erro "unexpected commit digest"
echo "🧹 Limpando cache do builder e forçando atualização de imagens base..."
docker builder prune --all --force
docker pull node:20-slim

# Executa o docker compose
# Tentamos desativar o BuildKit se ele estiver causando problemas de checksum no Mac
export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0

if docker compose version &> /dev/null; then
    echo "🏗️  Construindo imagens (modo legado para compatibilidade)..."
    docker compose -f docker-compose.prod.yml up -d --build
else
    echo "🏗️  Construindo imagens (modo legado para compatibilidade)..."
    docker-compose -f docker-compose.prod.yml up -d --build
fi

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ === DEPLOY LOCAL CONCLUÍDO COM SUCESSO ===${NC}"
    echo "🌍 Frontend acessível em: http://localhost:4000"
    echo "⚙️  Backend acessível em:  http://localhost:4001"
    echo ""
    echo "⚠️  Nota: O banco de dados é novo (PostgreSQL). Seus dados do SQLite não foram migrados."
    echo "Para parar e voltar ao desenvolvimento:"
    echo "  1. docker compose -f docker-compose.prod.yml down"
    echo "  2. mv .env.dev.bak .env"
else
    echo ""
    echo -e "${RED}❌ Falha ao iniciar os containers (Código de erro: $EXIT_CODE).${NC}"
    echo "Verifique o erro acima."
    echo "Tentando restaurar .env..."
    if [ -f .env.dev.bak ]; then
        mv .env.dev.bak .env
        echo "✅ .env restaurado."
    fi
fi
