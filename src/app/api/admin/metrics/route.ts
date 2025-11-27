/**
 * API Endpoint - System Metrics & Monitoring
 * GET /api/admin/metrics
 *
 * Exposes real-time system metrics for monitoring and dashboards
 * Includes: API performance, database health, queue status, resource usage
 *
 * Authentication: Admin only (via API key or session)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRedisConnection } from '@/lib/redis'
import { log, logError } from '@/lib/services/logger'
import { ICONS } from '@/lib/icons'

// Metrics types
interface SystemMetrics {
  timestamp: string
  uptime: number
  environment: string
  database: DatabaseMetrics
  redis: RedisMetrics
  api: APIMetrics
  jobs: JobMetrics
  performance: PerformanceMetrics
}

interface DatabaseMetrics {
  healthy: boolean
  connectionCount: number
  activeConnections: number
  queryTime: number // Average query time in ms
  lastCheck: string
}

interface RedisMetrics {
  healthy: boolean
  connectedClients: number
  usedMemory: number
  keyCount: number
  uptime: number
  lastCheck: string
}

interface APIMetrics {
  totalRequests: number
  requestsPerSecond: number
  averageResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  errorRate: number
  statusCodes: Record<number, number>
}

interface JobMetrics {
  queuedJobs: number
  processingJobs: number
  completedJobs: number
  failedJobs: number
  averageProcessingTime: number
}

interface PerformanceMetrics {
  memoryUsage: {
    heapUsed: number
    heapTotal: number
    external: number
    rss: number
  }
  cpuUsage: number
  uptime: number
}

export async function GET(request: NextRequest) {
  try {
    // ============================================================
    // AUTHORIZATION CHECK
    // ============================================================

    const authHeader = request.headers.get('authorization')
    const apiKey = process.env.ADMIN_API_KEY

    if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    log.info({
      msg: 'Metrics request received',
      component: 'metricsEndpoint',
    })

    // ============================================================
    // COLLECT METRICS
    // ============================================================

    const metrics: SystemMetrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'unknown',
      database: await getDatabaseMetrics(),
      redis: await getRedisMetrics(),
      api: getAPIMetrics(),
      jobs: await getJobMetrics(),
      performance: getPerformanceMetrics(),
    }

    // ============================================================
    // RETURN METRICS
    // ============================================================

    return NextResponse.json(metrics, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    logError(error, 'Error collecting metrics', { component: 'metricsEndpoint' })

    return NextResponse.json(
      {
        error: 'Failed to collect metrics',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

/**
 * Get database connection metrics
 */
async function getDatabaseMetrics(): Promise<DatabaseMetrics> {
  const startTime = Date.now()

  try {
    // Run a health check query
    const result = await prisma.$queryRaw`SELECT 1 as health`

    const queryTime = Date.now() - startTime

    // Get connection pool stats (approximate)
    const metrics = await prisma.$metrics.json()
    const connectionCount = (metrics as any)?.connection?.total || 0

    return {
      healthy: Array.isArray(result) && result.length > 0,
      connectionCount,
      activeConnections: Math.floor(connectionCount * 0.7), // Approximate
      queryTime,
      lastCheck: new Date().toISOString(),
    }
  } catch (error) {
    logError(error, 'Failed to get database metrics', { component: 'metricsEndpoint' })

    return {
      healthy: false,
      connectionCount: 0,
      activeConnections: 0,
      queryTime: 0,
      lastCheck: new Date().toISOString(),
    }
  }
}

/**
 * Get Redis metrics
 */
async function getRedisMetrics(): Promise<RedisMetrics> {
  try {
    const redis = getRedisConnection()

    if (!redis) {
      return {
        healthy: false,
        connectedClients: 0,
        usedMemory: 0,
        keyCount: 0,
        uptime: 0,
        lastCheck: new Date().toISOString(),
      }
    }

    // Get Redis info
    const info = await redis.info()
    const infoLines = info.split('\r\n')

    let connectedClients = 0
    let usedMemory = 0
    let uptime = 0

    for (const line of infoLines) {
      if (line.startsWith('connected_clients:')) {
        connectedClients = parseInt(line.split(':')[1])
      }
      if (line.startsWith('used_memory:')) {
        usedMemory = parseInt(line.split(':')[1])
      }
      if (line.startsWith('uptime_in_seconds:')) {
        uptime = parseInt(line.split(':')[1])
      }
    }

    // Get key count
    const keyCount = await redis.dbsize()

    return {
      healthy: true,
      connectedClients,
      usedMemory,
      keyCount,
      uptime,
      lastCheck: new Date().toISOString(),
    }
  } catch (error) {
    logError(error, 'Failed to get Redis metrics', { component: 'metricsEndpoint' })

    return {
      healthy: false,
      connectedClients: 0,
      usedMemory: 0,
      keyCount: 0,
      uptime: 0,
      lastCheck: new Date().toISOString(),
    }
  }
}

/**
 * Get API performance metrics (from logs or in-memory store)
 */
function getAPIMetrics(): APIMetrics {
  // In production, these would be collected from actual API calls
  // For now, we return mock data structure

  return {
    totalRequests: 0,
    requestsPerSecond: 0,
    averageResponseTime: 0,
    p95ResponseTime: 0,
    p99ResponseTime: 0,
    errorRate: 0,
    statusCodes: {
      200: 0,
      201: 0,
      400: 0,
      401: 0,
      404: 0,
      500: 0,
    },
  }
}

/**
 * Get job queue metrics
 */
async function getJobMetrics(): Promise<JobMetrics> {
  try {
    const queuedJobs = await prisma.backgroundJob.count({
      where: { status: 'PENDING' },
    })

    const processingJobs = await prisma.backgroundJob.count({
      where: { status: 'PROCESSING' },
    })

    const completedJobs = await prisma.backgroundJob.count({
      where: { status: 'COMPLETED' },
    })

    const failedJobs = await prisma.backgroundJob.count({
      where: { status: 'FAILED' },
    })

    // Calculate average processing time (last 100 completed jobs)
    const completedJobsData = await prisma.backgroundJob.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      take: 100,
      select: { createdAt: true, completedAt: true },
    })

    const avgProcessingTime =
      completedJobsData.length > 0
        ? completedJobsData.reduce((sum, job) => {
            if (job.completedAt && job.createdAt) {
              return sum + (job.completedAt.getTime() - job.createdAt.getTime())
            }
            return sum
          }, 0) / completedJobsData.length
        : 0

    return {
      queuedJobs,
      processingJobs,
      completedJobs,
      failedJobs,
      averageProcessingTime: Math.round(avgProcessingTime),
    }
  } catch (error) {
    logError(error, 'Failed to get job metrics', { component: 'metricsEndpoint' })

    return {
      queuedJobs: 0,
      processingJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      averageProcessingTime: 0,
    }
  }
}

/**
 * Get Node.js process performance metrics
 */
function getPerformanceMetrics(): PerformanceMetrics {
  const memUsage = process.memoryUsage()

  return {
    memoryUsage: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // Convert to MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024),
    },
    cpuUsage: 0, // Would require additional instrumentation
    uptime: Math.round(process.uptime()),
  }
}
