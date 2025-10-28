// ================================
// SISTEMA DE ALERTAS PARA PROCESSOS
// ================================
// Gerenciamento completo de alertas e notificações

import prisma from './prisma';
import { ICONS } from './icons';

// ================================
// TIPOS E INTERFACES
// ================================

export interface AlertTemplate {
  id: string;
  name: string;
  title: string;
  messageTemplate: string;
  type: AlertType;
  severity: Priority;
  conditions: AlertCondition[];
  enabled: boolean;
}

export interface AlertCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: unknown;
  description: string;
}

export interface AlertNotification {
  id: string;
  alertId: string;
  recipientEmail: string;
  method: 'EMAIL' | 'SMS' | 'WEBHOOK';
  status: 'PENDING' | 'SENT' | 'FAILED';
  sentAt?: Date;
  errorMessage?: string;
}

export type AlertType = 'MOVEMENT' | 'DEADLINE' | 'ERROR' | 'SYNC_FAILURE' | 'IMPORTANT_DECISION';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

// ================================
// CLASSE PRINCIPAL DE ALERTAS
// ================================

export class ProcessAlertManager {

  /**
   * Gera alertas baseado nas movimentações de um processo
   */
  async generateMovementAlerts(
    monitoredProcessId: string,
    movements: Record<string, unknown>[]
  ): Promise<string[]> {
    const alertIds: string[] = [];

    const process = await prisma.monitoredProcess.findUnique({
      where: { id: monitoredProcessId },
      select: {
        id: true,
        processNumber: true,
        clientName: true,
        court: true,
        alertsEnabled: true,
        alertRecipients: true
      }
    });

    if (!process || !process.alertsEnabled) {
      return alertIds;
    }

    // Processar cada movimentação
    for (const movement of movements) {
      const alerts = await this.evaluateMovementForAlerts(process, movement);

      for (const alertData of alerts) {
        try {
          const alert = await prisma.processAlert.create({
            data: {
              monitoredProcessId: process.id,
              title: alertData.title,
              message: alertData.message,
              type: alertData.type,
              severity: alertData.severity,
              recipients: process.alertRecipients
            }
          });

          alertIds.push(alert.id);

          // Enviar notificações
          await this.sendAlertNotifications(alert.id);

        } catch (error) {
          console.error(`${ICONS.ERROR} Erro ao criar alerta:`, error);
        }
      }
    }

    return alertIds;
  }

  /**
   * Avalia uma movimentação específica para gerar alertas
   */
  private async evaluateMovementForAlerts(
    process: Record<string, unknown>,
    movement: Record<string, unknown>
  ): Promise<Array<{
    title: string;
    message: string;
    type: AlertType;
    severity: Priority;
  }>> {
    const alerts: Array<{
      title: string;
      message: string;
      type: AlertType;
      severity: Priority;
    }> = [];

    // 1. Alertas baseados na importância da movimentação
    if (movement.importance === 'URGENT') {
      alerts.push({
        title: `${ICONS.URGENT} Movimentação URGENTE - ${process.processNumber}`,
        message: `Cliente: ${process.clientName}\nTipo: ${movement.type}\nDescrição: ${movement.description}\nTribunal: ${process.court}`,
        type: 'MOVEMENT',
        severity: 'URGENT'
      });
    } else if (movement.importance === 'HIGH') {
      alerts.push({
        title: `${ICONS.WARNING} Movimentação Importante - ${process.processNumber}`,
        message: `Cliente: ${process.clientName}\nTipo: ${movement.type}\nDescrição: ${movement.description}`,
        type: 'MOVEMENT',
        severity: 'HIGH'
      });
    }

    // 2. Alertas baseados no tipo de movimentação
    const movementType = movement.type.toUpperCase();
    const description = movement.description.toUpperCase();

    // Sentenças e decisões importantes
    if (
      movementType.includes('SENTENÇA') ||
      movementType.includes('DECISÃO') ||
      description.includes('SENTENÇA') ||
      description.includes('DECISÃO')
    ) {
      alerts.push({
        title: `${ICONS.DECISION} Decisão/Sentença - ${process.processNumber}`,
        message: `DECISÃO IMPORTANTE registrada no processo!\n\nCliente: ${process.clientName}\nDescrição: ${movement.description}\n\nRecomenda-se análise imediata.`,
        type: 'IMPORTANT_DECISION',
        severity: 'URGENT'
      });
    }

    // Audiências marcadas
    if (
      movementType.includes('AUDIÊNCIA') ||
      description.includes('AUDIÊNCIA')
    ) {
      alerts.push({
        title: `${ICONS.CALENDAR} Audiência Marcada - ${process.processNumber}`,
        message: `Nova audiência no processo!\n\nCliente: ${process.clientName}\nDetalhes: ${movement.description}\n\nVerifique data e prepare-se adequadamente.`,
        type: 'MOVEMENT',
        severity: 'HIGH'
      });
    }

    // Intimações e citações
    if (
      movementType.includes('INTIMAÇÃO') ||
      movementType.includes('CITAÇÃO') ||
      description.includes('INTIMAÇÃO') ||
      description.includes('CITAÇÃO')
    ) {
      alerts.push({
        title: `${ICONS.NOTIFICATION} Intimação/Citação - ${process.processNumber}`,
        message: `Nova intimação ou citação!\n\nCliente: ${process.clientName}\nDescrição: ${movement.description}\n\nAção pode ser necessária dentro do prazo.`,
        type: 'MOVEMENT',
        severity: 'HIGH'
      });
    }

    // Prazos e deadlines
    if (
      movement.requiresAction ||
      movementType.includes('PRAZO') ||
      description.includes('PRAZO')
    ) {
      const severity: Priority = movement.deadline ? 'URGENT' : 'HIGH';

      alerts.push({
        title: `${ICONS.CLOCK} Prazo/Ação Necessária - ${process.processNumber}`,
        message: `Ação necessária no processo!\n\nCliente: ${process.clientName}\nDescrição: ${movement.description}\n${movement.deadline ? `Prazo: ${new Date(movement.deadline).toLocaleDateString('pt-BR')}` : 'Verificar prazo urgentemente!'}`,
        type: 'DEADLINE',
        severity
      });
    }

    return alerts;
  }

  /**
   * Envia notificações para um alerta específico
   */
  async sendAlertNotifications(alertId: string): Promise<void> {
    const alert = await prisma.processAlert.findUnique({
      where: { id: alertId },
      include: {
        monitoredProcess: {
          select: {
            processNumber: true,
            clientName: true,
            court: true
          }
        }
      }
    });

    if (!alert || alert.recipients.length === 0) {
      return;
    }

    console.log(`${ICONS.MAIL} Enviando notificações para alerta: ${alert.title}`);

    try {
      const { getEmailService } = await import('./email-service');
      const emailService = getEmailService();

      // Enviar email para cada recipient
      const emailPromises = alert.recipients.map(async (recipient: string) => {
        const processInfo = alert.monitoredProcess?.processNumber || 'Número não disponível';

        return emailService.sendProcessAlert(
          recipient,
          processInfo,
          alert.title,
          alert.message,
          alert.severity === 'HIGH' ? 'high' : alert.severity === 'MEDIUM' ? 'medium' : 'low'
        );
      });

      const results = await Promise.allSettled(emailPromises);
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

      console.log(`${ICONS.SUCCESS} ${successCount}/${alert.recipients.length} emails enviados com sucesso`);

      // Marcar como enviado
      await prisma.processAlert.update({
        where: { id: alertId },
        data: {
          sent: true,
          sentAt: new Date()
        }
      });

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao enviar notificações:`, error);

      // Marcar como falha no envio
      await prisma.processAlert.update({
        where: { id: alertId },
        data: {
          sent: false,
          sentAt: new Date()
        }
      });
    }

    // TODO: Integrar com webhooks para sistemas externos
    // TODO: Implementar rate limiting para evitar spam
  }

  /**
   * Marca alertas como lidos
   */
  async markAlertsAsRead(alertIds: string[], workspaceId: string): Promise<number> {
    const result = await prisma.processAlert.updateMany({
      where: {
        id: { in: alertIds },
        monitoredProcess: {
          workspaceId
        }
      },
      data: {
        read: true,
        readAt: new Date()
      }
    });

    return result.count;
  }

  /**
   * Busca alertas não lidos de um workspace
   */
  async getUnreadAlerts(workspaceId: string, limit: number = 50) {
    return await prisma.processAlert.findMany({
      where: {
        read: false,
        monitoredProcess: {
          workspaceId
        }
      },
      include: {
        monitoredProcess: {
          select: {
            id: true,
            processNumber: true,
            clientName: true,
            court: true
          }
        },
        movement: {
          select: {
            id: true,
            date: true,
            type: true,
            category: true
          }
        }
      },
      orderBy: [
        { severity: 'desc' },
        { createdAt: 'desc' }
      ],
      take: limit
    });
  }

  /**
   * Busca estatísticas de alertas
   */
  async getAlertStatistics(workspaceId: string) {
    const [
      totalAlerts,
      unreadAlerts,
      alertsBySeverity,
      alertsByType,
      recentAlerts
    ] = await Promise.all([
      // Total de alertas
      prisma.processAlert.count({
        where: {
          monitoredProcess: { workspaceId }
        }
      }),

      // Alertas não lidos
      prisma.processAlert.count({
        where: {
          read: false,
          monitoredProcess: { workspaceId }
        }
      }),

      // Por severidade (últimos 30 dias)
      prisma.processAlert.groupBy({
        by: ['severity'],
        where: {
          monitoredProcess: { workspaceId },
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        },
        _count: true
      }),

      // Por tipo (últimos 30 dias)
      prisma.processAlert.groupBy({
        by: ['type'],
        where: {
          monitoredProcess: { workspaceId },
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        },
        _count: true
      }),

      // Alertas recentes (últimas 24h)
      prisma.processAlert.count({
        where: {
          monitoredProcess: { workspaceId },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    const severityStats = alertsBySeverity.reduce((acc, stat) => {
      acc[stat.severity] = stat._count;
      return acc;
    }, {} as Record<string, number>);

    const typeStats = alertsByType.reduce((acc, stat) => {
      acc[stat.type] = stat._count;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: totalAlerts,
      unread: unreadAlerts,
      recent: recentAlerts,
      bySeverity: severityStats,
      byType: typeStats
    };
  }

  /**
   * Gera alerta customizado
   */
  async createCustomAlert(
    monitoredProcessId: string,
    title: string,
    message: string,
    type: AlertType = 'MOVEMENT',
    severity: Priority = 'MEDIUM'
  ): Promise<string> {
    const process = await prisma.monitoredProcess.findUnique({
      where: { id: monitoredProcessId },
      select: {
        alertsEnabled: true,
        alertRecipients: true
      }
    });

    if (!process || !process.alertsEnabled) {
      throw new Error('Processo não permite alertas ou não foi encontrado');
    }

    const alert = await prisma.processAlert.create({
      data: {
        monitoredProcessId,
        title,
        message,
        type,
        severity,
        recipients: process.alertRecipients
      }
    });

    // Enviar notificações
    await this.sendAlertNotifications(alert.id);

    return alert.id;
  }

  /**
   * Configura alertas em lote para vários processos
   */
  async configureProcessesAlerts(
    processIds: string[],
    workspaceId: string,
    config: {
      alertsEnabled: boolean;
      alertRecipients: string[];
    }
  ): Promise<number> {
    const result = await prisma.monitoredProcess.updateMany({
      where: {
        id: { in: processIds },
        workspaceId
      },
      data: {
        alertsEnabled: config.alertsEnabled,
        alertRecipients: config.alertRecipients
      }
    });

    return result.count;
  }

  /**
   * Limpa alertas antigos
   */
  async cleanupOldAlerts(daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const result = await prisma.processAlert.deleteMany({
      where: {
        read: true,
        createdAt: {
          lt: cutoffDate
        }
      }
    });

    console.log(`${ICONS.CLEAN} Alertas antigos removidos: ${result.count}`);
    return result.count;
  }
}

// ================================
// INSTÂNCIA SINGLETON GLOBAL
// ================================

let globalAlertManager: ProcessAlertManager | null = null;

/**
 * Obtém a instância global do gerenciador de alertas
 */
export function getGlobalAlertManager(): ProcessAlertManager {
  if (!globalAlertManager) {
    globalAlertManager = new ProcessAlertManager();
  }
  return globalAlertManager;
}

// ================================
// TEMPLATES DE ALERTAS PRÉ-DEFINIDOS
// ================================

export const DEFAULT_ALERT_TEMPLATES: AlertTemplate[] = [
  {
    id: 'urgent-movement',
    name: 'Movimentação Urgente',
    title: 'Movimentação URGENTE no processo {processNumber}',
    messageTemplate: `Movimentação urgente detectada!

Cliente: {clientName}
Processo: {processNumber}
Tribunal: {court}

Tipo: {movementType}
Descrição: {movementDescription}

Ação imediata recomendada.`,
    type: 'MOVEMENT',
    severity: 'URGENT',
    conditions: [
      {
        field: 'importance',
        operator: 'equals',
        value: 'URGENT',
        description: 'Movimentação marcada como urgente'
      }
    ],
    enabled: true
  },
  {
    id: 'decision-alert',
    name: 'Decisão Judicial',
    title: 'Nova decisão no processo {processNumber}',
    messageTemplate: `DECISÃO JUDICIAL registrada!

Cliente: {clientName}
Processo: {processNumber}

Descrição: {movementDescription}

Recomenda-se análise imediata da decisão.`,
    type: 'IMPORTANT_DECISION',
    severity: 'URGENT',
    conditions: [
      {
        field: 'type',
        operator: 'contains',
        value: ['SENTENÇA', 'DECISÃO'],
        description: 'Contém palavras-chave de decisão'
      }
    ],
    enabled: true
  },
  {
    id: 'hearing-scheduled',
    name: 'Audiência Agendada',
    title: 'Audiência marcada - {processNumber}',
    messageTemplate: `Nova audiência agendada!

Cliente: {clientName}
Processo: {processNumber}

Detalhes: {movementDescription}

Prepare-se adequadamente para a audiência.`,
    type: 'MOVEMENT',
    severity: 'HIGH',
    conditions: [
      {
        field: 'category',
        operator: 'equals',
        value: 'HEARING',
        description: 'Movimentação de audiência'
      }
    ],
    enabled: true
  },
  {
    id: 'deadline-alert',
    name: 'Prazo Processual',
    title: 'Prazo identificado - {processNumber}',
    messageTemplate: `Prazo identificado no processo!

Cliente: {clientName}
Processo: {processNumber}

Descrição: {movementDescription}
{deadline ? 'Prazo: ' + deadline : 'Verificar prazo com urgência!'}

Ação necessária dentro do prazo.`,
    type: 'DEADLINE',
    severity: 'HIGH',
    conditions: [
      {
        field: 'requiresAction',
        operator: 'equals',
        value: true,
        description: 'Movimentação requer ação'
      }
    ],
    enabled: true
  }
];

// ================================
// UTILITÁRIOS DE FORMATAÇÃO
// ================================

/**
 * Formata uma mensagem de alerta usando um template
 */
export function formatAlertMessage(
  template: string,
  variables: Record<string, unknown>
): string {
  let message = template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    message = message.replace(new RegExp(placeholder, 'g'), String(value || ''));
  }

  return message;
}

/**
 * Converte severidade em ícone apropriado
 */
export function getSeverityIcon(severity: Priority): string {
  switch (severity) {
    case 'URGENT': return ICONS.URGENT;
    case 'HIGH': return ICONS.WARNING;
    case 'MEDIUM': return ICONS.INFO;
    case 'LOW': return ICONS.NOTIFICATION;
    default: return ICONS.INFO;
  }
}

/**
 * Converte tipo de alerta em ícone apropriado
 */
export function getAlertTypeIcon(type: AlertType): string {
  switch (type) {
    case 'MOVEMENT': return ICONS.DOCUMENT;
    case 'DEADLINE': return ICONS.CLOCK;
    case 'ERROR': return ICONS.ERROR;
    case 'SYNC_FAILURE': return ICONS.SYNC;
    case 'IMPORTANT_DECISION': return ICONS.DECISION;
    default: return ICONS.NOTIFICATION;
  }
}