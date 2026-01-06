// ================================================================
// CORS HELPER UTILITIES
// ================================================================
// Funções auxiliares para configuração de CORS em API routes

import { NextRequest, NextResponse } from 'next/server'
import { getAllowedOrigins, isOriginAllowed, getCorsOriginHeader } from './cors-config'

/**
 * Adiciona headers CORS à resposta
 */
export function addCorsHeaders(
  response: NextResponse | Response,
  origin: string | null | undefined
): void {
  const headers = response.headers

  // Configurar Access-Control-Allow-Origin
  headers.set('Access-Control-Allow-Origin', getCorsOriginHeader(origin))

  // Configurar outros headers CORS
  headers.set('Access-Control-Allow-Credentials', 'true')
  headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, PATCH, OPTIONS'
  )
  headers.set(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, Cache-Control'
  )
  headers.set('Access-Control-Max-Age', '7200') // 2 horas (mais seguro para dados sensíveis)
}

/**
 * Cria uma resposta para preflight request (OPTIONS)
 */
export function createPreflightResponse(origin: string | null | undefined): Response {
  const headers = new Headers()

  headers.set('Access-Control-Allow-Origin', getCorsOriginHeader(origin))
  headers.set('Access-Control-Allow-Credentials', 'true')
  headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, PATCH, OPTIONS'
  )
  headers.set(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, Cache-Control'
  )
  headers.set('Access-Control-Max-Age', '7200')

  return new Response(null, { status: 200, headers })
}

/**
 * Middleware CORS para validação de origem
 */
export function validateCorsOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin')

  // Se a origem não está permitida, retornar erro 403
  if (origin && !isOriginAllowed(origin)) {
    console.warn(`[CORS] Origem não permitida: ${origin}`)

    return NextResponse.json(
      {
        success: false,
        error: 'Origem não permitida',
        message: 'CORS policy: This origin is not allowed to access this resource'
      },
      { status: 403 }
    )
  }

  return null
}

/**
 * Cria headers CORS seguros para SSE
 */
export function createSSECorsHeaders(origin: string | null | undefined): Headers {
  const headers = new Headers()

  headers.set('Content-Type', 'text/event-stream')
  headers.set('Cache-Control', 'no-cache')
  headers.set('Connection', 'keep-alive')
  headers.set('Access-Control-Allow-Origin', getCorsOriginHeader(origin))
  headers.set('Access-Control-Allow-Credentials', 'true')
  headers.set('Access-Control-Allow-Headers', 'Cache-Control, Content-Type')

  return headers
}

/**
 * Logger de tentativas de acesso negadas
 */
export async function logDeniedAccess(
  origin: string | null | undefined,
  path: string,
  method: string
): Promise<void> {
  const timestamp = new Date().toISOString()
  const allowedOrigins = getAllowedOrigins()

  console.warn(
    `[CORS DENIED] ${timestamp}
    Origin: ${origin || 'undefined'}
    Path: ${path}
    Method: ${method}
    Allowed origins: ${allowedOrigins.join(', ')}`
  )

  // Em produção, enviar para Sentry para monitoramento
  if (process.env.NODE_ENV === 'production') {
    try {
      const Sentry = await import('@sentry/nextjs');
      Sentry.captureMessage(
        `CORS access denied from origin: ${origin || 'undefined'}`,
        'warning'
      );
      Sentry.getCurrentScope().setContext('cors_denied', {
        origin: origin || 'undefined',
        path,
        method,
        allowedOrigins
      });
    } catch (error) {
      console.error('Failed to log CORS denial to Sentry:', error);
    }
  }
}
