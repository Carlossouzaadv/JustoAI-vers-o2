// ================================================================
// API DE CRÉDITOS - Compra Rápida e Gestão de Créditos
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { usageTracker } from '@/lib/telemetry/usage-tracker';
import { quotaEnforcement } from '@/lib/middleware/quota-enforcement';
import { getCredits } from '@/lib/services/creditService';
import { PlanService } from '@/lib/services/planService';
import { ICONS } from '@/lib/icons';

// ================================================================
// TIPOS E INTERFACES
// ================================================================

interface CreditPurchaseRequest {
  workspaceId: string;
  packageType: 'extra_reports_5' | 'extra_reports_20' | 'extra_reports_50' | 'custom';
  quantity?: number;
  paymentMethod?: 'credit_card' | 'pix' | 'boleto';
  metadata?: Record<string, unknown>;
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

interface PaymentWebhookPayload {
  provider?: string;
  headers?: Record<string, unknown>;
  [key: string]: unknown;
}

// ================================================================
// TYPE GUARDS (Mandato Inegociável)
// ================================================================

function isPaymentWebhookPayload(data: unknown): data is PaymentWebhookPayload {
  return typeof data === 'object' && data !== null;
}

// ================================================================
// CONFIGURAÇÃO DE PACOTES (FROM SSOT)
// ================================================================

/**
 * Get credit packages from SSOT (src/config/plans.ts)
 * Mapping new unified system to legacy package format for backwards compatibility
 */
function getCreditPackages(): CreditPackage[] {
  return PlanService.getAllCreditPacks().map(pack => {
    const discountPercent = Math.round(pack.discount * 100);

    return {
      id: pack.id,
      name: pack.name,
      description: pack.description,
      reportCredits: pack.credits, // Map unified credits to reportCredits for backward compat
      price: pack.priceCents / 100, // Convert centavos to BRL
      discount: discountPercent > 0 ? discountPercent : undefined,
      popular: pack.id === 'pack-credits-medium' // Middle pack is popular
    };
  });
}

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
        return await getCreditPackagesEndpoint();

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

  } catch (_error) {
    console.error(`${ICONS.ERROR} Credit API GET error:`, _error);
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

  } catch (_error) {
    console.error(`${ICONS.ERROR} Credit API POST error:`, _error);
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

  } catch (_error) {
    console.error(`${ICONS.ERROR} Failed to get credit balance:`, _error);
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

async function getCreditPackagesEndpoint(): Promise<NextResponse> {
  return NextResponse.json({
    success: true,
    data: {
      packages: getCreditPackages(),
      currency: 'BRL',
      paymentMethods: ['credit_card', 'pix', 'boleto']
    }
  });
}

async function getCreditDashboard(workspaceId: string): Promise<NextResponse> {
  try {
    // Usar serviço de créditos
    const balanceData = await getCredits(undefined, workspaceId);

    return NextResponse.json({
      success: true,
      data: {
        balance: {
          fullCreditsBalance: balanceData.fullCredits,
          reportCreditsBalance: balanceData.reportCredits,
          unlimited: balanceData.unlimited,
          divinityAdmin: balanceData.divinityAdmin
        },
        quotaStatus: {
          reports: {
            quotaStatus: 'ok',
            percentage: 0
          }
        },
        packages: getCreditPackages(),
        recommendations: []
      }
    });

  } catch (_error) {
    console.error(`${ICONS.ERROR} Failed to get credit dashboard:`, _error);
    // Return graceful default on error
    return NextResponse.json({
      success: true,
      data: {
        balance: {
          workspaceId,
          fullCreditsBalance: 999,
          reportCreditsBalance: 999,
          includedCredits: 999,
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
        packages: getCreditPackages(),
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

    // Buscar pacote from SSOT
    const package_ = getCreditPackages().find(p => p.id === packageType);
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

  } catch (_error) {
    console.error(`${ICONS.ERROR} Credit purchase failed:`, _error);
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

  } catch (_error) {
    console.error(`${ICONS.ERROR} Admin credit addition failed:`, _error);
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

    // Use getCreditPackages() from SSOT
    const package_ = getCreditPackages().find((p: CreditPackage) => p.id === packageType);
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

  } catch (_error) {
    console.error(`${ICONS.ERROR} Purchase simulation failed:`, _error);
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
  _paymentMethod: string,
  _amount: number
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

  } catch (_error) {
    console.error(`${ICONS.ERROR} Credit API PUT error:`, _error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

async function handlePaymentWebhook(payload: unknown): Promise<NextResponse> {
  try {
    const { getPaymentWebhookHandler } = await import('@/lib/payment-webhook-handler');
    const webhookHandler = getPaymentWebhookHandler();

    console.log(`${ICONS.WEBHOOK} Payment webhook received:`, payload);

    // Validate payload structure using type guard
    if (!isPaymentWebhookPayload(payload)) {
      return NextResponse.json(
        { error: 'Formato de payload inválido' },
        { status: 400 }
      );
    }

    // Safely extract provider and headers from validated payload
    const provider = typeof payload.provider === 'string' ? payload.provider : 'custom';

    // Convert headers to Record<string, string>, validating each entry
    const headersObj = typeof payload.headers === 'object' && payload.headers !== null
      ? (payload.headers as Record<string, unknown>)
      : {};
    const headers: Record<string, string> = Object.entries(headersObj).reduce(
      (acc, [key, value]) => {
        acc[key] = typeof value === 'string' ? value : String(value);
        return acc;
      },
      {} as Record<string, string>
    );

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

  } catch (_error) {
    console.error(`${ICONS.ERROR} Payment webhook failed:`, _error);
    return NextResponse.json(
      { error: 'Erro interno no webhook' },
      { status: 500 }
    );
  }
}