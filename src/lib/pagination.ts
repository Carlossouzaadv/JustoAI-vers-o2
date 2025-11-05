/**
 * Pagination Utilities
 * Utilitários para paginação padronizada nas APIs
 */

import { z } from 'zod';

// === SCHEMAS ===

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
});

export const PaginationParamsSchema = z.object({
  page: z.number().min(1),
  limit: z.number().min(1).max(100),
  offset: z.number().min(0),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']),
  search: z.string().optional(),
});

// === TIPOS ===

export interface PaginationQuery {
  page?: string | number;
  limit?: string | number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
  sort?: string;
  order: 'asc' | 'desc';
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    startIndex: number;
    endIndex: number;
  };
  meta?: {
    search?: string;
    sort?: string;
    order?: 'asc' | 'desc';
    filters?: Record<string, unknown>;
  };
}

// === FUNÇÕES UTILITÁRIAS ===

/**
 * Parse e valida parâmetros de paginação da query
 */
export function parsePaginationQuery(query: PaginationQuery): PaginationParams {
  const validated = PaginationQuerySchema.parse(query);

  return {
    page: validated.page,
    limit: validated.limit,
    offset: (validated.page - 1) * validated.limit,
    sort: validated.sort,
    order: validated.order,
    search: validated.search,
  };
}

/**
 * Cria resposta paginada padronizada
 */
export function createPaginatedResponse<T>(
  data: T[],
  params: PaginationParams,
  total: number,
  meta?: Record<string, unknown>
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / params.limit);
  const hasNext = params.page < totalPages;
  const hasPrev = params.page > 1;
  const startIndex = params.offset + 1;
  const endIndex = Math.min(params.offset + params.limit, total);

  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNext,
      hasPrev,
      startIndex,
      endIndex,
    },
    meta: {
      search: params.search,
      sort: params.sort,
      order: params.order,
      ...meta,
    },
  };
}

/**
 * Gera configuração Prisma para paginação
 */
export function getPrismaConfig(params: PaginationParams) {
  const config: Record<string, unknown> = {
    skip: params.offset,
    take: params.limit,
  };

  // Adicionar ordenação se especificada
  if (params.sort) {
    config.orderBy = {
      [params.sort]: params.order,
    };
  }

  return config;
}

/**
 * Gera configuração Prisma para busca
 */
export function getPrismaSearchConfig(
  searchFields: string[],
  searchTerm?: string,
  additionalWhere?: Record<string, unknown>
) {
  let where = additionalWhere || {} as Record<string, unknown>;

  if (searchTerm && searchFields.length > 0) {
    const searchConditions = searchFields.map(field => ({
      [field]: {
        contains: searchTerm,
        mode: 'insensitive' as const,
      },
    }));

    where = {
      ...where,
      OR: searchConditions,
    };
  }

  return where;
}

/**
 * Calcula estatísticas de paginação
 */
export function calculatePaginationStats(
  currentPage: number,
  totalItems: number,
  itemsPerPage: number
) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const hasNext = currentPage < totalPages;
  const hasPrev = currentPage > 1;

  const nextPage = hasNext ? currentPage + 1 : null;
  const prevPage = hasPrev ? currentPage - 1 : null;

  return {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    startItem,
    endItem,
    hasNext,
    hasPrev,
    nextPage,
    prevPage,
    isFirstPage: currentPage === 1,
    isLastPage: currentPage === totalPages,
  };
}

/**
 * Gera URLs de paginação para APIs
 */
export function generatePaginationUrls(
  baseUrl: string,
  params: PaginationParams,
  totalPages: number
) {
  const createUrl = (page: number) => {
    const url = new URL(baseUrl);
    url.searchParams.set('page', page.toString());
    url.searchParams.set('limit', params.limit.toString());

    if (params.sort) url.searchParams.set('sort', params.sort);
    if (params.order) url.searchParams.set('order', params.order);
    if (params.search) url.searchParams.set('search', params.search);

    return url.toString();
  };

  const urls: Record<string, string> = {
    self: createUrl(params.page),
    first: createUrl(1),
    last: createUrl(totalPages),
  };

  if (params.page > 1) {
    urls.prev = createUrl(params.page - 1);
  }

  if (params.page < totalPages) {
    urls.next = createUrl(params.page + 1);
  }

  return urls;
}

/**
 * Middleware para validação de paginação
 */
export function validatePaginationMiddleware() {
  return (req: { query: PaginationQuery; pagination?: PaginationParams }, res: { status: (code: number) => { json: (data: unknown) => unknown } }, next: () => void) => {
    try {
      const params = parsePaginationQuery(req.query);
      req.pagination = params;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid pagination parameters',
          details: error.issues,
        });
      }

      return res.status(400).json({
        error: 'Invalid pagination parameters',
      });
    }
  };
}

/**
 * Cache key para paginação
 */
export function generatePaginationCacheKey(
  resource: string,
  params: PaginationParams,
  additionalParams?: Record<string, unknown>
): string {
  const keyParts = [
    resource,
    `page-${params.page}`,
    `limit-${params.limit}`,
  ];

  if (params.sort) keyParts.push(`sort-${params.sort}`);
  if (params.order) keyParts.push(`order-${params.order}`);
  if (params.search) keyParts.push(`search-${encodeURIComponent(params.search)}`);

  if (additionalParams) {
    Object.entries(additionalParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        keyParts.push(`${key}-${encodeURIComponent(String(value))}`);
      }
    });
  }

  return keyParts.join(':');
}

/**
 * Configurações padrão de paginação por recurso
 */
export const PAGINATION_DEFAULTS = {
  clients: { limit: 20, sort: 'createdAt', order: 'desc' as const },
  processes: { limit: 15, sort: 'lastSyncAt', order: 'desc' as const },
  cases: { limit: 10, sort: 'createdAt', order: 'desc' as const },
  documents: { limit: 25, sort: 'uploadedAt', order: 'desc' as const },
  reports: { limit: 10, sort: 'createdAt', order: 'desc' as const },
  users: { limit: 20, sort: 'createdAt', order: 'desc' as const },
  events: { limit: 50, sort: 'date', order: 'desc' as const },
} as const;

/**
 * Aplica configurações padrão para um recurso
 */
export function applyDefaultPagination(
  resource: keyof typeof PAGINATION_DEFAULTS,
  query: PaginationQuery
): PaginationParams {
  const defaults = PAGINATION_DEFAULTS[resource];

  return parsePaginationQuery({
    ...defaults,
    ...query,
  });
}

const exported = {
  parsePaginationQuery,
  createPaginatedResponse,
  getPrismaConfig,
  getPrismaSearchConfig,
  calculatePaginationStats,
  generatePaginationUrls,
  validatePaginationMiddleware,
  generatePaginationCacheKey,
  applyDefaultPagination,
  PAGINATION_DEFAULTS,
};

export default exported;
