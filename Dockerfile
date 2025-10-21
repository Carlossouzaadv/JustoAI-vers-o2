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

# Copy built .next folder from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma client (needed for runtime if APIs use DB)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy public files if they exist
COPY --from=builder /app/public ./public 2>/dev/null || true

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start the standalone server
CMD ["node", "server.js"]
