#!/bin/bash

# ==========================================
# VPS Deployment Script
# Run this script INSIDE the VPS to update the application
# Usage: ./vps-update.sh
# ==========================================

# Configuration
APP_DIR="$HOME/lydzzmultitenant"
DOCKER_COMPOSE_FILE="docker-compose.prod.yml"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Starting VPS Deployment ===${NC}"

# 1. Navigate to Project Directory
if [ -d "$APP_DIR" ]; then
    cd "$APP_DIR" || exit
    echo -e "${YELLOW}Entered directory: $APP_DIR${NC}"
else
    echo -e "${RED}Error: Directory $APP_DIR not found.${NC}"
    echo "Please ensure the project is cloned/uploaded to $APP_DIR"
    exit 1
fi

# 2. Pull Latest Code (if using Git)
if [ -d ".git" ]; then
    echo -e "${YELLOW}Pulling latest changes from Git...${NC}"
    git fetch origin main
    git reset --hard origin/main
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Git update successful.${NC}"
    else
        echo -e "${RED}Git pull failed. Continuing with current files...${NC}"
    fi
else
    echo -e "${YELLOW}Not a git repository. Skipping git pull.${NC}"
fi

# 3. Verify Environment File
if [ ! -f ".env" ]; then
    echo -e "${RED}Error: .env file is missing!${NC}"
    echo "Please upload .env.prod as .env before deploying."
    exit 1
fi

# 4. Rebuild and Restart Containers
echo -e "${YELLOW}Rebuilding and restarting containers...${NC}"

# Stop existing containers
docker compose -f $DOCKER_COMPOSE_FILE down

# Prune unused images to save space (optional but good for VPS)
echo -e "${YELLOW}Cleaning up old docker images...${NC}"
docker image prune -f

# Build with no cache to ensure latest code is used
echo -e "${YELLOW}Building images (no-cache)...${NC}"
docker compose -f $DOCKER_COMPOSE_FILE build --no-cache

# Start containers in detached mode
echo -e "${YELLOW}Starting services...${NC}"
docker compose -f $DOCKER_COMPOSE_FILE up -d

# 5. Health Check
echo -e "${YELLOW}Checking container status...${NC}"
sleep 5
docker compose -f $DOCKER_COMPOSE_FILE ps

echo -e "${GREEN}=== Deployment Complete! ===${NC}"
echo -e "Monitor logs with: docker compose -f $DOCKER_COMPOSE_FILE logs -f"
