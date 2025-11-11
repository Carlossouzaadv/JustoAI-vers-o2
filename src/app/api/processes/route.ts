// ================================
// API CRUD PROCESSOS MONITORADOS
// ================================
// Gerenciamento completo de processos em monitoramento

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { validateAuth } from '@/lib/auth';
import { apiResponse, errorResponse, ApiError, validateJson } from '@/lib/api-utils';
import {
  createProcessApiClient,
  validateProcessNumber,
  normalizeProcessNumber
} from '@/lib/process-apis';
import { ICONS } from '@/lib/icons';
import type { Prisma } from '@prisma/client';
import type { MovementCategory, Priority } from '@prisma/client';

// ================================
// SCHEMAS DE VALIDAÇÃO
// ================================

const CreateProcessSchema = z.object({
  processNumber: z.string().min(1, 'Número do processo é obrigatório'),
  court: z.string().min(1, 'Tribunal é obrigatório'),
  clientName: z.string().min(1, 'Nome do cliente é obrigatório'),
  caseId: z.string().optional(),
  syncFrequency: z.enum(['HOURLY', 'DAILY', 'WEEKLY', 'MANUAL']).default('DAILY'),
  alertsEnabled: z.boolean().default(true),
  alertRecipients: z.array(z.string().email()).default([]),
  fetchInitialData: z.boolean().default(true)
});

const UpdateProcessSchema = z.object({
  court: z.string().min(1).optional(),
  clientName: z.string().min(1).optional(),
  caseId: z.string().nullable().optional(),
  monitoringStatus: z.enum(['ACTIVE', 'PAUSED', 'STOPPED', 'ERROR']).optional(),
  syncFrequency: z.enum(['HOURLY', 'DAILY', 'WEEKLY', 'MANUAL']).optional(),
  alertsEnabled: z.boolean().optional(),
  alertRecipients: z.array(z.string().email()).optional()
});

const QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'STOPPED', 'ERROR']).optional(),
  court: z.string().optional(),
  hasCase: z.enum(['true', 'false']).optional(),
  sortBy: z.enum(['createdAt', 'processNumber', 'clientName', 'lastSync']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// ================================
// TYPE GUARDS & VALIDATION
// ================================

interface ProcessMovementData {
  date: string | Date;
  type: string;
  description: string;
  category?: string;
  importance?: string;
  requiresAction?: boolean;
  deadline?: string | Date | null;
  [key: string]: unknown;
}

function isValidMovementCategory(value: unknown): value is MovementCategory {
  if (typeof value !== 'string') {
    return false;
  }

  const validCategories: readonly string[] = [
    'HEARING',
    'DECISION',
    'PETITION',
    'DOCUMENT_REQUEST',
    'DEADLINE',
    'NOTIFICATION',
    'APPEAL',
    'SETTLEMENT',
    'OTHER'
  ];

  return validCategories.includes(value);
}

function isValidPriority(value: unknown): value is Priority {
  if (typeof value !== 'string') {
    return false;
  }

  const validPriorities: readonly string[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

  return validPriorities.includes(value);
}

function isProcessMovement(data: unknown): data is ProcessMovementData {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  // Check required properties with 'in' operator (100% safe narrowing)
  if (!('date' in data && 'type' in data && 'description' in data)) {
    return false;
  }
  // Now safely access properties through the narrowed type
  const dateValue = data.date;
  const typeValue = data.type;
  const descValue = data.description;

  return (
    (typeof dateValue === 'string' || dateValue instanceof Date) &&
    typeof typeValue === 'string' &&
    typeof descValue === 'string'
  );
}

// ================================
// GET - LISTAR PROCESSOS MONITORADOS
// ================================

/**
 * @swagger
 * /api/processes:
 *   get:
 *     summary: Listar processos monitorados
 *     description: Retorna lista paginada de processos jurídicos em monitoramento com filtros, busca e ordenação
 *     tags:
 *       - Processos
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/SearchParam'
 *       - name: status
 *         in: query
 *         description: Filtrar por status do monitoramento
 *         required: false
 *         schema:
 *           type: string
 *           enum: [ACTIVE, PAUSED, STOPPED, ERROR]
 *       - name: court
 *         in: query
 *         description: Filtrar por tribunal/vara
 *         required: false
 *         schema:
 *           type: string
 *       - name: hasCase
 *         in: query
 *         description: Filtrar processos com ou sem caso associado
 *         required: false
 *         schema:
 *           type: string
 *           enum: [true, false]
 *       - name: sortBy
 *         in: query
 *         description: Campo para ordenação
 *         required: false
 *         schema:
 *           type: string
 *           enum: [createdAt, processNumber, clientName, lastSync]
 *           default: createdAt
 *       - $ref: '#/components/parameters/SortOrderParam'
 *     responses:
 *       200:
 *         description: Lista de processos retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     processes:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Process'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *                     stats:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 100
 *                         byStatus:
 *                           type: object
 *                           properties:
 *                             ACTIVE:
 *                               type: integer
 *                               example: 80
 *                             PAUSED:
 *                               type: integer
 *                               example: 15
 *                             STOPPED:
 *                               type: integer
 *                               example: 3
 *                             ERROR:
 *                               type: integer
 *                               example: 2
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
export async function GET(request: NextRequest) {
  try {
    const { workspace } = await validateAuth();
    const { searchParams } = new URL(request.url);

    // Validar query parameters
    const query = QuerySchema.parse({
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      court: searchParams.get('court') || undefined,
      hasCase: searchParams.get('hasCase') || undefined,
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc'
    });

    const offset = (query.page - 1) * query.limit;

    // Construir filtros
    const where: Prisma.MonitoredProcessWhereInput = {
      workspaceId: workspace.id
    };

    if (query.search) {
      where.OR = [
        { processNumber: { contains: query.search, mode: 'insensitive' } },
        { clientName: { contains: query.search, mode: 'insensitive' } },
        { court: { contains: query.search, mode: 'insensitive' } }
      ];
    }

    if (query.status) {
      where.monitoringStatus = query.status;
    }

    if (query.court) {
      where.court = { contains: query.court, mode: 'insensitive' };
    }

    if (query.hasCase === 'true') {
      where.caseId = { not: null };
    } else if (query.hasCase === 'false') {
      where.caseId = null;
    }

    // Buscar processos com contagem total
    const [processes, total] = await Promise.all([
      prisma.monitoredProcess.findMany({
        where,
        skip: offset,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
        include: {
          case: {
            select: {
              id: true,
              title: true,
              status: true,
              type: true
            }
          },
          movements: {
            take: 5,
            orderBy: { date: 'desc' },
            select: {
              id: true,
              date: true,
              type: true,
              description: true,
              category: true,
              importance: true,
              requiresAction: true,
              read: true
            }
          },
          alerts: {
            where: { read: false },
            take: 3,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              title: true,
              type: true,
              severity: true,
              createdAt: true
            }
          },
          _count: {
            select: {
              movements: true,
              alerts: true
            }
          }
        }
      }),
      prisma.monitoredProcess.count({ where })
    ]);

    // Calcular estatísticas
    const stats = await prisma.monitoredProcess.groupBy({
      by: ['monitoringStatus'],
      where: { workspaceId: workspace.id },
      _count: true
    });

    const statusStats = stats.reduce((acc, stat) => {
      acc[stat.monitoringStatus] = stat._count;
      return acc;
    }, {} as Record<string, number>);

    return apiResponse({
      processes,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit)
      },
      stats: {
        total,
        byStatus: statusStats
      }
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao listar processos:`, error);

    if (error instanceof ApiError) {
      return errorResponse(error.message, error.status);
    }

    return errorResponse('Erro interno do servidor', 500);
  }
}

// ================================
// POST - CRIAR NOVO PROCESSO MONITORADO
// ================================

/**
 * @swagger
 * /api/processes:
 *   post:
 *     summary: Criar novo processo monitorado
 *     description: Adiciona um novo processo jurídico ao monitoramento, opcionalmente buscando dados iniciais da API externa
 *     tags:
 *       - Processos
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - processNumber
 *               - court
 *               - clientName
 *             properties:
 *               processNumber:
 *                 type: string
 *                 example: "1234567-89.2024.8.26.0001"
 *                 description: Número do processo no formato CNJ
 *               court:
 *                 type: string
 *                 example: "1ª Vara Cível Central"
 *                 description: Tribunal ou vara do processo
 *               clientName:
 *                 type: string
 *                 example: "João Silva"
 *                 description: Nome do cliente associado ao processo
 *               caseId:
 *                 type: string
 *                 format: uuid
 *                 description: ID do caso jurídico a associar (opcional)
 *               syncFrequency:
 *                 type: string
 *                 enum: [HOURLY, DAILY, WEEKLY, MANUAL]
 *                 default: DAILY
 *                 description: Frequência de sincronização com a API externa
 *               alertsEnabled:
 *                 type: boolean
 *                 default: true
 *                 description: Habilitar alertas para este processo
 *               alertRecipients:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: email
 *                 default: []
 *                 example: ["admin@escritorio.com"]
 *                 description: Lista de emails para receber alertas
 *               fetchInitialData:
 *                 type: boolean
 *                 default: true
 *                 description: Buscar dados iniciais do processo na API externa
 *     responses:
 *       201:
 *         description: Processo criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     process:
 *                       $ref: '#/components/schemas/Process'
 *                     initialMovements:
 *                       type: integer
 *                       example: 15
 *                       description: Número de movimentações iniciais importadas
 *                 message:
 *                   type: string
 *                   example: "Processo adicionado ao monitoramento com sucesso"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       409:
 *         description: Processo já está sendo monitorado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error: "Conflito"
 *               message: "Processo já está sendo monitorado neste workspace"
 *               statusCode: 409
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
export async function POST(request: NextRequest) {
  try {
    const { user, workspace } = await validateAuth();
    const { data: body, error: validationError } = await validateJson(request, CreateProcessSchema);
    if (validationError) return validationError;

    // Normalizar e validar número do processo
    const normalizedNumber = normalizeProcessNumber(body.processNumber);

    if (!validateProcessNumber(normalizedNumber)) {
      throw new ApiError('Número de processo inválido (formato CNJ esperado)', 400);
    }

    // Verificar se já existe
    const existing = await prisma.monitoredProcess.findUnique({
      where: {
        workspaceId_processNumber: {
          workspaceId: workspace.id,
          processNumber: normalizedNumber
        }
      }
    });

    if (existing) {
      throw new ApiError('Processo já está sendo monitorado neste workspace', 409);
    }

    // Verificar se o caso existe (se fornecido)
    let caseExists = null;
    if (body.caseId) {
      caseExists = await prisma.case.findFirst({
        where: {
          id: body.caseId,
          workspaceId: workspace.id
        }
      });

      if (!caseExists) {
        throw new ApiError('Caso não encontrado ou não pertence ao workspace', 404);
      }
    }

    // Buscar dados iniciais do processo (se solicitado)
    let processData = null;
    let initialMovements: unknown[] = [];

    if (body.fetchInitialData) {
      try {
        const processApi = createProcessApiClient();
        const apiResult = await processApi.searchProcess({
          processNumber: normalizedNumber,
          court: body.court,
          clientName: body.clientName,
          includeMovements: true,
          includeParties: true
        });

        if (apiResult.success && apiResult.data) {
          processData = apiResult.data;
          initialMovements = apiResult.data.movements.slice(0, 50); // Limite inicial
        }
      } catch (apiError) {
        console.warn(`${ICONS.WARNING} Erro ao buscar dados iniciais:`, apiError);
        // Continua sem os dados da API
      }
    }

    // Criar processo monitorado
    const monitoredProcess = await prisma.monitoredProcess.create({
      data: {
        workspaceId: workspace.id,
        caseId: body.caseId,
        processNumber: normalizedNumber,
        court: body.court,
        clientName: body.clientName,
        processData: processData ? JSON.parse(JSON.stringify(processData)) : null,
        monitoringStatus: 'ACTIVE',
        syncFrequency: body.syncFrequency,
        alertsEnabled: body.alertsEnabled,
        alertRecipients: body.alertRecipients,
        source: processData ? 'JUDIT_API' : 'MANUAL_INPUT',
        extractionMethod: 'API',
        lastSync: processData ? new Date() : null
      },
      include: {
        case: {
          select: {
            id: true,
            title: true,
            status: true
          }
        }
      }
    });

    // Criar movimentações iniciais (se existem)
    if (initialMovements.length > 0) {
      // Filter and validate movements using type guard
      const validMovements: Prisma.ProcessMovementCreateManyInput[] = [];

      for (const item of initialMovements) {
        if (!isProcessMovement(item)) {
          console.warn(`${ICONS.WARNING} Movimento inválido ignorado:`, item);
          continue;
        }

        // Now 'item' is safely typed as ProcessMovementData
        const category = isValidMovementCategory(item.category) ? item.category : 'OTHER';
        const importance = isValidPriority(item.importance) ? item.importance : 'MEDIUM';

        const validatedMovement: Prisma.ProcessMovementCreateManyInput = {
          monitoredProcessId: monitoredProcess.id,
          date: new Date(item.date),
          type: item.type,
          description: item.description,
          category,
          importance,
          requiresAction: item.requiresAction ?? false,
          deadline: item.deadline ? new Date(item.deadline) : null,
          rawData: JSON.parse(JSON.stringify(item))
        };

        validMovements.push(validatedMovement);
      }

      if (validMovements.length > 0) {
        await prisma.processMovement.createMany({
          data: validMovements
        });
      }
    }

    // Log de criação
    console.log(`${ICONS.SUCCESS} Processo monitorado criado:`, {
      id: monitoredProcess.id,
      processNumber: normalizedNumber,
      workspace: workspace.name,
      initialMovements: initialMovements.length
    });

    return NextResponse.json({
      success: true,
      data: {
        process: monitoredProcess,
        initialMovements: initialMovements.length
      },
      message: 'Processo adicionado ao monitoramento com sucesso'
    }, { status: 201 });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao criar processo monitorado:`, error);

    if (error instanceof ApiError) {
      return errorResponse(error.message, error.status);
    }

    return errorResponse('Erro interno do servidor', 500);
  }
}

// ================================
// DELETE - REMOVER PROCESSOS EM LOTE
// ================================

/**
 * @swagger
 * /api/processes:
 *   delete:
 *     summary: Remover processos em lote
 *     description: Remove um ou mais processos do monitoramento por IDs ou números de processo
 *     tags:
 *       - Processos
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: ids
 *         in: query
 *         description: IDs dos processos separados por vírgula
 *         required: false
 *         schema:
 *           type: string
 *           example: "uuid1,uuid2,uuid3"
 *       - name: processNumbers
 *         in: query
 *         description: Números dos processos separados por vírgula
 *         required: false
 *         schema:
 *           type: string
 *           example: "1234567-89.2024.8.26.0001,9876543-21.2024.8.26.0002"
 *     responses:
 *       200:
 *         description: Processos removidos com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     deleted:
 *                       type: integer
 *                       example: 3
 *                       description: Quantidade de processos removidos
 *                     processes:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           processNumber:
 *                             type: string
 *                           clientName:
 *                             type: string
 *                     message:
 *                       type: string
 *                       example: "3 processos removidos do monitoramento"
 *       400:
 *         description: Parâmetros inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error: "Requisição inválida"
 *               message: "IDs ou números de processo devem ser fornecidos"
 *               statusCode: 400
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
export async function DELETE(request: NextRequest) {
  try {
    const { workspace } = await validateAuth();
    const { searchParams } = new URL(request.url);

    const ids = searchParams.get('ids')?.split(',').filter(Boolean);
    const processNumbers = searchParams.get('processNumbers')?.split(',').filter(Boolean);

    if (!ids && !processNumbers) {
      throw new ApiError('IDs ou números de processo devem ser fornecidos', 400);
    }

    const where: Prisma.MonitoredProcessWhereInput = {
      workspaceId: workspace.id
    };

    if (ids) {
      where.id = { in: ids };
    } else if (processNumbers) {
      where.processNumber = { in: processNumbers.map(n => normalizeProcessNumber(n)) };
    }

    // Buscar processos que serão removidos
    const processesToDelete = await prisma.monitoredProcess.findMany({
      where,
      select: {
        id: true,
        processNumber: true,
        clientName: true
      }
    });

    if (processesToDelete.length === 0) {
      throw new ApiError('Nenhum processo encontrado para remoção', 404);
    }

    // Remover (cascade automático remove movimentações, alertas, etc.)
    const deleted = await prisma.monitoredProcess.deleteMany({
      where
    });

    console.log(`${ICONS.SUCCESS} Processos removidos:`, {
      count: deleted.count,
      processes: processesToDelete.map(p => p.processNumber)
    });

    return apiResponse({
      deleted: deleted.count,
      processes: processesToDelete,
      message: `${deleted.count} processos removidos do monitoramento`
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao remover processos:`, error);

    if (error instanceof ApiError) {
      return errorResponse(error.message, error.status);
    }

    return errorResponse('Erro interno do servidor', 500);
  }
}