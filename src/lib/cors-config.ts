// ================================================================
// CONFIGURAÇÃO SEGURA DE CORS
// ================================================================
// Configuração baseada em ambiente para controle de acesso

export const corsConfig = {
  development: {
    origins: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://localhost:8080',
    ],
    credentials: true,
  },
  production: {
    origins: [
      'https://justoai.com',
      'https://www.justoai.com',
      'https://app.justoai.com',
      'https://admin.justoai.com',
      // Adicione outros domínios de produção conforme necessário
    ],
    credentials: true,
  },
  test: {
    origins: ['http://localhost:3000'],
    credentials: false,
  },
}

export const getCurrentCorsConfig = () => {
  const env = (process.env.NODE_ENV || 'development') as keyof typeof corsConfig
  return corsConfig[env] || corsConfig.development
}

/**
 * Obtém lista de origens permitidas baseada no ambiente
 */
export const getAllowedOrigins = (): string[] => {
  const config = getCurrentCorsConfig()
  return config.origins
}

/**
 * Verifica se uma origem é permitida
 */
export const isOriginAllowed = (origin: string | null | undefined): boolean => {
  if (!origin) {
    // Permite requisições sem origem (ex: Postman, apps mobile, curl)
    return true
  }

  const allowedOrigins = getAllowedOrigins()
  return allowedOrigins.includes(origin)
}

/**
 * Obtém o valor apropriado para Access-Control-Allow-Origin
 */
export const getCorsOriginHeader = (origin: string | null | undefined): string => {
  if (!origin) {
    // Para requisições sem origem, permitir apenas em desenvolvimento
    return process.env.NODE_ENV === 'production' ? getAllowedOrigins()[0] : '*'
  }

  if (isOriginAllowed(origin)) {
    return origin
  }

  // Se não permitido, retornar a primeira origem permitida (não permitirá acesso)
  return getAllowedOrigins()[0]
}
