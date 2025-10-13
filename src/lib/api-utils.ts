import { NextResponse } from 'next/server'

/**
 * Standard success response
 */
export function successResponse<T = any>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

/**
 * Standard error response
 */
export function errorResponse(message: string, status = 400, details?: any) {
  return NextResponse.json(
    {
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
