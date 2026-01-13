# Frontend Dockerfile - Multi-stage build for BASTION React frontend
# Vite + React + TypeScript with Privy authentication

# =====================================
# Stage 1: Build
# =====================================
FROM node:20-slim AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files for dependency caching
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY . .

# Build arguments for environment variables at build time
# These are baked into the static build
ARG VITE_PRIVY_APP_ID
ARG VITE_NEAR_NETWORK=testnet
ARG VITE_NEAR_RPC=https://rpc.testnet.near.org
ARG VITE_PINATA_GATEWAY
ARG VITE_BACKEND_URL=http://localhost:3001

# Set environment for build
ENV VITE_PRIVY_APP_ID=${VITE_PRIVY_APP_ID}
ENV VITE_NEAR_NETWORK=${VITE_NEAR_NETWORK}
ENV VITE_NEAR_RPC=${VITE_NEAR_RPC}
ENV VITE_PINATA_GATEWAY=${VITE_PINATA_GATEWAY}
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}

# Build for production
RUN pnpm build

# =====================================
# Stage 2: Development Server
# =====================================
FROM node:20-slim AS development

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including dev)
RUN pnpm install --frozen-lockfile

# Copy source files (will be overridden by volume mount in dev)
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Start Vite development server
CMD ["pnpm", "dev", "--host", "0.0.0.0"]

# =====================================
# Stage 3: Production Static Server
# =====================================
FROM nginx:alpine AS production

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
