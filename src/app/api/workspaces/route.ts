import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  requireAuth,
  validateBody,
  validateQuery,
  withMethods,
  rateLimit,
  getClientIP
} from '@/lib/api-utils'
import {
  createWorkspaceSchema,
  workspaceQuerySchema,
  CreateWorkspaceInput,
  WorkspaceQuery
} from '@/lib/validations'

// GET /api/workspaces - List user workspaces
async function GET(request: NextRequest) {
  // Rate limiting
  const clientIP = getClientIP(request)
  const { allowed, error: rateLimitError } = await rateLimit(`workspaces:${clientIP}`)
  if (!allowed) return rateLimitError!

  // Auth check
  const { user, error: authError } = await requireAuth(request)
  if (!user) return authError!

  // Query validation
  const { data: query, error: queryError } = validateQuery(request, workspaceQuerySchema)
  if (!query) return queryError!

  const { page, limit, search, status } = query

  // Development mode - return mock data
  if (process.env.NODE_ENV === 'development') {
    console.log('⚠️ Development mode: Returning mock workspaces data')
    const mockWorkspaces = [
      {
        id: 'dev-workspace',
        name: 'Development Workspace',
        slug: 'dev',
        description: 'Workspace for development and testing',
        status: 'ACTIVE',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
        userRole: 'OWNER',
        userStatus: 'ACTIVE',
        userJoinedAt: new Date('2024-01-01'),
        _count: {
          users: 3,
          clients: 4,
          cases: 20
        }
      }
    ]

    return paginatedResponse(
      mockWorkspaces,
      page,
      limit,
      1,
      'Found 1 workspace (mock data)'
    )
  }

  // Build filters
  const where: any = {
    users: {
      some: {
        userId: user.id,
        status: 'ACTIVE'
      }
    }
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } }
    ]
  }

  if (status) {
    where.status = status
  }

  // Get total count
  const total = await prisma.workspace.count({ where })

  // Get workspaces with pagination
  const workspaces = await prisma.workspace.findMany({
    where,
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
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  })

  // Transform data
  const transformedWorkspaces = workspaces.map(workspace => ({
    ...workspace,
    userRole: workspace.users[0]?.role,
    userStatus: workspace.users[0]?.status,
    userJoinedAt: workspace.users[0]?.createdAt,
    users: undefined, // Remove from response
  }))

  return paginatedResponse(
    transformedWorkspaces,
    page,
    limit,
    total,
    `Found ${total} workspace${total !== 1 ? 's' : ''}`
  )
}

// POST /api/workspaces - Create workspace
async function POST(request: NextRequest) {
  // Rate limiting (stricter for creates)
  const clientIP = getClientIP(request)
  const { allowed, error: rateLimitError } = await rateLimit(`create-workspace:${clientIP}`, 10)
  if (!allowed) return rateLimitError!

  // Auth check
  const { user, error: authError } = await requireAuth(request)
  if (!user) return authError!

  // Body validation
  const { data: input, error: validationError } = await validateBody(request, createWorkspaceSchema)
  if (!input) return validationError!

  // Check slug uniqueness
  const existingWorkspace = await prisma.workspace.findUnique({
    where: { slug: input.slug }
  })

  if (existingWorkspace) {
    return errorResponse('Workspace slug already exists', 409)
  }

  // Create workspace with user as owner
  const workspace = await prisma.workspace.create({
    data: {
      ...input,
      users: {
        create: {
          userId: user.id,
          role: 'OWNER'
        }
      }
    },
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

  // Transform response
  const transformedWorkspace = {
    ...workspace,
    userRole: workspace.users[0]?.role,
    userStatus: workspace.users[0]?.status,
    userJoinedAt: workspace.users[0]?.createdAt,
    users: undefined,
  }

  return successResponse(
    transformedWorkspace,
    `Workspace "${workspace.name}" created successfully`
  )
}

export { GET, POST }