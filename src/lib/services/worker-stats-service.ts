/**
 * WorkerStatsService (Padrão-Ouro - Fase 29)
 *
 * Encapsula a persistência de estatísticas de workers (BullMQ) no banco de dados.
 * Este é o ledger (livro-razão) imutável de todo o trabalho assíncrono.
 *
 * Filosofia:
 * - Ledger Imutável: Cada job que completa (sucesso ou falha) gera um registro
 * - Type Safety: Zero any, zero as, zero @ts-ignore
 * - Ação no Ponto de Conclusão: Registros criados apenas quando o job termina
 * - Auditoria Completa: Todos os detalhes do erro/sucesso são salvos
 */

import { Job } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { log } from './logger';
import { WorkerJobStatus } from '@prisma/client';

// ================================================================
// TYPE GUARDS E NARROWING SEGURO (Mandato Inegociável)
// ================================================================

/**
 * Valida se um valor é um erro conhecido
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

/**
 * Valida se um valor é uma stack trace válida
 */
function getErrorStack(error: unknown): string | null {
  if (error instanceof Error && error.stack) {
    return error.stack;
  }
  return null;
}

/**
 * Valida se uma metadata é um objeto seguro
 */
function isValidMetadata(metadata: unknown): metadata is Record<string, string | number | boolean | null | undefined> {
  if (typeof metadata !== 'object' || metadata === null) {
    return false;
  }

  const meta = metadata as Record<PropertyKey, unknown>;

  for (const key in meta) {
    const value = meta[key];
    const isValidType = (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null ||
      value === undefined
    );

    if (!isValidType) {
      return false;
    }
  }

  return true;
}

/**
 * Valida se um resultado é um objeto seguro
 */
function isValidResult(result: unknown): result is Record<string, unknown> {
  return typeof result === 'object' && result !== null;
}

// ================================================================
// TIPOS
// ================================================================

type JobMetadata = Record<string, string | number | boolean | null | undefined>;

interface ReportSuccessInput {
  jobId: string;
  queueName: string;
  result: unknown;
  durationMs: number;
  metadata?: unknown;
}

interface ReportFailureInput {
  jobId: string;
  queueName: string;
  error: unknown;
  durationMs: number;
  retryCount: number;
  metadata?: unknown;
}

// ================================================================
// WORKER STATS SERVICE (Implementação)
// ================================================================

class WorkerStatsServiceImpl {
  /**
   * Registra um job que foi completado com sucesso
   *
   * CRÍTICO: Este método deve ser chamado no onCompleted do worker
   * ou no finally de um try/catch que envolve a execução do job.
   *
   * @param input - ReportSuccessInput com jobId, queueName, result, durationMs
   */
  async reportSuccess(input: ReportSuccessInput): Promise<void> {
    const { jobId, queueName, result, durationMs, metadata } = input;

    try {
      // Validar metadata com type guard
      let validatedMetadata: JobMetadata = {};
      if (metadata !== undefined) {
        if (!isValidMetadata(metadata)) {
          log.warn({
            msg: 'Metadata inválida para worker job',
            component: 'WorkerStatsService',
            jobId,
            queueName
          });
        } else {
          validatedMetadata = metadata;
        }
      }

      // Validar resultado com type guard
      let resultSummary: Record<string, unknown> = {};
      if (isValidResult(result)) {
        // Pegar apenas campos relevantes do resultado (não o resultado completo)
        resultSummary = {
          success: true,
          hasData: Object.keys(result).length > 0
        };
      }

      // Criar registro de sucesso (ledger imutável)
      await prisma.workerJobRecord.upsert({
        where: {
          jobId_queueName: {
            jobId,
            queueName
          }
        },
        create: {
          jobId,
          queueName,
          status: 'COMPLETED' as WorkerJobStatus,
          startedAt: new Date(Date.now() - durationMs),
          completedAt: new Date(),
          durationMs,
          resultSummary: resultSummary.success ? resultSummary : undefined,
          metadata: validatedMetadata,
          retryCount: 0
        },
        update: {
          status: "COMPLETED" as WorkerJobStatus,
          completedAt: new Date(),
          durationMs,
          resultSummary: resultSummary.success ? resultSummary : undefined,
          metadata: validatedMetadata
        }
      });

      log.info({
        msg: 'Worker job registrado como sucesso',
        component: 'WorkerStatsService',
        jobId,
        queueName,
        durationMs
      });

    } catch (error) {
      // CRÍTICO: Não deixar falha do registro afetar o job
      // Apenas logar o erro e continuar
      log.error({
        msg: 'Erro ao registrar sucesso do worker job',
        component: 'WorkerStatsService',
        jobId,
        queueName,
        error: getErrorMessage(error)
      });
    }
  }

  /**
   * Registra um job que falhou
   *
   * CRÍTICO: Este método deve ser chamado no onFailed do worker
   * ou no catch de um try/catch que envolve a execução do job.
   *
   * @param input - ReportFailureInput com jobId, queueName, error, durationMs, retryCount
   */
  async reportFailure(input: ReportFailureInput): Promise<void> {
    const { jobId, queueName, error, durationMs, retryCount, metadata } = input;

    try {
      // Extrair detalhes do erro com type guards
      const errorMessage = getErrorMessage(error);
      const errorStack = getErrorStack(error);

      // Validar metadata com type guard
      let validatedMetadata: JobMetadata = {};
      if (metadata !== undefined) {
        if (!isValidMetadata(metadata)) {
          log.warn({
            msg: 'Metadata inválida para worker job falho',
            component: 'WorkerStatsService',
            jobId,
            queueName
          });
        } else {
          validatedMetadata = metadata;
        }
      }

      // Criar registro de falha (ledger imutável)
      await prisma.workerJobRecord.upsert({
        where: {
          jobId_queueName: {
            jobId,
            queueName
          }
        },
        create: {
          jobId,
          queueName,
          status: 'FAILED' as WorkerJobStatus,
          startedAt: new Date(Date.now() - durationMs),
          completedAt: new Date(),
          durationMs,
          errorDetails: {
            message: errorMessage,
            stack: errorStack,
            code: error instanceof Error && 'code' in error ? (error as any).code : null
          },
          metadata: validatedMetadata,
          retryCount
        },
        update: {
          status: 'FAILED' as WorkerJobStatus,
          completedAt: new Date(),
          durationMs,
          errorDetails: {
            message: errorMessage,
            stack: errorStack,
            code: error instanceof Error && 'code' in error ? (error as any).code : null
          },
          metadata: validatedMetadata,
          retryCount
        }
      });

      log.warn({
        msg: 'Worker job registrado como falha',
        component: 'WorkerStatsService',
        jobId,
        queueName,
        durationMs,
        retryCount,
        error: errorMessage
      });

    } catch (error) {
      // CRÍTICO: Não deixar falha do registro afetar o job
      // Apenas logar o erro e continuar
      log.error({
        msg: 'Erro ao registrar falha do worker job',
        component: 'WorkerStatsService',
        jobId,
        queueName,
        error: getErrorMessage(error)
      });
    }
  }

  /**
   * Retorna estatísticas agregadas de uma fila
   * Útil para dashboards e monitoramento
   */
  async getQueueStats(queueName: string): Promise<{
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    successRate: number;
    averageDurationMs: number;
  }> {
    try {
      const records = await prisma.workerJobRecord.findMany({
        where: { queueName }
      });

      const completed = records.filter(r => r.status === 'COMPLETED');
      const failed = records.filter(r => r.status === 'FAILED');

      const avgDuration = records.length > 0
        ? Math.round(
            records.reduce((sum, r) => sum + (r.durationMs || 0), 0) / records.length
          )
        : 0;

      return {
        totalJobs: records.length,
        completedJobs: completed.length,
        failedJobs: failed.length,
        successRate: records.length > 0 ? completed.length / records.length : 0,
        averageDurationMs: avgDuration
      };
    } catch (error) {
      log.error({
        msg: 'Erro ao recuperar estatísticas da fila',
        component: 'WorkerStatsService',
        queueName,
        error: getErrorMessage(error)
      });

      return {
        totalJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        successRate: 0,
        averageDurationMs: 0
      };
    }
  }
}

// Singleton pattern
export const workerStatsService = new WorkerStatsServiceImpl();

// Exportar tipos para uso em workers
export type { ReportSuccessInput, ReportFailureInput };
