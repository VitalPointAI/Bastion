# Backend Dockerfile - Multi-stage build for BASTION secure backend
# Node.js with TypeScript for TEE routing, blockchain sync, and API services

# =====================================
# Stage 1: Build
# =====================================
FROM node:20-slim AS builder

# Install git (required for some pnpm dependencies)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files and patches for dependency caching
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Install dependencies (including devDependencies for build)
RUN pnpm install

# Copy source files
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN pnpm build

# =====================================
# Stage 2: Production Runtime
# =====================================
FROM node:20-slim AS runtime

# Install git (required for some pnpm dependencies)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Create non-root user for security
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home nodejs

WORKDIR /app

# Copy package files and patches
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Install only production dependencies
RUN pnpm install --prod

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# Copy database schema files (needed for init)
COPY database/ ./database/

# Copy migration SQL files (migration-runner.ts reads from dist/db/migrations/)
COPY src/db/migrations/ ./dist/db/migrations/

# Set ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Environment defaults (override at runtime)
ENV NODE_ENV=production
ENV PORT=3001

# Expose API port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "fetch('http://localhost:3001/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start the application
CMD ["node", "dist/index.js"]
