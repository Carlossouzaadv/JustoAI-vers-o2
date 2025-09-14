import { NextRequest } from 'next/server'
import { successResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

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