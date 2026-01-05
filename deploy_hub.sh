#!/bin/bash
# deploy_hub.sh - Script para executar na VPS

# Parar em caso de erro
set -e

DOCKER_USER=$1
TAG=${2:-latest}

if [ -z "$DOCKER_USER" ]; then
    echo "❌ Erro: Usuário do Docker Hub não fornecido."
    echo "Uso: ./deploy_hub.sh <docker_user> [tag]"
    exit 1
fi

# Exportar variáveis para que o docker-compose consiga ler
export DOCKER_HUB_USER=$DOCKER_USER
export TAG=$TAG

echo "🚀 Iniciando deploy via Docker Hub..."
echo "   User: $DOCKER_HUB_USER"
echo "   Tag:  $TAG"

# Verificar se docker-compose.hub.yml existe
if [ ! -f "docker-compose.hub.yml" ]; then
    echo "❌ Erro: docker-compose.hub.yml não encontrado no diretório atual."
    exit 1
fi

# Carregar variáveis do .env se existir (para garantir que variáveis como POSTGRES_PASSWORD estejam disponíveis)
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
fi

echo "⬇️  Baixando imagens atualizadas..."
if ! docker compose -f docker-compose.hub.yml pull; then
    echo "❌ Falha ao baixar imagens. Se o repositório for privado, certifique-se de ter feito 'docker login' nesta VPS."
    exit 1
fi

echo "🔄 Recriando containers..."
docker compose -f docker-compose.hub.yml up -d

echo "🧹 Limpar imagens não utilizadas..."
docker image prune -f || true

echo "✅ Deploy Remoto Concluído com Sucesso!"
