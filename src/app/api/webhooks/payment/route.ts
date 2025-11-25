/**
 * API Endpoint - Payment Webhook Handler
 * POST /api/webhooks/payment
 *
 * Handles payment webhooks from multiple providers:
 * - Stripe
 * - MercadoPago
 * - PagSeguro
 * - Pix (Brazilian instant payment)
 *
 * All webhooks are verified using HMAC-SHA256 signatures
 * Invalid signatures are rejected with 401 Unauthorized
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPaymentWebhookHandler } from '@/lib/payment-webhook-handler';
import { ICONS } from '@/lib/icons';
import * as Sentry from '@sentry/nextjs';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get provider from query parameter or header
    const searchParams = new URL(request.url).searchParams;
    const provider = searchParams.get('provider');

    if (!provider) {
      console.warn(`${ICONS.WARNING} Payment webhook missing provider parameter`);
      return NextResponse.json(
        { success: false, error: 'Missing provider parameter' },
        { status: 400 }
      );
    }

    console.log(
      `${ICONS.SYNC} Payment webhook received from provider: ${provider}`
    );

    // Get raw body for signature verification
    // ⚠️ CRITICAL: Must be raw body, not parsed JSON
    const rawBody = await request.text();

    if (!rawBody) {
      console.warn(`${ICONS.WARNING} Payment webhook with empty body from ${provider}`);
      return NextResponse.json(
        { success: false, error: 'Empty request body' },
        { status: 400 }
      );
    }

    // Convert headers to record format
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    // Get the handler
    const handler = getPaymentWebhookHandler();

    // Process webhook (includes signature verification)
    const result = await handler.processWebhook(provider, headers, rawBody);

    const duration = Date.now() - startTime;

    // Check if signature was invalid (will be indicated in error handling)
    if (!result.success && result.error?.includes('Assinatura')) {
      console.error(
        `${ICONS.ERROR} Invalid webhook signature from ${provider}`
      );

      // Log invalid signature attempt to Sentry
      Sentry.captureMessage(
        `Invalid payment webhook signature from ${provider}`,
        'warning'
      );

      Sentry.setContext('payment_webhook_invalid', {
        provider,
        transactionId: result.transactionId,
        timestamp: new Date().toISOString(),
        duration,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid signature',
          transactionId: result.transactionId,
        },
        { status: 401 } // 401 Unauthorized for signature failures
      );
    }

    // Handle other errors
    if (!result.success) {
      console.error(`${ICONS.ERROR} Payment webhook processing failed:`, result);

      Sentry.captureMessage(
        `Payment webhook processing failed for ${provider}`,
        'error'
      );

      Sentry.setContext('payment_webhook_error', {
        provider,
        error: result.error,
        transactionId: result.transactionId,
        timestamp: new Date().toISOString(),
        duration,
      });

      // Return 200 with error details (webhook provider shouldn't retry on non-signature errors)
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          transactionId: result.transactionId,
          shouldRetry: result.shouldRetry || false,
        },
        { status: 200 } // Return 200 even on processing errors (provider won't re-send)
      );
    }

    // Success
    console.log(
      `${ICONS.SUCCESS} Payment webhook processed successfully: ${result.transactionId}`
    );

    if (result.creditsAdded) {
      console.log(
        `${ICONS.SUCCESS} Credits added: ${result.creditsAdded} for transaction ${result.transactionId}`
      );
    }

    Sentry.captureMessage(
      `Payment webhook processed: ${provider}`,
      'info'
    );

    Sentry.setContext('payment_webhook_success', {
      provider,
      transactionId: result.transactionId,
      creditsAdded: result.creditsAdded,
      timestamp: new Date().toISOString(),
      duration,
    });

    return NextResponse.json(
      {
        success: true,
        transactionId: result.transactionId,
        creditsAdded: result.creditsAdded,
        duration,
      },
      { status: 200 }
    );
  } catch (_error) {
    const duration = Date.now() - startTime;

    console.error(`${ICONS.ERROR} Payment webhook error:`, error);

    Sentry.captureException(error, {
      tags: {
        type: 'payment_webhook',
        context: 'webhook_handler',
      },
      contexts: {
        payment_webhook_exception: {
          timestamp: new Date().toISOString(),
          duration,
        },
      },
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * Health check endpoint
 * GET /api/webhooks/payment
 */
export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      status: 'healthy',
      service: 'payment-webhook-handler',
      timestamp: new Date().toISOString(),
      supported_providers: ['stripe', 'mercadopago', 'pagseguro', 'pix'],
    },
    { status: 200 }
  );
}
