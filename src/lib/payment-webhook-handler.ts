// ================================================================
// PAYMENT WEBHOOK HANDLER - Generic Payment Processing
// ================================================================
// Handles webhooks from various payment providers (Stripe, MercadoPago, etc.)

import { prisma } from './prisma';
import { log, logError } from '@/lib/services/logger';
import { getEmailService } from './email-service';
import { ICONS } from './icons';
import { randomUUID } from 'crypto';
import { getSignatureVerifier } from './webhook-signature-verifiers';
import * as Sentry from '@sentry/nextjs';
import {
  PaymentWebhookPayload,
  PaymentWebhookPayloadSchema,
  StripeWebhook,
  MercadoPagoWebhook,
  PagSeguroWebhook,
  PagSeguroWebhookSchema,
  parseStripeWebhook,
  parseMercadoPagoWebhook,
} from './types/external-api';

export interface PaymentProcessingResult {
  success: boolean;
  transactionId: string;
  creditsAdded?: number;
  error?: string;
  shouldRetry?: boolean;
}

/**
 * Generic Payment Webhook Handler
 * Processes payments from multiple providers
 */
export class PaymentWebhookHandler {

  /**
   * Process incoming webhook payload
   */
  async processWebhook(
    provider: string,
    headers: Record<string, string>,
    rawBody: string
  ): Promise<PaymentProcessingResult> {
    log.info({ msg: `${ICONS.SYNC} Processando webhook de pagamento: ${provider}`, component: 'paymentWebhookHandler' });

    try {
      // Verificar assinatura do webhook se configurada
      if (!this.verifyWebhookSignature(provider, headers, rawBody)) {
        throw new Error('Assinatura do webhook inválida');
      }

      // Parse do payload baseado no provider
      const payload = this.parseWebhookPayload(provider, rawBody);

      // Processar baseado no tipo de evento
      switch (payload.event) {
        case 'payment.success':
          return await this.handlePaymentSuccess(payload);
        case 'payment.failed':
          return await this.handlePaymentFailed(payload);
        case 'payment.pending':
          return await this.handlePaymentPending(payload);
        case 'payment.refunded':
          return await this.handlePaymentRefunded(payload);
        default:
          log.info({ msg: `${ICONS.WARNING} Evento de webhook não tratado: ${payload.event}`, component: 'paymentWebhookHandler' });
          return {
            success: true,
            transactionId: payload.transactionId
          };
      }

    } catch (_error) {
      logError(`${ICONS.ERROR} Erro ao processar webhook:`, '', { component: 'paymentWebhookHandler' });
      return {
        success: false,
        transactionId: 'unknown',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        shouldRetry: true
      };
    }
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSuccess(payload: PaymentWebhookPayload): Promise<PaymentProcessingResult> {
    log.info({ msg: `${ICONS.SUCCESS} Processando pagamento bem-sucedido: ${payload.transactionId}`, component: 'paymentWebhookHandler' });

    try {
      // Verificar se transação já foi processada
      const existingTransaction = await prisma.creditTransaction.findFirst({
        where: {
          metadata: {
            path: ['externalId'],
            equals: payload.transactionId
          }
        }
      });

      if (existingTransaction) {
        log.info({ msg: `${ICONS.WARNING} Transação já processada: ${payload.transactionId}`, component: 'paymentWebhookHandler' });
        return {
          success: true,
          transactionId: payload.transactionId,
          creditsAdded: Math.abs(Number(existingTransaction.amount))
        };
      }

      // Buscar usuário
      const userId = payload.metadata?.userId;
      if (!userId) {
        throw new Error('UserId não encontrado no metadata do pagamento');
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          workspaces: true
        }
      });

      if (!user) {
        throw new Error(`Usuário não encontrado: ${userId}`);
      }

      // Calcular créditos baseado no valor pago
      const credits = this.calculateCreditsFromAmount(payload.amount, payload.metadata?.planId);

      // Criar transação no banco
      // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
      const transaction = await prisma.creditTransaction.create({
        data: {
          id: randomUUID(),
          workspaceId: user.workspaces[0]?.workspaceId || '',
          type: 'CREDIT',
          creditCategory: 'FULL',
          amount: credits,
          reason: `Compra via ${payload.provider} - ${payload.transactionId}`,
          metadata: {
            ...payload.metadata,
            externalId: payload.transactionId,
            provider: payload.provider.toUpperCase(),
            paymentAmount: payload.amount,
            status: 'COMPLETED'
          }
        }
      });

      // Atualizar saldo de créditos do workspace
      const userWorkspace = await prisma.userWorkspace.findFirst({
        where: { userId: userId }
      });

      if (userWorkspace) {
        await prisma.workspaceCredits.upsert({
          where: { workspaceId: userWorkspace.workspaceId },
          create: {
            workspaceId: userWorkspace.workspaceId,
            fullCreditsBalance: credits
          },
          update: {
            fullCreditsBalance: {
              increment: credits
            }
          }
        });
      }

      // A transação já é registrada como movimentação de créditos

      log.info({ msg: `${ICONS.SUCCESS} ${credits} créditos adicionados para usuário ${userId}`, component: 'paymentWebhookHandler' });

      // Enviar email de confirmação
      try {
        const emailService = getEmailService();
        await emailService.sendPaymentSuccess(
          user.email,
          payload.amount,
          credits,
          payload.transactionId
        );
      } catch (emailError) {
        logError(`${ICONS.ERROR} Erro ao enviar email de confirmação:`, '', { component: 'paymentWebhookHandler' });
        // Não falhar o webhook por erro de email
      }

      return {
        success: true,
        transactionId: payload.transactionId,
        creditsAdded: credits
      };

    } catch (_error) {
      logError(`${ICONS.ERROR} Erro ao processar pagamento bem-sucedido:`, '', { component: 'paymentWebhookHandler' });
      throw error;
    }
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailed(payload: PaymentWebhookPayload): Promise<PaymentProcessingResult> {
    log.info({ msg: `${ICONS.ERROR} Processando pagamento falhado: ${payload.transactionId}`, component: 'paymentWebhookHandler' });

    try {
      const userId = payload.metadata?.userId;
      if (userId) {
        // Buscar workspace do usuário
        const userWorkspace = await prisma.userWorkspace.findFirst({
          where: { userId: userId }
        });

        if (userWorkspace) {
          // Registrar falha no banco
          await prisma.creditTransaction.create({
            data: {
              id: randomUUID(),
              workspaceId: userWorkspace.workspaceId,
              type: 'CREDIT',
              creditCategory: 'FULL',
              amount: 0,
              reason: `Falha na compra via ${payload.provider} - ${payload.transactionId}`,
              metadata: {
                ...payload.metadata,
                externalId: payload.transactionId,
                provider: payload.provider.toUpperCase(),
                paymentAmount: payload.amount,
                status: 'FAILED'
              }
            }
          });
        }

        // Aqui poderia enviar email de falha ou notificação
      }

      return {
        success: true,
        transactionId: payload.transactionId
      };
    } catch (_error) {
      logError(`${ICONS.ERROR} Erro ao processar pagamento falhado:`, '', { component: 'paymentWebhookHandler' });
      throw error;
    }
  }

  /**
   * Handle pending payment
   */
  private async handlePaymentPending(payload: PaymentWebhookPayload): Promise<PaymentProcessingResult> {
    log.info({ msg: `${ICONS.CLOCK} Processando pagamento pendente: ${payload.transactionId}`, component: 'paymentWebhookHandler' });

    try {
      const userId = payload.metadata?.userId;
      if (userId) {
        // Buscar workspace do usuário
        const userWorkspace = await prisma.userWorkspace.findFirst({
          where: { userId: userId }
        });

        if (userWorkspace) {
          await prisma.creditTransaction.create({
            data: {
              id: randomUUID(),
              workspaceId: userWorkspace.workspaceId,
              type: 'CREDIT',
              creditCategory: 'FULL',
              amount: 0,
              reason: `Pagamento pendente via ${payload.provider} - ${payload.transactionId}`,
              metadata: {
                ...payload.metadata,
                externalId: payload.transactionId,
                provider: payload.provider.toUpperCase(),
                paymentAmount: payload.amount,
                status: 'PENDING'
              }
            }
          });
        }
      }

      return {
        success: true,
        transactionId: payload.transactionId
      };
    } catch (_error) {
      logError(`${ICONS.ERROR} Erro ao processar pagamento pendente:`, '', { component: 'paymentWebhookHandler' });
      throw error;
    }
  }

  /**
   * Handle refunded payment
   */
  private async handlePaymentRefunded(payload: PaymentWebhookPayload): Promise<PaymentProcessingResult> {
    log.info({ msg: `${ICONS.MONEY} Processando reembolso: ${payload.transactionId}`, component: 'paymentWebhookHandler' });

    try {
      // Buscar transação original
      const originalTransaction = await prisma.creditTransaction.findFirst({
        where: {
          metadata: {
            path: ['externalId'],
            equals: payload.transactionId
          }
        }
      });

      // Type guard: originalTransaction must exist and have valid metadata
      if (originalTransaction === null) {
        log.info({ msg: `⚠️ Original transaction not found for refund: ${payload.transactionId}`, component: 'paymentWebhookHandler' });
        return {
          success: false,
          transactionId: payload.transactionId,
          error: 'Original transaction not found'
        };
      }

      // Check if metadata exists and has a status property that is 'COMPLETED'
      const isCompletedTransaction = (): boolean => {
        if (!originalTransaction.metadata || typeof originalTransaction.metadata !== 'object') {
          return false;
        }
        const meta = originalTransaction.metadata as Record<string, unknown>;
        return meta.status === 'COMPLETED';
      };

      if (isCompletedTransaction()) {
        // Remover créditos do workspace
        await prisma.workspaceCredits.update({
          where: { workspaceId: originalTransaction.workspaceId },
          data: {
            fullCreditsBalance: {
              decrement: Math.abs(Number(originalTransaction.amount))
            }
          }
        });

        // Criar nova transação de reembolso
        await prisma.creditTransaction.create({
          data: {
            id: randomUUID(),
            workspaceId: originalTransaction.workspaceId,
            type: 'DEBIT',
            creditCategory: 'FULL',
            amount: Math.abs(Number(originalTransaction.amount)),
            reason: `Reembolso - ${payload.transactionId}`,
            metadata: {
              originalTransactionId: originalTransaction.id,
              externalId: payload.transactionId,
              status: 'REFUNDED'
            }
          }
        });

        // A transação de débito já registra a movimentação
      }

      return {
        success: true,
        transactionId: payload.transactionId
      };
    } catch (_error) {
      logError(`${ICONS.ERROR} Erro ao processar reembolso:`, '', { component: 'paymentWebhookHandler' });
      throw error;
    }
  }

  /**
   * Parse webhook payload based on provider
   * Uses Zod validation for type-safe parsing
   */
  private parseWebhookPayload(provider: string, rawBody: string): PaymentWebhookPayload {
    let rawData: unknown;

    try {
      rawData = JSON.parse(rawBody);
    } catch (_error) {
      throw new Error(`Invalid JSON in webhook body: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    switch (provider.toLowerCase()) {
      case 'stripe':
        return this.parseStripePayload(rawData);
      case 'mercadopago':
        return this.parseMercadoPagoPayload(rawData);
      case 'pagseguro':
        return this.parsePagSeguroPayload(rawData);
      default:
        // Generic/custom payload format - validate with PaymentWebhookPayloadSchema
        const validationResult = PaymentWebhookPayloadSchema.safeParse(rawData);
        if (validationResult.success) {
          return validationResult.data;
        }
        // If validation fails, return a minimal payload with defaults
        return {
          provider: 'custom',
          event: 'payment.success',
          transactionId: 'unknown',
          amount: 0,
          currency: 'BRL',
          rawPayload: rawData
        };
    }
  }

  private parseStripePayload(rawData: unknown): PaymentWebhookPayload {
    // Validate raw data against Stripe schema
    const validationResult = parseStripeWebhook(rawData);

    if (!validationResult.success) {
      throw new Error(`Invalid Stripe webhook payload: ${validationResult.error}`);
    }

    const data: StripeWebhook = validationResult.data;
    let event: PaymentWebhookPayload['event'] = 'payment.success';

    // Map Stripe event types to our normalized event types
    if (data.type.includes('payment_intent.succeeded')) {
      event = 'payment.success';
    } else if (data.type.includes('payment_intent.payment_failed')) {
      event = 'payment.failed';
    } else if (data.type.includes('charge.dispute.created')) {
      event = 'payment.refunded';
    }

    // Extract object data from validated payload
    const objectData = data.data.object;
    const amount = objectData.amount / 100; // Stripe uses cents
    const currency = objectData.currency.toUpperCase();
    const metadata = objectData.metadata || {};

    return {
      provider: 'stripe',
      event,
      transactionId: objectData.id,
      amount,
      currency,
      metadata,
      rawPayload: data
    };
  }

  private parseMercadoPagoPayload(rawData: unknown): PaymentWebhookPayload {
    // Validate raw data against MercadoPago schema
    const validationResult = parseMercadoPagoWebhook(rawData);

    if (!validationResult.success) {
      throw new Error(`Invalid MercadoPago webhook payload: ${validationResult.error}`);
    }

    const data: MercadoPagoWebhook = validationResult.data;
    let event: PaymentWebhookPayload['event'] = 'payment.success';

    // Determine event type from status (check nested data first, then top-level)
    const status = data.data?.status ?? data.status;

    switch (status) {
      case 'approved':
        event = 'payment.success';
        break;
      case 'rejected':
        event = 'payment.failed';
        break;
      case 'pending':
        event = 'payment.pending';
        break;
      case 'refunded':
        event = 'payment.refunded';
        break;
    }

    // Extract transaction ID and amount (check nested data first, then top-level)
    const transactionId = data.data?.id ?? data.id ?? 'unknown';
    const amount = data.data?.transaction_amount ?? data.transaction_amount ?? 0;
    const metadata = data.metadata || {};

    return {
      provider: 'mercadopago',
      event,
      transactionId,
      amount,
      currency: 'BRL',
      metadata,
      rawPayload: data
    };
  }

  private parsePagSeguroPayload(rawData: unknown): PaymentWebhookPayload {
    // Validate raw data against PagSeguro schema
    const validationResult = PagSeguroWebhookSchema.safeParse(rawData);

    if (!validationResult.success) {
      throw new Error(`Invalid PagSeguro webhook payload: ${validationResult.error.message}`);
    }

    const data: PagSeguroWebhook = validationResult.data;

    return {
      provider: 'pagseguro',
      event: 'payment.success', // PagSeguro-specific event mapping could be added here
      transactionId: data.id ?? 'unknown',
      amount: data.amount ?? 0,
      currency: 'BRL',
      metadata: data.metadata || {},
      rawPayload: data
    };
  }

  /**
   * Verify webhook signature using provider-specific verification
   * Returns false and logs to Sentry if signature is invalid
   */
  private verifyWebhookSignature(provider: string, headers: Record<string, string>, body: string): boolean {
    try {
      log.info({ msg: `${ICONS.SHIELD} Verificando assinatura do webhook ${provider}...`, component: 'paymentWebhookHandler' });

      // Get the appropriate verifier for this provider
      const verifier = getSignatureVerifier(provider);

      if (!verifier) {
        log.warn({ msg: `${ICONS.WARNING} Nenhum verificador disponível para provider: ${provider}`, component: 'paymentWebhookHandler' });
        // For unknown providers, accept but log warning
        return true;
      }

      // Perform signature verification
      const isValid = verifier(headers, body);

      if (!isValid) {
        // Log invalid signature attempt to Sentry
        Sentry.captureMessage(
          `Invalid webhook signature from ${provider}`,
          'warning'
        );

        Sentry.getCurrentScope().setContext('webhook_verification_failed', {
          provider,
          headers: {
            'user-agent': headers['user-agent'],
            'content-type': headers['content-type'],
            'host': headers['host']
          },
          timestamp: new Date().toISOString()
        });

        logError(
          `${ICONS.ERROR} Assinatura inválida do webhook ${provider}. ` +
          `Headers: ${JSON.stringify(Object.keys(headers))}`,
          '',
          { component: 'paymentWebhookHandler' }
        );
      }

      return isValid;

    } catch (_error) {
      console.error(`${ICONS.ERROR} Erro ao verificar assinatura do webhook:`, '', { component: 'paymentWebhookHandler' });
      // Log error to Sentry
      Sentry.captureMessage(
        `Error verifying webhook signature for ${provider}`,
        'error'
      );

      Sentry.getCurrentScope().setContext('webhook_verification_error', {
        provider,
        error: error instanceof Error ? error.message : String(error)
      });

      return false;
    }
  }

  /**
   * Calculate credits from payment amount
   */
  private calculateCreditsFromAmount(amount: number, planId?: string): number {
    // Planos de créditos (valores em reais)
    const creditPlans: Record<string, { amount: number; credits: number }> = {
      'basic': { amount: 29.90, credits: 100 },
      'pro': { amount: 59.90, credits: 250 },
      'premium': { amount: 99.90, credits: 500 },
      'enterprise': { amount: 199.90, credits: 1200 }
    };

    // Se planId for especificado, usar o plano
    if (planId && creditPlans[planId]) {
      return creditPlans[planId].credits;
    }

    // Senão, calcular baseado no valor (1 real = ~3 créditos)
    return Math.floor(amount * 3);
  }
}

/**
 * Singleton instance
 */
let paymentHandlerInstance: PaymentWebhookHandler | null = null;

export function getPaymentWebhookHandler(): PaymentWebhookHandler {
  if (!paymentHandlerInstance) {
    paymentHandlerInstance = new PaymentWebhookHandler();
  }
  return paymentHandlerInstance;
}