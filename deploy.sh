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

# Check for git updates
echo -e "${YELLOW}Checking for local git updates...${NC}"
git pull origin main || echo -e "${YELLOW}Git pull failed or not a git repo. Using current local files.${NC}"

# 0. Generate Build Info (Frontend)
echo -e "${YELLOW}Generating build info...${NC}"
if [ -d "frontend" ]; then
    cd frontend
    node generate-build-info.js
    cd ..
fi

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

# 3.4 Setup Swap Memory (Prevent OOM Killer during build)
echo -e "${YELLOW}Configuring Swap Memory (4GB)...${NC}"
ssh $SERVER_USER@$SERVER_HOST "
    if [ ! -f /swapfile ]; then
        echo 'Creating 4GB swapfile...'
        fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
        chmod 600 /swapfile
        mkswap /swapfile
        swapon /swapfile
        grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
        echo 'Swap created successfully.'
    else
        echo 'Swapfile already exists.'
    fi
    free -h
"

# 3.4.1 Optimize Docker Network (Disable IPv6 & Fix DNS)
echo -e "${YELLOW}Optimizing Docker Network...${NC}"
scp daemon.json $SERVER_USER@$SERVER_HOST:/etc/docker/daemon.json
ssh $SERVER_USER@$SERVER_HOST "systemctl restart docker"

# 3.5 Setup Firewall (UFW) - Fix for connection timeouts
echo -e "${YELLOW}Configuring Firewall (UFW) to allow ports...${NC}"
ssh $SERVER_USER@$SERVER_HOST "
    if command -v ufw >/dev/null 2>&1; then
        echo 'UFW detected, configuring rules...'
        ufw allow 22/tcp
        ufw allow 80/tcp
        ufw allow 443/tcp
        # Ports 4000/4001 should NOT be exposed publicly. Nginx handles proxying.
        ufw delete allow 4000/tcp
        ufw delete allow 4001/tcp
        
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
    # Install Certbot if not present
    if ! command -v certbot >/dev/null 2>&1; then
        echo 'Installing Certbot...'
        apt-get update
        apt-get install -y certbot python3-certbot-nginx
    fi

    cp $DEST_DIR/nginx_vps.conf /etc/nginx/sites-available/lydzz.com.br
    ln -sf /etc/nginx/sites-available/lydzz.com.br /etc/nginx/sites-enabled/
    
    # Test Nginx config before reloading
    nginx -t
    systemctl reload nginx
    
    # Setup SSL with Certbot (Auto-renew)
    echo 'Configuring SSL with Let\'s Encrypt...'
    # This command obtains the cert and modifies the nginx config automatically
    # It uses --redirect to force HTTPS
    certbot --nginx -d lydzz.com.br -d www.lydzz.com.br --non-interactive --agree-tos --email contato@lydzz.com.br --redirect
    
    echo 'Nginx configuration updated with SSL.'
"

# 4. Deploy with Docker Compose
echo -e "${YELLOW}Building and starting containers...${NC}"
ssh $SERVER_USER@$SERVER_HOST "cd $DEST_DIR && docker compose -f docker-compose.prod.yml up -d --build"

echo -e "${GREEN}=== Deployment Complete! ===${NC}"
echo -e "Check status with: ssh $SERVER_USER@$SERVER_HOST 'cd $DEST_DIR && docker compose -f docker-compose.prod.yml ps'"
