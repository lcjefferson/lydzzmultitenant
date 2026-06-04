#!/bin/bash
# Instala e configura Nginx na VPS para o Lydzz.
# Execute NA VPS, na pasta do projeto (onde está nginx_vps.conf).
#
# Uso:
#   chmod +x scripts/setup-nginx-vps.sh
#   ./scripts/setup-nginx-vps.sh
#   ./scripts/setup-nginx-vps.sh lydzz.com.br
#   SSL=1 ./scripts/setup-nginx-vps.sh lydzz.com.br   # roda certbot após instalar

set -e

DOMAIN="${1:-lydzz.com.br}"
WWW="www.${DOMAIN}"
SSL="${SSL:-0}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NGINX_SITE="lydzz"
CONFIG_SRC="${PROJECT_DIR}/nginx_vps.conf"
CONFIG_DEST="/etc/nginx/sites-available/${NGINX_SITE}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Setup Nginx — Lydzz (${DOMAIN}) ===${NC}"

if [ ! -f "$CONFIG_SRC" ]; then
    echo -e "${RED}Arquivo não encontrado: ${CONFIG_SRC}${NC}"
    exit 1
fi

if ! command -v docker &>/dev/null; then
    echo -e "${YELLOW}Aviso: Docker não encontrado. Suba os containers antes de testar o site.${NC}"
fi

echo -e "${YELLOW}Instalando Nginx e Certbot...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y nginx certbot python3-certbot-nginx

echo -e "${YELLOW}Aplicando configuração...${NC}"
# www primeiro para não corromper www.lydzz.com.br ao substituir o domínio base
sed "s/www.lydzz.com.br/${WWW}/g; s/lydzz.com.br/${DOMAIN}/g" "$CONFIG_SRC" > /tmp/lydzz-nginx.conf
cp /tmp/lydzz-nginx.conf "$CONFIG_DEST"

ln -sf "$CONFIG_DEST" "/etc/nginx/sites-enabled/${NGINX_SITE}"

# Desativa site default conflitante
if [ -f /etc/nginx/sites-enabled/default ]; then
    rm -f /etc/nginx/sites-enabled/default
fi

echo -e "${YELLOW}Testando configuração...${NC}"
nginx -t

systemctl enable nginx
systemctl reload nginx

echo -e "${GREEN}Nginx instalado e ativo.${NC}"
echo ""
echo "Pré-requisitos DNS (registro A apontando para o IP desta VPS):"
echo "  - ${DOMAIN}"
echo "  - ${WWW}"
echo ""
echo "Docker deve expor:"
echo "  - Frontend → localhost:4000  (FRONTEND_PORT no .env)"
echo "  - Backend  → localhost:4001  (BACKEND_PORT no .env)"
echo ""
echo "URLs recomendadas no .env (após HTTPS):"
echo "  APP_URL=https://${DOMAIN}"
echo "  FRONTEND_URL=https://${DOMAIN}"
echo "  NEXT_PUBLIC_API_URL=https://${DOMAIN}/api"
echo "  NEXT_PUBLIC_WS_URL=https://${DOMAIN}"
echo ""

if [ "$SSL" = "1" ]; then
    echo -e "${YELLOW}Solicitando certificado SSL (Certbot)...${NC}"
    certbot --nginx -d "$DOMAIN" -d "$WWW" --non-interactive --agree-tos --redirect \
        -m "${CERTBOT_EMAIL:-admin@${DOMAIN}}" || {
        echo -e "${RED}Certbot falhou. Verifique DNS e rode manualmente:${NC}"
        echo "  certbot --nginx -d ${DOMAIN} -d ${WWW}"
        exit 1
    }
    systemctl reload nginx
    echo -e "${GREEN}HTTPS configurado.${NC}"
else
    echo -e "${YELLOW}Para ativar HTTPS, após o DNS propagar:${NC}"
    echo "  certbot --nginx -d ${DOMAIN} -d ${WWW}"
    echo "  ou: SSL=1 CERTBOT_EMAIL=seu@email.com ./scripts/setup-nginx-vps.sh ${DOMAIN}"
fi

echo ""
echo -e "${GREEN}Teste: curl -I http://127.0.0.1/ -H 'Host: ${DOMAIN}'${NC}"
