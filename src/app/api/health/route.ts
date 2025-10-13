import { NextRequest } from 'next/server'
import { successResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

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
    // Test database connection
    const dbStatus = await prisma.$queryRaw`SELECT 1 as test`

    // Get basic stats
    const stats = await Promise.all([
      prisma.workspace.count(),
      prisma.user.count(),
      prisma.client.count(),
      prisma.case.count(),
    ])

    return successResponse({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      database: {
        connected: !!dbStatus,
        stats: {
          workspaces: stats[0],
          users: stats[1],
          clients: stats[2],
          cases: stats[3],
        }
      },
      environment: process.env.NODE_ENV,
    })
  } catch (error) {
    return successResponse({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      error: error instanceof Error ? error.message : 'Unknown error',
      environment: process.env.NODE_ENV,
    })
  }
}