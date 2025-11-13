// ================================================================
// RELATÓRIOS INDIVIDUAIS ON-DEMAND - Endpoint Principal
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCreditManager } from '@/lib/credit-system';
import { ReportGenerator } from '@/lib/report-generator';
import { addNotificationJob } from '@/lib/queues';
import { ICONS } from '@/lib/icons';
import { createHash } from 'crypto';
import { juditAPI, JuditOperationType } from '@/lib/judit-api-wrapper';
import { ReportType, AudienceType, OutputFormat } from '@/lib/types/database';

// Tipos para o endpoint
interface IndividualReportRequest {
  processIds: string[];
  type: 'JURIDICO' | 'EXECUTIVO';
  format: ('PDF' | 'DOCX')[];
  scheduleAt?: string; // ISO string para agendamento
  forceNewAnalysis?: boolean;
}

interface IndividualReportResponse {
  success: boolean;
  reportId?: string;
  status: 'IMMEDIATE' | 'SCHEDULED';
  fileUrls?: Record<string, string>;
  creditsCost?: {
    consumed: boolean;
    reportCredits: number;
    message: string;
  };
  cacheInfo?: {
    hit: boolean;
    lastUpdate: string;
    expiresAt: string;
  };
  scheduledFor?: string;
  estimatedCompletion?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  let creditHold: { success: boolean; holdId?: string } | null = null;

  try {
    // 1. Parse e validação da requisição
    const body: IndividualReportRequest = await request.json();
    const { processIds, type, format, scheduleAt, forceNewAnalysis } = body;

    // Validação básica
    if (!processIds || processIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Lista de processos é obrigatória'
      }, { status: 400 });
    }

    if (processIds.length > 50) {
      return NextResponse.json({
        success: false,
        error: 'Máximo de 50 processos por relatório'
      }, { status: 400 });
    }

    // Obter workspace do usuário (mockado por enquanto)
    const workspaceId = request.headers.get('x-workspace-id') || 'workspace-mock';

    console.log(`${ICONS.PROCESS} Solicitação de relatório individual: ${processIds.length} processos, tipo ${type}`);

    // 2. Verificar cache se não forçar nova análise
    let cacheResult = null;

    if (!forceNewAnalysis) {
      cacheResult = await checkReportCache(workspaceId, processIds, type, format);

      if (cacheResult.hit) {
        console.log(`${ICONS.SUCCESS} Cache hit encontrado - não haverá cobrança de créditos`);

        // Track cache hit
        await juditAPI.trackCall({
          workspaceId,
          operationType: JuditOperationType.REPORT,
          durationMs: 0,
          success: true,
          requestId: cacheResult.reportId,
          metadata: {
            eventType: 'report.cache_hit',
            reportType: type,
            processCount: processIds.length,
            cacheHit: true
          }
        });

        return NextResponse.json({
          success: true,
          reportId: cacheResult.reportId,
          status: 'IMMEDIATE',
          fileUrls: cacheResult.fileUrls,
          creditsCost: {
            consumed: false,
            reportCredits: 0,
            message: 'Este relatório já está atualizado até a última movimentação. Não foi descontado crédito.'
          },
          cacheInfo: {
            hit: true,
            lastUpdate: cacheResult.lastUpdate,
            expiresAt: cacheResult.expiresAt
          }
        } as IndividualReportResponse);
      }
    }

    // 3. Calcular custo em créditos
    const creditManager = getCreditManager(prisma);
    const reportCreditCost = creditManager.calculateReportCreditCost(processIds.length);

    console.log(`${ICONS.INFO} Custo calculado: ${reportCreditCost} report credits para ${processIds.length} processos`);

    // 4. Verificar se tem créditos suficientes
    const balance = await creditManager.getCreditBalance(workspaceId);

    if (balance.reportCreditsAvailable < reportCreditCost) {
      return NextResponse.json({
        success: false,
        error: `Créditos insuficientes. Disponível: ${balance.reportCreditsAvailable}, Necessário: ${reportCreditCost}`
      }, { status: 400 });
    }

    // 5. Determinar se é imediato ou agendado
    const isScheduled = scheduleAt && new Date(scheduleAt) > new Date();

    if (isScheduled) {
      // FLUXO AGENDADO
      const scheduledDate = new Date(scheduleAt!);

      // Verificar se está na janela noturna permitida (23h-04h)
      const hour = scheduledDate.getHours();
      if (hour < 23 && hour > 4) {
        return NextResponse.json({
          success: false,
          error: 'Relatórios agendados só podem ser executados entre 23h e 04h'
        }, { status: 400 });
      }

      // Reservar créditos para o agendamento
      const holdResult = await creditManager.reserveCredits(
        workspaceId,
        `report-${Date.now()}`,
        reportCreditCost,
        0,
        30 // 30 dias de hold
      );

      if (!holdResult.success) {
        return NextResponse.json({
          success: false,
          error: holdResult.error
        }, { status: 400 });
      }

      creditHold = holdResult;

      // Criar execução agendada
      const reportExecution = await prisma.reportExecution.create({
        data: {
          workspaceId,
          reportType: type === 'JURIDICO' ? ReportType.COMPLETO : ReportType.NOVIDADES,
          parameters: {
            processIds,
            type,
            format,
            forceNewAnalysis
          },
          status: 'AGENDADO',
          scheduledFor: scheduledDate,
          audienceType: type === 'JURIDICO' ? AudienceType.USO_INTERNO : AudienceType.CLIENTE,
          outputFormats: format.map(toOutputFormat),
          quotaConsumed: reportCreditCost
        }
      });

      // Agendar job para execução
      await addNotificationJob('scheduled-report', {
        reportExecutionId: reportExecution.id,
        workspaceId,
        processIds,
        type,
        format,
        creditHoldId: holdResult.holdId
      }, {
        delay: scheduledDate.getTime() - Date.now(),
        priority: 1 // Baixa prioridade para agendados
      });

      console.log(`${ICONS.CALENDAR} Relatório agendado para ${scheduledDate.toISOString()}`);

      return NextResponse.json({
        success: true,
        reportId: reportExecution.id,
        status: 'SCHEDULED',
        creditsCost: {
          consumed: false,
          reportCredits: reportCreditCost,
          message: `${reportCreditCost} crédito(s) foram reservados e serão consumidos na execução`
        },
        scheduledFor: scheduledDate.toISOString(),
        estimatedCompletion: new Date(scheduledDate.getTime() + 5 * 60 * 1000).toISOString() // +5 min
      } as IndividualReportResponse);

    } else {
      // FLUXO IMEDIATO
      console.log(`${ICONS.PROCESS} Iniciando geração imediata do relatório`);

      // Debitar créditos antes da geração (transação atômica)
      const debitResult = await creditManager.debitCredits(
        workspaceId,
        reportCreditCost,
        0,
        `Relatório individual ${type}`,
        {
          processIds,
          type,
          format,
          timestamp: new Date().toISOString()
        }
      );

      if (!debitResult.success) {
        return NextResponse.json({
          success: false,
          error: debitResult.error
        }, { status: 400 });
      }

      try {
        // Gerar relatório
        const generator = new ReportGenerator();

        // Type-safe enum conversions (explicit type annotations to prevent literal inference)
        const selectedReportType: ReportType = type === 'JURIDICO' ? ReportType.COMPLETO : ReportType.NOVIDADES;
        const selectedAudienceType: AudienceType = type === 'JURIDICO' ? AudienceType.USO_INTERNO : AudienceType.CLIENTE;
        const selectedOutputFormats: OutputFormat[] = format.map(toOutputFormat);

        const reportResult = await generator.generateScheduledReport({
          workspaceId,
          reportType: selectedReportType,
          processIds,
          audienceType: selectedAudienceType,
          outputFormats: selectedOutputFormats,
          deltaDataOnly: type === 'EXECUTIVO'
        });

        if (!reportResult.success) {
          // Rollback dos créditos em caso de erro
          console.error(`${ICONS.ERROR} Erro na geração - executando rollback de créditos`);

          await creditManager.creditCredits(
            workspaceId,
            reportCreditCost,
            0,
            'PACK',
            'Rollback - erro na geração de relatório'
          );

          return NextResponse.json({
            success: false,
            error: reportResult.error || 'Erro na geração do relatório'
          }, { status: 500 });
        }

        // Salvar histórico de execução
        const reportExecution = await prisma.reportExecution.create({
          data: {
            workspaceId,
            reportType: type === 'JURIDICO' ? ReportType.COMPLETO : ReportType.NOVIDADES,
            parameters: {
              processIds,
              type,
              format,
              cacheHit: reportResult.cacheHit
            },
            status: 'CONCLUIDO',
            result: reportResult.summary,
            filePath: Object.values(reportResult.fileUrls)[0],
            fileUrls: reportResult.fileUrls,
            completedAt: new Date(),
            duration: reportResult.processingTime,
            tokensUsed: reportResult.tokensUsed,
            audienceType: type === 'JURIDICO' ? AudienceType.USO_INTERNO : AudienceType.CLIENTE,
            outputFormats: format.map(toOutputFormat),
            cacheHit: reportResult.cacheHit,
            quotaConsumed: reportCreditCost
          }
        });

        // Track telemetry
        await juditAPI.trackCall({
          workspaceId,
          operationType: JuditOperationType.REPORT,
          durationMs: reportResult.processingTime,
          success: true,
          requestId: reportExecution.id,
          metadata: {
            eventType: 'report.generated',
            reportType: type,
            processCount: processIds.length,
            outputFormats: format,
            cacheHit: reportResult.cacheHit,
            tokensUsed: reportResult.tokensUsed
          }
        });

        console.log(`${ICONS.SUCCESS} Relatório gerado com sucesso em ${reportResult.processingTime}ms`);

        return NextResponse.json({
          success: true,
          reportId: reportResult.reportId,
          status: 'IMMEDIATE',
          fileUrls: reportResult.fileUrls,
          creditsCost: {
            consumed: true,
            reportCredits: reportCreditCost,
            message: `Este relatório consumiu ${reportCreditCost} crédito(s)`
          },
          cacheInfo: {
            hit: reportResult.cacheHit,
            lastUpdate: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          }
        } as IndividualReportResponse);

      } catch (generationError) {
        // Rollback dos créditos em caso de erro
        console.error(`${ICONS.ERROR} Erro na geração - executando rollback de créditos:`, generationError);

        await creditManager.creditCredits(
          workspaceId,
          reportCreditCost,
          0,
          'PACK',
          'Rollback - erro na geração de relatório'
        );

        throw generationError;
      }
    }

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro no endpoint de relatórios individuais:`, error);

    // Liberar hold de créditos se foi criado
    if (creditHold?.success && creditHold.holdId) {
      try {
        const creditManager = getCreditManager(prisma);
        await creditManager.releaseReservation(creditHold.holdId);
      } catch (holdError) {
        console.error(`${ICONS.ERROR} Erro ao liberar hold de créditos:`, holdError);
      }
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    }, { status: 500 });
  }
}

// ================================================================
// FUNÇÕES AUXILIARES
// ================================================================

/**
 * Converte string de formato para o enum OutputFormat
 */
function toOutputFormat(format: 'PDF' | 'DOCX'): OutputFormat {
  if (format === 'PDF') {
    return OutputFormat.PDF;
  }
  return OutputFormat.DOCX;
}

/**
 * Verifica cache existente para o relatório
 */
async function checkReportCache(
  workspaceId: string,
  processIds: string[],
  type: string,
  format: string[]
): Promise<{
  hit: boolean;
  reportId?: string;
  fileUrls?: Record<string, string>;
  lastUpdate?: string;
  expiresAt?: string;
}> {
  try {
    // Gerar chave de cache baseada nos parâmetros
    const cacheKey = generateCacheKey(workspaceId, processIds, type, format);

    // Buscar cache existente
    const cached = await prisma.reportCache.findUnique({
      where: { cacheKey }
    });

    if (!cached || cached.expiresAt < new Date()) {
      return { hit: false };
    }

    // Verificar se houve movimentações recentes nos processos
    const latestMovement = await prisma.processMovement.findFirst({
      where: {
        monitoredProcess: {
          id: { in: processIds }
        }
      },
      orderBy: { date: 'desc' }
    });

    // Se há movimentação mais recente que o cache, invalidar
    if (latestMovement && latestMovement.date > cached.lastMovementTimestamp) {
      await prisma.reportCache.delete({ where: { cacheKey } });
      return { hit: false };
    }

    return {
      hit: true,
      reportId: cached.id,
      fileUrls: cached.fileUrls as Record<string, string>,
      lastUpdate: cached.lastMovementTimestamp.toISOString(),
      expiresAt: cached.expiresAt.toISOString()
    };

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao verificar cache:`, error);
    return { hit: false };
  }
}

/**
 * Gera chave de cache consistente
 */
function generateCacheKey(
  workspaceId: string,
  processIds: string[],
  type: string,
  format: string[]
): string {
  const keyData = [
    workspaceId,
    type,
    processIds.sort().join('|'),
    format.sort().join('|')
  ].join('||');

  return createHash('sha256').update(keyData).digest('hex');
}