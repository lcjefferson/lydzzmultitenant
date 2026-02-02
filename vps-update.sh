#!/bin/bash

# Configuration
DEST_DIR="~/lydzzmultitenant"
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=== Starting Local Update on VPS ===${NC}"

# 1. Update Code
echo -e "${YELLOW}Pulling latest code...${NC}"
cd $DEST_DIR || exit
git pull origin main

# 2. Update Environment Variables (Optional - if needed)
# if [ -f .env.prod ]; then
#     cp .env.prod .env
# fi

# 3. Rebuild and Restart Containers
echo -e "${YELLOW}Rebuilding containers...${NC}"
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

echo -e "${GREEN}=== Update Complete! ===${NC}"
echo "Check status with: docker compose -f docker-compose.prod.yml ps"
