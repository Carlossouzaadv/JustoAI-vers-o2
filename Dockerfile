# Multi-stage build for Next.js standalone deployment
FROM node:18-bookworm AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY .npmrc* ./

# Install dependencies (mozjpeg needs build tools available in bookworm)
RUN npm install --legacy-peer-deps --prefer-offline --no-audit

# Copy source code
COPY . .

# Generate Prisma Client BEFORE building Next.js
# This is needed because Next.js build may need to execute code that uses Prisma
RUN npx prisma generate

# Build Next.js app (generates .next/ folder)
RUN npm run build

# Production image - use slim variant to reduce size
FROM node:18-bookworm-slim

WORKDIR /app

# Install runtime dependencies (OpenSSL required by Prisma, poppler-utils for PDF extraction)
RUN apt-get update -y && apt-get install -y openssl poppler-utils && rm -rf /var/lib/apt/lists/*

# Copy built .next folder from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy configuration files (needed for tsx to resolve path aliases)
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/tsconfig*.json ./
COPY --from=builder /app/package.json ./

# Copy source code (needed for workers which use tsx)
COPY --from=builder /app/src ./src

# Copy prisma directory
COPY --from=builder /app/prisma ./prisma

# Copy ALL node_modules (needed for Prisma Query Engine and runtime dependencies)
# Prisma Query Engine is an architecture-specific binary that must be copied as-is
COPY --from=builder /app/node_modules ./node_modules

# Copy public files
COPY --from=builder /app/public ./public

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

# Health check (only for web service)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 0

# Default: start as web service (Next.js standalone)
# For workers, override CMD to: npx tsx src/workers/juditOnboardingWorker.ts
CMD ["node", "server.js"]
