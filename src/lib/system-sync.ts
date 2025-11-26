
// ================================
// SISTEMA DE SINCRONIZAÇÃO BÁSICO
// ================================
// Mantém dados sincronizados com sistemas externos

import prisma from './prisma';
import { ICONS } from './icons';
import type { SourceSystem } from './system-importer';
import { log, logError } from '@/lib/services/logger';

// ================================
// TYPES (Prisma não completamente gerado)
// ================================

/**
 * Tipo mínimo para SystemImport baseado no schema Prisma
 */
interface SystemImportFields {
  processedRows: number | null;
}

/**
 * Tipo mínimo para SystemSync com logs incluídos
 */
interface SystemSyncFields {
  sourceSystem: SourceSystem;
  currentStatus: string;
  lastSync: Date | null;
  updatedAt: Date;
}

// ================================
// TYPE GUARDS E VALIDAÇÃO DE ENUM
// ================================

/**
 * Valida se uma string é um valor válido do enum SourceSystem
 * Padrão-Ouro: Type Guard de Enum sem casting
 */
function isValidSourceSystem(value: string): value is SourceSystem {
  const validSystems: readonly string[] = [
    'PROJURIS',
    'LEGAL_ONE',
    'ASTREA',
    'CP_PRO',
    'SAJ',
    'ESAJ',
    'PJE',
    'THEMIS',
    'ADVBOX',
    'JUSBRASIL',
    'UNKNOWN'
  ];
  return validSystems.includes(value);
}

// ================================
// TIPOS E INTERFACES
// ================================

export interface SyncSession {
  id: string;
  sourceSystem: string;
  syncType: 'FULL' | 'INCREMENTAL' | 'MANUAL';
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  itemsChecked: number;
  itemsUpdated: number;
  errors: string[];
  startedAt: Date;
  finishedAt?: Date;
}

// ================================
// CLASSE DE SINCRONIZAÇÃO
// ================================

export class SystemSynchronizer {
  /**
   * Inicia sincronização manual de um sistema
   */
  async startManualSync(workspaceId: string, sourceSystem: string): Promise<SyncSession> {
    log.info({ msg: 'Iniciando sincronização manual:' });

    const session: SyncSession = {
      id: `sync_${Date.now()}`,
      sourceSystem,
      syncType: 'MANUAL',
      status: 'RUNNING',
      itemsChecked: 0,
      itemsUpdated: 0,
      errors: [],
      startedAt: new Date()
    };

    try {
      // Validar sourceSystem com Type Guard - Padrão-Ouro (ZERO casting)
      if (!isValidSourceSystem(sourceSystem)) {
        throw new Error(
          `${ICONS.ERROR} sourceSystem inválido: "${sourceSystem}". Deve ser um dos valores: PROJURIS, LEGAL_ONE, ASTREA, etc.`
        );
      }

      // Agora sourceSystem é narrowed a SourceSystem (sem casting)
      // Buscar importações do sistema para sincronizar
      const systemImports = await prisma.systemImport.findMany({
        where: {
          workspaceId,
          sourceSystem, // ✅ Type-safe, sem casting
          status: 'COMPLETED'
        }
      });

      // Contar itens processados baseado nos campos de contagem da SystemImport
      // (não há relação importedItems, usamos os campos de contagem disponíveis)
      session.itemsChecked = systemImports.reduce(
        (total: number, imp: SystemImportFields) => total + (imp.processedRows || 0),
        0
      );

      // Por enquanto, apenas simular sincronização
      // Em implementação completa, aqui faria:
      // 1. Conectar com API do sistema externo
      // 2. Verificar se há atualizações
      // 3. Aplicar mudanças incrementais

      session.status = 'COMPLETED';
      session.finishedAt = new Date();

      console.log(`${ICONS.SUCCESS} Sincronização concluída:`, {
        system: sourceSystem,
        checked: session.itemsChecked,
        updated: session.itemsUpdated
      });

      return session;

    } catch (error) {
      session.status = 'FAILED';
      session.finishedAt = new Date();
      session.errors.push(_error instanceof Error ? _error.message : 'Erro desconhecido');

      logError(_error, '${ICONS.ERROR} Erro na sincronização:', { component: 'refactored' });
      return session;
    }
  }

  /**
   * Verifica status de sincronização de um workspace
   */
  async getSyncStatus(workspaceId: string) {
    const lastSyncs = await prisma.systemSync.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      include: {
        syncLogs: {
          take: 1,
          orderBy: { startedAt: 'desc' }
        }
      }
    });

    return {
      activeSyncs: lastSyncs.filter((sync) => sync.currentStatus === 'SUCCESS').length,
      totalSyncs: lastSyncs.length,
      lastSyncDate: lastSyncs[0]?.updatedAt,
      systems: lastSyncs.map((sync) => ({
        system: sync.sourceSystem,
        status: sync.currentStatus,
        lastSync: sync.lastSync
      }))
    };
  }
}

/**
 * Factory para criar sincronizador
 */
export function createSystemSynchronizer(): SystemSynchronizer {
  return new SystemSynchronizer();
}