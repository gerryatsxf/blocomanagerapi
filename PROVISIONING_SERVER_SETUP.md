# Provisioning Server Setup Guide

## Overview

The Provisioning Server is the orchestration layer of the multi-tenant BlocoManager system. It receives tenant creation requests from the main BlocoManager API, deploys isolated Docker containers for each tenant, configures nginx reverse proxy routing, and sends deployment status updates via webhooks.

**Key Responsibilities:**
- Receive tenant provisioning requests from BlocoManager API
- Create and manage isolated Docker containers (512MB RAM limit per tenant)
- Generate and update nginx configuration for subdomain routing
- Send webhook callbacks with deployment status
- Manage container lifecycle (deploy, status check, undeploy)

## Technology Stack

- **Node.js/Express** - HTTP server and API endpoints
- **dockerode** - Docker SDK for container management
- **nginx** - Reverse proxy for routing tenant subdomains
- **axios** - HTTP client for webhook callbacks
- **crypto** - Webhook signature verification
- **uuid** - Unique deployment ID generation

## Project Structure

```
provisioning-server/
├── server.js                 # Main Express application
├── package.json              # Dependencies and scripts
├── .env                      # Environment configuration
├── config/
│   ├── docker.js            # Docker configuration
│   └── nginx.js             # nginx template generator
├── middleware/
│   └── auth.js              # API key authentication
├── routes/
│   ├── provision.js         # Tenant provisioning endpoint
│   ├── status.js            # Deployment status endpoint
│   └── undeploy.js          # Container removal endpoint
├── services/
│   ├── dockerService.js     # Docker container operations
│   ├── nginxService.js      # nginx configuration management
│   └── webhookService.js    # Webhook callback handler
├── utils/
│   ├── logger.js            # Logging utility
│   └── validation.js        # Request validation
└── logs/
    └── provisioning.log     # Application logs
```

## Installation Steps

### 1. Initialize Node.js Project

```bash
mkdir provisioning-server
cd provisioning-server
npm init -y
```

### 2. Install Dependencies

```bash
npm install express dockerode axios dotenv uuid
npm install --save-dev nodemon
```

**Dependencies:**
- `express` - Web framework
- `dockerode` - Docker API client
- `axios` - HTTP client for webhooks
- `dotenv` - Environment variable management
- `uuid` - Generate unique deployment IDs
- `nodemon` - Development auto-reload (dev only)

### 3. Configure Docker Access

Ensure Docker is installed and running:

```bash
docker --version
```

**For macOS/Linux:**
```bash
# Ensure current user has Docker permissions
sudo usermod -aG docker $USER
# Restart shell or re-login
```

## Implementation Code

### Main Server Setup (server.js)

```javascript
require('dotenv').config();
const express = require('express');
const dockerService = require('./services/dockerService');
const nginxService = require('./services/nginxService');
const webhookService = require('./services/webhookService');
const authMiddleware = require('./middleware/auth');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Provision new tenant container
app.post('/provision', authMiddleware, async (req, res) => {
  const { tenantId, subdomain, databaseUrl, callbackUrl, apiKey } = req.body;

  // Validate request
  if (!tenantId || !subdomain || !databaseUrl || !callbackUrl) {
    return res.status(400).json({ 
      error: 'Missing required fields: tenantId, subdomain, databaseUrl, callbackUrl' 
    });
  }

  const deploymentId = uuidv4();

  console.log(`[${deploymentId}] Starting provisioning for tenant: ${tenantId}`);

  // Respond immediately with deployment ID
  res.json({ 
    deploymentId, 
    status: 'provisioning',
    message: 'Deployment started. Check status endpoint for updates.'
  });

  // Async provisioning process
  (async () => {
    try {
      // Step 1: Create Docker container
      console.log(`[${deploymentId}] Creating Docker container...`);
      const container = await dockerService.createContainer({
        tenantId,
        subdomain,
        databaseUrl,
        apiKey: apiKey || process.env.TENANT_DEFAULT_API_KEY,
        deploymentId
      });

      // Step 2: Start container
      console.log(`[${deploymentId}] Starting container...`);
      await container.start();

      // Step 3: Wait for container to be healthy
      console.log(`[${deploymentId}] Waiting for health check...`);
      await dockerService.waitForHealthy(container, 60000); // 60s timeout

      // Step 4: Update nginx configuration
      console.log(`[${deploymentId}] Updating nginx configuration...`);
      await nginxService.addTenant(subdomain, container.id);
      await nginxService.reload();

      // Step 5: Send success webhook
      console.log(`[${deploymentId}] Sending success webhook...`);
      await webhookService.sendCallback(callbackUrl, {
        deploymentId,
        tenantId,
        subdomain,
        status: 'deployed',
        containerId: container.id,
        url: `https://${subdomain}.${process.env.BASE_DOMAIN}`,
        timestamp: new Date().toISOString()
      });

      console.log(`[${deploymentId}] Provisioning completed successfully`);

    } catch (error) {
      console.error(`[${deploymentId}] Provisioning failed:`, error);

      // Send failure webhook
      await webhookService.sendCallback(callbackUrl, {
        deploymentId,
        tenantId,
        subdomain,
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  })();
});

// Get deployment status
app.get('/status/:deploymentId', authMiddleware, async (req, res) => {
  const { deploymentId } = req.params;

  try {
    const status = await dockerService.getDeploymentStatus(deploymentId);
    res.json(status);
  } catch (error) {
    res.status(404).json({ error: 'Deployment not found' });
  }
});

// Undeploy tenant (remove container and nginx config)
app.delete('/undeploy/:tenantId', authMiddleware, async (req, res) => {
  const { tenantId } = req.params;

  try {
    console.log(`Undeploying tenant: ${tenantId}`);

    // Step 1: Find and stop container
    const container = await dockerService.findContainer(tenantId);
    if (!container) {
      return res.status(404).json({ error: 'Container not found' });
    }

    await container.stop();
    await container.remove();

    // Step 2: Remove nginx configuration
    const subdomain = await dockerService.getSubdomain(container);
    await nginxService.removeTenant(subdomain);
    await nginxService.reload();

    res.json({ 
      status: 'undeployed',
      tenantId,
      message: 'Container removed and nginx updated'
    });

  } catch (error) {
    console.error('Undeploy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// List all tenant containers
app.get('/tenants', authMiddleware, async (req, res) => {
  try {
    const containers = await dockerService.listTenantContainers();
    res.json({ containers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Provisioning Server running on port ${PORT}`);
});
```

### Docker Service (services/dockerService.js)

```javascript
const Docker = require('dockerode');
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// Store deployment status in memory (use Redis in production)
const deployments = new Map();

async function createContainer({ tenantId, subdomain, databaseUrl, apiKey, deploymentId }) {
  const containerName = `blocomanager-${tenantId}`;
  
  // Get internal port for this container
  const internalPort = await getNextAvailablePort();

  const containerConfig = {
    name: containerName,
    Image: process.env.DOCKER_IMAGE || 'blocomanager-frontend:latest',
    Env: [
      `NEXT_PUBLIC_TENANT_ID=${tenantId}`,
      `NEXT_PUBLIC_API_BASE_URL=${process.env.API_BASE_URL}`,
      `NODE_ENV=production`,
      `PORT=3000`
    ],
    Labels: {
      'tenant.id': tenantId,
      'tenant.subdomain': subdomain,
      'deployment.id': deploymentId,
      'managed.by': 'provisioning-server'
    },
    HostConfig: {
      Memory: 512 * 1024 * 1024, // 512MB RAM limit
      MemoryReservation: 256 * 1024 * 1024, // 256MB soft limit
      CpuShares: 512, // CPU shares (relative weight)
      RestartPolicy: {
        Name: 'unless-stopped'
      },
      PortBindings: {
        '3000/tcp': [{ HostPort: internalPort.toString() }]
      }
    },
    ExposedPorts: {
      '3000/tcp': {}
    },
    Healthcheck: {
      Test: ['CMD', 'wget', '--quiet', '--tries=1', '--spider', 'http://localhost:3000/health'],
      Interval: 10000000000, // 10s
      Timeout: 5000000000,   // 5s
      Retries: 3,
      StartPeriod: 30000000000 // 30s
    }
  };

  const container = await docker.createContainer(containerConfig);
  
  // Store deployment info
  deployments.set(deploymentId, {
    deploymentId,
    tenantId,
    subdomain,
    containerId: container.id,
    status: 'created',
    createdAt: new Date().toISOString()
  });

  return container;
}

async function waitForHealthy(container, timeout = 60000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const info = await container.inspect();
    
    if (info.State.Health?.Status === 'healthy') {
      return true;
    }
    
    if (!info.State.Running) {
      throw new Error('Container stopped unexpectedly');
    }
    
    // Wait 2 seconds before next check
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('Health check timeout');
}

async function findContainer(tenantId) {
  const containers = await docker.listContainers({
    all: true,
    filters: {
      label: [`tenant.id=${tenantId}`]
    }
  });

  if (containers.length === 0) return null;
  
  return docker.getContainer(containers[0].Id);
}

async function getSubdomain(container) {
  const info = await container.inspect();
  return info.Config.Labels['tenant.subdomain'];
}

async function listTenantContainers() {
  const containers = await docker.listContainers({
    all: true,
    filters: {
      label: ['managed.by=provisioning-server']
    }
  });

  return containers.map(c => ({
    id: c.Id,
    name: c.Names[0],
    tenantId: c.Labels['tenant.id'],
    subdomain: c.Labels['tenant.subdomain'],
    state: c.State,
    status: c.Status
  }));
}

async function getDeploymentStatus(deploymentId) {
  return deployments.get(deploymentId) || null;
}

// Port management (simple implementation - use Redis in production)
let nextPort = 4000;
async function getNextAvailablePort() {
  return nextPort++;
}

module.exports = {
  createContainer,
  waitForHealthy,
  findContainer,
  getSubdomain,
  listTenantContainers,
  getDeploymentStatus
};
```

### nginx Service (services/nginxService.js)

```javascript
const fs = require('fs').promises;
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const NGINX_CONF_DIR = process.env.NGINX_CONF_DIR || '/etc/nginx/sites-enabled';
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'blocomanager.com';

async function addTenant(subdomain, containerId) {
  const confPath = `${NGINX_CONF_DIR}/${subdomain}.conf`;
  
  // Get container port mapping
  const Docker = require('dockerode');
  const docker = new Docker({ socketPath: '/var/run/docker.sock' });
  const container = docker.getContainer(containerId);
  const info = await container.inspect();
  
  const hostPort = info.NetworkSettings.Ports['3000/tcp'][0].HostPort;

  const config = `
server {
    listen 80;
    server_name ${subdomain}.${BASE_DOMAIN};

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:${hostPort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://localhost:${hostPort}/health;
    }
}
`;

  await fs.writeFile(confPath, config, 'utf8');
  console.log(`nginx config created: ${confPath}`);
}

async function removeTenant(subdomain) {
  const confPath = `${NGINX_CONF_DIR}/${subdomain}.conf`;
  
  try {
    await fs.unlink(confPath);
    console.log(`nginx config removed: ${confPath}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function reload() {
  try {
    // Test configuration first
    await execPromise('sudo nginx -t');
    
    // Reload nginx
    await execPromise('sudo systemctl reload nginx');
    console.log('nginx reloaded successfully');
  } catch (error) {
    console.error('nginx reload failed:', error);
    throw new Error(`nginx reload failed: ${error.message}`);
  }
}

module.exports = {
  addTenant,
  removeTenant,
  reload
};
```

### Webhook Service (services/webhookService.js)

```javascript
const axios = require('axios');
const crypto = require('crypto');

async function sendCallback(callbackUrl, payload) {
  const signature = generateSignature(payload);

  try {
    const response = await axios.post(callbackUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'User-Agent': 'ProvisioningServer/1.0'
      },
      timeout: 10000
    });

    console.log(`Webhook sent successfully to ${callbackUrl}`);
    return response.data;

  } catch (error) {
    console.error(`Webhook failed for ${callbackUrl}:`, error.message);
    
    // Retry once after 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    try {
      await axios.post(callbackUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature
        },
        timeout: 10000
      });
      console.log(`Webhook retry successful`);
    } catch (retryError) {
      console.error(`Webhook retry failed:`, retryError.message);
      throw retryError;
    }
  }
}

function generateSignature(payload) {
  const secret = process.env.WEBHOOK_SECRET || 'default-secret-key';
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

function verifySignature(payload, signature) {
  const expectedSignature = generateSignature(payload);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

module.exports = {
  sendCallback,
  generateSignature,
  verifySignature
};
```

### Authentication Middleware (middleware/auth.js)

```javascript
function authMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  if (apiKey !== process.env.PROVISIONING_API_KEY) {
    return res.status(403).json({ error: 'Invalid API key' });
  }

  next();
}

module.exports = authMiddleware;
```

## Configuration

### Environment Variables (.env)

```bash
# Server Configuration
PORT=3001
NODE_ENV=production

# Security
PROVISIONING_API_KEY=your-secure-api-key-here
WEBHOOK_SECRET=your-webhook-secret-here

# Docker Configuration
DOCKER_IMAGE=blocomanager-frontend:latest
API_BASE_URL=http://localhost:3002

# nginx Configuration
NGINX_CONF_DIR=/etc/nginx/sites-enabled
BASE_DOMAIN=blocomanager.com

# Tenant Defaults
TENANT_DEFAULT_API_KEY=default-tenant-api-key
```

### package.json

```json
{
  "name": "provisioning-server",
  "version": "1.0.0",
  "description": "BlocoManager Multi-Tenant Provisioning Server",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "dockerode": "^4.0.0",
    "dotenv": "^16.3.0",
    "express": "^4.18.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
```

## Testing

### 1. Start Provisioning Server

```bash
npm start
```

### 2. Test Provisioning Flow

```bash
curl -X POST http://localhost:3001/provision \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "test-tenant-001",
    "subdomain": "acme",
    "databaseUrl": "postgresql://user:pass@db:5432/tenant001",
    "callbackUrl": "http://localhost:3002/api/tenant-public/provisioning-webhook",
    "apiKey": "tenant-specific-key"
  }'
```

### 3. Check Deployment Status

```bash
curl http://localhost:3001/status/deployment-id \
  -H "X-API-Key: your-api-key"
```

### 4. Undeploy Tenant

```bash
curl -X DELETE http://localhost:3001/undeploy/test-tenant-001 \
  -H "X-API-Key: your-api-key"
```

## Deployment

### Production Setup

1. **Install nginx**:
```bash
sudo apt install nginx
```

2. **Configure nginx permissions**:
```bash
sudo visudo
# Add: provisionuser ALL=(ALL) NOPASSWD: /usr/sbin/nginx, /bin/systemctl reload nginx
```

3. **Set up SSL with Let's Encrypt**:
```bash
sudo certbot --nginx -d blocomanager.com -d *.blocomanager.com
```

4. **Use PM2 for process management**:
```bash
npm install -g pm2
pm2 start server.js --name provisioning-server
pm2 save
pm2 startup
```

---

**Documentation Version:** 1.0  
**Last Updated:** January 31, 2026
