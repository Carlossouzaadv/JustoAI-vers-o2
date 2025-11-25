import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  requireAuth,
  requireWorkspaceAccess,
} from '@/lib/api-utils'
import {
  RouteIdParamSchema,
  UpdateCasePayloadSchema,
  type UpdateCasePayload,
} from '@/lib/types/api-schemas'
import { ICONS } from '@/lib/icons'

/**
 * GET /api/cases/[id] - Get a specific case with full details
 *
 * Validation:
 * - Route param [id] must be a valid UUID
 * - User must have access to the case's workspace
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await requireAuth(request)
    if (!user) return authError!

    // --- VALIDATION 1: ROUTE PARAMETERS ---
    const awaitedParams = await params
    const paramParseResult = RouteIdParamSchema.safeParse(awaitedParams)

    if (!paramParseResult.success) {
      return NextResponse.json({
        success: false,
        message: 'ID do caso inválido na URL.',
        errors: paramParseResult.error.flatten(),
      }, { status: 400 })
    }

    const { id: caseId } = paramParseResult.data

    console.log(`${ICONS.SEARCH} [API] Fetching case: ${caseId}`)

    // Include definition for case queries
    const caseInclude = {
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          type: true,
        },
      },
      documents: {
        select: {
          id: true,
          name: true,
          type: true,
          size: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' as const },
        take: 20,
      },
      _count: {
        select: {
          documents: true,
        },
      },
    }

    // Try to fetch the case by ID (primary key)
    let caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: caseInclude,
    })

    // If not found by ID, try by detectedCnj (CNJ number)
    if (!caseData) {
      console.log(`${ICONS.INFO} [API] Not found by ID, trying detectedCnj...`)
      caseData = await prisma.case.findFirst({
        where: {
          detectedCnj: caseId,
        },
        include: caseInclude,
      })
    }

    // If still not found, try by process number
    if (!caseData) {
      console.log(`${ICONS.INFO} [API] Not found by detectedCnj, trying process number...`)
      caseData = await prisma.case.findFirst({
        where: {
          number: caseId,
        },
        include: caseInclude,
      })
    }

    if (!caseData) {
      console.warn(`${ICONS.WARNING} Case not found using unknown identifier: ${caseId}`)
      return errorResponse('Caso não encontrado', 404)
    }

    console.log(`${ICONS.SUCCESS} Case found: ${caseData.id} (number: ${caseData.number})`)

    // Check if user has access to this workspace
    const { hasAccess, error: accessError } = await requireWorkspaceAccess(
      user.id,
      caseData.workspaceId
    )
    if (!hasAccess) return accessError!

    return successResponse({
      id: caseData.id,
      number: caseData.number,
      detectedCnj: caseData.detectedCnj,
      title: caseData.title,
      description: caseData.description,
      type: caseData.type,
      status: caseData.status,
      priority: caseData.priority,
      client: caseData.client,
      documents: caseData.documents,
      documentCount: caseData._count.documents,
      onboardingStatus: caseData.onboardingStatus,
      // Note: previewSnapshot excluded from response due to size (load separately if needed)
      previewGeneratedAt: caseData.previewGeneratedAt,
      createdAt: caseData.createdAt,
      updatedAt: caseData.updatedAt,
      createdBy: caseData.createdById,
    })
  } catch (_error) {
    console.error(`${ICONS.ERROR} Error fetching case:`, error)
    return errorResponse('Erro ao carregar caso', 500)
  }
}

/**
 * PATCH /api/cases/[id] - Update a case
 *
 * Validation:
 * - Route param [id] must be a valid UUID
 * - Request body must match UpdateCasePayloadSchema
 * - At least one field must be provided for update
 * - User must have access to the case's workspace
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await requireAuth(request)
    if (!user) return authError!

    // --- VALIDATION 1: ROUTE PARAMETERS ---
    const awaitedParams = await params
    const paramParseResult = RouteIdParamSchema.safeParse(awaitedParams)

    if (!paramParseResult.success) {
      return NextResponse.json({
        success: false,
        message: 'ID do caso inválido na URL.',
        errors: paramParseResult.error.flatten(),
      }, { status: 400 })
    }

    const { id: caseId } = paramParseResult.data

    // --- VALIDATION 2: REQUEST BODY ---
    const rawBody: unknown = await request.json()
    const bodyParseResult = UpdateCasePayloadSchema.safeParse(rawBody)

    if (!bodyParseResult.success) {
      return NextResponse.json({
        success: false,
        message: 'Dados de atualização inválidos.',
        errors: bodyParseResult.error.flatten(),
      }, { status: 400 })
    }

    const updateData: UpdateCasePayload = bodyParseResult.data

    console.log(`${ICONS.EDIT} [API] Updating case: ${caseId}`)

    // Fetch case to verify ownership
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { workspaceId: true },
    })

    if (!caseData) {
      return errorResponse('Caso não encontrado', 404)
    }

    // Check access
    const { hasAccess, error: accessError } = await requireWorkspaceAccess(
      user.id,
      caseData.workspaceId
    )
    if (!hasAccess) return accessError!

    // Update case with validated data
    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: updateData,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            type: true,
          },
        },
        documents: {
          select: {
            id: true,
            name: true,
            type: true,
            size: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' as const },
          take: 20,
        },
        _count: {
          select: {
            documents: true,
          },
        },
      },
    })

    console.log(`${ICONS.SUCCESS} Case updated successfully: ${caseId}`)

    return successResponse(updatedCase, 'Caso atualizado com sucesso')
  } catch (_error) {
    console.error(`${ICONS.ERROR} Error updating case:`, error)
    return errorResponse('Erro ao atualizar caso', 500)
  }
}

/**
 * DELETE /api/cases/[id] - Delete a case
 *
 * Validation:
 * - Route param [id] must be a valid UUID
 * - User must have access to the case's workspace
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await requireAuth(request)
    if (!user) return authError!

    // --- VALIDATION 1: ROUTE PARAMETERS ---
    const awaitedParams = await params
    const paramParseResult = RouteIdParamSchema.safeParse(awaitedParams)

    if (!paramParseResult.success) {
      return NextResponse.json({
        success: false,
        message: 'ID do caso inválido na URL.',
        errors: paramParseResult.error.flatten(),
      }, { status: 400 })
    }

    const { id: caseId } = paramParseResult.data

    console.log(`${ICONS.EDIT} [API] Deleting case: ${caseId}`)

    // Fetch case to verify ownership
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { workspaceId: true, number: true },
    })

    if (!caseData) {
      return errorResponse('Caso não encontrado', 404)
    }

    // Check access
    const { hasAccess, error: accessError } = await requireWorkspaceAccess(
      user.id,
      caseData.workspaceId
    )
    if (!hasAccess) return accessError!

    // Delete case
    await prisma.case.delete({
      where: { id: caseId },
    })

    console.log(`${ICONS.SUCCESS} Case deleted successfully: ${caseId} (number: ${caseData.number})`)

    return successResponse(
      { id: caseId },
      'Caso deletado com sucesso'
    )
  } catch (_error) {
    console.error(`${ICONS.ERROR} Error deleting case:`, error)
    return errorResponse('Erro ao deletar caso', 500)
  }
}
