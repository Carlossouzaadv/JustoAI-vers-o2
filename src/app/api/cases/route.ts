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
import { z } from 'zod'

// Validation schemas
const createCaseSchema = z.object({
  workspaceId: z.string().cuid(),
  clientId: z.string().cuid(),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional(),
  processNumber: z.string().optional(),
  type: z.enum(['CIVIL', 'CRIMINAL', 'LABOR', 'FAMILY', 'TAX', 'ADMINISTRATIVE']),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'CLOSED', 'ARCHIVED', 'CANCELLED']).default('ACTIVE'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  value: z.number().optional(),
  startDate: z.string().datetime().optional(),
  expectedEndDate: z.string().datetime().optional(),
})

const caseQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'CLOSED', 'ARCHIVED', 'CANCELLED']).optional(),
  type: z.enum(['CIVIL', 'CRIMINAL', 'LABOR', 'FAMILY', 'TAX', 'ADMINISTRATIVE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  clientId: z.string().cuid().optional(),
  workspaceId: z.string().cuid().optional(),
})

/**
 * @swagger
 * /api/cases:
 *   get:
 *     summary: Listar casos jurídicos
 *     description: Retorna lista paginada de casos jurídicos com filtros e busca
 *     tags:
 *       - Casos
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
 *           enum: [ACTIVE, SUSPENDED, CLOSED, ARCHIVED, CANCELLED]
 *       - name: type
 *         in: query
 *         description: Filtrar por tipo de caso
 *         required: false
 *         schema:
 *           type: string
 *           enum: [CIVIL, CRIMINAL, LABOR, FAMILY, TAX, ADMINISTRATIVE]
 *       - name: priority
 *         in: query
 *         description: Filtrar por prioridade
 *         required: false
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, URGENT]
 *       - name: clientId
 *         in: query
 *         description: Filtrar por cliente
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *       - name: workspaceId
 *         in: query
 *         description: ID do workspace para filtrar
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Lista de casos retornada com sucesso
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
 *                     $ref: '#/components/schemas/Case'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *                 message:
 *                   type: string
 *                   example: "Found 50 cases"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
// GET /api/cases - List cases
async function GET(request: NextRequest) {
  // Rate limiting
  const clientIP = getClientIP(request)
  const { allowed, error: rateLimitError } = await rateLimit(`cases:${clientIP}`)
  if (!allowed) return rateLimitError!

  // Auth check
  const { user, error: authError } = await requireAuth(request)
  if (!user) return authError!

  // Query validation
  const { data: query, error: queryError } = validateQuery(request, caseQuerySchema)
  if (!query) return queryError!

  const { page, limit, search, status, type, priority, clientId, workspaceId } = query

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
    return paginatedResponse([], page, limit, 0, 'No cases found')
  }

  // Build filters
  const where: unknown = {
    workspaceId: { in: workspaceIds }
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { processNumber: { contains: search, mode: 'insensitive' } },
      { client: { name: { contains: search, mode: 'insensitive' } } }
    ]
  }

  if (status) where.status = status
  if (type) where.type = type
  if (priority) where.priority = priority
  if (clientId) where.clientId = clientId

  // Get total count
  const total = await prisma.case.count({ where })

  // Get cases with pagination
  const cases = await prisma.case.findMany({
    where,
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      },
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          type: true
        }
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      _count: {
        select: {
          documents: true,
          events: true,
          analysisVersions: true
        }
      }
    },
    orderBy: { updatedAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  })

  return paginatedResponse(
    cases,
    page,
    limit,
    total,
    `Found ${total} case${total !== 1 ? 's' : ''}`
  )
}

/**
 * @swagger
 * /api/cases:
 *   post:
 *     summary: Criar novo caso jurídico
 *     description: Cria um novo caso jurídico associado a um cliente
 *     tags:
 *       - Casos
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workspaceId
 *               - clientId
 *               - title
 *               - type
 *             properties:
 *               workspaceId:
 *                 type: string
 *                 format: uuid
 *               clientId:
 *                 type: string
 *                 format: uuid
 *               title:
 *                 type: string
 *                 example: "Ação de Cobrança"
 *                 maxLength: 200
 *               description:
 *                 type: string
 *                 example: "Descrição detalhada do caso"
 *               processNumber:
 *                 type: string
 *                 example: "1234567-89.2024.8.26.0001"
 *               type:
 *                 type: string
 *                 enum: [CIVIL, CRIMINAL, LABOR, FAMILY, TAX, ADMINISTRATIVE]
 *                 example: CIVIL
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, SUSPENDED, CLOSED, ARCHIVED, CANCELLED]
 *                 default: ACTIVE
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *                 default: MEDIUM
 *               value:
 *                 type: number
 *                 example: 50000.00
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               expectedEndDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Caso criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Case'
 *                 message:
 *                   type: string
 *                   example: "Case \"Ação de Cobrança\" created successfully"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Cliente não encontrado
 *       409:
 *         description: Caso com este número de processo já existe
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
// POST /api/cases - Create case
async function POST(request: NextRequest) {
  // Rate limiting (stricter for creates)
  const clientIP = getClientIP(request)
  const { allowed, error: rateLimitError } = await rateLimit(`create-case:${clientIP}`, 30)
  if (!allowed) return rateLimitError!

  // Auth check
  const { user, error: authError } = await requireAuth(request)
  if (!user) return authError!

  // Body validation
  const { data: input, error: validationError } = await validateBody(request, createCaseSchema)
  if (!input) return validationError!

  // Workspace access check
  const { hasAccess, error: accessError } = await requireWorkspaceAccess(user.id, input.workspaceId)
  if (!hasAccess) return accessError!

  // Check if client exists and belongs to workspace
  const client = await prisma.client.findFirst({
    where: {
      id: input.clientId,
      workspaceId: input.workspaceId,
      status: { not: 'DELETED' }
    }
  })

  if (!client) {
    return errorResponse('Client not found or does not belong to this workspace', 404)
  }

  // Check for duplicate process number in same workspace
  if (input.processNumber) {
    const existingCase = await prisma.case.findFirst({
      where: {
        workspaceId: input.workspaceId,
        number: input.processNumber,
        status: { not: 'CANCELLED' }
      }
    })

    if (existingCase) {
      return errorResponse('A case with this process number already exists in this workspace', 409)
    }
  }

  // Create case
  const caseData = {
    ...input,
    number: input.processNumber || '',
    createdById: user.id,
    startDate: input.startDate ? new Date(input.startDate) : undefined,
    expectedEndDate: input.expectedEndDate ? new Date(input.expectedEndDate) : undefined,
  }

  const newCase = await prisma.case.create({
    data: caseData,
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      },
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          type: true
        }
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      _count: {
        select: {
          documents: true,
          events: true,
          analysisVersions: true
        }
      }
    }
  })

  return successResponse(
    newCase,
    `Case "${newCase.title}" created successfully`
  )
}

export { GET, POST }