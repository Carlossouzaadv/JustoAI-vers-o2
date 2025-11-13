// ================================================================
// GERENCIADOR DE CACHE DE RELATÓRIOS - Invalidação Automática
// ================================================================

import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';
import { ICONS } from '@/lib/icons';
import { ReportType, AudienceType } from '@prisma/client';

// ================================================================
// Type Guard para Validação Segura de Configuração de Cache
// ================================================================

/**
 * Valida se um valor é um ReportType válido
 */
function isValidReportType(value: unknown): value is ReportType {
  return (
    typeof value === 'string' &&
    Object.values(ReportType).includes(value as ReportType)
  );
}

/**
 * Valida se um valor é um AudienceType válido
 */
function isValidAudienceType(value: unknown): value is AudienceType {
  return (
    typeof value === 'string' &&
    Object.values(AudienceType).includes(value as AudienceType)
  );
}

/**
 * Type Guard para Config de Cache
 * Valida que o objeto contém as propriedades necessárias com tipos corretos
 */
function isCacheConfig(data: unknown): data is {
  reportType: ReportType;
  processIds: string[];
  audienceType: AudienceType;
} {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  return (
    'reportType' in obj &&
    'processIds' in obj &&
    'audienceType' in obj &&
    isValidReportType(obj.reportType) &&
    Array.isArray(obj.processIds) &&
    obj.processIds.every((item) => typeof item === 'string') &&
    isValidAudienceType(obj.audienceType)
  );
}

export interface CacheInvalidationResult {
  invalidated: number;
  processIds: string[];
  reason: string;
}

export interface CacheStatistics {
  totalEntries: number;
  hitRate: number;
  averageAge: number;
  expiredEntries: number;
  sizeByWorkspace: Record<string, number>;
}

// ================================================================
// Interfaces Locais para Type Safety em Callbacks
// ================================================================

/**
 * Tipo para entrada de cache retornada em invalidateOnMovement
 */
interface MovementCacheEntry {
  id: string;
  cacheKey: string;
  lastMovementTimestamp: Date;
  processIds: string[];
}

/**
 * Tipo para entrada de cache retornada em invalidateOnBulkMovements
 */
interface BulkInvalidationCacheEntry {
  id: string;
  processIds: string[];
}

/**
 * Tipo para entrada de cache retornada em invalidateByWorkspace
 */
interface WorkspaceCacheEntry {
  processIds: string[];
}

/**
 * Tipo para resultado de groupBy de workspaceId
 */
interface WorkspaceGroupByResult {
  workspaceId: string;
  _count: {
    id: number;
  };
}

export class ReportCacheManager {
  /**
   * Invalida cache quando detectada nova movimentação
   */
  async invalidateOnMovement(processId: string, movementDate: Date): Promise<CacheInvalidationResult> {
    console.log(`${ICONS.PROCESS} Invalidando cache para processo ${processId} - nova movimentação em ${movementDate.toISOString()}`);

    try {
      // Encontrar todas as entradas de cache que incluem este processo
      const cacheEntries: MovementCacheEntry[] = await prisma.reportCache.findMany({
        where: {
          processIds: {
            has: processId
          }
        },
        select: {
          id: true,
          cacheKey: true,
          lastMovementTimestamp: true,
          processIds: true
        }
      });

      let invalidated = 0;
      const affectedProcessIds: Set<string> = new Set();

      for (const entry of cacheEntries) {
        // Verificar se a movimentação é mais recente que o cache
        if (movementDate > entry.lastMovementTimestamp) {
          await prisma.reportCache.delete({
            where: { id: entry.id }
          });

          invalidated++;
          entry.processIds.forEach((id: string) => affectedProcessIds.add(id));

          console.log(`${ICONS.SUCCESS} Cache invalidado: ${entry.cacheKey}`);
        }
      }

      const result: CacheInvalidationResult = {
        invalidated,
        processIds: Array.from(affectedProcessIds),
        reason: `Nova movimentação no processo ${processId}`
      };

      console.log(`${ICONS.SUCCESS} Invalidação concluída: ${invalidated} entradas removidas`);
      return result;

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro na invalidação de cache:`, error);
      throw error;
    }
  }

  /**
   * Invalida cache por bulk de movimentações
   */
  async invalidateOnBulkMovements(movements: Array<{
    processId: string;
    date: Date;
  }>): Promise<CacheInvalidationResult> {
    console.log(`${ICONS.PROCESS} Invalidação em massa: ${movements.length} movimentações`);

    const affectedProcessIds = new Set<string>();
    let totalInvalidated = 0;

    // Processar em lotes para evitar sobrecarga
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < movements.length; i += batchSize) {
      batches.push(movements.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const batchProcessIds = batch.map(m => m.processId);
      const maxDate = new Date(Math.max(...batch.map(m => m.date.getTime())));

      // Encontrar cache afetado por este lote
      const cacheEntries: BulkInvalidationCacheEntry[] = await prisma.reportCache.findMany({
        where: {
          processIds: {
            hasSome: batchProcessIds
          },
          lastMovementTimestamp: {
            lt: maxDate
          }
        },
        select: {
          id: true,
          processIds: true
        }
      });

      // Deletar entradas invalidadas
      if (cacheEntries.length > 0) {
        const idsToDelete = cacheEntries.map((entry: BulkInvalidationCacheEntry) => entry.id);

        await prisma.reportCache.deleteMany({
          where: {
            id: { in: idsToDelete }
          }
        });

        totalInvalidated += cacheEntries.length;

        // Coletar todos os process IDs afetados
        cacheEntries.forEach((entry: BulkInvalidationCacheEntry) => {
          entry.processIds.forEach((id: string) => affectedProcessIds.add(id));
        });
      }
    }

    const result: CacheInvalidationResult = {
      invalidated: totalInvalidated,
      processIds: Array.from(affectedProcessIds),
      reason: `Invalidação em massa de ${movements.length} movimentações`
    };

    console.log(`${ICONS.SUCCESS} Invalidação em massa concluída: ${totalInvalidated} entradas removidas`);
    return result;
  }

  /**
   * Invalida cache por workspace (admin action)
   */
  async invalidateByWorkspace(workspaceId: string, reason: string = 'Invalidação manual'): Promise<CacheInvalidationResult> {
    console.log(`${ICONS.PROCESS} Invalidando todo cache do workspace ${workspaceId}`);

    const deletedEntries: WorkspaceCacheEntry[] = await prisma.reportCache.findMany({
      where: { workspaceId },
      select: { processIds: true }
    });

    const result = await prisma.reportCache.deleteMany({
      where: { workspaceId }
    });

    const affectedProcessIds = new Set<string>();
    deletedEntries.forEach((entry: WorkspaceCacheEntry) => {
      entry.processIds.forEach((id: string) => affectedProcessIds.add(id));
    });

    return {
      invalidated: result.count,
      processIds: Array.from(affectedProcessIds),
      reason
    };
  }

  /**
   * Limpeza automática de cache expirado
   */
  async cleanupExpiredCache(): Promise<{
    expired: number;
    orphaned: number;
    errors: number;
  }> {
    console.log(`${ICONS.PROCESS} Iniciando limpeza automática de cache`);

    let expired = 0;
    let orphaned = 0;
    let errors = 0;

    try {
      // 1. Remover entradas expiradas
      const expiredResult = await prisma.reportCache.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });
      expired = expiredResult.count;

      // 2. Remover entradas órfãs (workspace inexistente)
      // Com onDelete: Cascade no schema, entradas órfãs são removidas automaticamente
      // Então vamos pular esta verificação
      const orphanedEntries: { id: string }[] = [];

      if (orphanedEntries.length > 0) {
        const orphanedResult = await prisma.reportCache.deleteMany({
          where: {
            id: { in: orphanedEntries.map(e => e.id) }
          }
        });
        orphaned = orphanedResult.count;
      }

      console.log(`${ICONS.SUCCESS} Limpeza concluída: ${expired} expiradas, ${orphaned} órfãs`);

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro na limpeza de cache:`, error);
      errors++;
    }

    return { expired, orphaned, errors };
  }

  /**
   * Pré-aquecimento de cache (para relatórios frequentes)
   */
  async warmupCache(workspaceId: string, reportConfigs: Array<{
    reportType: string;
    processIds: string[];
    audienceType: string;
  }>): Promise<{
    warmed: number;
    skipped: number;
    errors: number;
  }> {
    console.log(`${ICONS.PROCESS} Pré-aquecendo cache para ${reportConfigs.length} configurações`);

    let warmed = 0;
    let skipped = 0;
    let errors = 0;

    for (const config of reportConfigs) {
      try {
        // Verificar se já existe cache válido
        const cacheKey = this.generateCacheKey(
          workspaceId,
          config.reportType,
          config.processIds,
          config.audienceType
        );

        const existing = await prisma.reportCache.findUnique({
          where: { cacheKey }
        });

        if (existing && existing.expiresAt > new Date()) {
          skipped++;
          continue;
        }

        // Gerar cache (placeholder - integraria com ReportGenerator)
        await this.generateCacheEntry(workspaceId, config);
        warmed++;

      } catch (error) {
        console.error(`${ICONS.ERROR} Erro no pré-aquecimento:`, error);
        errors++;
      }
    }

    console.log(`${ICONS.SUCCESS} Pré-aquecimento concluído: ${warmed} gerados, ${skipped} existentes, ${errors} erros`);
    return { warmed, skipped, errors };
  }

  /**
   * Estatísticas do cache
   */
  async getCacheStatistics(workspaceId?: string): Promise<CacheStatistics> {
    const whereClause = workspaceId ? { workspaceId } : {};

    const [totalStats, expiredCount, workspaceStats] = await Promise.all([
      prisma.reportCache.aggregate({
        where: whereClause,
        _count: { id: true }
      }),

      prisma.reportCache.count({
        where: {
          ...whereClause,
          expiresAt: { lt: new Date() }
        }
      }),

      prisma.reportCache.groupBy({
        by: ['workspaceId'],
        where: workspaceId ? { workspaceId } : {},
        _count: { id: true }
      })
    ]);

    // Calcular idade média do cache (simplificado)
    // const now = Date.now(); // Unused - kept for future implementation
    const averageAge = 24; // Mock - em horas, seria necessário implementar cálculo específico

    // Hit rate (placeholder - precisaria de métricas de uso)
    const hitRate = 75; // Mock - implementar tracking real

    const sizeByWorkspace: Record<string, number> = {};
    workspaceStats.forEach((stat: WorkspaceGroupByResult) => {
      sizeByWorkspace[stat.workspaceId] = stat._count.id;
    });

    return {
      totalEntries: totalStats._count.id,
      hitRate,
      averageAge,
      expiredEntries: expiredCount,
      sizeByWorkspace
    };
  }

  /**
   * Invalidação baseada em tags/categorias
   */
  async invalidateByTags(tags: string[], _workspaceId?: string): Promise<CacheInvalidationResult> {
    // Para implementação futura - invalidar cache por categorias
    // Ex: "client:123", "case-type:CIVIL", etc.

    console.log(`${ICONS.PROCESS} Invalidação por tags: ${tags.join(', ')}`);

    // Placeholder implementation
    const result: CacheInvalidationResult = {
      invalidated: 0,
      processIds: [],
      reason: `Invalidação por tags: ${tags.join(', ')}`
    };

    return result;
  }

  /**
   * Invalidação inteligente baseada em padrões
   */
  async smartInvalidation(workspaceId: string): Promise<{
    patterns: Array<{
      pattern: string;
      invalidated: number;
      reason: string;
    }>;
    totalInvalidated: number;
  }> {
    console.log(`${ICONS.PROCESS} Executando invalidação inteligente para workspace ${workspaceId}`);

    const patterns = [];
    let totalInvalidated = 0;

    // Padrão 1: Cache muito antigo (> 30 dias)
    const oldCacheResult = await prisma.reportCache.deleteMany({
      where: {
        workspaceId,
        createdAt: {
          lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    });

    if (oldCacheResult.count > 0) {
      patterns.push({
        pattern: 'Cache antigo (>30 dias)',
        invalidated: oldCacheResult.count,
        reason: 'Manutenção automática'
      });
      totalInvalidated += oldCacheResult.count;
    }

    // Padrão 2: Cache de processos inativos
    // (implementar lógica específica conforme necessário)

    console.log(`${ICONS.SUCCESS} Invalidação inteligente concluída: ${totalInvalidated} entradas`);

    return {
      patterns,
      totalInvalidated
    };
  }

  /**
   * Gera chave de cache consistente
   */
  private generateCacheKey(
    workspaceId: string,
    reportType: string,
    processIds: string[],
    audienceType: string,
    additionalData?: Record<string, unknown>
  ): string {
    const keyData = [
      workspaceId,
      reportType,
      audienceType,
      processIds.sort().join('|'),
      additionalData ? JSON.stringify(additionalData) : ''
    ].join('||');

    return createHash('sha256').update(keyData).digest('hex');
  }

  /**
   * Gera entrada de cache (placeholder)
   */
  private async generateCacheEntry(workspaceId: string, config: Record<string, unknown>): Promise<void> {
    // Type Guard: Validar e narrowizar config
    if (!isCacheConfig(config)) {
      throw new Error(
        `Invalid cache config: missing or invalid properties. Expected reportType (ReportType), processIds (string[]), audienceType (AudienceType)`
      );
    }

    // Agora 'config' é 100% seguro: { reportType: ReportType; processIds: string[]; audienceType: AudienceType }
    // Nenhum 'as' necessário - o type guard garantiu a segurança de tipos

    // Placeholder - integraria com ReportGenerator real
    const cacheKey = this.generateCacheKey(
      workspaceId,
      config.reportType,
      config.processIds,
      config.audienceType
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.reportCache.create({
      data: {
        cacheKey,
        workspaceId,
        reportType: config.reportType,
        processIds: config.processIds,
        audienceType: config.audienceType,
        lastMovementTimestamp: new Date(),
        cachedData: { generated: true, timestamp: new Date() },
        expiresAt
      }
    });
  }

  /**
   * Monitor de performance do cache
   */
  async monitorCachePerformance(): Promise<{
    metrics: {
      avgResponseTime: number;
      cacheHitRatio: number;
      memoryUsage: number;
      errorRate: number;
    };
    recommendations: string[];
  }> {
    // Implementar métricas de performance
    const metrics = {
      avgResponseTime: 150, // ms
      cacheHitRatio: 0.75,  // 75%
      memoryUsage: 256,     // MB
      errorRate: 0.02       // 2%
    };

    const recommendations: string[] = [];

    if (metrics.cacheHitRatio < 0.6) {
      recommendations.push('Hit ratio baixo - considerar pré-aquecimento');
    }

    if (metrics.avgResponseTime > 200) {
      recommendations.push('Tempo de resposta alto - otimizar queries');
    }

    if (metrics.memoryUsage > 512) {
      recommendations.push('Uso de memória alto - executar limpeza');
    }

    return { metrics, recommendations };
  }
}