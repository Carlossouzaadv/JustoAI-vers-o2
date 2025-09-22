// ================================================================
// PAYMENT WEBHOOK HANDLER - Generic Payment Processing
// ================================================================
// Handles webhooks from various payment providers (Stripe, MercadoPago, etc.)

import { prisma } from './prisma';
import { getEmailService } from './email-service';
import { ICONS } from './icons';
import crypto from 'crypto';

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
    [key: string]: any;
  };
  rawPayload: any;
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
    console.log(`${ICONS.WEBHOOK} Processando webhook de pagamento: ${provider}`);

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
      const existingTransaction = await prisma.transaction.findUnique({
        where: { externalId: payload.transactionId }
      });

      if (existingTransaction) {
        console.log(`${ICONS.WARNING} Transação já processada: ${payload.transactionId}`);
        return {
          success: true,
          transactionId: payload.transactionId,
          creditsAdded: existingTransaction.credits
        };
      }

      // Buscar usuário
      const userId = payload.metadata?.userId;
      if (!userId) {
        throw new Error('UserId não encontrado no metadata do pagamento');
      }

      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error(`Usuário não encontrado: ${userId}`);
      }

      // Calcular créditos baseado no valor pago
      const credits = this.calculateCreditsFromAmount(payload.amount, payload.metadata?.planId);

      // Criar transação no banco
      const transaction = await prisma.transaction.create({
        data: {
          id: crypto.randomUUID(),
          userId: userId,
          type: 'CREDIT_PURCHASE',
          amount: payload.amount,
          credits: credits,
          status: 'COMPLETED',
          provider: payload.provider.toUpperCase(),
          externalId: payload.transactionId,
          metadata: payload.metadata || {},
          createdAt: new Date()
        }
      });

      // Atualizar saldo de créditos do usuário
      await prisma.user.update({
        where: { id: userId },
        data: {
          credits: {
            increment: credits
          }
        }
      });

      // Registrar movimentação de créditos
      await prisma.creditMovement.create({
        data: {
          id: crypto.randomUUID(),
          userId: userId,
          amount: credits,
          type: 'PURCHASE',
          description: `Compra via ${payload.provider} - ${payload.transactionId}`,
          transactionId: transaction.id,
          createdAt: new Date()
        }
      });

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
        // Registrar falha no banco
        await prisma.transaction.create({
          data: {
            id: crypto.randomUUID(),
            userId: userId,
            type: 'CREDIT_PURCHASE',
            amount: payload.amount,
            credits: 0,
            status: 'FAILED',
            provider: payload.provider.toUpperCase(),
            externalId: payload.transactionId,
            metadata: payload.metadata || {},
            createdAt: new Date()
          }
        });

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
        await prisma.transaction.create({
          data: {
            id: crypto.randomUUID(),
            userId: userId,
            type: 'CREDIT_PURCHASE',
            amount: payload.amount,
            credits: 0,
            status: 'PENDING',
            provider: payload.provider.toUpperCase(),
            externalId: payload.transactionId,
            metadata: payload.metadata || {},
            createdAt: new Date()
          }
        });
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
    console.log(`${ICONS.REFUND} Processando reembolso: ${payload.transactionId}`);

    try {
      // Buscar transação original
      const originalTransaction = await prisma.transaction.findUnique({
        where: { externalId: payload.transactionId }
      });

      if (originalTransaction && originalTransaction.status === 'COMPLETED') {
        // Remover créditos do usuário
        await prisma.user.update({
          where: { id: originalTransaction.userId },
          data: {
            credits: {
              decrement: originalTransaction.credits
            }
          }
        });

        // Atualizar status da transação
        await prisma.transaction.update({
          where: { id: originalTransaction.id },
          data: { status: 'REFUNDED' }
        });

        // Registrar movimentação de créditos
        await prisma.creditMovement.create({
          data: {
            id: crypto.randomUUID(),
            userId: originalTransaction.userId,
            amount: -originalTransaction.credits,
            type: 'REFUND',
            description: `Reembolso - ${payload.transactionId}`,
            transactionId: originalTransaction.id,
            createdAt: new Date()
          }
        });
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
    const data = JSON.parse(rawBody);

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
          event: data.event || 'payment.success',
          transactionId: data.transactionId || data.id,
          amount: data.amount || 0,
          currency: data.currency || 'BRL',
          metadata: data.metadata || {},
          rawPayload: data
        };
    }
  }

  private parseStripePayload(data: any): PaymentWebhookPayload {
    const eventType = data.type;
    let event: PaymentWebhookPayload['event'] = 'payment.success';

    if (eventType.includes('payment_intent.succeeded')) {
      event = 'payment.success';
    } else if (eventType.includes('payment_intent.payment_failed')) {
      event = 'payment.failed';
    } else if (eventType.includes('charge.dispute.created')) {
      event = 'payment.refunded';
    }

    return {
      provider: 'stripe',
      event,
      transactionId: data.data.object.id,
      amount: data.data.object.amount / 100, // Stripe usa centavos
      currency: data.data.object.currency.toUpperCase(),
      metadata: data.data.object.metadata || {},
      rawPayload: data
    };
  }

  private parseMercadoPagoPayload(data: any): PaymentWebhookPayload {
    let event: PaymentWebhookPayload['event'] = 'payment.success';

    switch (data.data?.status || data.status) {
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
      transactionId: data.data?.id || data.id,
      amount: data.data?.transaction_amount || data.transaction_amount || 0,
      currency: 'BRL',
      metadata: data.metadata || {},
      rawPayload: data
    };
  }

  private parsePagSeguroPayload(data: any): PaymentWebhookPayload {
    // Implementar parsing específico do PagSeguro
    return {
      provider: 'pagseguro',
      event: 'payment.success',
      transactionId: data.id || 'unknown',
      amount: data.amount || 0,
      currency: 'BRL',
      metadata: data.metadata || {},
      rawPayload: data
    };
  }

  /**
   * Verify webhook signature
   */
  private verifyWebhookSignature(provider: string, headers: Record<string, string>, body: string): boolean {
    // Por enquanto, sempre válido - implementar verificação real conforme provider
    console.log(`${ICONS.SECURITY} Verificando assinatura do webhook ${provider}...`);

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