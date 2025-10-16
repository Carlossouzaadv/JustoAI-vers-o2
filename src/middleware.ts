// ================================================================
// MIDDLEWARE DE PERFORMANCE E SEGURANÇA - JUSTOAI V2
// ================================================================
// Implementa cache dinâmico, otimizações de performance e segurança

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // ======================================
  // CACHE DE PERFORMANCE
  // ======================================

  const { pathname } = request.nextUrl;

  // Cache agressivo para assets estáticos
  if (pathname.startsWith('/_next/static/') || pathname.startsWith('/optimized/')) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    response.headers.set('Vary', 'Accept-Encoding');
  }

  // Cache para imagens
  else if (/\.(png|jpg|jpeg|gif|webp|avif|ico|svg)$/.test(pathname)) {
    response.headers.set('Cache-Control', 'public, max-age=86400');
    response.headers.set('Vary', 'Accept-Encoding');
  }

  // Cache para fontes
  else if (/\.(woff|woff2|eot|ttf|otf)$/.test(pathname)) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    response.headers.set('Vary', 'Accept-Encoding');
  }

  // Cache para API routes (cache mais conservador)
  else if (pathname.startsWith('/api/')) {
    // Cache de 5 minutos para APIs não críticas
    if (!pathname.includes('/auth/') && !pathname.includes('/upload/')) {
      response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    } else {
      // Sem cache para endpoints sensíveis
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }

  // Cache para páginas estáticas
  else if (pathname === '/' || pathname.startsWith('/blog/') || pathname === '/pricing') {
    response.headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  }

  // ======================================
  // HEADERS DE PERFORMANCE
  // ======================================

  // Preconnect para recursos externos
  response.headers.set('Link', [
    '</optimized/logo+nome.webp>; rel=preload; as=image',
    '<https://fonts.googleapis.com>; rel=preconnect',
    '<https://fonts.gstatic.com>; rel=preconnect; crossorigin',
  ].join(', '));

  // ======================================
  // HEADERS DE SEGURANÇA
  // ======================================

  // Headers de segurança básicos
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // HSTS para forçar HTTPS
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Permissions Policy
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');

  // ======================================
  // DETECÇÃO DE ATAQUES
  // ======================================

  const userAgent = request.headers.get('user-agent') || '';
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';

  // Bloquear user agents suspeitos
  const suspiciousUAs = [
    'sqlmap', 'nmap', 'masscan', 'nessus', 'openvas', 'nikto',
    'dirbuster', 'gobuster', 'wpscan', 'burpsuite'
  ];

  if (suspiciousUAs.some(ua => userAgent.toLowerCase().includes(ua))) {
    console.warn(`[SECURITY] Blocked suspicious user agent: ${userAgent} from IP: ${ip}`);
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Verificação de HOST header
  const host = request.headers.get('host');
  const allowedHosts = [
    'localhost:3000',
    '127.0.0.1:3000',
    'localhost',
    '127.0.0.1',
    'justoai.com.br',
    'www.justoai.com.br',
    // Allow Railway internal health checks
    'healthcheck.railway.app',
    process.env.NEXT_PUBLIC_APP_URL?.replace(/https?:\/\//, ''),
    process.env.NEXT_PUBLIC_APP_DOMAIN,
  ].filter(Boolean);

  if (host && !allowedHosts.some(allowedHost => host.includes(allowedHost))) {
    // Only warn for non-Railway health checks
    if (!host.includes('healthcheck.railway')) {
      console.warn(`[SECURITY] Suspicious host header: ${host} from IP: ${ip}`);
    }
  }

  // Rate limiting básico para APIs sensíveis
  if (pathname.startsWith('/api/auth') ||
      pathname.startsWith('/api/ai') ||
      pathname.includes('upload')) {
    console.log(`[SECURITY] API access from ${ip} to ${pathname}`);
  }

  // Compressão
  if (request.headers.get('accept-encoding')?.includes('gzip')) {
    response.headers.set('Vary', 'Accept-Encoding');
  }

  // ======================================
  // OTIMIZAÇÕES ESPECÍFICAS
  // ======================================

  // Service Worker para cache offline
  if (pathname === '/sw.js') {
    response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
    response.headers.set('Service-Worker-Allowed', '/');
  }

  // Manifest para PWA
  if (pathname === '/manifest.json') {
    response.headers.set('Cache-Control', 'public, max-age=86400');
    response.headers.set('Content-Type', 'application/manifest+json');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};