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
  rateLimit,
  getClientIP
} from '@/lib/api-utils'
import {
  createClientSchema,
  clientQuerySchema,
  CreateClientInput,
  ClientQuery
} from '@/lib/validations'

/**
 * @swagger
 * /api/clients:
 *   get:
 *     summary: Listar clientes
 *     description: Retorna lista paginada de clientes com filtros e busca
 *     tags:
 *       - Clientes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/SearchParam'
 *       - name: status
 *         in: query
 *         description: Filtrar por status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, SUSPENDED]
 *       - name: type
 *         in: query
 *         description: Filtrar por tipo
 *         required: false
 *         schema:
 *           type: string
 *           enum: [INDIVIDUAL, BUSINESS]
 *       - name: workspaceId
 *         in: query
 *         description: ID do workspace para filtrar
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Lista de clientes retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Client'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *                 message:
 *                   type: string
 *                   example: "Found 25 clients"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         description: Limite de requisições excedido
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
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

  const { page, limit, search, status, workspaceId, type} = query

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

/**
 * @swagger
 * /api/clients:
 *   post:
 *     summary: Criar novo cliente
 *     description: Cria um novo cliente no workspace especificado
 *     tags:
 *       - Clientes
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - workspaceId
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *                 example: "João Silva"
 *                 description: Nome do cliente
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "joao@email.com"
 *               phone:
 *                 type: string
 *                 example: "(11) 99999-9999"
 *               document:
 *                 type: string
 *                 example: "123.456.789-00"
 *                 description: CPF ou CNPJ
 *               type:
 *                 type: string
 *                 enum: [INDIVIDUAL, BUSINESS]
 *                 example: INDIVIDUAL
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE, SUSPENDED]
 *                 default: ACTIVE
 *               workspaceId:
 *                 type: string
 *                 format: uuid
 *                 description: ID do workspace
 *     responses:
 *       200:
 *         description: Cliente criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Client'
 *                 message:
 *                   type: string
 *                   example: "Client \"João Silva\" created successfully"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       409:
 *         description: Cliente com este documento já existe
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
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