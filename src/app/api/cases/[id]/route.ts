import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  requireAuth,
  requireWorkspaceAccess,
} from '@/lib/api-utils'
import { ICONS } from '@/lib/icons'

/**
 * GET /api/cases/[id] - Get a specific case with full details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await requireAuth(request)
    if (!user) return authError!

    const caseId = (await params).id

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
        orderBy: { createdAt: 'desc' },
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
      console.warn(`${ICONS.WARNING} Case not found using any identifier: ${caseId}`)
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
      case: {
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
        previewSnapshot: caseData.previewSnapshot,
        previewGeneratedAt: caseData.previewGeneratedAt,
        createdAt: caseData.createdAt,
        updatedAt: caseData.updatedAt,
        createdBy: caseData.createdById,
      },
    })
  } catch (error) {
    console.error(`${ICONS.ERROR} Error fetching case:`, error)
    return errorResponse('Erro ao carregar caso', 500)
  }
}

/**
 * PATCH /api/cases/[id] - Update a case (e.g., associate client)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await requireAuth(request)
    if (!user) return authError!

    const caseId = (await params).id
    const body = await request.json()

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

    // Update case
    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: body,
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
          orderBy: { createdAt: 'desc' },
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

    return successResponse({
      case: updatedCase,
      message: 'Caso atualizado com sucesso',
    })
  } catch (error) {
    console.error(`${ICONS.ERROR} Error updating case:`, error)
    return errorResponse('Erro ao atualizar caso', 500)
  }
}
