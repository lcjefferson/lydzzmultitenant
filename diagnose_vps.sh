#!/bin/bash

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Diagnóstico da VPS ===${NC}"

# 1. Verificar Docker
echo -e "\n${GREEN}1. Verificando Docker...${NC}"
if systemctl is-active --quiet docker; then
    echo "✅ Docker está rodando."
else
    echo "❌ Docker NÃO está rodando. Tentando iniciar..."
    systemctl start docker
fi

# 2. Verificar Containers
echo -e "\n${GREEN}2. Verificando Containers do Projeto...${NC}"
cd ~/lydzzmultitenant
if [ -f "docker-compose.prod.yml" ]; then
    docker compose -f docker-compose.prod.yml ps
else
    echo "❌ Arquivo docker-compose.prod.yml não encontrado em ~/lydzzmultitenant"
    docker ps
fi

# 3. Verificar Nginx
echo -e "\n${GREEN}3. Verificando Nginx...${NC}"
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx está rodando."
else
    echo "❌ Nginx NÃO está rodando. Tentando iniciar..."
    systemctl start nginx
fi

# 4. Verificar Firewall (UFW)
echo -e "\n${GREEN}4. Verificando Firewall (UFW)...${NC}"
if command -v ufw >/dev/null; then
    ufw status verbose
else
    echo "⚠️ UFW não instalado."
fi

# 5. Verificar Portas Ouvindog
echo -e "\n${GREEN}5. Verificando Portas Abertas...${NC}"
netstat -tulpn | grep -E '(:80|:443|:4000|:4001)'
