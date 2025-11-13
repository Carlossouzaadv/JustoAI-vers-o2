import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  requireAuth,
  validateBody,
  requireWorkspaceAccess,
  rateLimit,
  getClientIP
} from '@/lib/api-utils'
import {
  updateWorkspaceSchema
} from '@/lib/validations'

interface RouteContext {
  params: Promise<{ id: string }>
}

// Type for UserWorkspace with included user relation from Prisma query
interface UserWorkspaceWithUser {
  id: string
  userId: string
  workspaceId: string
  role: string
  status: string
  permissions: unknown
  createdAt: Date
  user: {
    id: string
    name: string | null
    email: string
    avatar: string | null
    role: string
  }
}

// Type guard: validate schema output matches Prisma's WorkspaceUpdateInput expectations
function isValidWorkspaceUpdateInput(
  data: unknown
): data is {
  name?: string
  description?: string
  logoUrl?: string
  plan?: 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE'
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'DELETED'
  settings?: Record<string, unknown>
} {
  if (typeof data !== 'object' || data === null) {
    return false
  }

  const obj = data as Record<string, unknown>

  // Valid enum values
  const validPlans = ['FREE', 'BASIC', 'PRO', 'ENTERPRISE']
  const validStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED']

  // Validate each field matches Zod schema output
  return (
    (typeof obj.name === 'string' || obj.name === undefined) &&
    (typeof obj.description === 'string' || obj.description === undefined) &&
    (typeof obj.logoUrl === 'string' || obj.logoUrl === undefined) &&
    (validPlans.includes(obj.plan as string) || obj.plan === undefined) &&
    (validStatuses.includes(obj.status as string) || obj.status === undefined) &&
    (typeof obj.settings === 'object' || obj.settings === undefined)
  )
}

// Type guard: ensure workspace has users array
function hasUsersArray(
  workspace: unknown
): workspace is { users: unknown[]; [key: string]: unknown } {
  return (
    typeof workspace === 'object' &&
    workspace !== null &&
    'users' in workspace &&
    Array.isArray((workspace as Record<string, unknown>).users)
  )
}

// Type guard: ensure user object has the required role, status, createdAt properties
function isValidWorkspaceUser(
  user: unknown
): user is { role: string; status: string; createdAt: Date } {
  return (
    typeof user === 'object' &&
    user !== null &&
    'role' in user &&
    'status' in user &&
    'createdAt' in user &&
    typeof (user as Record<string, unknown>).role === 'string' &&
    typeof (user as Record<string, unknown>).status === 'string' &&
    (user as Record<string, unknown>).createdAt instanceof Date
  )
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
  const currentUserWorkspace = workspace.users.find((uw: UserWorkspaceWithUser) => uw.userId === user.id)

  const transformedWorkspace = {
    ...workspace,
    currentUserRole: currentUserWorkspace?.role,
    currentUserStatus: currentUserWorkspace?.status,
    members: workspace.users.map((uw: UserWorkspaceWithUser) => ({
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

  // Validate and narrow input to ensure it matches Prisma's WorkspaceUpdateInput
  if (!isValidWorkspaceUpdateInput(input)) {
    return errorResponse('Invalid workspace update data', 400)
  }

  // Extract only non-undefined fields for Prisma
  const updateData: Record<string, string | Record<string, unknown>> = {}
  if (input.name !== undefined) updateData.name = input.name
  if (input.description !== undefined) updateData.description = input.description
  if (input.logoUrl !== undefined) updateData.logoUrl = input.logoUrl
  if (input.plan !== undefined) updateData.plan = input.plan
  if (input.status !== undefined) updateData.status = input.status
  if (input.settings !== undefined) updateData.settings = input.settings

  // Update workspace
  const workspace = await prisma.workspace.update({
    where: { id: workspaceId },
    data: updateData,
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

  // Safely narrow workspace to ensure users array exists
  if (!hasUsersArray(workspace)) {
    return errorResponse('Failed to retrieve workspace users', 500)
  }

  const firstUser = workspace.users[0]

  // Safely narrow first user if it exists
  let userWorkspaceRole: string | undefined
  let userWorkspaceStatus: string | undefined
  let userWorkspaceJoinedAt: Date | undefined

  if (firstUser && isValidWorkspaceUser(firstUser)) {
    userWorkspaceRole = firstUser.role
    userWorkspaceStatus = firstUser.status
    userWorkspaceJoinedAt = firstUser.createdAt
  }

  const transformedWorkspace = {
    ...workspace,
    userRole: userWorkspaceRole,
    userStatus: userWorkspaceStatus,
    userJoinedAt: userWorkspaceJoinedAt,
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