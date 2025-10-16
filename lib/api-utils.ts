import { NextRequest, NextResponse } from 'next/server'
import { ZodError, ZodSchema } from 'zod'
import { getCurrentUser } from './auth'
import { ICONS } from './icons'

// Standard API Response types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Success response helper
export function successResponse<T>(data: T, message?: string): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    message,
  })
}

// Error response helper
export function errorResponse(error: string, status: number = 400): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status }
  )
}

// Paginated response helper
export function paginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  message?: string
): NextResponse<ApiResponse<T[]>> {
  return NextResponse.json({
    success: true,
    data,
    message,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}

// Validation middleware
export async function validateBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  try {
    const body = await request.json()
    const data = schema.parse(body)
    return { data, error: null }
  } catch (error) {
    if (error instanceof ZodError) {
      const formattedErrors = error.issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }))

      return {
        data: null,
        error: NextResponse.json(
          {
            success: false,
            error: 'Validation failed',
            details: formattedErrors,
          },
          { status: 400 }
        ),
      }
    }

    return {
      data: null,
      error: errorResponse('Invalid request body', 400),
    }
  }
}

// Query params validation
export function validateQuery<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): { data: T; error: null } | { data: null; error: NextResponse } {
  try {
    const { searchParams } = new URL(request.url)
    const params = Object.fromEntries(searchParams.entries())
    const data = schema.parse(params)
    return { data, error: null }
  } catch (error) {
    if (error instanceof ZodError) {
      const formattedErrors = error.issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }))

      return {
        data: null,
        error: NextResponse.json(
          {
            success: false,
            error: 'Invalid query parameters',
            details: formattedErrors,
          },
          { status: 400 }
        ),
      }
    }

    return {
      data: null,
      error: errorResponse('Invalid query parameters', 400),
    }
  }
}

// Auth middleware
export async function requireAuth(request: NextRequest) {
  // Development mode - allow bypass
  if (process.env.NODE_ENV === 'development') {
    console.log('⚠️ Development mode: Bypassing API auth validation')
    return {
      user: {
        id: 'dev-user',
        email: 'dev@justoai.com',
        name: 'Development User',
        supabaseId: 'dev-supabase-id',
        emailVerified: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        workspaces: [{
          workspace: {
            id: 'dev-workspace',
            name: 'Development Workspace',
            slug: 'dev'
          }
        }]
      },
      error: null
    }
  }

  const user = await getCurrentUser()

  if (!user) {
    return {
      user: null,
      error: NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      ),
    }
  }

  return { user, error: null }
}

// Workspace access middleware
export async function requireWorkspaceAccess(userId: string, workspaceId: string) {
  // Development mode - allow bypass
  if (process.env.NODE_ENV === 'development') {
    console.log('⚠️ Development mode: Bypassing workspace access check')
    return { hasAccess: true, error: null }
  }

  // Import inside function to avoid circular dependency
  const { hasWorkspaceAccess } = await import('./auth')

  const hasAccess = await hasWorkspaceAccess(userId, workspaceId)

  if (!hasAccess) {
    return {
      hasAccess: false,
      error: NextResponse.json(
        {
          success: false,
          error: 'Access denied to this workspace',
        },
        { status: 403 }
      ),
    }
  }

  return { hasAccess: true, error: null }
}

// Error handler wrapper
export function withErrorHandler(handler: (request: NextRequest, context?: { params: Promise<Record<string, string>> }) => Promise<NextResponse>) {
  return async (request: NextRequest, context?: { params: Promise<Record<string, string>> }) => {
    try {
      return await handler(request, context)
    } catch (error) {
      console.error('API Error:', error)

      if (error instanceof Error) {
        return errorResponse(error.message, 500)
      }

      return errorResponse('Internal server error', 500)
    }
  }
}

// Method handler helper
export function withMethods(handlers: Record<string, (request: NextRequest, context?: { params: Promise<Record<string, string>> }) => Promise<NextResponse>>) {
  return async (request: NextRequest, context?: { params: Promise<Record<string, string>> }) => {
    const method = request.method
    const handler = handlers[method]

    if (!handler) {
      return NextResponse.json(
        {
          success: false,
          error: `Method ${method} not allowed`,
        },
        { status: 405 }
      )
    }

    return withErrorHandler(handler)(request, context)
  }
}

// Rate limiting (simple in-memory implementation)
const requestCounts = new Map<string, { count: number; resetTime: number }>()

export async function rateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
): Promise<{ allowed: boolean; error: NextResponse | null }> {
  const now = Date.now()
  const record = requestCounts.get(identifier)

  if (!record || now > record.resetTime) {
    requestCounts.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    })
    return { allowed: true, error: null }
  }

  if (record.count >= limit) {
    return {
      allowed: false,
      error: NextResponse.json(
        {
          success: false,
          error: `${ICONS.WARNING} Rate limit exceeded. Try again later.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((record.resetTime - now) / 1000).toString(),
          },
        }
      ),
    }
  }

  record.count++
  return { allowed: true, error: null }
}

// Get client IP helper
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const real = request.headers.get('x-real-ip')
  const ip = forwarded?.split(',')[0] || real || 'unknown'
  return ip
}

// Custom Error class for API errors
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number = 400,
    public code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Generic API response helper (alias for successResponse)
export const apiResponse = successResponse

// JSON validation helper (alias for validateBody)
export const validateJson = validateBody