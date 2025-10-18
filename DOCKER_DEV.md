# Docker Development Environment Guide

## Prerequisites
- Docker Desktop installed and running
- Environment variables configured in `env/dev.env`

## Quick Start

### 1. Automated Deployment (Recommended)
```bash
# Make script executable (first time only)
chmod +x deploy-local.sh

# Deploy with automatic env loading and cleanup
./deploy-local.sh
```

The deployment script:
- Loads variables from `env/dev.env` automatically  
- Performs system cleanup for memory optimization
- Builds and starts services without watch mode (production-like)
- Runs health checks and displays service info
- Mimics GitHub Actions deployment locally

### 2. Manual Development Environment
```bash
docker compose --profile dev up
```

This command starts:
- **MongoDB Dev**: Database on port 27020
- **API Dev Server**: NestJS app (production mode, no hot reload)

### 2. Development Features
- **Hot Reload**: Code changes automatically restart the server
- **Volume Mounting**: Local source code synced with container
- **Isolated Database**: Separate dev database from production
- **Environment Variables**: Loaded from `env/dev.env`

### 3. Useful Commands
```bash
# Start in background
docker compose --profile dev up -d

# View logs
docker compose --profile dev logs -f nestjs-dev

# Stop services
docker compose --profile dev down

# Rebuild after dependency changes
docker compose --profile dev up --build

# View all running containers
docker compose --profile dev ps

# Restart specific service
docker compose --profile dev restart nestjs-dev

# Remove volumes (fresh database)
docker compose --profile dev down --volumes
```

### 4. Database Access
**MongoDB Connection (MongoDB Compass Recommended)**
- **Connection String**: `mongodb://admin_root:admin_root@localhost:27020/?authSource=admin`
- **Database**: `blocomanager`
- **Admin Credentials**: `admin_root` / `admin_root`

**Using MongoDB Compass:**
1. Install [MongoDB Compass](https://www.mongodb.com/products/compass)
2. Use connection string above or manual setup:
   - Host: `localhost:27020`
   - Username: `admin_root`
   - Password: `admin_root`
   - Auth Database: `admin`

### 5. Troubleshooting
- If port 3002 is busy, stop other services
- Run `docker compose --profile dev down` to reset
- Check `env/dev.env` exists and has required variables
- For fresh start: `docker compose --profile dev down --volumes && docker compose --profile dev up --build`

### 6. Docker Compose Version Notes
This project uses **Docker Compose V2** syntax (`docker compose` with space).
- ✅ Modern: `docker compose`
- ❌ Legacy: `docker-compose` (deprecated)

The development environment provides a consistent, containerized setup with hot reload for efficient coding.