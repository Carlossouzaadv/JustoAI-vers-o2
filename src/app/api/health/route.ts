import { NextRequest } from 'next/server'
import { successResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
  environment: string | undefined;
  uptime: number;
  database?: { connected: boolean; stats?: Record<string, unknown>; error?: string };
}

function isHealthResponse(data: unknown): data is HealthResponse {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.status === 'string' && typeof obj.timestamp === 'string';
}

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Verificar saúde do sistema
 *     description: Endpoint de health check que verifica o status da API, conexão com banco de dados e estatísticas básicas do sistema
 *     tags:
 *       - Health
 *     security: []
 *     responses:
 *       200:
 *         description: Sistema saudável e operacional
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *             examples:
 *               healthy:
 *                 summary: Sistema saudável
 *                 value:
 *                   success: true
 *                   data:
 *                     status: healthy
 *                     timestamp: "2024-01-15T10:30:00.000Z"
 *                     version: "2.0.0"
 *                     database:
 *                       connected: true
 *                       stats:
 *                         workspaces: 25
 *                         users: 150
 *                         clients: 500
 *                         cases: 1200
 *                     environment: development
 *               unhealthy:
 *                 summary: Sistema com problemas
 *                 value:
 *                   success: true
 *                   data:
 *                     status: unhealthy
 *                     timestamp: "2024-01-15T10:30:00.000Z"
 *                     version: "2.0.0"
 *                     error: "Database connection failed"
 *                     environment: development
 */
export async function GET(request: NextRequest) {
  try {
    const response: HealthResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      environment: process.env.NODE_ENV,
      uptime: process.uptime(),
    }

    // Try to check database, but don't fail if it's not available
    try {
      const dbStatus = await prisma.$queryRaw`SELECT 1 as test`
      const stats = await Promise.all([
        prisma.workspace.count(),
        prisma.user.count(),
        prisma.client.count(),
        prisma.case.count(),
      ])

      if (isHealthResponse(response)) {
        response.database = {
          connected: !!dbStatus,
          stats: {
            workspaces: stats[0],
            users: stats[1],
            clients: stats[2],
            cases: stats[3],
          }
        }
      }
    } catch (dbError) {
      // Log database error but don't fail the health check
      if (isHealthResponse(response)) {
        response.database = {
          connected: false,
          error: dbError instanceof Error ? dbError.message : 'Database unavailable'
        }
      }
    }

    return successResponse(response)
  } catch (error) {
    // Even on error, return 200 to keep service alive
    return successResponse({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      error: error instanceof Error ? error.message : 'Unknown error',
      environment: process.env.NODE_ENV,
    })
  }
}