# Docker Development Environment Guide

## Prerequisites
- Docker Desktop installed and running
- Environment variables configured in `env/dev.env`

## Quick Start

### 1. Start Development Environment
```bash
docker-compose --profile dev up
```

This command starts:
- **MongoDB Dev**: Database on port 27020
- **API Dev Server**: NestJS app with hot reload on port 3002

### 2. Development Features
- **Hot Reload**: Code changes automatically restart the server
- **Volume Mounting**: Local source code synced with container
- **Isolated Database**: Separate dev database from production
- **Environment Variables**: Loaded from `env/dev.env`

### 3. Useful Commands
```bash
# Start in background
docker-compose --profile dev up -d

# View logs
docker-compose --profile dev logs -f nestjs-dev

# Stop services
docker-compose --profile dev down

# Rebuild after dependency changes
docker-compose --profile dev up --build
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
- Run `docker-compose --profile dev down` to reset
- Check `env/dev.env` exists and has required variables

The development environment provides a consistent, containerized setup with hot reload for efficient coding.