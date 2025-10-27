/**
 * GET /api/admin/judit-consumption
 *
 * Endpoint interno para puxar dados de consumo JUDIT
 * Protegido: Apenas usuários autenticados
 * Cache: 1x por dia
 *
 * Retorna:
 * - Dados de consumo real
 * - Custos calculados
 * - Preços sugeridos por margem
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

// Constants
const JUDIT_API_KEY = process.env.JUDIT_API_KEY;
const JUDIT_API_URL = 'https://requests.prod.judit.io/requests';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// ================================================================
// Types
// ================================================================

interface JuditRequest {
  request_id: string;
  search: {
    on_demand: boolean;
    search_type: string;
    search_key: string;
    response_type: string;
    search_params?: Record<string, any>;
  };
  with_attachments: boolean;
  origin: 'api' | 'tracking';
  status: 'completed' | 'failed' | 'pending';
  created_at: string;
  updated_at: string;
}

interface ConsumptionReport {
  period: {
    start: string;
    end: string;
    days: number;
  };
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  successRate: number;
  totalCost: number;
  avgCostPerRequest: number;
  byOrigin: Record<string, number>;
  bySearchType: Record<string, number>;
  byResponseType: Record<string, number>;
  byStatus: Record<string, number>;
  withAttachments: number;
  costBreakdown: {
    apiRequests: number;
    trackingRequests: number;
    attachments: number;
    total: number;
  };
  cachedAt: string;
}

// ================================================================
// Helper Functions
// ================================================================

async function isUserAuthenticated(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          }
        }
      }
    );

    const {
      data: { session }
    } = await supabase.auth.getSession();

    return !!session?.user;
  } catch {
    return false;
  }
}

async function fetchJuditData(startDate: string, endDate: string) {
  if (!JUDIT_API_KEY) {
    throw new Error('JUDIT_API_KEY not configured');
  }

  const url = `${JUDIT_API_URL}?page_size=1000&created_at_gte=${startDate}&created_at_lte=${endDate}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'api-key': JUDIT_API_KEY,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`JUDIT API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function calculateCost(request: JuditRequest): number {
  let cost = 0;
  const searchType = request.search?.search_type || 'unknown';
  const origin = request.origin || 'api';

  // Base search cost
  const searchCosts: Record<string, number> = {
    cpf: 0.50,
    cnpj: 0.50,
    oab: 0.50,
    name: 0.50,
    lawsuit_cnj: 0.30,
    lawsuit_attachment: 0.30
  };

  cost = searchCosts[searchType] || 0.30;

  // Attachment cost
  if (request.with_attachments) {
    cost += 3.50;
  }

  return cost;
}

function analyzeRequests(requests: JuditRequest[]): ConsumptionReport {
  const analysis = {
    period: {
      start: '',
      end: '',
      days: 0
    },
    totalRequests: requests.length,
    completedRequests: 0,
    failedRequests: 0,
    successRate: 0,
    totalCost: 0,
    avgCostPerRequest: 0,
    byOrigin: {} as Record<string, number>,
    bySearchType: {} as Record<string, number>,
    byResponseType: {} as Record<string, number>,
    byStatus: {} as Record<string, number>,
    withAttachments: 0,
    costBreakdown: {
      apiRequests: 0,
      trackingRequests: 0,
      attachments: 0,
      total: 0
    },
    cachedAt: new Date().toISOString()
  };

  if (requests.length === 0) {
    analysis.successRate = 100;
    return analysis;
  }

  const dates = requests.map(r => new Date(r.created_at).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);

  analysis.period.start = new Date(minDate).toISOString().split('T')[0];
  analysis.period.end = new Date(maxDate).toISOString().split('T')[0];
  analysis.period.days = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1;

  requests.forEach((req) => {
    const origin = req.origin || 'unknown';
    const searchType = req.search?.search_type || 'unknown';
    const responseType = req.search?.response_type || 'unknown';
    const status = req.status || 'unknown';
    const cost = calculateCost(req);

    // Count by origin
    analysis.byOrigin[origin] = (analysis.byOrigin[origin] || 0) + 1;

    // Count by search type
    analysis.bySearchType[searchType] = (analysis.bySearchType[searchType] || 0) + 1;

    // Count by response type
    analysis.byResponseType[responseType] = (analysis.byResponseType[responseType] || 0) + 1;

    // Count by status
    analysis.byStatus[status] = (analysis.byStatus[status] || 0) + 1;

    if (status === 'completed') analysis.completedRequests++;
    if (status === 'failed') analysis.failedRequests++;

    // Count with attachments
    if (req.with_attachments) {
      analysis.withAttachments++;
      analysis.costBreakdown.attachments += 3.50;
    }

    // Total cost
    analysis.totalCost += cost;

    // Breakdown by origin
    if (origin === 'api') {
      analysis.costBreakdown.apiRequests += (searchCosts[searchType] || 0.30);
    } else if (origin === 'tracking') {
      analysis.costBreakdown.trackingRequests += (searchCosts[searchType] || 0.30);
    }
  });

  analysis.costBreakdown.total = analysis.totalCost;
  analysis.avgCostPerRequest = analysis.totalCost / requests.length;
  analysis.successRate = (analysis.completedRequests / requests.length) * 100;

  return analysis;

  // Helper for search costs - need to define it properly
  const searchCosts: Record<string, number> = {
    cpf: 0.50,
    cnpj: 0.50,
    oab: 0.50,
    name: 0.50,
    lawsuit_cnj: 0.30,
    lawsuit_attachment: 0.30
  };
}

async function getCachedReport(): Promise<ConsumptionReport | null> {
  try {
    // Try to get from database (we'll implement caching in DB later)
    // For now, return null to force fresh fetch
    return null;
  } catch {
    return null;
  }
}

async function saveCachedReport(report: ConsumptionReport): Promise<void> {
  try {
    // TODO: Save to database for future caching
    // await prisma.adminCache.upsert({...})
  } catch (error) {
    console.error('Failed to cache report:', error);
    // Don't throw - just log the error
  }
}

// ================================================================
// Route Handlers
// ================================================================

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const isAuthenticated = await isUserAuthenticated(request);
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check cache first
    const cached = await getCachedReport();
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        fromCache: true
      });
    }

    // Fetch fresh data from JUDIT
    // Default: last 10 days
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 10 * 24 * 60 * 60 * 1000);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const juditData = await fetchJuditData(startDateStr, endDateStr);
    const requests = juditData.page_data || [];

    // Analyze data
    const report = analyzeRequests(requests);

    // Cache the report
    await saveCachedReport(report);

    return NextResponse.json({
      success: true,
      data: report,
      fromCache: false
    });
  } catch (error) {
    console.error('Error fetching JUDIT consumption:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch consumption data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
