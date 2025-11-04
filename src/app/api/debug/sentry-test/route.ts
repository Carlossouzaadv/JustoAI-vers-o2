/**
 * API Endpoint - Sentry Test
 * POST /api/debug/sentry-test
 * Trigger a test error to verify Sentry integration
 *
 * ⚠️  DEBUG ENDPOINT - PRODUCTION ONLY FOR AUTHORIZED TESTING
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { ICONS } from '@/lib/icons';
import { captureApiError, setSentryUserContext, captureSentryMessage } from '@/lib/sentry-error-handler';

export async function POST(request: NextRequest) {
  try {
    const { type = 'error', userId = 'test-user', testMessage } = await request.json();

    console.log(`${ICONS.ROBOT} Sentry test triggered - type: ${type}`);

    // Set user context for better debugging
    if (userId) {
      setSentryUserContext(userId);
    }

    // Trigger different error types based on request
    switch (type) {
      case 'error':
        // Simulate a real error
        throw new Error('🧪 This is a test error from Sentry integration test');

      case 'warning':
        // Capture a warning message
        captureSentryMessage(
          testMessage || '🧪 Test warning message from Sentry integration',
          'warning',
          { testType: 'warning', timestamp: new Date().toISOString() }
        );
        return NextResponse.json({
          success: true,
          message: 'Warning captured to Sentry',
          type: 'warning',
        });

      case 'performance':
        // Test performance monitoring by simulating slow operation
        const startTime = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
        const duration = Date.now() - startTime;

        captureSentryMessage(
          `🧪 Performance test: Operation took ${duration}ms`,
          'info',
          { duration, testType: 'performance' }
        );

        return NextResponse.json({
          success: true,
          message: 'Performance test completed',
          duration,
        });

      case 'context':
        // Test with additional context
        Sentry.setContext('test_context', {
          customData: 'test-value',
          timestamp: new Date().toISOString(),
          userId,
        });

        captureSentryMessage(
          '🧪 Test message with custom context',
          'info'
        );

        return NextResponse.json({
          success: true,
          message: 'Context test completed',
          context: { userId },
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown test type' },
          { status: 400 }
        );
    }
  } catch (error) {
    // Capture to Sentry with full context
    captureApiError(error, {
      endpoint: '/api/debug/sentry-test',
      method: 'POST',
      testEndpoint: true,
    });

    console.error(`${ICONS.ERROR} Sentry test error:`, error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Test error occurred',
        errorType: 'test_error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for simple test without payload
 * GET /api/debug/sentry-test
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const type = searchParams.get('type') || 'error';

    // Redirect to POST handler
    const body = JSON.stringify({ type });
    const postRequest = new NextRequest(request, { method: 'POST', body });

    return POST(postRequest);
  } catch (error) {
    captureApiError(error, {
      endpoint: '/api/debug/sentry-test',
      method: 'GET',
    });

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
