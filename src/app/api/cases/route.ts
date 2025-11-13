import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  requireAuth,
  requireWorkspaceAccess,
  rateLimit,
  getClientIP
} from '@/lib/api-utils'
import {
  CreateCasePayloadSchema,
  CreateCasePayload,
  CasesListQuerySchema,
  CasesListQuery
} from '@/lib/types/api-schemas'

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
/**
 * GET /api/cases - List cases
 *
 * Validation:
 * - All query parameters validated with CasesListQuerySchema
 * - Page defaults to 1, limit defaults to 20
 * - Optional filters: status, type, priority, clientId, workspaceId
 * - Search term applies to title, description, processNumber, client.name
 */
/**
 * Type Guard Functions for Prisma Enums (Padrão-Ouro)
 * Validates string values against allowed enum values before narrowing
 */

function isValidCaseStatus(value: unknown): value is 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'ARCHIVED' | 'CANCELLED' | 'UNASSIGNED' {
  // === PASSO 1: Prova que é string ===
  if (typeof value !== 'string') {
    return false;
  }

  // === PASSO 2: Define array de verificação como readonly string[] ===
  const validStatuses: readonly string[] = ['ACTIVE', 'SUSPENDED', 'CLOSED', 'ARCHIVED', 'CANCELLED', 'UNASSIGNED'];

  // === PASSO 3: Compara string com string[] (100% seguro, ZERO 'as') ===
  return validStatuses.includes(value);
}

function isValidCasePriority(value: unknown): value is 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' {
  // === PASSO 1: Prova que é string ===
  if (typeof value !== 'string') {
    return false;
  }

  // === PASSO 2: Define array de verificação como readonly string[] ===
  const validPriorities: readonly string[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

  // === PASSO 3: Compara string com string[] (100% seguro, ZERO 'as') ===
  return validPriorities.includes(value);
}

function isValidCaseType(value: unknown): value is 'CIVIL' | 'CRIMINAL' | 'LABOR' | 'FAMILY' | 'COMMERCIAL' | 'ADMINISTRATIVE' | 'CONSTITUTIONAL' | 'TAX' | 'OTHER' {
  // === PASSO 1: Prova que é string ===
  if (typeof value !== 'string') {
    return false;
  }

  // === PASSO 2: Define array de verificação como readonly string[] ===
  const validTypes: readonly string[] = ['CIVIL', 'CRIMINAL', 'LABOR', 'FAMILY', 'COMMERCIAL', 'ADMINISTRATIVE', 'CONSTITUTIONAL', 'TAX', 'OTHER'];

  // === PASSO 3: Compara string com string[] (100% seguro, ZERO 'as') ===
  return validTypes.includes(value);
}

/**
 * Build safe Prisma Case WHERE conditions (Padrão-Ouro - 100% Type Safe)
 * Constructs Prisma.CaseWhereInput with full type safety through enum validation
 */
function buildCaseFilters(params: {
  workspaceIds: string[]
  search?: string
  status?: string
  type?: string
  priority?: string
  clientId?: string
}): Prisma.CaseWhereInput {
  const conditions: Prisma.CaseWhereInput = {
    workspaceId: { in: params.workspaceIds }
  };

  if (params.search && typeof params.search === 'string' && params.search.length > 0) {
    conditions.OR = [
      { title: { contains: params.search, mode: 'insensitive' } },
      { description: { contains: params.search, mode: 'insensitive' } },
      { number: { contains: params.search, mode: 'insensitive' } },
      { client: { name: { contains: params.search, mode: 'insensitive' } } }
    ];
  }

  if (params.status && isValidCaseStatus(params.status)) {
    conditions.status = params.status;
  }

  if (params.priority && isValidCasePriority(params.priority)) {
    conditions.priority = params.priority;
  }

  if (params.type && isValidCaseType(params.type)) {
    conditions.type = params.type;
  }

  if (params.clientId && typeof params.clientId === 'string' && params.clientId.length > 0) {
    conditions.clientId = params.clientId;
  }

  return conditions;
}

async function GET(request: NextRequest) {
  // Rate limiting
  const clientIP = getClientIP(request)
  const { allowed, error: rateLimitError } = await rateLimit(`cases:${clientIP}`)
  if (!allowed) return rateLimitError!

  // Auth check
  const { user, error: authError } = await requireAuth(request)
  if (!user) return authError!

  // --- VALIDATION: QUERY PARAMETERS ---
  // Extract searchParams into an object (Zod expects object, not URLSearchParams)
  const rawParams: unknown = Object.fromEntries(request.nextUrl.searchParams.entries())
  const paramParseResult = CasesListQuerySchema.safeParse(rawParams)

  if (!paramParseResult.success) {
    return NextResponse.json({
      success: false,
      message: 'Parâmetros de busca (query) inválidos.',
      errors: paramParseResult.error.flatten(),
    }, { status: 400 })
  }

  // Destructure type-safe query parameters
  const query: CasesListQuery = paramParseResult.data
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

  // Build filters - Type-safe Prisma.CaseWhereInput with enum validation (Padrão-Ouro 100%)
  const whereConfig = buildCaseFilters({
    workspaceIds,
    search: search || undefined,
    status: status || undefined,
    type: type || undefined,
    priority: priority || undefined,
    clientId: clientId || undefined
  })

  // Get total count
  const total = await prisma.case.count({ where: whereConfig })

  // Get cases with pagination
  const cases = await prisma.case.findMany({
    where: whereConfig,
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
/**
 * POST /api/cases - Create case
 *
 * Validation:
 * - Request body validated with CreateCasePayloadSchema
 * - Required: workspaceId, clientId, title, type
 * - Optional: description, processNumber, status, priority, value, startDate, expectedEndDate
 * - Client must exist and belong to the workspace
 */
async function POST(request: NextRequest) {
  // Rate limiting (stricter for creates)
  const clientIP = getClientIP(request)
  const { allowed, error: rateLimitError } = await rateLimit(`create-case:${clientIP}`, 30)
  if (!allowed) return rateLimitError!

  // Auth check
  const { user, error: authError } = await requireAuth(request)
  if (!user) return authError!

  // --- VALIDATION: REQUEST BODY ---
  const rawBody: unknown = await request.json()
  const bodyParseResult = CreateCasePayloadSchema.safeParse(rawBody)

  if (!bodyParseResult.success) {
    return NextResponse.json({
      success: false,
      message: 'Dados de criação do caso inválidos.',
      errors: bodyParseResult.error.flatten(),
    }, { status: 400 })
  }

  const input: CreateCasePayload = bodyParseResult.data

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
