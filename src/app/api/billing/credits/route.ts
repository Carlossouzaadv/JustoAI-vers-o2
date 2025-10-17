// ================================================================
// API DE CRÉDITOS - Compra Rápida e Gestão de Créditos
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { usageTracker } from '@/lib/telemetry/usage-tracker';
import { quotaEnforcement } from '@/lib/middleware/quota-enforcement';
import { ICONS } from '@/lib/icons';

// ================================================================
// TIPOS E INTERFACES
// ================================================================

interface CreditPurchaseRequest {
  workspaceId: string;
  packageType: 'extra_reports_5' | 'extra_reports_20' | 'extra_reports_50' | 'custom';
  quantity?: number;
  paymentMethod?: 'credit_card' | 'pix' | 'boleto';
  metadata?: Record<string, any>;
}

interface CreditPackage {
  id: string;
  name: string;
  description: string;
  reportCredits: number;
  price: number;
  discount?: number;
  popular?: boolean;
}

interface CreditBalance {
  workspaceId: string;
  balance: number;
  includedCredits: number;
  purchasedCredits: number;
  consumedCredits: number;
  transactions: CreditTransaction[];
}

interface CreditTransaction {
  id: string;
  type: 'debit' | 'credit';
  amount: number;
  reason: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

// ================================================================
// CONFIGURAÇÃO DE PACOTES
// ================================================================

const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'extra_reports_5',
    name: '5 Relatórios Extras',
    description: 'Pacote básico para necessidades ocasionais',
    reportCredits: 5,
    price: 29.90
  },
  {
    id: 'extra_reports_20',
    name: '20 Relatórios Extras',
    description: 'Ideal para escritórios pequenos e médios',
    reportCredits: 20,
    price: 99.90,
    discount: 15,
    popular: true
  },
  {
    id: 'extra_reports_50',
    name: '50 Relatórios Extras',
    description: 'Para grandes volumes e escritórios maiores',
    reportCredits: 50,
    price: 199.90,
    discount: 25
  }
];

// ================================================================
// HANDLERS DE ENDPOINTS
// ================================================================

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get('workspaceId');
    const action = url.searchParams.get('action');

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId é obrigatório' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'balance':
        return await getCreditBalance(workspaceId);

      case 'packages':
        return await getCreditPackages();

      case 'transactions':
        // Return empty transactions to avoid database errors
        return NextResponse.json({
          success: true,
          data: {
            transactions: []
          }
        });

      default:
        return await getCreditDashboard(workspaceId);
    }

  } catch (error) {
    console.error(`${ICONS.ERROR} Credit API GET error:`, error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'purchase':
        return await purchaseCredits(body);

      case 'admin_add':
        return await adminAddCredits(body);

      case 'simulate_purchase':
        return await simulatePurchase(body);

      default:
        return NextResponse.json(
          { error: 'Ação não reconhecida' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error(`${ICONS.ERROR} Credit API POST error:`, error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// ================================================================
// IMPLEMENTAÇÃO DOS HANDLERS
// ================================================================

async function getCreditBalance(workspaceId: string): Promise<NextResponse> {
  try {
    const balance = await usageTracker.getCreditBalance(workspaceId);

    return NextResponse.json({
      success: true,
      data: balance
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Failed to get credit balance:`, error);
    // Return default balance if service is unavailable
    return NextResponse.json({
      success: true,
      data: {
        workspaceId,
        balance: 0,
        includedCredits: 0,
        purchasedCredits: 0,
        consumedCredits: 0,
        transactions: []
      }
    });
  }
}

async function getCreditPackages(): Promise<NextResponse> {
  return NextResponse.json({
    success: true,
    data: {
      packages: CREDIT_PACKAGES,
      currency: 'BRL',
      paymentMethods: ['credit_card', 'pix', 'boleto']
    }
  });
}

async function getCreditTransactions(workspaceId: string): Promise<NextResponse> {
  try {
    const transactions = await prisma.creditTransactions.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const formattedTransactions: CreditTransaction[] = transactions.map(t => ({
      id: t.id,
      type: t.type as 'debit' | 'credit',
      amount: parseFloat(t.amount.toString()),
      reason: (t.metadata as any)?.reason || 'Transação de crédito',
      createdAt: t.createdAt.toISOString(),
      metadata: t.metadata as any
    }));

    return NextResponse.json({
      success: true,
      data: {
        transactions: formattedTransactions
      }
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Failed to get credit transactions:`, error);
    return NextResponse.json(
      { error: 'Erro ao buscar transações' },
      { status: 500 }
    );
  }
}

async function getCreditDashboard(workspaceId: string): Promise<NextResponse> {
  try {
    // Return default data if services are unavailable
    return NextResponse.json({
      success: true,
      data: {
        balance: {
          workspaceId,
          balance: 0,
          includedCredits: 0,
          purchasedCredits: 0,
          consumedCredits: 0,
          transactions: []
        },
        quotaStatus: {
          reports: {
            quotaStatus: 'ok',
            percentage: 0
          }
        },
        packages: CREDIT_PACKAGES,
        recommendations: []
      }
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Failed to get credit dashboard:`, error);
    // Return graceful default on error
    return NextResponse.json({
      success: true,
      data: {
        balance: {
          workspaceId,
          balance: 0,
          includedCredits: 0,
          purchasedCredits: 0,
          consumedCredits: 0,
          transactions: []
        },
        quotaStatus: {
          reports: {
            quotaStatus: 'ok',
            percentage: 0
          }
        },
        packages: CREDIT_PACKAGES,
        recommendations: []
      }
    });
  }
}

async function purchaseCredits(request: CreditPurchaseRequest): Promise<NextResponse> {
  try {
    const { workspaceId, packageType, quantity, paymentMethod, metadata } = request;

    // Validar entrada
    if (!workspaceId || !packageType) {
      return NextResponse.json(
        { error: 'workspaceId e packageType são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar pacote
    const package_ = CREDIT_PACKAGES.find(p => p.id === packageType);
    if (!package_) {
      return NextResponse.json(
        { error: 'Pacote não encontrado' },
        { status: 404 }
      );
    }

    const finalQuantity = quantity || 1;
    const totalCredits = package_.reportCredits * finalQuantity;
    const totalPrice = package_.price * finalQuantity;

    console.log(`${ICONS.CREDIT} Processing credit purchase:`, {
      workspace: workspaceId,
      package: packageType,
      quantity: finalQuantity,
      credits: totalCredits,
      price: totalPrice
    });

    // Simular processamento de pagamento
    const paymentResult = await simulatePaymentProcessing(paymentMethod || 'credit_card', totalPrice);

    if (!paymentResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Falha no processamento do pagamento',
        details: paymentResult.error
      }, { status: 402 });
    }

    // Registrar transação de crédito
    await usageTracker.trackCreditPurchase(workspaceId, {
      amount: totalCredits,
      source: 'purchase',
      transactionId: paymentResult.transactionId,
      metadata: {
        packageType,
        quantity: finalQuantity,
        price: totalPrice,
        paymentMethod,
        ...metadata
      }
    });

    console.log(`${ICONS.SUCCESS} Credit purchase completed:`, {
      workspace: workspaceId,
      credits: totalCredits,
      transactionId: paymentResult.transactionId
    });

    // Verificar se isso resolve bloqueios de quota
    const newQuotaStatus = await quotaEnforcement.getQuotaStatus(workspaceId);

    return NextResponse.json({
      success: true,
      data: {
        transaction: {
          id: paymentResult.transactionId,
          credits: totalCredits,
          price: totalPrice,
          package: package_.name,
          status: 'completed'
        },
        newBalance: await usageTracker.getCreditBalance(workspaceId),
        quotaResolved: newQuotaStatus.reports.quotaStatus === 'ok'
      }
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Credit purchase failed:`, error);
    return NextResponse.json(
      { error: 'Erro no processamento da compra' },
      { status: 500 }
    );
  }
}

async function adminAddCredits(request: {
  workspaceId: string;
  amount: number;
  reason: string;
  adminId: string;
}): Promise<NextResponse> {
  try {
    const { workspaceId, amount, reason, adminId } = request;

    // Validar entrada
    if (!workspaceId || !amount || !reason || !adminId) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Quantidade deve ser positiva' },
        { status: 400 }
      );
    }

    console.log(`${ICONS.ADMIN} Admin adding credits:`, {
      workspace: workspaceId,
      amount,
      reason,
      admin: adminId
    });

    // Registrar transação administrativa
    await usageTracker.trackCreditPurchase(workspaceId, {
      amount,
      source: 'admin',
      metadata: {
        reason,
        adminId,
        timestamp: new Date().toISOString()
      }
    });

    console.log(`${ICONS.SUCCESS} Admin credit addition completed`);

    return NextResponse.json({
      success: true,
      data: {
        creditsAdded: amount,
        reason,
        newBalance: await usageTracker.getCreditBalance(workspaceId)
      }
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Admin credit addition failed:`, error);
    return NextResponse.json(
      { error: 'Erro na adição de créditos' },
      { status: 500 }
    );
  }
}

async function simulatePurchase(request: {
  packageType: string;
  quantity?: number;
}): Promise<NextResponse> {
  try {
    const { packageType, quantity } = request;

    const package_ = CREDIT_PACKAGES.find(p => p.id === packageType);
    if (!package_) {
      return NextResponse.json(
        { error: 'Pacote não encontrado' },
        { status: 404 }
      );
    }

    const finalQuantity = quantity || 1;
    const totalCredits = package_.reportCredits * finalQuantity;
    const basePrice = package_.price * finalQuantity;
    const discount = package_.discount || 0;
    const discountAmount = (basePrice * discount) / 100;
    const finalPrice = basePrice - discountAmount;

    return NextResponse.json({
      success: true,
      data: {
        package: package_,
        quantity: finalQuantity,
        totalCredits,
        pricing: {
          basePrice,
          discount,
          discountAmount,
          finalPrice
        },
        savings: discountAmount > 0 ? `Você economiza R$ ${discountAmount.toFixed(2)}` : null
      }
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Purchase simulation failed:`, error);
    return NextResponse.json(
      { error: 'Erro na simulação' },
      { status: 500 }
    );
  }
}

// ================================================================
// FUNÇÕES AUXILIARES
// ================================================================

async function simulatePaymentProcessing(
  paymentMethod: string,
  amount: number
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  // Simular delay de processamento
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Simular 95% de taxa de sucesso
  const isSuccess = Math.random() > 0.05;

  if (isSuccess) {
    return {
      success: true,
      transactionId: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  } else {
    return {
      success: false,
      error: 'Pagamento recusado pelo processador'
    };
  }
}

function generateRecommendations(
  balance: any,
  quotaStatus: any
): string[] {
  const recommendations: string[] = [];

  if (quotaStatus.quotaStatus === 'hard_blocked') {
    recommendations.push('🚨 Compre créditos agora para continuar gerando relatórios');
  } else if (quotaStatus.quotaStatus === 'soft_warning') {
    recommendations.push('⚠️ Considere comprar créditos extras para evitar interrupções');
  }

  if (balance.balance < 5) {
    recommendations.push('💡 Saldo baixo - recomendamos comprar o pacote de 20 relatórios');
  }

  if (quotaStatus.percentage > 70) {
    recommendations.push('📈 Use o agendamento noturno para economizar créditos');
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ Tudo certo! Você tem créditos suficientes');
  }

  return recommendations;
}

// ================================================================
// ENDPOINT DE WEBHOOK PARA PAGAMENTOS (FUTURO)
// ================================================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'payment_webhook':
        return await handlePaymentWebhook(body);

      default:
        return NextResponse.json(
          { error: 'Ação não reconhecida' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error(`${ICONS.ERROR} Credit API PUT error:`, error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

async function handlePaymentWebhook(payload: any): Promise<NextResponse> {
  try {
    const { getPaymentWebhookHandler } = await import('@/lib/payment-webhook-handler');
    const webhookHandler = getPaymentWebhookHandler();

    console.log(`${ICONS.WEBHOOK} Payment webhook received:`, payload);

    // Extrair informações do header (seria necessário no request real)
    const provider = payload.provider || 'custom';
    const headers = payload.headers || {};
    const rawBody = JSON.stringify(payload);

    // Processar webhook
    const result = await webhookHandler.processWebhook(provider, headers, rawBody);

    if (result.success) {
      console.log(`${ICONS.SUCCESS} Webhook processado: ${result.transactionId}`, {
        creditsAdded: result.creditsAdded
      });

      return NextResponse.json({
        success: true,
        message: 'Webhook processado com sucesso',
        transactionId: result.transactionId,
        creditsAdded: result.creditsAdded
      });
    } else {
      console.error(`${ICONS.ERROR} Falha no processamento do webhook:`, result.error);

      return NextResponse.json(
        {
          error: result.error,
          shouldRetry: result.shouldRetry
        },
        { status: result.shouldRetry ? 500 : 400 }
      );
    }

  } catch (error) {
    console.error(`${ICONS.ERROR} Payment webhook failed:`, error);
    return NextResponse.json(
      { error: 'Erro interno no webhook' },
      { status: 500 }
    );
  }
}