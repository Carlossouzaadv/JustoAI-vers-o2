import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  requireAuth,
  validateBody,
  requireWorkspaceAccess,
  withMethods,
  rateLimit,
  getClientIP
} from '@/lib/api-utils'
import {
  updateWorkspaceSchema,
  UpdateWorkspaceInput
} from '@/lib/validations'

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET /api/workspaces/[id] - Get workspace details
async function GET(request: NextRequest, { params }: RouteContext) {
  // Rate limiting
  const clientIP = getClientIP(request)
  const { allowed, error: rateLimitError } = await rateLimit(`workspace-detail:${clientIP}`)
  if (!allowed) return rateLimitError!

  // Auth check
  const { user, error: authError } = await requireAuth(request)
  if (!user) return authError!

  const { id: workspaceId } = await params

  // Access check
  const { hasAccess, error: accessError } = await requireWorkspaceAccess(user.id, workspaceId)
  if (!hasAccess) return accessError!

  // Get workspace
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      users: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              role: true
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      },
      _count: {
        select: {
          users: true,
          clients: true,
          cases: true,
          reportSchedules: true
        }
      }
    }
  })

  if (!workspace) {
    return errorResponse('Workspace not found', 404)
  }

  // Get current user role
  const currentUserWorkspace = workspace.users.find(uw => uw.userId === user.id)

  const transformedWorkspace = {
    ...workspace,
    currentUserRole: currentUserWorkspace?.role,
    currentUserStatus: currentUserWorkspace?.status,
    members: workspace.users.map(uw => ({
      id: uw.id,
      role: uw.role,
      status: uw.status,
      joinedAt: uw.createdAt,
      permissions: uw.permissions,
      user: uw.user
    }))
  }

  return successResponse(transformedWorkspace)
}

// PUT /api/workspaces/[id] - Update workspace
async function PUT(request: NextRequest, { params }: RouteContext) {
  // Rate limiting
  const clientIP = getClientIP(request)
  const { allowed, error: rateLimitError } = await rateLimit(`update-workspace:${clientIP}`, 20)
  if (!allowed) return rateLimitError!

  // Auth check
  const { user, error: authError } = await requireAuth(request)
  if (!user) return authError!

  const { id: workspaceId } = await params

  // Access check
  const { hasAccess, error: accessError } = await requireWorkspaceAccess(user.id, workspaceId)
  if (!hasAccess) return accessError!

  // Check if user has admin role
  const { getUserWorkspaceRole } = await import('@/lib/auth')
  const userRole = await getUserWorkspaceRole(user.id, workspaceId)

  if (!userRole || !['OWNER', 'ADMIN'].includes(userRole)) {
    return errorResponse('Insufficient permissions to update workspace', 403)
  }

  // Body validation
  const { data: input, error: validationError } = await validateBody(request, updateWorkspaceSchema)
  if (!input) return validationError!

  // Update workspace
  const workspace = await prisma.workspace.update({
    where: { id: workspaceId },
    data: input,
    include: {
      users: {
        where: { userId: user.id },
        select: {
          role: true,
          status: true,
          createdAt: true
        }
      },
      _count: {
        select: {
          users: true,
          clients: true,
          cases: true
        }
      }
    }
  })

  const transformedWorkspace = {
    ...workspace,
    userRole: workspace.users[0]?.role,
    userStatus: workspace.users[0]?.status,
    userJoinedAt: workspace.users[0]?.createdAt,
    users: undefined,
  }

  return successResponse(
    transformedWorkspace,
    `Workspace "${workspace.name}" updated successfully`
  )
}

// DELETE /api/workspaces/[id] - Delete workspace (soft delete)
async function DELETE(request: NextRequest, { params }: RouteContext) {
  // Rate limiting
  const clientIP = getClientIP(request)
  const { allowed, error: rateLimitError } = await rateLimit(`delete-workspace:${clientIP}`, 5)
  if (!allowed) return rateLimitError!

  // Auth check
  const { user, error: authError } = await requireAuth(request)
  if (!user) return authError!

  const { id: workspaceId } = await params

  // Access check
  const { hasAccess, error: accessError } = await requireWorkspaceAccess(user.id, workspaceId)
  if (!hasAccess) return accessError!

  // Check if user is owner
  const { getUserWorkspaceRole } = await import('@/lib/auth')
  const userRole = await getUserWorkspaceRole(user.id, workspaceId)

  if (userRole !== 'OWNER') {
    return errorResponse('Only workspace owners can delete workspaces', 403)
  }

  // Soft delete workspace
  const workspace = await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      status: 'DELETED',
      // Also soft delete all user relationships
      users: {
        updateMany: {
          where: {},
          data: { status: 'DELETED' }
        }
      }
    }
  })

  return successResponse(
    { id: workspace.id, status: workspace.status },
    `Workspace "${workspace.name}" deleted successfully`
  )
}

export { GET, PUT, DELETE }