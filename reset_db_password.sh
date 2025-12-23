#!/bin/bash

# Carrega variáveis do .env
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
else
    echo "Arquivo .env não encontrado!"
    exit 1
fi

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "POSTGRES_PASSWORD não encontrada no .env"
    exit 1
fi

echo "==================================================="
echo "RESET DE SENHA DO BANCO DE DADOS (SEM PERDER DADOS)"
echo "==================================================="
echo "Senha alvo (do .env): $POSTGRES_PASSWORD"

# Tenta descobrir o nome do volume
# Geralmente é pasta_postgres_data. Ex: lydzzfinal_postgres_data
VOLUME_NAME=$(docker volume ls --format "{{.Name}}" | grep "postgres_data" | head -n 1)

if [ -z "$VOLUME_NAME" ]; then
    echo "ERRO: Não consegui encontrar o volume do banco de dados automaticamente."
    echo "Por favor, execute 'docker volume ls' para ver o nome e edite este script."
    exit 1
fi

echo "Volume encontrado: $VOLUME_NAME"
echo "Parando container do banco de dados oficial..."
docker compose -f docker-compose.prod.yml stop postgres

echo "Iniciando banco temporário em modo de recuperação (TRUST)..."
# Inicia um postgres temporário montando o mesmo volume, mas sem exigir senha
docker run --rm -d --name temp-postgres-reset \
  -v "$VOLUME_NAME:/var/lib/postgresql/data" \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  postgres:15-alpine

echo "Aguardando inicialização (10s)..."
sleep 10

echo "Alterando a senha do usuário 'postgres'..."
docker exec temp-postgres-reset psql -U postgres -c "ALTER USER postgres WITH PASSWORD '$POSTGRES_PASSWORD';"

if [ $? -eq 0 ]; then
    echo "✅ Senha alterada com sucesso no banco de dados!"
else
    echo "❌ Falha ao alterar senha. Verifique os logs."
    docker stop temp-postgres-reset
    exit 1
fi

echo "Parando banco temporário..."
docker stop temp-postgres-reset

echo "Reiniciando aplicação..."
docker compose -f docker-compose.prod.yml up -d postgres
echo "Aguardando banco oficial subir (5s)..."
sleep 5
docker compose -f docker-compose.prod.yml restart backend

echo "==================================================="
echo "PRONTO! O banco agora usa a mesma senha do arquivo .env"
echo "Verifique os logs com: docker logs lydzz-backend"
