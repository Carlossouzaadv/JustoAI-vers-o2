// ================================================================
// WORKER DE NOTIFICAÇÕES POR E-MAIL - Dispatch de Alertas de Processo
// ================================================================
//
// Responsabilidade: Processar jobs de dispatch de alertas de processo
// enviando emails para usuários interessados respeitando suas
// preferências de notificação e quiet hours.
//
// Job Type: 'dispatch-process-alert'
// Job Data: { alertId: string }
//

import { Job } from 'bull';
import Queue from 'bull';
import { prisma } from '@/lib/prisma';
import { getRedisConnection } from '@/lib/redis';
import { getNotificationService } from '@/lib/notification-service';
import { ICONS } from '@/lib/icons';

// ================================================================
// TIPOS E INTERFACES
// ================================================================

/**
 * Job payload para dispatch de alertas de processo
 */
interface ProcessAlertNotificationJobData {
  alertId: string;
  dispatchedAt: string;
}

/**
 * Resultado de envio de email para um usuário
 */
interface NotificationSendResult {
  userId: string;
  email: string;
  sent: boolean;
  reason?: string;
  error?: string;
}

// ================================================================
// TYPE GUARDS
// ================================================================

/**
 * Valida dados desconhecidos para NotificationFrequency
 */
function isValidNotificationFrequency(value: unknown): value is 'IMMEDIATE' | 'DAILY_DIGEST' | 'WEEKLY_DIGEST' | 'DISABLED' {
  return (
    typeof value === 'string' &&
    ['IMMEDIATE', 'DAILY_DIGEST', 'WEEKLY_DIGEST', 'DISABLED'].includes(value)
  );
}

/**
 * Valida se é string (para timezone validation)
 */
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

// ================================================================
// CONFIGURAÇÃO DA FILA
// ================================================================

/**
 * Cria a fila de notificações com configuração otimizada
 */
function createNotificationQueue(): Queue.Queue<ProcessAlertNotificationJobData> {
  const redisConnection = getRedisConnection();

  if (!redisConnection) {
    throw new Error('Redis connection is not available for notification worker');
  }

  return new Queue<ProcessAlertNotificationJobData>('Notifications', {
    createClient: (type: 'client' | 'subscriber' | 'bclient') => redisConnection,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  });
}

export const notificationQueue = createNotificationQueue();

// ================================================================
// PROCESSADOR PRINCIPAL
// ================================================================

/**
 * Processa jobs de dispatch de alertas de processo
 */
notificationQueue.process(
  'dispatch-process-alert',
  3, // concorrência máxima de 3 processamentos simultâneos
  async (job: Job<ProcessAlertNotificationJobData>) => {
    const { alertId } = job.data;

    console.log(`${ICONS.PROCESS} Processing alert notification dispatch for alertId: ${alertId}`);

    try {
      await job.progress(5);

      // Buscar alerta com suas relações
      const alert = await prisma.processAlert.findUnique({
        where: { id: alertId },
        include: {
          monitoredProcess: {
            include: {
              workspace: {
                include: {
                  users: {
                    include: {
                      user: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!alert) {
        console.warn(`${ICONS.WARNING} Alert not found: ${alertId}`);
        throw new Error(`ProcessAlert not found: ${alertId}`);
      }

      await job.progress(15);

      const workspace = alert.monitoredProcess.workspace;
      const processNumber = alert.monitoredProcess.processNumber;

      console.log(`${ICONS.INFO} Dispatching notifications for process: ${processNumber}, severity: ${alert.severity}`);

      // Preparar dados do alerta para o template
      const alertData = {
        alertId: alert.id,
        processNumber,
        title: alert.title,
        message: alert.message,
        severity: alert.severity,
        type: alert.type,
        createdAt: alert.createdAt.toISOString(),
        workspaceName: workspace.name,
      };

      // Enviar para cada usuário no workspace
      const userEmails = alert.monitoredProcess.workspace.users;
      const totalUsers = userEmails.length;
      let successCount = 0;
      let skippedCount = 0;
      const errors: NotificationSendResult[] = [];

      await job.progress(20);

      for (let i = 0; i < userEmails.length; i++) {
        const userWorkspace = userEmails[i];
        const user = userWorkspace.user;

        try {
          // Verificar preferências de notificação do usuário
          const preferences = await getUserNotificationPreferences(user.id, workspace.id);

          // Validar se deve enviar email
          const shouldSend = shouldSendEmailNotification(preferences, alert.type, alert.severity);

          if (!shouldSend) {
            console.log(`${ICONS.WARNING} Skipping notification for user ${user.email} (preferences disable this alert type)`);
            skippedCount++;
            errors.push({
              userId: user.id,
              email: user.email,
              sent: false,
              reason: 'User disabled this alert type in preferences',
            });
            continue;
          }

          // Verificar quiet hours
          if (isInQuietHours(preferences)) {
            console.log(`${ICONS.WARNING} Skipping notification for user ${user.email} (in quiet hours)`);
            skippedCount++;
            errors.push({
              userId: user.id,
              email: user.email,
              sent: false,
              reason: 'Currently in user quiet hours',
            });
            continue;
          }

          // Enviar email
          const notificationService = getNotificationService();
          const result = await notificationService.sendProcessAlert(
            user.email,
            processNumber,
            alert.type,
            alert.message,
            getSeverityUrgency(alert.severity)
          );

          if (result.success) {
            successCount++;
            console.log(`${ICONS.SUCCESS} Email sent to ${user.email}`);
          } else {
            console.error(`${ICONS.ERROR} Failed to send email to ${user.email}: ${result.email?.error}`);
            errors.push({
              userId: user.id,
              email: user.email,
              sent: false,
              error: result.email?.error || 'Unknown error',
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`${ICONS.ERROR} Error sending notification to user ${user.email}:`, error);
          errors.push({
            userId: user.id,
            email: user.email,
            sent: false,
            error: errorMessage,
          });
        }

        // Atualizar progresso
        const progress = 20 + Math.round(((i + 1) / userEmails.length) * 70);
        await job.progress(progress);
      }

      await job.progress(95);

      // Marcar alerta como enviado
      await prisma.processAlert.update({
        where: { id: alertId },
        data: {
          sent: true,
          sentAt: new Date(),
        },
      });

      await job.progress(100);

      const summary = {
        alertId,
        processNumber,
        totalUsers,
        successCount,
        skippedCount,
        failedCount: errors.filter(e => !e.sent).length,
        errors: errors.length > 0 ? errors : undefined,
      };

      console.log(`${ICONS.SUCCESS} Alert notification dispatch completed:`, summary);

      return summary;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`${ICONS.ERROR} Failed to process alert notification job:`, error);
      throw new Error(`Notification dispatch failed for alertId ${job.data.alertId}: ${errorMessage}`);
    }
  }
);

// ================================================================
// FUNÇÕES AUXILIARES
// ================================================================

/**
 * Busca as preferências de notificação de um usuário para um workspace
 * Retorna preferências globais se não houver configuração por workspace
 */
async function getUserNotificationPreferences(userId: string, workspaceId: string) {
  // Tentar buscar preferências específicas do workspace primeiro
  let settings = await prisma.userNotificationSettings.findFirst({
    where: {
      userId,
      workspaceId,
    },
  });

  // Se não houver, buscar preferências globais (workspaceId = NULL)
  if (!settings) {
    settings = await prisma.userNotificationSettings.findFirst({
      where: {
        userId,
        workspaceId: null,
      },
    });
  }

  // Se ainda não houver, retornar preferências padrão
  if (!settings) {
    return getDefaultNotificationPreferences();
  }

  return settings;
}

/**
 * Retorna preferências de notificação padrão
 */
function getDefaultNotificationPreferences() {
  return {
    emailEnabled: true,
    processAlerts: true,
    billingAlerts: true,
    systemAlerts: true,
    deadlineAlerts: true,
    frequency: 'IMMEDIATE' as const,
    quietHoursEnabled: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    quietHoursTimezone: 'America/Sao_Paulo',
    digestEnabled: false,
    digestTime: null,
  };
}

/**
 * Determina se deve enviar notificação baseado no tipo e preferências
 */
function shouldSendEmailNotification(
  preferences: Awaited<ReturnType<typeof getUserNotificationPreferences>>,
  alertType: string,
  severity: string
): boolean {
  // Email deve estar ativado
  if (!preferences.emailEnabled) {
    return false;
  }

  // Se frequência é DISABLED, não enviar
  const frequency = isValidNotificationFrequency(preferences.frequency)
    ? preferences.frequency
    : 'IMMEDIATE';

  if (frequency === 'DISABLED') {
    return false;
  }

  // Verificar tipo de alerta
  switch (alertType) {
    case 'MOVEMENT':
      return preferences.processAlerts === true;
    case 'DEADLINE':
      return preferences.deadlineAlerts === true;
    case 'BILLING':
      return preferences.billingAlerts === true;
    case 'SYSTEM':
      return preferences.systemAlerts === true;
    default:
      // Para tipos desconhecidos, usar processAlerts como fallback
      return preferences.processAlerts === true;
  }
}

/**
 * Verifica se o usuário está em quiet hours
 */
function isInQuietHours(
  preferences: Awaited<ReturnType<typeof getUserNotificationPreferences>>
): boolean {
  if (!preferences.quietHoursEnabled) {
    return false;
  }

  if (!isString(preferences.quietHoursStart) || !isString(preferences.quietHoursEnd)) {
    return false;
  }

  try {
    // Calcular hora atual no timezone do usuário
    const timezone = isString(preferences.quietHoursTimezone)
      ? preferences.quietHoursTimezone
      : 'America/Sao_Paulo';

    const now = new Date();
    // Nota: Para produção, usar uma lib como date-fns-tz para conversão de timezone
    // Por enquanto, usar hora UTC como approximation
    const currentHour = now.getHours();

    const [startHour, startMin] = preferences.quietHoursStart.split(':').map(Number);
    const [endHour, endMin] = preferences.quietHoursEnd.split(':').map(Number);

    const startInMinutes = startHour * 60 + startMin;
    const endInMinutes = endHour * 60 + endMin;
    const currentInMinutes = currentHour * 60 + now.getMinutes();

    // Se quiet hours não cruzam meia-noite
    if (startInMinutes < endInMinutes) {
      return currentInMinutes >= startInMinutes && currentInMinutes < endInMinutes;
    } else {
      // Se cruzam meia-noite (ex: 22:00-06:00)
      return currentInMinutes >= startInMinutes || currentInMinutes < endInMinutes;
    }
  } catch (error) {
    console.error('Error checking quiet hours:', error);
    return false;
  }
}

/**
 * Mapeia severidade do alerta para urgência de email
 */
function getSeverityUrgency(severity: string): 'high' | 'medium' | 'low' {
  switch (severity) {
    case 'CRITICAL':
      return 'high';
    case 'HIGH':
      return 'high';
    case 'MEDIUM':
      return 'medium';
    case 'LOW':
      return 'low';
    default:
      return 'medium';
  }
}

// ================================================================
// EVENT HANDLERS
// ================================================================

notificationQueue.on('completed', (job: Job<ProcessAlertNotificationJobData>) => {
  console.log(`${ICONS.SUCCESS} Job completed: ${job.id} (alertId: ${job.data.alertId})`);
});

notificationQueue.on('failed', (job: Job<ProcessAlertNotificationJobData>, error: Error) => {
  console.error(`${ICONS.ERROR} Job failed: ${job.id} (alertId: ${job.data.alertId}), Error: ${error.message}`);
});

notificationQueue.on('error', (error: Error) => {
  console.error(`${ICONS.ERROR} Queue error:`, error);
});

// ================================================================
// GRACEFUL SHUTDOWN
// ================================================================

process.on('SIGINT', async () => {
  console.log('${ICONS.PROCESS} Closing notification queue...');
  await notificationQueue.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('${ICONS.PROCESS} Closing notification queue...');
  await notificationQueue.close();
  process.exit(0);
});
