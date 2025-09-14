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
  updateClientSchema,
  UpdateClientInput
} from '@/lib/validations'

interface RouteContext {
  params: { id: string }
}

// GET /api/clients/[id] - Get client details
async function GET(request: NextRequest, { params }: RouteContext) {
  // Rate limiting
  const clientIP = getClientIP(request)
  const { allowed, error: rateLimitError } = await rateLimit(`client-detail:${clientIP}`)
  if (!allowed) return rateLimitError!

  // Auth check
  const { user, error: authError } = await requireAuth(request)
  if (!user) return authError!

  const clientId = params.id

  // Get client
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      },
      cases: {
        select: {
          id: true,
          number: true,
          title: true,
          type: true,
          status: true,
          priority: true,
          claimValue: true,
          createdAt: true,
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10 // Latest 10 cases
      },
      _count: {
        select: {
          cases: true
        }
      }
    }
  })

  if (!client) {
    return errorResponse('Client not found', 404)
  }

  // Workspace access check
  const { hasAccess, error: accessError } = await requireWorkspaceAccess(user.id, client.workspaceId)
  if (!hasAccess) return accessError!

  return successResponse(client)
}

// PUT /api/clients/[id] - Update client
async function PUT(request: NextRequest, { params }: RouteContext) {
  // Rate limiting
  const clientIP = getClientIP(request)
  const { allowed, error: rateLimitError } = await rateLimit(`update-client:${clientIP}`, 30)
  if (!allowed) return rateLimitError!

  // Auth check
  const { user, error: authError } = await requireAuth(request)
  if (!user) return authError!

  const clientId = params.id

  // Get existing client
  const existingClient = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      workspaceId: true,
      document: true
    }
  })

  if (!existingClient) {
    return errorResponse('Client not found', 404)
  }

  // Workspace access check
  const { hasAccess, error: accessError } = await requireWorkspaceAccess(user.id, existingClient.workspaceId)
  if (!hasAccess) return accessError!

  // Body validation
  const { data: input, error: validationError } = await validateBody(request, updateClientSchema)
  if (!input) return validationError!

  // Check for duplicate document (if document is being updated)
  if (input.document && input.document !== existingClient.document) {
    const duplicateClient = await prisma.client.findFirst({
      where: {
        workspaceId: existingClient.workspaceId,
        document: input.document,
        status: { not: 'DELETED' },
        id: { not: clientId }
      }
    })

    if (duplicateClient) {
      return errorResponse('Another client with this document already exists in this workspace', 409)
    }
  }

  // Update client
  const client = await prisma.client.update({
    where: { id: clientId },
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
    `Client "${client.name}" updated successfully`
  )
}

// DELETE /api/clients/[id] - Delete client (soft delete)
async function DELETE(request: NextRequest, { params }: RouteContext) {
  // Rate limiting
  const clientIP = getClientIP(request)
  const { allowed, error: rateLimitError } = await rateLimit(`delete-client:${clientIP}`, 10)
  if (!allowed) return rateLimitError!

  // Auth check
  const { user, error: authError } = await requireAuth(request)
  if (!user) return authError!

  const clientId = params.id

  // Get existing client
  const existingClient = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      workspaceId: true,
      _count: {
        select: {
          cases: { where: { status: { not: 'CLOSED' } } }
        }
      }
    }
  })

  if (!existingClient) {
    return errorResponse('Client not found', 404)
  }

  // Workspace access check
  const { hasAccess, error: accessError } = await requireWorkspaceAccess(user.id, existingClient.workspaceId)
  if (!hasAccess) return accessError!

  // Check if client has active cases
  if (existingClient._count.cases > 0) {
    return errorResponse(
      'Cannot delete client with active cases. Please close or transfer all cases first.',
      409
    )
  }

  // Soft delete client
  const client = await prisma.client.update({
    where: { id: clientId },
    data: {
      status: 'DELETED'
    }
  })

  return successResponse(
    { id: client.id, status: client.status },
    `Client "${existingClient.name}" deleted successfully`
  )
}

export { GET, PUT, DELETE }