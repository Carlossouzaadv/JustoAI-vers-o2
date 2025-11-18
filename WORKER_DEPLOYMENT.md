# JUDIT Onboarding Worker - Deployment Guide

## Overview
The JUDIT Onboarding Worker processes document onboarding jobs asynchronously using BullMQ and Redis. This guide covers deployment, signal handling, and graceful shutdown.

## Problem: SIGTERM Errors

### Root Cause
When using `npx tsx`, npm becomes PID 1 in Docker containers. SIGTERM signals are not properly forwarded to the worker process, causing abrupt termination.

**Error:**
```
npm error signal SIGTERM
npm error command sh -c tsx -r tsconfig-paths/register src/workers/juditOnboardingWorker.ts
```

### Solution
Use `node --loader tsx/esm` instead of `npx tsx` to ensure:
- **Node becomes PID 1** - Directly receives and forwards signals
- **Proper graceful shutdown** - Worker has time to finish active jobs
- **No npm intermediary** - Eliminates signal forwarding issues

## Deployment Methods

### 1. Docker (Recommended)

Build worker image:
```bash
docker build -f Dockerfile.worker -t justoai-worker:latest .
```

Run worker:
```bash
docker run \
  --env-file .env.production \
  --name judit-worker \
  justoai-worker:latest
```

The Dockerfile uses `node --loader tsx/esm` to ensure proper signal handling.

### 2. Local Development

```bash
npm run worker:judit:dev
```

This uses `npx tsx` which is fine for development.

### 3. PM2 (Production Linux/Mac)

```bash
npm run worker:judit:pm2
```

Or manually:
```bash
pm2 start --name judit-worker \
  --interpreter node \
  -- --loader tsx/esm src/workers/juditOnboardingWorker.ts
```

### 4. Direct Node (Production)

```bash
node --loader tsx/esm src/workers/juditOnboardingWorker.ts
```

## Environment Variables

Required in `.env.production`:
```env
# Redis
REDIS_URL=redis://localhost:6379

# Database
DATABASE_URL=postgresql://user:pass@host/db
DIRECT_URL=postgresql://user:pass@host/db

# JUDIT API
JUDIT_API_KEY=your-api-key
JUDIT_BASE_URL=https://api.judit.com

# Optional: Worker concurrency
WORKER_CONCURRENCY=2
```

## Graceful Shutdown

The worker handles graceful shutdown with:

1. **Signal Handlers**: Listens to SIGTERM and SIGINT
2. **Shutdown Timeout**: 25 seconds to finish active jobs
3. **Job Queue Pause**: Stops accepting new jobs
4. **Cleanup**: Properly closes Redis connections

### Shutdown Flow

```
SIGTERM received
  ↓
gracefulShutdown() called
  ↓
worker.close() - stops accepting new jobs
  ↓
Wait for active jobs to complete (max 25s)
  ↓
process.exit(0) or process.exit(1)
```

### Testing Graceful Shutdown

```bash
# Start worker
npm run worker:judit:dev

# In another terminal, get PID
ps aux | grep juditOnboardingWorker

# Send SIGTERM (0-25s for graceful shutdown)
kill -TERM <PID>

# Watch logs for "graceful_shutdown_success"
```

## Docker Compose Example

```yaml
services:
  judit-worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    container_name: justoai-judit-worker
    restart: unless-stopped
    env_file: .env.production
    depends_on:
      redis:
        condition: service_healthy
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "node", "-e", "require('redis').createClient(process.env.REDIS_URL).ping()"]
      interval: 30s
      timeout: 10s
      retries: 3
    stop_grace_period: 30s  # Critical: give worker 30s for graceful shutdown
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

**Important**: `stop_grace_period: 30s` tells Docker to wait 30 seconds for graceful shutdown before SIGKILL.

## Monitoring

### Health Checks

Worker logs important events:
- `worker_ready` - Worker started successfully
- `job_active` - Job processing started
- `job_completed` - Job finished successfully
- `job_failed` - Job failed (will retry)
- `graceful_shutdown_start` - Shutdown initiated
- `graceful_shutdown_success` - Clean shutdown
- `graceful_shutdown_timeout` - Timeout reached (forced exit)

### Circuit Breaker

The worker includes circuit breaker protection for API quota limits:
- If quota exceeded: Worker pauses automatically
- Auto-retry: Scheduled retry when quota resets
- Status: Check `/api/health/system` for quota status

### Logs

View worker logs:
```bash
# Docker
docker logs -f judit-worker

# PM2
pm2 logs judit-worker

# Production: Check Sentry or centralized logging
```

## Troubleshooting

### Worker Won't Start

1. **Check Redis connection:**
   ```bash
   redis-cli ping
   ```

2. **Check JUDIT API configuration:**
   ```bash
   npm run verify:worker
   ```

3. **Check Node/TypeScript:**
   ```bash
   node --version  # Should be ≥ 18
   npm ls tsx      # Should be installed
   ```

### SIGTERM Errors

- **Using old image?** Rebuild with `docker build --no-cache -f Dockerfile.worker`
- **Not using docker?** Ensure `node --loader tsx/esm` in your deployment
- **Grace period too short?** Increase `stop_grace_period` in docker-compose

### Jobs Not Processing

1. **Check Redis connection** - Worker needs Redis
2. **Check JUDIT API key** - Set JUDIT_API_KEY
3. **Check queue** - Visit `http://localhost:3000/admin/queue` (if Bull Board enabled)

### High Memory Usage

Worker configuration in `Dockerfile.worker` (optimize if needed):
- `WORKER_CONCURRENCY`: Default 2 (lower = less memory, slower throughput)
- `lockDuration`: 30s (default - adjust if jobs take longer)

## Migration from npx tsx

If migrating existing deployment:

1. **Update Dockerfile**
   ```dockerfile
   # OLD
   CMD ["npx", "tsx", "src/workers/juditOnboardingWorker.ts"]

   # NEW
   CMD ["node", "--loader", "tsx/esm", "src/workers/juditOnboardingWorker.ts"]
   ```

2. **Update PM2 config**
   ```bash
   pm2 delete judit-worker
   npm run worker:judit:pm2
   ```

3. **Update docker-compose.yml**
   ```yaml
   stop_grace_period: 30s
   ```

## Performance Tuning

### Concurrency
Default: 2 jobs at a time. Adjust based on:
- JUDIT API rate limits (~60 requests/minute)
- Server resources (CPU, memory)

```bash
# High throughput
WORKER_CONCURRENCY=5

# Conservative (low cost)
WORKER_CONCURRENCY=1
```

### Rate Limiting
Worker respects JUDIT API limits:
- Max 10 jobs per 60 seconds
- Automatic backoff if quota exceeded

### Job Retries
Failed jobs automatically retry:
- Max 3 attempts per job
- Exponential backoff between retries

## Architecture

```
Docker Container
  ├── Node.js (PID 1)
  │   ├── Signal Handlers (SIGTERM/SIGINT)
  │   └── Worker Process
  │       ├── Processor (processOnboardingJob)
  │       ├── BullMQ Worker
  │       ├── Redis Connection
  │       └── Graceful Shutdown Handler
  │
  └── Health: Monitors queue and job status
```

## References

- [BullMQ Documentation](https://docs.bullmq.io/)
- [Node.js Signal Handling](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [Docker Graceful Shutdown](https://www.docker.com/blog/graceful-shutdown-with-docker/)
