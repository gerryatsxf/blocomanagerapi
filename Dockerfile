# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:20-alpine AS builder

# Native deps for bcrypt
RUN apk add --no-cache python3 make g++ \
    && rm -rf /var/cache/apk/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --prefer-offline \
    && npm cache clean --force \
    && rm -rf ~/.npm

COPY . .

RUN NODE_OPTIONS="--max-old-space-size=2048" npm run build

# ── Stage 2: Production runtime ────────────────────────────────
FROM node:20-alpine

RUN apk add --no-cache curl \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy only production dependencies manifest, then install
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --prefer-offline \
    && npm cache clean --force \
    && rm -rf ~/.npm

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Copy public static assets (admin panel, tenant panel)
COPY --from=builder /app/public ./public

# Non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /app
USER appuser

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ENV PORT=3002
ENV NODE_OPTIONS="--max-old-space-size=256"

EXPOSE 3002

CMD ["node", "dist/main.js"]
