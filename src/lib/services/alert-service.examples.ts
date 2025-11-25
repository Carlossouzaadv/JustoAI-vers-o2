/**
 * ================================================================
 * ALERT SERVICE - USAGE EXAMPLES & TESTS
 * Phase 25: Gold Standard Alert System
 * ================================================================
 * This file demonstrates how to use the AlertService in real scenarios.
 * These are NOT Jest tests, but integration examples.
 */

import { alert } from './alert-service';

/**
 * SCENARIO 1: Emergency Refund Failed (Critical Financial Issue)
 * This is the exact scenario from Phase 24 (full/route.ts)
 */
export async function exampleEmergencyRefundFailure() {
  const caseId = 'case-12345';
  const debitTransactionIds = ['txn-001', 'txn-002', 'txn-003'];
  const refundError = new Error('Refund API timeout after 30s');

  await alert.fatal('Reembolso de emergência falhou - créditos podem estar perdidos', {
    component: 'fullAnalysisRoute',
    stage: 'emergencyRefundCatch',
    caseId,
    error: refundError,
    debitTransactionIds,
    context: 'This is a critical financial issue requiring immediate investigation',
  });
}

/**
 * SCENARIO 2: Gemini API Refund Failed
 * API call succeeded but refund after error failed
 */
export async function exampleGeminiErrorRefund() {
  const caseId = 'case-67890';
  const debitTransactionIds = ['txn-004', 'txn-005'];
  const refundError = 'Database connection lost during refund transaction';

  await alert.fatal('Reembolso de créditos falhou após erro da API Gemini', {
    component: 'fullAnalysisRoute',
    stage: 'geminiErrorRefund',
    caseId,
    error: refundError,
    debitTransactionIds,
  });
}

/**
 * SCENARIO 3: Main Catch - Emergency Refund Failure
 * Unexpected error in analysis + refund also failed
 */
export async function exampleMainCatchEmergencyRefund() {
  const caseId = 'case-99999';
  const debitTransactionIds = ['txn-006', 'txn-007', 'txn-008', 'txn-009'];
  const originalError = new Error('Prisma transaction deadlock');
  const refundError = new Error('Credit manager service unavailable');

  await alert.fatal('Reembolso de emergência falhou durante catch geral', {
    component: 'fullAnalysisRoute',
    stage: 'mainCatchEmergencyRefund',
    caseId,
    error: refundError,
    debitTransactionIds,
    originalError: String(originalError),
    context: 'Unexpected error occurred and emergency refund attempt also failed',
  });
}

/**
 * EXPECTED SLACK OUTPUT
 * ================================================================
 *
 * When alert.fatal() is called, it sends to Slack with this format:
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │ 🚨 FATAL Alert                                          │
 * ├─────────────────────────────────────────────────────────┤
 * │ Reembolso de emergência falhou - créditos podem estar   │
 * │ perdidos                                                │
 * ├─────────────────────────────────────────────────────────┤
 * │ Component: fullAnalysisRoute                            │
 * │ Case ID: case-12345                                     │
 * │ Debit Transactions: txn-001, txn-002, txn-003           │
 * │                                                         │
 * │ Error:                                                  │
 * │ ```                                                     │
 * │ Refund API timeout after 30s                            │
 * │ ```                                                     │
 * │                                                         │
 * │ Additional Context:                                     │
 * │ • stage: emergencyRefundCatch                           │
 * │ • context: This is a critical financial issue...       │
 * ├─────────────────────────────────────────────────────────┤
 * │ 2025-11-17T13:45:00Z · Environment: production          │
 * └─────────────────────────────────────────────────────────┘
 *
 * SIMULTANEOUSLY (non-blocking):
 * 1. Alert is sent to Slack via webhook (immediate, 100ms)
 * 2. Full log is sent to Better Stack via LoggerService (batched)
 * 3. Both go to Vercel logs automatically
 */

/**
 * INTEGRATION POINTS IN CODEBASE
 * ================================================================
 *
 * The AlertService is integrated at 3 critical points in:
 * apps/server/src/app/api/process/[id]/analysis/full/route.ts
 *
 * POINT 1 (Line ~219-225): Gemini API fails, refund fails
 * ────────────────────────────────────────────────────────
 * try {
 *   analysisRaw = await gemini.generateJsonContent(prompt, {...});
 * } catch (geminiError) {
 *   // ... if refund fails:
 *   await alert.fatal("Reembolso de créditos falhou após erro da API Gemini", {...});
 * }
 *
 * POINT 2 (Line ~347-355): Main catch block, emergency refund fails
 * ────────────────────────────────────────────────────────────────
 * } catch (_error) {
 *   // ... if emergency refund fails:
 *   await alert.fatal("Reembolso de emergência falhou durante catch geral", {...});
 * }
 *
 * POINT 3 (Line ~358-365): Emergency refund catch block
 * ────────────────────────────────────────────────────
 * } catch (refundError) {
 *   await alert.fatal("Reembolso de emergência falhou - créditos podem estar perdidos", {...});
 * }
 */

/**
 * HOW IT WORKS (FLOW)
 * ================================================================
 *
 * 1. DEVELOPER CALLS:
 *    await alert.fatal("Message", { component, error, context, ... })
 *
 * 2. ALERT SERVICE:
 *    ├─ Log to Better Stack (via LoggerService)
 *    │  └─ Adds level: "fatal" for high priority
 *    │
 *    └─ Send to Slack (non-blocking via setImmediate)
 *       ├─ Build Slack Block Kit JSON
 *       ├─ POST to SLACK_ALERT_WEBHOOK_URL
 *       └─ Log any Slack failures to Better Stack (graceful)
 *
 * 3. OBSERVABILITY:
 *    ├─ Better Stack: Full structured logs with context
 *    ├─ Slack: Real-time notification (3am alert!)
 *    ├─ Vercel: Automatic stdout capture
 *    └─ Sentry: Error tracking (via captureApiError)
 *
 * 4. NO BLOCKING:
 *    ├─ Slack sends happen in setImmediate()
 *    ├─ API response returns before Slack completes
 *    └─ Failures in Slack don't crash the app
 */
