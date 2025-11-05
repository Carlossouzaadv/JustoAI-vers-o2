import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  requireAuth,
  validateQuery,
  rateLimit,
  getClientIP
} from '@/lib/api-utils'
import { z } from 'zod'

// Validation schema
const analyticsQuerySchema = z.object({
  metric: z.enum(['processing_time', 'success_rate', 'volume', 'performance']).optional(),
  period: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
  workspaceId: z.string().cuid().optional(),
})

// GET /api/analytics - Get analytics data
async function GET(request: NextRequest) {
  // Rate limiting
  const clientIP = getClientIP(request)
  const { allowed, error: rateLimitError } = await rateLimit(`analytics:${clientIP}`)
  if (!allowed) return rateLimitError!

  // Auth check
  const { user, error: authError } = await requireAuth(request)
  if (!user) return authError!

  // Query validation
  const { data: query, error: queryError } = validateQuery(request, analyticsQuerySchema)
  if (!query) return queryError!

  const { metric, period, workspaceId } = query

  try {
    // Get workspace access
    let workspaceIds: string[] = []

    if (workspaceId) {
      // Check specific workspace access
      const hasAccess = await prisma.userWorkspace.findFirst({
        where: {
          userId: user.id,
          workspaceId,
          status: 'ACTIVE'
        }
      })

      if (!hasAccess) {
        return errorResponse('Access denied to workspace', 403)
      }
      workspaceIds = [workspaceId]
    } else {
      // Get all user workspaces
      const userWorkspaces = await prisma.userWorkspace.findMany({
        where: {
          userId: user.id,
          status: 'ACTIVE'
        },
        select: { workspaceId: true }
      })
      workspaceIds = userWorkspaces.map(uw => uw.workspaceId)
    }

    if (workspaceIds.length === 0) {
      return successResponse({
        metric,
        period,
        data: [],
        summary: {}
      }, 'No analytics data available')
    }

    // Calculate date range
    const now = new Date()
    const daysMap = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }
    const days = daysMap[period]
    const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000))

    const analyticsData: unknown = {}

    if (!metric || metric === 'processing_time') {
      // Get average processing time data
      const processingTimes = await prisma.case.findMany({
        where: {
          workspaceId: { in: workspaceIds },
          createdAt: { gte: startDate },
          status: { in: ['CLOSED', 'ARCHIVED'] }
        },
        select: {
          createdAt: true,
          updatedAt: true,
          title: true
        }
      })

      const processingTimeData = processingTimes.map(case_ => {
        const processingTime = case_.updatedAt.getTime() - case_.createdAt.getTime()
        const processingHours = processingTime / (1000 * 60 * 60)
        return {
          date: case_.createdAt.toISOString().split('T')[0],
          processingTime: Math.round(processingHours * 100) / 100,
          caseTitle: case_.title
        }
      })

      const avgProcessingTime = processingTimeData.length > 0
        ? processingTimeData.reduce((sum, item) => sum + item.processingTime, 0) / processingTimeData.length
        : 0

      analyticsData.processing_time = {
        data: processingTimeData,
        average: Math.round(avgProcessingTime * 100) / 100,
        unit: 'hours'
      }
    }

    if (!metric || metric === 'success_rate') {
      // Get success rate data
      const cases = await prisma.case.findMany({
        where: {
          workspaceId: { in: workspaceIds },
          createdAt: { gte: startDate }
        },
        select: {
          status: true,
          createdAt: true
        }
      })

      const totalCases = cases.length
      const successfulCases = cases.filter(c => c.status === 'CLOSED').length
      const successRate = totalCases > 0 ? (successfulCases / totalCases) * 100 : 0

      analyticsData.success_rate = {
        rate: Math.round(successRate * 100) / 100,
        successful: successfulCases,
        total: totalCases,
        unit: 'percentage'
      }
    }

    if (!metric || metric === 'volume') {
      // Get volume data by day
      const volumeData = await prisma.case.groupBy({
        by: ['createdAt'],
        where: {
          workspaceId: { in: workspaceIds },
          createdAt: { gte: startDate }
        },
        _count: true
      })

      // Group by day
      const dailyVolume: { [key: string]: number } = {}
      volumeData.forEach(item => {
        const date = item.createdAt.toISOString().split('T')[0]
        dailyVolume[date] = (dailyVolume[date] || 0) + item._count
      })

      analyticsData.volume = {
        data: Object.entries(dailyVolume).map(([date, count]) => ({
          date,
          count
        })),
        total: Object.values(dailyVolume).reduce((sum, count) => sum + count, 0)
      }
    }

    if (!metric || metric === 'performance') {
      // Get performance metrics
      const [activeCases, closedCases, totalDocuments] = await Promise.all([
        prisma.case.count({
          where: {
            workspaceId: { in: workspaceIds },
            status: 'ACTIVE'
          }
        }),
        prisma.case.count({
          where: {
            workspaceId: { in: workspaceIds },
            status: 'CLOSED',
            updatedAt: { gte: startDate }
          }
        }),
        prisma.caseDocument.count({
          where: {
            case: {
              workspaceId: { in: workspaceIds }
            },
            createdAt: { gte: startDate }
          }
        })
      ])

      analyticsData.performance = {
        activeCases,
        closedCases,
        totalDocuments,
        productivity: closedCases / Math.max(activeCases + closedCases, 1) * 100
      }
    }

    return successResponse({
      metric,
      period,
      workspaces: workspaceIds.length,
      data: analyticsData
    }, 'Analytics data retrieved successfully')

  } catch (error) {
    console.error('Error getting analytics data:', error)
    return errorResponse('Failed to get analytics data', 500)
  }
}

export { GET }