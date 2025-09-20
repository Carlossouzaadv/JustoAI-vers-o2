import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  requireAuth,
  rateLimit,
  getClientIP
} from '@/lib/api-utils'

// GET /api/workspaces/current/summary - Get current workspace summary
async function GET(request: NextRequest) {
  // Rate limiting
  const clientIP = getClientIP(request)
  const { allowed, error: rateLimitError } = await rateLimit(`workspace-summary:${clientIP}`)
  if (!allowed) return rateLimitError!

  // Auth check
  const { user, error: authError } = await requireAuth(request)
  if (!user) return authError!

  try {
    // Development mode - return mock data
    if (process.env.NODE_ENV === 'development') {
      console.log('⚠️ Development mode: Returning mock workspace summary')
      const mockSummary = {
        workspace: {
          id: 'dev-workspace',
          name: 'Development Workspace',
          slug: 'dev'
        },
        statistics: {
          clients: 4,
          activeCases: 8,
          closedCases: 12,
          totalCases: 20,
          documents: 45,
          users: 3
        },
        recentActivity: [
          {
            id: '1',
            type: 'CASE_CREATED',
            description: 'Novo processo criado: Ação de Cobrança',
            case: { id: '1', title: 'Ação de Cobrança - João Silva' },
            createdAt: new Date(Date.now() - 1000 * 60 * 30) // 30 minutes ago
          },
          {
            id: '2',
            type: 'DOCUMENT_UPLOADED',
            description: 'Documento anexado ao processo',
            case: { id: '2', title: 'Divórcio Consensual - Maria Santos' },
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2) // 2 hours ago
          },
          {
            id: '3',
            type: 'STATUS_CHANGED',
            description: 'Status do processo alterado para Em Andamento',
            case: { id: '3', title: 'Ação Trabalhista - Empresa ABC' },
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6) // 6 hours ago
          }
        ]
      }

      return successResponse(mockSummary, 'Workspace summary retrieved successfully (mock data)')
    }

    // Get user's active workspaces
    const userWorkspaces = await prisma.userWorkspace.findMany({
      where: {
        userId: user.id,
        status: 'ACTIVE'
      },
      include: {
        workspace: {
          include: {
            _count: {
              select: {
                clients: true,
                cases: true,
                users: true
              }
            }
          }
        }
      }
    })

    if (userWorkspaces.length === 0) {
      return errorResponse('No active workspace found', 404)
    }

    // Use the first active workspace as current
    const currentWorkspace = userWorkspaces[0].workspace
    const workspaceId = currentWorkspace.id

    // Get summary statistics
    const [
      clientsCount,
      activeCasesCount,
      closedCasesCount,
      documentsCount,
      recentActivity
    ] = await Promise.all([
      // Total clients
      prisma.client.count({
        where: {
          workspaceId,
          status: { not: 'DELETED' }
        }
      }),

      // Active cases
      prisma.case.count({
        where: {
          workspaceId,
          status: 'ACTIVE'
        }
      }),

      // Closed cases
      prisma.case.count({
        where: {
          workspaceId,
          status: 'CLOSED'
        }
      }),

      // Total documents
      prisma.caseDocument.count({
        where: {
          case: {
            workspaceId
          }
        }
      }),

      // Recent activity (last 10 events)
      prisma.caseEvent.findMany({
        where: {
          case: {
            workspaceId
          }
        },
        include: {
          case: {
            select: {
              id: true,
              title: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10
      })
    ])

    const summary = {
      workspace: {
        id: currentWorkspace.id,
        name: currentWorkspace.name,
        slug: currentWorkspace.slug
      },
      statistics: {
        clients: clientsCount,
        activeCases: activeCasesCount,
        closedCases: closedCasesCount,
        totalCases: activeCasesCount + closedCasesCount,
        documents: documentsCount,
        users: currentWorkspace._count.users
      },
      recentActivity: recentActivity.map(event => ({
        id: event.id,
        type: event.type,
        description: event.description,
        case: event.case,
        createdAt: event.createdAt
      }))
    }

    return successResponse(summary, 'Workspace summary retrieved successfully')

  } catch (error) {
    console.error('Error getting workspace summary:', error)
    return errorResponse('Failed to get workspace summary', 500)
  }
}

export { GET }