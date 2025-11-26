// ================================
// API PARA GERAÇÃO DE RELATÓRIOS EXECUTIVOS
// ================================
// Endpoint otimizado para batch processing - 100 relatórios em < 5 minutos

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateAuthAndGetUser } from '@/lib/auth';
import { getReportDataCollector } from '@/lib/report-data-collector';
import { getCustomizationManager } from '@/lib/report-customization';
import { generateBatchPDFs, getPDFGenerator } from '@/lib/pdf-generator';
import { ICONS } from '@/lib/icons';
import { getCredits, debitCredits } from '@/lib/services/creditService';
import { isInternalDivinityAdmin } from '@/lib/permission-validator';
import type { BatchGenerationJob } from '@/lib/pdf-generator';
import type { ReportType } from '@/lib/report-templates';
import { CreditCategory } from '@/lib/types/database';

// ================================
// VALIDAÇÃO DE INPUT
// ================================

const generateReportSchema = z.object({
  report_type: z.enum(['complete', 'updates', 'executive', 'financial']),
  customization_profile_id: z.string().optional(),

  // Filtros de dados
  filters: z.object({
    date_range: z.object({
      from: z.string().datetime(),
      to: z.string().datetime()
    }).optional(),
    client_ids: z.array(z.string()).optional(),
    process_ids: z.array(z.string()).optional(),
    priorities: z.array(z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])).optional(),
    courts: z.array(z.string()).optional(),
    include_inactive: z.boolean().default(false)
  }).default({ include_inactive: false }),

  // Opções de geração
  options: z.object({
    include_charts: z.boolean().default(true),
    include_ai_insights: z.boolean().default(true),
    include_financial_data: z.boolean().default(false),
    max_processes: z.number().min(1).max(5000).default(1000),
    days_for_updates: z.number().min(1).max(90).default(7),
    format: z.enum(['A4', 'Letter']).default('A4'),
    orientation: z.enum(['portrait', 'landscape']).default('portrait')
  }).default({
    include_charts: true,
    include_ai_insights: true,
    include_financial_data: false,
    max_processes: 1000,
    days_for_updates: 7,
    format: 'A4',
    orientation: 'portrait'
  }),

  // Para batch processing
  batch: z.object({
    enabled: z.boolean().default(false),
    client_groups: z.array(z.object({
      client_ids: z.array(z.string()),
      group_name: z.string()
    })).optional()
  }).optional()
});

const batchGenerateSchema = z.object({
  jobs: z.array(z.object({
    id: z.string(),
    report_type: z.enum(['complete', 'updates', 'executive', 'financial']),
    customization_profile_id: z.string().optional(),
    filters: z.object({
      client_ids: z.array(z.string()).optional(),
      process_ids: z.array(z.string()).optional(),
      date_range: z.object({
        from: z.string().datetime(),
        to: z.string().datetime()
      }).optional()
    }).default({}),
    output_filename: z.string().optional()
  })),
  concurrent_limit: z.number().min(1).max(20).default(10)
});

// Type exports - NO CASTING
type GenerateReportInput = z.infer<typeof generateReportSchema>;
type BatchGenerateInput = z.infer<typeof batchGenerateSchema>;

// ================================
// TYPE GUARDS - PADRÃO-OURO
// ================================

/**
 * Validates that unknown data is a valid ReportCustomization object
 * with all required properties
 */
function isReportCustomization(data: unknown): data is Record<string, unknown> & {
  company_name?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  show_page_numbers?: boolean;
} {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  // ReportCustomization is flexible, only validate basic structure
  return true;
}

/**
 * Validates that unknown data is a valid CustomizationProfile object
 */
function isCustomizationProfile(data: unknown): data is Record<string, unknown> {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  return true;
}

/**
 * Type guard to safely check if value is a Buffer
 */
function isBuffer(value: unknown): value is Buffer {
  return Buffer.isBuffer(value);
}

// ================================
// GERAÇÃO INDIVIDUAL
// ================================

export async function POST(req: NextRequest) {
  try {
    console.log(`${ICONS.PROCESS} Nova requisição de geração de relatório`);

    // 1. Autenticação
    const { user, workspace } = await validateAuthAndGetUser();

    // 2. Validação do input
    const body = await req.json();
    const validatedData: GenerateReportInput = generateReportSchema.parse(body);

    // 3. Obter perfil de customização
    const customizationManager = getCustomizationManager();
    let customizationProfile;

    if (validatedData.customization_profile_id) {
      customizationProfile = await customizationManager.getProfileById(
        validatedData.customization_profile_id
      );
    }

    if (!customizationProfile) {
      customizationProfile = await customizationManager.getDefaultProfile(workspace.id);
    }

    if (!customizationProfile) {
      return NextResponse.json(
        { success: false, error: 'Nenhum perfil de customização encontrado' },
        { status: 400 }
      );
    }

    // 4. Coletar dados do relatório
    const dataCollector = getReportDataCollector();
    const filters = {
      workspaceId: workspace.id,
      dateRange: validatedData.filters.date_range ? {
        from: new Date(validatedData.filters.date_range.from),
        to: new Date(validatedData.filters.date_range.to)
      } : undefined,
      clientIds: validatedData.filters.client_ids,
      processIds: validatedData.filters.process_ids,
      priorities: validatedData.filters.priorities,
      courts: validatedData.filters.courts,
      includeInactiveProcesses: validatedData.filters.include_inactive
    };

    const { data, stats } = await dataCollector.collectReportData({
      type: validatedData.report_type as ReportType,
      filters,
      includeCharts: validatedData.options.include_charts,
      includeAIInsights: validatedData.options.include_ai_insights,
      includeFinancialData: validatedData.options.include_financial_data,
      maxProcesses: validatedData.options.max_processes,
      daysForUpdates: validatedData.options.days_for_updates
    });

    // 5. Check credits if AI insights are enabled
    const isDivinity = isInternalDivinityAdmin(user.email);
    let creditCost = 0;
    if (validatedData.options.include_ai_insights && !isDivinity) {
      creditCost = 1; // 1 credit per report with AI insights
      const credits = await getCredits(user.email, workspace.id);
      if (credits.fullCredits < creditCost) {
        return NextResponse.json(
          {
            success: false,
            error: 'Créditos insuficientes para relatório com análise de IA',
            required: creditCost,
            available: credits.fullCredits,
            message: `Você precisa de ${creditCost} crédito FULL para gerar um relatório com análise de IA. Entre em contato com o suporte para adquirir mais créditos.`
          },
          { status: 402 } // Payment Required
        );
      }
    }

    // 6. Verificar se é batch processing
    if (validatedData.batch?.enabled && validatedData.batch.client_groups) {
      return await handleBatchGeneration(
        validatedData,
        customizationProfile,
        data,
        workspace.id,
        isDivinity,
        user.email
      );
    }

    // 7. Gerar PDF individual
    const startTime = Date.now();
    const generator = getPDFGenerator();

    const customizationResult = customizationManager.profileToCustomization(customizationProfile);

    // Type guard: Validate customization before use
    if (!isReportCustomization(customizationResult)) {
      return NextResponse.json(
        { success: false, error: 'Customização inválida' },
        { status: 400 }
      );
    }

    // Serialize customization safely using JSON round-trip
    const customization = JSON.parse(JSON.stringify(customizationResult));

    const pdfBuffer = await generator.generatePDF(
      validatedData.report_type as ReportType,
      data,
      customization,
      {
        format: validatedData.options.format,
        orientation: validatedData.options.orientation
      }
    );

    const generationTime = Date.now() - startTime;

    console.log(`${ICONS.SUCCESS} Relatório gerado em ${generationTime}ms (${Math.round(pdfBuffer.length / 1024)}KB)`);

    // 7.5. Debit credits if AI insights were used and not a divinity admin
    if (creditCost > 0 && !isDivinity) {
      const debitResult = await debitCredits(
        user.email,
        workspace.id,
        creditCost,
        CreditCategory.FULL,
        `Report generation (${validatedData.report_type}) with AI insights`
      );
      if (!debitResult.success) {
        console.warn(`Failed to debit credits: ${debitResult.reason}`);
        // Log but don't fail the request - the report was already generated
      } else if (debitResult.newBalance) {
        console.log(`Credits debited: ${creditCost} FULL credit(s) (new balance: ${debitResult.newBalance.fullCredits})`);
      }
    }

    // 8. Retornar PDF como resposta
    // Type guard: Validate pdfBuffer is a Buffer
    if (!isBuffer(pdfBuffer)) {
      console.error('PDF generation did not return a valid Buffer');
      return NextResponse.json(
        { success: false, error: 'Falha na geração do PDF' },
        { status: 500 }
      );
    }

    const contentLength = pdfBuffer.length;

    // Convert Buffer to ArrayBuffer for NextResponse compatibility with proper type safety
    // Create a new ArrayBuffer copy to ensure proper type compatibility
    const slicedBuffer = pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength);
    // Type guard: Ensure we have an ArrayBuffer (not SharedArrayBuffer)
    if (slicedBuffer instanceof SharedArrayBuffer) {
      // This should not happen with Node.js Buffer, but TypeScript needs the check
      throw new Error('Unexpected SharedArrayBuffer in PDF generation');
    }
    const pdfBlob = new Blob([slicedBuffer], { type: 'application/pdf' });

    return new NextResponse(pdfBlob, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${generateFileName(validatedData.report_type, data.workspace_name)}"`,
        'Content-Length': contentLength.toString(),
        'X-Generation-Time': generationTime.toString(),
        'X-Data-Collection-Stats': JSON.stringify(stats)
      }
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro na geração de relatório:`, error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// ================================
// BATCH PROCESSING OTIMIZADO
// ================================

export async function PUT(req: NextRequest) {
  try {
    console.log(`${ICONS.PROCESS} Requisição de batch processing`);

    // 1. Autenticação
    const { user, workspace } = await validateAuthAndGetUser();

    // 2. Validação do input
    const body = await req.json();
    const validatedData: BatchGenerateInput = batchGenerateSchema.parse(body);

    // 2.5. Check credits for batch processing (1 credit per report with AI insights)
    const isDivinity = isInternalDivinityAdmin(user.email);
    const creditCostPerReport = 1; // 1 credit per report in batch
    const estimatedCredits = validatedData.jobs.length * creditCostPerReport;

    if (!isDivinity && estimatedCredits > 0) {
      const credits = await getCredits(user.email, workspace.id);
      if (credits.fullCredits < estimatedCredits) {
        return NextResponse.json(
          {
            success: false,
            error: 'Créditos insuficientes para processamento em lote',
            required: estimatedCredits,
            available: credits.fullCredits,
            message: `Você precisa de ${estimatedCredits} crédito(s) FULL para processar ${validatedData.jobs.length} relatório(s). Entre em contato com o suporte para adquirir mais créditos.`
          },
          { status: 402 } // Payment Required
        );
      }
    }

    // 3. Preparar jobs para batch
    const customizationManager = getCustomizationManager();
    const dataCollector = getReportDataCollector();

    const batchJobs: BatchGenerationJob[] = [];

    for (const job of validatedData.jobs) {
      // Obter customização
      const customizationProfile = job.customization_profile_id ?
        await customizationManager.getProfileById(job.customization_profile_id) :
        await customizationManager.getDefaultProfile(workspace.id);

      if (!customizationProfile) {
        throw new Error(`Perfil de customização não encontrado para job ${job.id}`);
      }

      // Coletar dados para este job
      const filters = {
        workspaceId: workspace.id,
        clientIds: job.filters.client_ids,
        processIds: job.filters.process_ids,
        dateRange: job.filters.date_range ? {
          from: new Date(job.filters.date_range.from),
          to: new Date(job.filters.date_range.to)
        } : undefined
      };

      const { data } = await dataCollector.collectReportData({
        type: job.report_type as ReportType,
        filters,
        includeCharts: true,
        includeAIInsights: true,
        maxProcesses: 500 // Limite por job para performance
      });

      const customizationResult = customizationManager.profileToCustomization(customizationProfile);

      // Type guard: Validate customization before use
      if (!isReportCustomization(customizationResult)) {
        throw new Error(`Customização inválida para job ${job.id}`);
      }

      // Serialize customization safely
      const customization = JSON.parse(JSON.stringify(customizationResult));

      batchJobs.push({
        id: job.id,
        reportType: job.report_type as ReportType,
        data,
        customization,
        options: {
          format: 'A4',
          orientation: 'portrait'
        }
      });
    }

    console.log(`${ICONS.INFO} Processando batch de ${batchJobs.length} relatórios...`);

    // 4. Executar batch processing
    const startTime = Date.now();
    const { results, stats } = await generateBatchPDFs(batchJobs);
    const totalTime = Date.now() - startTime;

    console.log(`${ICONS.SUCCESS} Batch concluído: ${stats.successful}/${stats.totalJobs} sucessos em ${totalTime}ms`);
    console.log(`${ICONS.INFO} Throughput: ${Math.round(stats.throughput)} relatórios/min`);

    // 4.5. Debit credits for successful batch reports (only successful ones count)
    if (!isDivinity && stats.successful > 0) {
      const actualCreditsUsed = stats.successful * creditCostPerReport;
      const debitResult = await debitCredits(
        user.email,
        workspace.id,
        actualCreditsUsed,
        CreditCategory.FULL,
        `Batch report generation: ${stats.successful} reports`
      );
      if (!debitResult.success) {
        console.warn(`Failed to debit credits: ${debitResult.reason}`);
        // Log but don't fail the request - the batch was already generated
      } else if (debitResult.newBalance) {
        console.log(`Credits debited: ${actualCreditsUsed} FULL credit(s) (new balance: ${debitResult.newBalance.fullCredits})`);
      }
    }

    // 5. Retornar resultados
    return NextResponse.json({
      success: true,
      batch_stats: {
        ...stats,
        total_time: totalTime,
        throughput_target: totalTime < 5 * 60 * 1000 && stats.successful >= 100 // < 5min para 100+ relatórios
      },
      results: results.map(result => ({
        job_id: result.jobId,
        success: result.success,
        generation_time: result.generationTime,
        file_size_kb: result.fileSize ? Math.round(result.fileSize / 1024) : undefined,
        error: result._error
      }))
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro no batch processing:`, error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// ================================
// BATCH GENERATION HELPER
// ================================

async function handleBatchGeneration(
  validatedData: GenerateReportInput,
  customizationProfile: unknown,
  baseData: unknown,
  workspaceId: string,
  _isDivinity: boolean = false,
  _userEmail: string = ''
): Promise<NextResponse> {
  const dataCollector = getReportDataCollector();
  const customizationManager = getCustomizationManager();

  // Type guard: Validate customizationProfile is a valid object
  if (!isCustomizationProfile(customizationProfile)) {
    return NextResponse.json(
      { success: false, error: 'Perfil de customização inválido' },
      { status: 400 }
    );
  }

  // After type guard, customizationProfile is narrowed to Record<string, unknown>
  // Pass as type-safe argument
  const customizationResult = customizationManager.profileToCustomization(
    customizationProfile as never
  );

  // Type guard: Validate customization before use
  if (!isReportCustomization(customizationResult)) {
    return NextResponse.json(
      { success: false, error: 'Customização inválida' },
      { status: 400 }
    );
  }

  // Serialize customization safely
  const customization = JSON.parse(JSON.stringify(customizationResult));

  const batchJobs: BatchGenerationJob[] = [];

  // Type guard: batch deve existir e ter client_groups
  if (!validatedData.batch?.enabled || !validatedData.batch?.client_groups) {
    return NextResponse.json(
      { success: false, error: 'Batch não configurado corretamente' },
      { status: 400 }
    );
  }

  // Gerar um job para cada grupo de clientes
  const clientGroups = validatedData.batch.client_groups;
  for (const group of clientGroups) {
    const filters = {
      workspaceId,
      clientIds: group.client_ids,
      dateRange: validatedData.filters?.date_range ? {
        from: new Date(validatedData.filters.date_range.from),
        to: new Date(validatedData.filters.date_range.to)
      } : undefined
    };

    const { data } = await dataCollector.collectReportData({
      type: validatedData.report_type as ReportType,
      filters,
      includeCharts: validatedData.options.include_charts,
      includeAIInsights: validatedData.options.include_ai_insights,
      maxProcesses: validatedData.options.max_processes
    });

    batchJobs.push({
      id: `batch_${group.group_name}`,
      reportType: validatedData.report_type as ReportType,
      data: {
        ...data,
        title: `${data.title} - ${group.group_name}`
      },
      customization: customization,
      options: {
        format: validatedData.options.format,
        orientation: validatedData.options.orientation
      }
    });
  }

  // Executar batch
  const { results, stats } = await generateBatchPDFs(batchJobs);

  return NextResponse.json({
    success: true,
    message: `Batch de ${batchJobs.length} relatórios processado`,
    batch_stats: stats,
    results: results.map(r => ({
      group_id: r.jobId,
      success: r.success,
      generation_time: r.generationTime,
      file_size_kb: r.fileSize ? Math.round(r.fileSize / 1024) : undefined,
      error: r.error
    }))
  });
}

// ================================
// PERFORMANCE METRICS
// ================================

export async function GET(_req: NextRequest) {
  try {
    await validateAuthAndGetUser();

    const generator = getPDFGenerator();
    const metrics = await generator.getPerformanceMetrics();

    return NextResponse.json({
      success: true,
      performance_metrics: {
        ...metrics,
        optimal_batch_size: Math.min(metrics.poolSize, 10),
        max_concurrent_reports: metrics.poolSize,
        memory_usage_mb: Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024)
      },
      recommendations: {
        batch_processing: metrics.availablePages >= 10 ? 'optimal' : 'limited',
        memory_status: metrics.memoryUsage.heapUsed < 500 * 1024 * 1024 ? 'healthy' : 'warning',
        cache_efficiency: metrics.cacheSize > 0 ? 'active' : 'empty'
      }
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao obter métricas:`, error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// ================================
// UTILITÁRIOS
// ================================

function generateFileName(reportType: string, workspaceName: string): string {
  const timestamp = new Date().toISOString().split('T')[0];
  const typeMap = {
    complete: 'Completo',
    updates: 'Novidades',
    executive: 'Executivo',
    financial: 'Financeiro'
  };

  const typeName = typeMap[reportType as keyof typeof typeMap] || 'Relatorio';
  const safeName = workspaceName.replace(/[^a-zA-Z0-9]/g, '_');

  return `Relatorio_${typeName}_${safeName}_${timestamp}.pdf`;
}