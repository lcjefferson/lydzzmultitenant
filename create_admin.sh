#!/bin/bash

# Carrega variáveis do .env
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
else
    echo "Arquivo .env não encontrado!"
    exit 1
fi

echo "==================================================="
echo "CRIANDO USUÁRIO ADMIN PADRÃO"
echo "==================================================="

# Executa o seed do banco de dados dentro do container do backend
docker compose -f docker-compose.prod.yml exec backend npx prisma db seed

if [ $? -eq 0 ]; then
    echo "✅ Seed executado com sucesso!"
    echo "Tente logar com:"
    echo "Email: admin@smarterchat.com"
    echo "Senha: senha123"
else
    echo "❌ Falha ao executar o seed."
    exit 1
fi
