#!/bin/bash

# Configuration
SERVER_USER="root"
SERVER_HOST="72.60.154.65"
DEST_DIR="~/lydzzmultitenant"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Starting Deployment to $SERVER_USER@$SERVER_HOST ===${NC}"

# 1. Create directory on server
echo -e "${YELLOW}Creating remote directory...${NC}"
ssh $SERVER_USER@$SERVER_HOST "mkdir -p $DEST_DIR"

# 2. Sync files
echo -e "${YELLOW}Syncing files...${NC}"
rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.next' \
    --exclude 'dist' \
    --exclude 'coverage' \
    --exclude '.env' \
    --exclude 'postgres_data' \
    --exclude 'redis_data' \
    ./ $SERVER_USER@$SERVER_HOST:$DEST_DIR/

# 3. Handle Environment Variables
if [ -f .env.prod ]; then
    echo -e "${YELLOW}Uploading .env.prod as .env...${NC}"
    scp .env.prod $SERVER_USER@$SERVER_HOST:$DEST_DIR/.env
else
    echo -e "${YELLOW}WARNING: .env.prod not found. Please ensure .env exists on the server.${NC}"
fi

# 3.5 Setup Firewall (UFW) - Fix for connection timeouts
echo -e "${YELLOW}Configuring Firewall (UFW) to allow ports...${NC}"
ssh $SERVER_USER@$SERVER_HOST "
    if command -v ufw >/dev/null 2>&1; then
        echo 'UFW detected, configuring rules...'
        ufw allow 22/tcp
        ufw allow 80/tcp
        ufw allow 443/tcp
        ufw allow 4000/tcp
        ufw allow 4001/tcp
        # Enable UFW non-interactively
        echo 'y' | ufw enable
        ufw status
    else
        echo 'UFW not found, skipping firewall configuration.'
    fi
"

# 3.6 Update Nginx Configuration
echo -e "${YELLOW}Updating Nginx configuration...${NC}"
ssh $SERVER_USER@$SERVER_HOST "
    cp $DEST_DIR/nginx_vps.conf /etc/nginx/sites-available/lydzz.com.br
    ln -sf /etc/nginx/sites-available/lydzz.com.br /etc/nginx/sites-enabled/
    nginx -t && systemctl reload nginx
    echo 'Nginx configuration updated and reloaded.'
"

# 4. Deploy with Docker Compose
echo -e "${YELLOW}Building and starting containers...${NC}"
ssh $SERVER_USER@$SERVER_HOST "cd $DEST_DIR && docker compose -f docker-compose.prod.yml up -d --build"

echo -e "${GREEN}=== Deployment Complete! ===${NC}"
echo -e "Check status with: ssh $SERVER_USER@$SERVER_HOST 'cd $DEST_DIR && docker compose -f docker-compose.prod.yml ps'"
