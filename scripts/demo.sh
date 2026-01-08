#!/bin/bash

# MES MVP Demo Script
# This script sets up and runs the complete MES MVP demo environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "=============================================="
echo "    MES MVP - Manufacturing Execution System"
echo "         One-Command Demo Setup"
echo "=============================================="
echo -e "${NC}"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}No .env file found. Creating from .env.example...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${YELLOW}Please update .env with your Clerk API keys before running again.${NC}"
        echo -e "${YELLOW}Get your keys from: https://dashboard.clerk.com/last-active?path=api-keys${NC}"
        exit 1
    else
        echo -e "${RED}Error: .env.example not found. Please create a .env file.${NC}"
        exit 1
    fi
fi

# Check for required environment variables
source .env 2>/dev/null || true
if [ -z "$CLERK_SECRET_KEY" ] || [ "$CLERK_SECRET_KEY" = "sk_test_REPLACE_ME" ]; then
    echo -e "${RED}Error: CLERK_SECRET_KEY is not set or is a placeholder.${NC}"
    echo -e "${YELLOW}Please update your .env file with your Clerk API key.${NC}"
    exit 1
fi

if [ -z "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" ] || [ "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" = "pk_test_REPLACE_ME" ]; then
    echo -e "${RED}Error: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set or is a placeholder.${NC}"
    echo -e "${YELLOW}Please update your .env file with your Clerk publishable key.${NC}"
    exit 1
fi

# Step 1: Start PostgreSQL
echo -e "${GREEN}[1/5] Starting PostgreSQL...${NC}"
docker compose up -d postgres

# Wait for PostgreSQL to be healthy
echo -e "${YELLOW}Waiting for PostgreSQL to be ready...${NC}"
until docker compose exec -T postgres pg_isready -U mes -d mes 2>/dev/null; do
    sleep 1
done
echo -e "${GREEN}PostgreSQL is ready!${NC}"

# Step 2: Install dependencies (if not already installed)
echo -e "${GREEN}[2/5] Checking dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing npm packages...${NC}"
    npm ci
fi

# Generate Prisma client
echo -e "${YELLOW}Generating Prisma client...${NC}"
npx prisma generate

# Step 3: Run migrations
echo -e "${GREEN}[3/5] Running database migrations...${NC}"
npx prisma migrate deploy

# Step 4: Seed database
echo -e "${GREEN}[4/5] Seeding demo data...${NC}"
npx prisma db seed

# Step 5: Run simulation (optional, creates realistic data)
echo -e "${GREEN}[5/5] Running production simulation...${NC}"
npx tsx prisma/simulate.ts

echo ""
echo -e "${GREEN}=============================================="
echo "             Demo Setup Complete!"
echo "==============================================${NC}"
echo ""
echo -e "${BLUE}Start the development server:${NC}"
echo "  npm run dev"
echo ""
echo -e "${BLUE}Then open:${NC}"
echo "  http://localhost:3000"
echo ""
echo -e "${BLUE}Demo Credentials (create in Clerk Dashboard):${NC}"
echo "  Admin:      admin@example.com"
echo "  Supervisor: supervisor@example.com"
echo "  Operator:   operator@example.com"
echo ""
echo -e "${BLUE}Available Routes:${NC}"
echo "  /dashboard    - Supervisor dashboard"
echo "  /station      - Operator interface"
echo "  /admin        - Admin configuration"
echo "  /traceability - Unit traceability search"
echo ""
echo -e "${YELLOW}Note: You may need to configure users in your Clerk dashboard"
echo "and set their roles via custom claims or metadata.${NC}"
echo ""
