#!/bin/bash

# Local Docker Compose Deployment Script
# This script mimics the GitHub Actions deployment by reading env vars from dev.env
# and passing them to Docker Compose

set -e  # Exit on any error

echo "🚀 Starting local Docker Compose deployment..."

# Check if dev.env exists
if [ ! -f "env/dev.env" ]; then
    echo "❌ Error: env/dev.env file not found!"
    echo "Please make sure the dev.env file exists in the env/ directory"
    exit 1
fi

echo "📁 Loading environment variables from env/dev.env..."

# Source the dev.env file to load variables
set -a  # Automatically export all variables
source env/dev.env
set +a  # Stop auto-export

# Set additional deployment variables
export NODE_ENV=development
export PORT=3002
export DOCKER_ENV=true
export COMPOSE_PROJECT_NAME=blocomanager
export DOCKER_BUILDKIT=1

echo "🧹 Cleaning up existing containers and images..."

# Stop and remove existing containers
docker stop $(docker ps -aq) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true

# Clean up unused images and build cache for memory optimization
docker system prune -f --volumes || true
docker image prune -af || true
docker builder prune -af || true

echo "📊 System resources before build:"
echo "Memory:"
free -h 2>/dev/null || echo "Memory info not available on this system"
echo "Disk space:"
df -h . 2>/dev/null || echo "Disk info not available on this system"

echo "🏗️ Building and starting services with Docker Compose..."

# Export all the required environment variables for Docker Compose
# Use container service name instead of localhost for internal communication
export MONGO_DB_CONNECTION_STRING="mongodb://admin_root:admin_root@mongodb-dev:27017/blocomanager?authSource=admin"
export JWT_SECRET="${JWT_SECRET}"
export JWT_EXPIRES_IN="${JWT_EXPIRES_IN}"
export STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY}"
export STRIPE_PAYMENT_SUCCESS_WEBHOOK_SECRET_KEY="${STRIPE_PAYMENT_SUCCESS_WEBHOOK_SECRET_KEY}"
export NYLAS_MAIN_ACCOUNT_EMAIL="${NYLAS_MAIN_ACCOUNT_EMAIL}"
export NYLAS_CLIENT_ID="${NYLAS_CLIENT_ID}"
export NYLAS_CLIENT_SECRET="${NYLAS_CLIENT_SECRET}"
export NYLAS_MAIN_ACCOUNT_ACCESS_TOKEN="${NYLAS_MAIN_ACCOUNT_ACCESS_TOKEN}"
export NYLAS_MAIN_ACCOUNT_API_KEY="${NYLAS_MAIN_ACCOUNT_API_KEY}"
export NYLAS_MAIN_ACCOUNT_GRANT_ID="${NYLAS_MAIN_ACCOUNT_GRANT_ID}"
export CREATE_MEETING_URL="${CREATE_MEETING_URL}"
export VONAGE_JWT_365_DAYS="${VONAGE_JWT_365_DAYS}"

# Build and start services
docker compose --profile dev up -d --build

echo "📊 System resources after build:"
free -h 2>/dev/null || echo "Memory info not available on this system"

echo "⏳ Waiting for services to be ready..."
sleep 30

echo "📋 Container status:"
docker compose ps

echo "📝 Recent logs:"
docker compose logs --tail=50

echo "🩺 Performing health check..."
if curl -f http://localhost:3002/health 2>/dev/null; then
    echo "✅ Health check passed!"
else
    echo "⚠️  Health check failed, but containers are running. Check logs above."
fi

echo "🎯 Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 Service Information:"
echo "   API URL: http://localhost:3002"
echo "   API Documentation: http://localhost:3002/api-docs"
echo "   MongoDB: mongodb://localhost:27020"
echo ""
echo "📊 Final system status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "🔧 Useful commands:"
echo "   View logs: docker compose logs -f"
echo "   Stop services: docker compose --profile dev down"
echo "   Restart: docker compose --profile dev restart"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"