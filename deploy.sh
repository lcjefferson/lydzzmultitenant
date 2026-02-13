#!/bin/bash

# Configuration
SERVER_USER="root"
SERVER_HOST="72.60.154.65"
SERVER_PORT="22" # Default SSH port
DEST_DIR="~/lydzzmultitenant"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Starting Deployment to $SERVER_USER@$SERVER_HOST ===${NC}"

# Check for local requirements
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed or not in PATH.${NC}"
    exit 1
fi
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: node is not installed or not in PATH.${NC}"
    exit 1
fi

# Check for git updates
echo -e "${YELLOW}Checking for local git updates...${NC}"
git pull origin main || echo -e "${YELLOW}Git pull failed or not a git repo. Using current local files.${NC}"

# 0. Generate Build Info (Frontend)
echo -e "${YELLOW}Generating build info...${NC}"
if [ -d "frontend" ]; then
    cd frontend
    # Auto-increment patch version before building
    echo "Incrementing version..."
    NEW_VERSION=$(npm version patch --no-git-tag-version)
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}New version: $NEW_VERSION${NC}"
    else
        echo -e "${RED}Failed to increment version${NC}"
    fi
    
    # Generate build info file
    node generate-build-info.js
    cd ..
else
    echo -e "${RED}Error: frontend directory not found.${NC}"
    exit 1
fi

# 1. Create directory on server
echo -e "${YELLOW}Creating remote directory...${NC}"
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST "mkdir -p $DEST_DIR"

# 2. Sync files
# Using -I to ignore times and force update if size differs, ensuring changes are sent.
# Removed exclusion of .next/dist to ensure clean state on server side, though we exclude them to save bandwidth usually.
# Keeping exclusions but ensuring src/build-info.json and package.json are sent.
echo -e "${YELLOW}Syncing files...${NC}"

if command -v rsync &> /dev/null; then
    rsync -avz -I --delete -e "ssh -p $SERVER_PORT" \
        --exclude 'node_modules' \
        --exclude '.git' \
        --exclude '.next' \
        --exclude 'dist' \
        --exclude 'coverage' \
        --exclude '.env' \
        --exclude 'postgres_data' \
        --exclude 'redis_data' \
        ./ $SERVER_USER@$SERVER_HOST:$DEST_DIR/
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Rsync failed. Aborting.${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}rsync not found. Falling back to tar + scp...${NC}"
    
    TAR_FILE="deploy_package.tar.gz"
    
    # Create tarball excluding unwanted files
    # Using --exclude before the target '.'
    tar --exclude='node_modules' \
        --exclude='.git' \
        --exclude='.next' \
        --exclude='dist' \
        --exclude='coverage' \
        --exclude='.env' \
        --exclude='postgres_data' \
        --exclude='redis_data' \
        -czf $TAR_FILE .
        
    if [ $? -ne 0 ]; then
        echo -e "${RED}Tar creation failed. Please install rsync or ensure tar supports --exclude.${NC}"
        exit 1
    fi
    
    # Upload tarball
    echo -e "${YELLOW}Uploading package...${NC}"
    scp -P $SERVER_PORT $TAR_FILE $SERVER_USER@$SERVER_HOST:$DEST_DIR/
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}SCP failed. Aborting.${NC}"
        rm -f $TAR_FILE
        exit 1
    fi
    
    # Extract on server
    echo -e "${YELLOW}Extracting on server...${NC}"
    ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST "cd $DEST_DIR && tar -xzf $TAR_FILE && rm $TAR_FILE"
    
    # Cleanup local
    rm -f $TAR_FILE
fi

# 3. Handle Environment Variables
if [ -f .env.prod ]; then
    echo -e "${YELLOW}Uploading .env.prod as .env...${NC}"
    scp -P $SERVER_PORT .env.prod $SERVER_USER@$SERVER_HOST:$DEST_DIR/.env
else
    echo -e "${YELLOW}WARNING: .env.prod not found. Please ensure .env exists on the server.${NC}"
fi

# 3.4 Setup Swap Memory (Prevent OOM Killer during build)
echo -e "${YELLOW}Configuring Swap Memory (4GB)...${NC}"
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST "
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
scp -P $SERVER_PORT daemon.json $SERVER_USER@$SERVER_HOST:/etc/docker/daemon.json
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST "systemctl restart docker"

# 3.5 Setup Firewall (UFW) - Fix for connection timeouts
echo -e "${YELLOW}Configuring Firewall (UFW) to allow ports...${NC}"
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST "
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
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST "
    # Install Certbot if not present
    if ! command -v certbot &> /dev/null; then
        apt-get update
        apt-get install -y certbot python3-certbot-nginx
    fi
"

scp -P $SERVER_PORT nginx.conf $SERVER_USER@$SERVER_HOST:/etc/nginx/sites-available/default
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST "nginx -t && systemctl reload nginx"

# 4. Build and Start Containers
echo -e "${YELLOW}Building and starting containers...${NC}"
# Force rebuild of frontend and backend to pick up new code/version
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST "
    cd $DEST_DIR
    echo 'Current directory content:'
    ls -la frontend/package.json
    echo 'Checking version on server:'
    grep 'version' frontend/package.json
    
    echo 'Rebuilding containers...'
    # Build first to ensure success before stopping services
    if docker compose -f docker-compose.prod.yml build --no-cache frontend backend; then
        echo 'Build successful. Restarting services...'
        docker compose -f docker-compose.prod.yml down
        docker compose -f docker-compose.prod.yml up -d
        echo 'Pruning unused images...'
        docker image prune -f
    else
        echo 'Build failed! Keeping previous version running.'
        exit 1
    fi
"

echo -e "${GREEN}=== Deployment Complete! ===${NC}"
echo -e "Check status with: ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST 'cd ~/lydzzmultitenant && docker compose -f docker-compose.prod.yml ps'"
