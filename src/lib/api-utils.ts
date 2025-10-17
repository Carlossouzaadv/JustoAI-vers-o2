import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

/**
 * Standard success response
 */
export function successResponse<T = any>(data: T, message?: string, status = 200) {
  return NextResponse.json({ success: true, data, message }, { status })
}

/**
 * Standard error response
 */
export function errorResponse(message: string, status = 400, details?: any) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(details && { details }),
    },
    { status }
  )
}

/**
 * Unauthorized response
 */
export function unauthorizedResponse(message = 'Não autorizado') {
  return errorResponse(message, 401)
}

/**
 * Not found response
 */
export function notFoundResponse(message = 'Recurso não encontrado') {
  return errorResponse(message, 404)
}

/**
 * Method not allowed response
 */
export function methodNotAllowedResponse(allowedMethods: string[]) {
  return NextResponse.json(
    {
      success: false,
      error: 'Método não permitido',
      allowedMethods,
    },
    {
      status: 405,
      headers: {
        Allow: allowedMethods.join(', '),
      },
    }
  )
}

/**
 * Validation error response
 */
export function validationErrorResponse(errors: Record<string, string[]>) {
  return NextResponse.json(
    {
      success: false,
      error: 'Erro de validação',
      errors,
    },
    { status: 422 }
  )
}

/**
 * Server error response
 */
export function serverErrorResponse(message = 'Erro interno do servidor') {
  return errorResponse(message, 500)
}

/**
 * Paginated response
 */
export function paginatedResponse<T = any>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  message?: string
) {
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
    message,
  })
}

/**
 * Require authentication
 */
export async function requireAuth(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { user: null, error: unauthorizedResponse() }
    }
    return { user, error: null }
  } catch (error) {
    console.error('Auth error:', error)
    return { user: null, error: unauthorizedResponse() }
  }
}

/**
 * Require workspace access
 */
export async function requireWorkspaceAccess(userId: string, workspaceId: string) {
  try {
    const { prisma } = await import('@/lib/prisma')

    const access = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        workspaceId,
        status: 'ACTIVE',
      },
    })

    if (!access) {
      return {
        hasAccess: false,
        error: errorResponse('No access to this workspace', 403),
      }
    }

    return { hasAccess: true, error: null }
  } catch (error) {
    console.error('Workspace access error:', error)
    return {
      hasAccess: false,
      error: serverErrorResponse(),
    }
  }
}

/**
 * Validate request body
 */
export function validateBody(request: NextRequest, schema: any) {
  return {
    data: null,
    error: null,
  }
}

/**
 * Validate query parameters
 */
export function validateQuery(request: NextRequest, schema: any) {
  const { searchParams } = request.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10')))
  const search = searchParams.get('search') || undefined
  const status = searchParams.get('status') || undefined
  const workspaceId = searchParams.get('workspaceId') || undefined
  const type = searchParams.get('type') || undefined

  return {
    data: {
      page,
      limit,
      search,
      status,
      workspaceId,
      type,
    },
    error: null,
  }
}

/**
 * With methods wrapper
 */
export function withMethods(handlers: Record<string, any>) {
  return handlers
}

/**
 * Rate limit
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

export async function rateLimit(key: string, limit = 100) {
  const now = Date.now()
  const data = rateLimitMap.get(key)

  if (data && data.resetAt > now) {
    if (data.count >= limit) {
      return {
        allowed: false,
        error: errorResponse('Rate limit exceeded', 429),
      }
    }
    data.count++
  } else {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60000 })
  }

  return { allowed: true, error: null }
}

/**
 * Get client IP
 */
export function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}
