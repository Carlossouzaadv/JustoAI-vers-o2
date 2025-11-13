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
import type { Workspace } from '@prisma/client'
import { Prisma } from '@prisma/client'

// ================================
// TYPE ALIASES
// ================================

/**
 * Type for Workspace with included relations from findMany query
 * Captures the exact return type from Prisma query with users and _count
 */
type WorkspaceWithRelations = Prisma.WorkspaceGetPayload<{
  include: {
    users: {
      select: {
        role: true
        status: true
        createdAt: true
      }
    }
    _count: {
      select: {
        users: true
        clients: true
        cases: true
      }
    }
  }
}>

// ================================
// TYPE GUARDS FOR DATA SAFETY
// ================================

/**
 * Type guard for WorkspaceWhereInput
 * Validates that unknown data can be safely used as a Prisma WHERE filter
 */
function isWorkspaceFilter(data: unknown): data is Prisma.WorkspaceWhereInput {
  if (typeof data !== 'object' || data === null) {
    return false
  }

  const obj = data as Record<string, unknown>

  // Must have at least one valid filter property
  const validKeys = ['id', 'slug', 'status', 'name', 'users', 'OR', 'AND', 'NOT']
  return validKeys.some(key => key in obj)
}

/**
 * Type guard for Workspace with included users relation
 * Validates that the workspace object has the users array after include
 */
function isWorkspaceWithUsers(
  data: unknown,
  expectedUsersField: boolean = true
): data is Workspace & { users: Array<{ role: string; status: string; createdAt: Date }> } {
  if (typeof data !== 'object' || data === null) {
    return false
  }

  const workspace = data as Record<string, unknown>

  // Check workspace has required base properties
  if (typeof workspace.id !== 'string' || typeof workspace.name !== 'string') {
    return false
  }

  // If expecting users field, validate it
  if (expectedUsersField) {
    if (!Array.isArray(workspace.users)) {
      return false
    }

    // Validate users array has expected structure
    return (workspace.users as unknown[]).every(user => {
      return (
        typeof user === 'object' &&
        user !== null &&
        'role' in user &&
        'status' in user &&
        'createdAt' in user
      )
    })
  }

  return true
}

/**
 * Map Zod plan values to Prisma plan enum values
 * Zod defines: FREE, BASIC, PRO, ENTERPRISE
 * Prisma defines: FREE, STARTER, PROFESSIONAL
 */
function mapPlanToDbPlan(plan: string): 'FREE' | 'STARTER' | 'PROFESSIONAL' | null {
  const planMap: Record<string, 'FREE' | 'STARTER' | 'PROFESSIONAL'> = {
    'FREE': 'FREE',
    'BASIC': 'STARTER',
    'PRO': 'PROFESSIONAL',
    'ENTERPRISE': 'PROFESSIONAL'
  }

  return plan in planMap ? planMap[plan] : null
}

/**
 * Type guard to validate CreateWorkspaceInput with proper Plan type
 * This ensures input.plan is a valid Zod plan value
 */
function isCreateWorkspaceInputValid(
  data: unknown
): data is CreateWorkspaceInput & {
  plan: 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE'
} {
  if (typeof data !== 'object' || data === null) {
    return false
  }

  const input = data as Record<string, unknown>

  // Check required fields
  if (typeof input.name !== 'string' || typeof input.slug !== 'string') {
    return false
  }

  // Validate plan is one of the allowed Zod values
  const validPlans = ['FREE', 'BASIC', 'PRO', 'ENTERPRISE']
  if (typeof input.plan !== 'string' || !validPlans.includes(input.plan)) {
    return false
  }

  return true
}

/**
 * Validates that a Record<string, unknown> can be safely used as InputJsonValue for Prisma
 */
function isValidWorkspaceSettings(value: unknown): value is Prisma.InputJsonValue {
  if (value === null || value === undefined) {
    return true
  }

  const type = typeof value
  if (type === 'string' || type === 'number' || type === 'boolean') {
    return true
  }

  if (Array.isArray(value)) {
    // Recursively check array elements
    return value.every(item => isValidWorkspaceSettings(item))
  }

  // Allow plain objects
  if (type === 'object' && value !== null && !Array.isArray(value)) {
    return true
  }

  return false
}


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

  // Build filters with type safety
  const baseFilter: Prisma.WorkspaceWhereInput = {
    users: {
      some: {
        userId: user.id,
        status: 'ACTIVE'
      }
    }
  }

  // Extend base filter conditionally
  const where: Prisma.WorkspaceWhereInput = {
    ...baseFilter,
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }),
    ...(status && { status: status as typeof status })
  }

  // Get total count
  const total = await prisma.workspace.count({ where })

  // Get workspaces with pagination and strict typing
  const workspacesRaw = await prisma.workspace.findMany({
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

  // Validate and transform data with type guard
  const transformedWorkspaces = workspacesRaw
    .filter((workspace: WorkspaceWithRelations): workspace is WorkspaceWithRelations =>
      isWorkspaceWithUsers(workspace, true)
    )
    .map((workspace: WorkspaceWithRelations) => {
      // After narrowing, workspace.users is guaranteed to exist and be valid
      const userRole = workspace.users[0]?.role
      const userStatus = workspace.users[0]?.status
      const userJoinedAt = workspace.users[0]?.createdAt

      return {
        ...workspace,
        userRole,
        userStatus,
        userJoinedAt,
        users: undefined // Remove from response
      }
    })

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

  // Validate input with our type guard to ensure plan is properly typed
  if (!isCreateWorkspaceInputValid(input)) {
    return errorResponse('Invalid workspace data', 400)
  }

  // Check slug uniqueness
  const existingWorkspace = await prisma.workspace.findUnique({
    where: { slug: input.slug }
  })

  if (existingWorkspace) {
    return errorResponse('Workspace slug already exists', 409)
  }

  // Create workspace with user as owner
  // After type guard, input.plan is guaranteed to be a valid Zod plan value
  // Map it to the Prisma enum value
  const dbPlan = mapPlanToDbPlan(input.plan)
  if (dbPlan === null) {
    return errorResponse('Invalid plan value', 400)
  }

  // Build workspace data with proper type checking
  // Check if settings are provided and valid
  let workspaceData: Prisma.WorkspaceCreateInput

  if (input.settings && isValidWorkspaceSettings(input.settings)) {
    // Settings are provided and valid
    // After type guard, input.settings is narrowed to Prisma.InputJsonValue
    workspaceData = {
      name: input.name,
      slug: input.slug,
      plan: dbPlan,
      description: input.description ?? null,
      logoUrl: input.logoUrl ?? null,
      settings: input.settings,
      users: {
        create: {
          userId: user.id,
          role: 'OWNER'
        }
      }
    }
  } else {
    // Settings not provided or invalid
    workspaceData = {
      name: input.name,
      slug: input.slug,
      plan: dbPlan,
      description: input.description ?? null,
      logoUrl: input.logoUrl ?? null,
      users: {
        create: {
          userId: user.id,
          role: 'OWNER'
        }
      }
    }
  }

  const workspaceRaw = await prisma.workspace.create({
    data: workspaceData,
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

  // Validate response with type guard before transformation
  if (!isWorkspaceWithUsers(workspaceRaw, true)) {
    // This should never happen, but handle gracefully
    return errorResponse('Failed to create workspace properly', 500)
  }

  // After type guard, workspace.users is guaranteed to exist
  const workspace = workspaceRaw

  // Transform response
  const transformedWorkspace = {
    ...workspace,
    userRole: workspace.users[0]?.role,
    userStatus: workspace.users[0]?.status,
    userJoinedAt: workspace.users[0]?.createdAt,
    users: undefined
  }

  return successResponse(
    transformedWorkspace,
    `Workspace "${workspace.name}" created successfully`
  )
}

export { GET, POST }