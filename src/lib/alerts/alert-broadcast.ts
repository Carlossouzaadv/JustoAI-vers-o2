/**
 * Alert Broadcast Helper - Envia atualizações de alertas via SSE
 *
 * Responsável por:
 * 1. Contar alertas críticos não resolvidos
 * 2. Enviar evento 'alert_count_update' via WebSocket/SSE
 *
 * Integração com Phase 33 (Dashboard Sidebar Alerts)
 */

import { prisma } from '@/lib/prisma';
import { getWebSocketManager } from '@/lib/websocket-manager';
import { ICONS } from '@/lib/icons';
import { log, logError } from '@/lib/services/logger';

/**
 * Type Guard: Valida estrutura de contadores de alerta
 */
function isAlertCountData(data: unknown): data is { unreadCount: number; criticalCount: number } {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.unreadCount === 'number' &&
    typeof obj.criticalCount === 'number'
  );
}

/**
 * Obtém contagem de alertas críticos não resolvidos para um workspace
 *
 * @param workspaceId - ID do workspace
 * @returns { unreadCount: number, criticalCount: number }
 */
export async function getAlertCounts(workspaceId: string): Promise<{ unreadCount: number; criticalCount: number }> {
  try {
    // Contar alertas não resolvidos
    const unreadCount = await prisma.juditAlert.count({
      where: {
        workspaceId,
        resolved: false
      }
    });

    // Contar alertas críticos não resolvidos
    const criticalCount = await prisma.juditAlert.count({
      where: {
        workspaceId,
        resolved: false,
        severity: 'CRITICAL'
      }
    });

    return {
      unreadCount,
      criticalCount
    };
  } catch (_error) {
    logError(error, '${ICONS.ERROR} Erro ao contar alertas do workspace ${workspaceId}:', { component: 'refactored' });
    // Retornar zeros em caso de erro (fail-safe)
    return {
      unreadCount: 0,
      criticalCount: 0
    };
  }
}

/**
 * Envia atualização de contagem de alertas para um workspace via SSE
 *
 * Padrão-Ouro:
 * - Type-safe com type guards
 * - Fail-safe se wsManager não estiver disponível
 * - Log de sucesso/erro
 *
 * @param workspaceId - ID do workspace para receber atualização
 */
export async function broadcastAlertCountUpdate(workspaceId: string): Promise<void> {
  try {
    // 1. Obter contadores atualizados do banco
    const counts = await getAlertCounts(workspaceId);

    // 2. Validar dados com type guard
    if (!isAlertCountData(counts)) {
      log.error({ msg: 'Dados de alerta inválidos para workspace' });
      return;
    }

    // 3. Obter manager SSE e enviar evento
    const wsManager = getWebSocketManager();
    wsManager.broadcastToWorkspace(workspaceId, {
      type: 'alert:notification',
      data: {
        unreadCount: counts.unreadCount,
        criticalCount: counts.criticalCount
      }
    });

    console.log(
      `${ICONS.SUCCESS} Alerta SSE enviado para workspace ${workspaceId}: ` +
      `${counts.criticalCount} crítico${counts.criticalCount !== 1 ? 's' : ''}, ` +
      `${counts.unreadCount} não lido${counts.unreadCount !== 1 ? 's' : ''}`
    );
  } catch (_error) {
    logError(error, '${ICONS.ERROR} Erro ao enviar atualização de alertas para ${workspaceId}:', { component: 'refactored' });
    // Não lançar erro (fail-safe)
  }
}

/**
 * Broadcast de alerta para todos os workspaces
 *
 * Útil quando é um alerta global ou quando você quer notificar todos
 *
 * @param workspaceIds - Array de IDs de workspace
 */
export async function broadcastAlertCountUpdateBatch(workspaceIds: string[]): Promise<void> {
  log.info({ msg: 'Enviando atualização de alertas para  workspace(s)' });

  // Enviar em paralelo (Promise.all é seguro pois cada broadcast é independente)
  const promises = workspaceIds.map(workspaceId => broadcastAlertCountUpdate(workspaceId));
  await Promise.all(promises);
}
