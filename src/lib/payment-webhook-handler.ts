// ================================================================
// PAYMENT WEBHOOK HANDLER - Generic Payment Processing
// ================================================================
// Handles webhooks from various payment providers (Stripe, MercadoPago, etc.)

import { prisma } from './prisma';
import { getEmailService } from './email-service';
import { ICONS } from './icons';
import { randomUUID } from 'crypto';

export interface PaymentWebhookPayload {
  provider: 'stripe' | 'mercadopago' | 'pagseguro' | 'pix' | 'custom';
  event: 'payment.success' | 'payment.failed' | 'payment.pending' | 'payment.refunded';
  transactionId: string;
  amount: number;
  currency: string;
  metadata?: {
    userId?: string;
    planId?: string;
    credits?: number;
    [key: string]: unknown;
  };
  rawPayload: unknown;
}

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
    console.log(`${ICONS.SYNC} Processando webhook de pagamento: ${provider}`);

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
          console.log(`${ICONS.WARNING} Evento de webhook não tratado: ${payload.event}`);
          return {
            success: true,
            transactionId: payload.transactionId
          };
      }

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao processar webhook:`, error);
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
    console.log(`${ICONS.SUCCESS} Processando pagamento bem-sucedido: ${payload.transactionId}`);

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
        console.log(`${ICONS.WARNING} Transação já processada: ${payload.transactionId}`);
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

      console.log(`${ICONS.SUCCESS} ${credits} créditos adicionados para usuário ${userId}`);

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
        console.error(`${ICONS.ERROR} Erro ao enviar email de confirmação:`, emailError);
        // Não falhar o webhook por erro de email
      }

      return {
        success: true,
        transactionId: payload.transactionId,
        creditsAdded: credits
      };

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao processar pagamento bem-sucedido:`, error);
      throw error;
    }
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailed(payload: PaymentWebhookPayload): Promise<PaymentProcessingResult> {
    console.log(`${ICONS.ERROR} Processando pagamento falhado: ${payload.transactionId}`);

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
    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao processar pagamento falhado:`, error);
      throw error;
    }
  }

  /**
   * Handle pending payment
   */
  private async handlePaymentPending(payload: PaymentWebhookPayload): Promise<PaymentProcessingResult> {
    console.log(`${ICONS.CLOCK} Processando pagamento pendente: ${payload.transactionId}`);

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
    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao processar pagamento pendente:`, error);
      throw error;
    }
  }

  /**
   * Handle refunded payment
   */
  private async handlePaymentRefunded(payload: PaymentWebhookPayload): Promise<PaymentProcessingResult> {
    console.log(`${ICONS.MONEY} Processando reembolso: ${payload.transactionId}`);

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

      if (originalTransaction && originalTransaction.metadata && (originalTransaction.metadata as Record<string, unknown>).status === 'COMPLETED') {
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
    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao processar reembolso:`, error);
      throw error;
    }
  }

  /**
   * Parse webhook payload based on provider
   */
  private parseWebhookPayload(provider: string, rawBody: string): PaymentWebhookPayload {
    const data = JSON.parse(rawBody) as Record<string, unknown>;

    switch (provider.toLowerCase()) {
      case 'stripe':
        return this.parseStripePayload(data);
      case 'mercadopago':
        return this.parseMercadoPagoPayload(data);
      case 'pagseguro':
        return this.parsePagSeguroPayload(data);
      default:
        // Generic/custom payload format
        return {
          provider: 'custom',
          event: (data.event as PaymentWebhookPayload['event']) || 'payment.success',
          transactionId: (data.transactionId as string) || (data.id as string),
          amount: (data.amount as number) || 0,
          currency: (data.currency as string) || 'BRL',
          metadata: (data.metadata as Record<string, unknown>) || {},
          rawPayload: data
        };
    }
  }

  private parseStripePayload(data: Record<string, unknown>): PaymentWebhookPayload {
    const eventType = data.type as string;
    let event: PaymentWebhookPayload['event'] = 'payment.success';

    if (eventType.includes('payment_intent.succeeded')) {
      event = 'payment.success';
    } else if (eventType.includes('payment_intent.payment_failed')) {
      event = 'payment.failed';
    } else if (eventType.includes('charge.dispute.created')) {
      event = 'payment.refunded';
    }

    const dataObj = data.data as Record<string, unknown>;
    const objectData = dataObj.object as Record<string, unknown>;

    return {
      provider: 'stripe',
      event,
      transactionId: objectData.id as string,
      amount: (objectData.amount as number) / 100, // Stripe usa centavos
      currency: (objectData.currency as string).toUpperCase(),
      metadata: (objectData.metadata as Record<string, unknown>) || {},
      rawPayload: data
    };
  }

  private parseMercadoPagoPayload(data: Record<string, unknown>): PaymentWebhookPayload {
    let event: PaymentWebhookPayload['event'] = 'payment.success';

    const dataObj = data.data as Record<string, unknown> | undefined;
    const status = dataObj?.status || data.status;

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

    return {
      provider: 'mercadopago',
      event,
      transactionId: (dataObj?.id || data.id) as string,
      amount: ((dataObj?.transaction_amount || data.transaction_amount) as number) || 0,
      currency: 'BRL',
      metadata: (data.metadata as Record<string, unknown>) || {},
      rawPayload: data
    };
  }

  private parsePagSeguroPayload(data: Record<string, unknown>): PaymentWebhookPayload {
    // Implementar parsing específico do PagSeguro
    return {
      provider: 'pagseguro',
      event: 'payment.success',
      transactionId: (data.id as string) || 'unknown',
      amount: (data.amount as number) || 0,
      currency: 'BRL',
      metadata: (data.metadata as Record<string, unknown>) || {},
      rawPayload: data
    };
  }

  /**
   * Verify webhook signature
   */
  private verifyWebhookSignature(_provider: string, _headers: Record<string, string>, _body: string): boolean {
    // Por enquanto, sempre válido - implementar verificação real conforme provider
    console.log(`${ICONS.SHIELD} Verificando assinatura do webhook ${_provider}...`);

    // TODO: Implementar verificação real de assinatura para cada provider
    // Stripe: usar stripe.webhooks.constructEvent
    // MercadoPago: verificar x-signature header
    // etc.

    return true;
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