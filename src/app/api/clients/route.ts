import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  requireAuth,
  validateBody,
  validateQuery,
  requireWorkspaceAccess,
  withMethods,
  rateLimit,
  getClientIP
} from '@/lib/api-utils'
import {
  createClientSchema,
  clientQuerySchema,
  CreateClientInput,
  ClientQuery
} from '@/lib/validations'

// GET /api/clients - List clients
async function GET(request: NextRequest) {
  // Rate limiting
  const clientIP = getClientIP(request)
  const { allowed, error: rateLimitError } = await rateLimit(`clients:${clientIP}`)
  if (!allowed) return rateLimitError!

  // Auth check
  const { user, error: authError } = await requireAuth(request)
  if (!user) return authError!

  // Query validation
  const { data: query, error: queryError } = validateQuery(request, clientQuerySchema)
  if (!query) return queryError!

  const { page, limit, search, status, workspaceId, type } = query

  // Development mode - return mock data
  if (process.env.NODE_ENV === 'development') {
    console.log('⚠️ Development mode: Returning mock clients data')
    const mockClients = [
      {
        id: '1',
        name: 'João Silva',
        email: 'joao@email.com',
        phone: '(11) 99999-9999',
        document: '123.456.789-01',
        type: 'INDIVIDUAL',
        status: 'ACTIVE',
        workspaceId: 'dev-workspace',
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date(),
        workspace: {
          id: 'dev-workspace',
          name: 'Development Workspace',
          slug: 'dev'
        },
        _count: {
          cases: 3
        }
      },
      {
        id: '2',
        name: 'Maria Santos',
        email: 'maria@empresa.com',
        phone: '(11) 88888-8888',
        document: '987.654.321-00',
        type: 'INDIVIDUAL',
        status: 'ACTIVE',
        workspaceId: 'dev-workspace',
        createdAt: new Date('2024-01-10'),
        updatedAt: new Date(),
        workspace: {
          id: 'dev-workspace',
          name: 'Development Workspace',
          slug: 'dev'
        },
        _count: {
          cases: 1
        }
      },
      {
        id: '3',
        name: 'Empresa ABC Ltda',
        email: 'contato@abc.com.br',
        phone: '(11) 77777-7777',
        document: '12.345.678/0001-90',
        type: 'BUSINESS',
        status: 'ACTIVE',
        workspaceId: 'dev-workspace',
        createdAt: new Date('2024-01-05'),
        updatedAt: new Date(),
        workspace: {
          id: 'dev-workspace',
          name: 'Development Workspace',
          slug: 'dev'
        },
        _count: {
          cases: 5
        }
      }
    ]

    let filteredClients = mockClients
    if (search) {
      filteredClients = mockClients.filter(client =>
        client.name.toLowerCase().includes(search.toLowerCase()) ||
        client.email.toLowerCase().includes(search.toLowerCase()) ||
        client.document.includes(search)
      )
    }

    return paginatedResponse(
      filteredClients,
      page,
      limit,
      filteredClients.length,
      `Found ${filteredClients.length} client${filteredClients.length !== 1 ? 's' : ''} (mock data)`
    )
  }

  // If workspaceId is provided, check access
  let workspaceIds: string[] = []

  if (workspaceId) {
    const { hasAccess, error: accessError } = await requireWorkspaceAccess(user.id, workspaceId)
    if (!hasAccess) return accessError!
    workspaceIds = [workspaceId]
  } else {
    // Get all workspaces user has access to
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
    return paginatedResponse([], page, limit, 0, 'No clients found')
  }

  // Build filters
  const where: any = {
    workspaceId: { in: workspaceIds }
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { document: { contains: search, mode: 'insensitive' } }
    ]
  }

  if (status) {
    where.status = status
  }

  if (type) {
    where.type = type
  }

  // Get total count
  const total = await prisma.client.count({ where })

  // Get clients with pagination
  const clients = await prisma.client.findMany({
    where,
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      },
      _count: {
        select: {
          cases: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  })

  return paginatedResponse(
    clients,
    page,
    limit,
    total,
    `Found ${total} client${total !== 1 ? 's' : ''}`
  )
}

// POST /api/clients - Create client
async function POST(request: NextRequest) {
  // Rate limiting (stricter for creates)
  const clientIP = getClientIP(request)
  const { allowed, error: rateLimitError } = await rateLimit(`create-client:${clientIP}`, 50)
  if (!allowed) return rateLimitError!

  // Auth check
  const { user, error: authError } = await requireAuth(request)
  if (!user) return authError!

  // Body validation
  const { data: input, error: validationError } = await validateBody(request, createClientSchema)
  if (!input) return validationError!

  // Workspace access check
  const { hasAccess, error: accessError } = await requireWorkspaceAccess(user.id, input.workspaceId)
  if (!hasAccess) return accessError!

  // Check for duplicate client (same document in same workspace)
  if (input.document) {
    const existingClient = await prisma.client.findFirst({
      where: {
        workspaceId: input.workspaceId,
        document: input.document,
        status: { not: 'DELETED' }
      }
    })

    if (existingClient) {
      return errorResponse('Client with this document already exists in this workspace', 409)
    }
  }

  // Create client
  const client = await prisma.client.create({
    data: input,
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      },
      _count: {
        select: {
          cases: true
        }
      }
    }
  })

  return successResponse(
    client,
    `Client "${client.name}" created successfully`
  )
}

export { GET, POST }