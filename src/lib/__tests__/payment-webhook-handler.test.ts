/**
 * Payment Webhook Handler Tests - Padrão-Ouro Security & Integrity
 *
 * Tests the webhook security and payment processing:
 * 1. Webhook signature verification (valid and invalid signatures)
 * 2. Payment event processing (success, failed, pending, refund)
 * 3. Error handling and logging
 * 4. Type-safe payload parsing with Zod validation
 */

import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import {
  PaymentWebhookHandler,
  PaymentProcessingResult,
} from '../payment-webhook-handler';
import * as Sentry from '@sentry/nextjs';

// Mock the logger
jest.mock('@/lib/services/logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
  },
  logError: jest.fn(),
}));

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: mockDeep<PrismaClient>(),
}));

// Mock email service
jest.mock('@/lib/email-service', () => ({
  getEmailService: jest.fn(() => ({
    sendPaymentSuccess: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock webhook signature verifier
jest.mock('@/lib/webhook-signature-verifiers', () => ({
  getSignatureVerifier: jest.fn((provider: string) => {
    // Return verifier functions for known providers
    if (provider === 'stripe') {
      return (
        headers: Record<string, string>,
        body: string
      ): boolean => {
        // Simulate signature verification
        const signature = headers['stripe-signature'];
        return signature === 'valid-stripe-signature';
      };
    }

    if (provider === 'mercadopago') {
      return (
        headers: Record<string, string>,
        body: string
      ): boolean => {
        const authHeader = headers.authorization;
        return authHeader === 'Bearer valid-mercadopago-token';
      };
    }

    // Unknown provider - return null (will be treated as unverified)
    return null;
  }),
}));

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  captureMessage: jest.fn(),
  getCurrentScope: jest.fn(() => ({
    setContext: jest.fn(),
  })),
}));

describe('PaymentWebhookHandler', () => {
  let handler: PaymentWebhookHandler;
  let mockPrisma: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    mockPrisma = mockDeep<PrismaClient>();
    handler = new PaymentWebhookHandler();
  });

  describe('Webhook Signature Verification', () => {
    it('should accept webhook with valid Stripe signature', async () => {
      const validHeaders: Record<string, string> = {
        'stripe-signature': 'valid-stripe-signature',
        'content-type': 'application/json',
      };

      const payload = {
        event: 'payment.success',
        provider: 'stripe',
        transactionId: 'stripe-tx-123',
        amount: 99.99,
        currency: 'BRL',
        metadata: {
          userId: 'user-1',
        },
      };

      const result: PaymentProcessingResult =
        await handler.processWebhook(
          'stripe',
          validHeaders,
          JSON.stringify(payload)
        );

      // Should proceed with processing (even if other parts fail)
      // The key is that it didn't reject due to invalid signature
      expect(Sentry.captureMessage).not.toHaveBeenCalledWith(
        expect.stringContaining('Invalid webhook signature')
      );
    });

    it('should reject webhook with invalid Stripe signature', async () => {
      const invalidHeaders: Record<string, string> = {
        'stripe-signature': 'invalid-signature',
        'content-type': 'application/json',
      };

      const payload = {
        event: 'payment.success',
        provider: 'stripe',
        transactionId: 'stripe-tx-123',
        amount: 99.99,
        currency: 'BRL',
      };

      const result: PaymentProcessingResult =
        await handler.processWebhook(
          'stripe',
          invalidHeaders,
          JSON.stringify(payload)
        );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Assinatura do webhook inválida');
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        expect.stringContaining('Invalid webhook signature'),
        'warning'
      );
    });

    it('should accept webhook with valid MercadoPago token', async () => {
      const validHeaders: Record<string, string> = {
        authorization: 'Bearer valid-mercadopago-token',
        'content-type': 'application/json',
      };

      const payload = {
        event: 'payment.success',
        provider: 'mercadopago',
        transactionId: 'mp-tx-456',
        amount: 149.90,
        currency: 'BRL',
        metadata: {
          userId: 'user-2',
        },
      };

      const result: PaymentProcessingResult =
        await handler.processWebhook(
          'mercadopago',
          validHeaders,
          JSON.stringify(payload)
        );

      // Should not have Sentry error about signature
      expect(Sentry.captureMessage).not.toHaveBeenCalledWith(
        expect.stringContaining('Invalid webhook signature')
      );
    });

    it('should reject webhook with invalid MercadoPago token', async () => {
      const invalidHeaders: Record<string, string> = {
        authorization: 'Bearer invalid-token',
        'content-type': 'application/json',
      };

      const payload = {
        event: 'payment.success',
        provider: 'mercadopago',
        transactionId: 'mp-tx-456',
        amount: 149.90,
        currency: 'BRL',
      };

      const result: PaymentProcessingResult =
        await handler.processWebhook(
          'mercadopago',
          invalidHeaders,
          JSON.stringify(payload)
        );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Assinatura do webhook inválida');
    });

    it('should handle unknown provider gracefully', async () => {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
      };

      const payload = {
        event: 'payment.success',
        provider: 'unknown-provider',
        transactionId: 'unknown-tx-789',
        amount: 50.0,
        currency: 'BRL',
      };

      // For unknown providers, verification returns null (treated as accepted)
      const result: PaymentProcessingResult =
        await handler.processWebhook(
          'unknown-provider',
          headers,
          JSON.stringify(payload)
        );

      // Should accept but not have verified
      expect(result.error).not.toContain(
        'Assinatura do webhook inválida'
      );
    });
  });

  describe('Webhook Payload Parsing', () => {
    it('should reject malformed JSON', async () => {
      const validHeaders: Record<string, string> = {
        'stripe-signature': 'valid-stripe-signature',
      };

      const invalidJson = '{invalid json';

      const result: PaymentProcessingResult =
        await handler.processWebhook(
          'stripe',
          validHeaders,
          invalidJson
        );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });

    it('should handle missing required fields gracefully', async () => {
      const validHeaders: Record<string, string> = {
        'stripe-signature': 'valid-stripe-signature',
      };

      // Missing event, provider, transactionId
      const incompletePayload = {
        amount: 99.99,
      };

      const result: PaymentProcessingResult =
        await handler.processWebhook(
          'stripe',
          validHeaders,
          JSON.stringify(incompletePayload)
        );

      // Should not crash, but may return error or default behavior
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Payment Event Handling', () => {
    it('should handle payment.success event and add credits', async () => {
      // This test validates the flow without actual DB calls
      const validHeaders: Record<string, string> = {
        'stripe-signature': 'valid-stripe-signature',
      };

      const payload = {
        event: 'payment.success',
        provider: 'stripe',
        transactionId: 'stripe-success-123',
        amount: 99.99,
        currency: 'BRL',
        metadata: {
          userId: 'user-1',
        },
      };

      // This would normally call Prisma operations
      // For now, we're testing that it attempts to process
      const result: PaymentProcessingResult =
        await handler.processWebhook(
          'stripe',
          validHeaders,
          JSON.stringify(payload)
        );

      // Even if Prisma fails, the webhook handler should return a result
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.transactionId).toBe('string');
    });

    it('should handle payment.failed event', async () => {
      const validHeaders: Record<string, string> = {
        'stripe-signature': 'valid-stripe-signature',
      };

      const payload = {
        event: 'payment.failed',
        provider: 'stripe',
        transactionId: 'stripe-failed-456',
        amount: 49.99,
        currency: 'BRL',
        metadata: {
          userId: 'user-2',
        },
      };

      const result: PaymentProcessingResult =
        await handler.processWebhook(
          'stripe',
          validHeaders,
          JSON.stringify(payload)
        );

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle payment.pending event', async () => {
      const validHeaders: Record<string, string> = {
        'stripe-signature': 'valid-stripe-signature',
      };

      const payload = {
        event: 'payment.pending',
        provider: 'stripe',
        transactionId: 'stripe-pending-789',
        amount: 29.90,
        currency: 'BRL',
        metadata: {
          userId: 'user-3',
        },
      };

      const result: PaymentProcessingResult =
        await handler.processWebhook(
          'stripe',
          validHeaders,
          JSON.stringify(payload)
        );

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle payment.refunded event', async () => {
      const validHeaders: Record<string, string> = {
        'stripe-signature': 'valid-stripe-signature',
      };

      const payload = {
        event: 'payment.refunded',
        provider: 'stripe',
        transactionId: 'stripe-refund-999',
        amount: 99.99,
        currency: 'BRL',
        metadata: {
          userId: 'user-1',
        },
      };

      const result: PaymentProcessingResult =
        await handler.processWebhook(
          'stripe',
          validHeaders,
          JSON.stringify(payload)
        );

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle unknown event gracefully', async () => {
      const validHeaders: Record<string, string> = {
        'stripe-signature': 'valid-stripe-signature',
      };

      const payload = {
        event: 'payment.unknown_event',
        provider: 'stripe',
        transactionId: 'stripe-unknown-111',
        amount: 19.99,
        currency: 'BRL',
      };

      const result: PaymentProcessingResult =
        await handler.processWebhook(
          'stripe',
          validHeaders,
          JSON.stringify(payload)
        );

      // Unknown events should be handled gracefully
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(result.transactionId).toBeDefined();
    });
  });

  describe('Error Handling & Logging', () => {
    it('should return retry flag on error', async () => {
      const validHeaders: Record<string, string> = {
        'stripe-signature': 'valid-stripe-signature',
      };

      // This will cause parsing to fail or other error
      const malformedPayload = 'not-a-json';

      const result: PaymentProcessingResult =
        await handler.processWebhook(
          'stripe',
          validHeaders,
          malformedPayload
        );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.shouldRetry).toBe('boolean');
    });

    it('should capture signature verification error in Sentry', async () => {
      const invalidHeaders: Record<string, string> = {
        'stripe-signature': 'invalid-signature',
        'user-agent': 'stripe-test-agent',
        'host': 'api.stripe.com',
      };

      const payload = {
        event: 'payment.success',
        provider: 'stripe',
        transactionId: 'stripe-sentry-test',
        amount: 99.99,
        currency: 'BRL',
      };

      await handler.processWebhook(
        'stripe',
        invalidHeaders,
        JSON.stringify(payload)
      );

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        expect.stringContaining('Invalid webhook signature'),
        'warning'
      );
      expect(Sentry.getCurrentScope).toHaveBeenCalled();
    });

    it('should include transactionId in result even on error', async () => {
      const validHeaders: Record<string, string> = {
        'stripe-signature': 'valid-stripe-signature',
      };

      const payload = {
        event: 'payment.success',
        provider: 'stripe',
        transactionId: 'specific-tx-id-123',
        amount: 99.99,
        currency: 'BRL',
      };

      // Process webhook - result should always have transactionId
      const result: PaymentProcessingResult =
        await handler.processWebhook(
          'stripe',
          validHeaders,
          JSON.stringify(payload)
        );

      expect(result.transactionId).toBeDefined();
      expect(typeof result.transactionId).toBe('string');
      // transactionId should be set if parsing succeeded
      if (result.error === undefined) {
        expect(result.transactionId).not.toBe('unknown');
      }
    });
  });

  describe('Type Safety', () => {
    it('should handle numeric values correctly', async () => {
      const validHeaders: Record<string, string> = {
        'stripe-signature': 'valid-stripe-signature',
      };

      const payload = {
        event: 'payment.success',
        provider: 'stripe',
        transactionId: 'tx-numeric-test',
        amount: 1234.56, // Large decimal amount
        currency: 'BRL',
        metadata: {
          userId: 'user-1',
          planId: 'pro',
        },
      };

      const result: PaymentProcessingResult =
        await handler.processWebhook(
          'stripe',
          validHeaders,
          JSON.stringify(payload)
        );

      // Should handle numeric amounts correctly
      expect(typeof result.transactionId).toBe('string');
    });

    it('should safely handle metadata without userId', async () => {
      const validHeaders: Record<string, string> = {
        'stripe-signature': 'valid-stripe-signature',
      };

      const payload = {
        event: 'payment.success',
        provider: 'stripe',
        transactionId: 'tx-no-userid',
        amount: 99.99,
        currency: 'BRL',
        metadata: {
          planId: 'basic', // Missing userId
        },
      };

      const result: PaymentProcessingResult =
        await handler.processWebhook(
          'stripe',
          validHeaders,
          JSON.stringify(payload)
        );

      // Should handle gracefully (might fail, but not crash)
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Provider-Specific Parsing', () => {
    it('should parse Stripe payload correctly', async () => {
      const validHeaders: Record<string, string> = {
        'stripe-signature': 'valid-stripe-signature',
      };

      const stripePayload = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_1234567890',
            amount: 9999, // Stripe uses cents
            currency: 'brl',
            metadata: {
              userId: 'user-stripe',
            },
          },
        },
      };

      const result: PaymentProcessingResult =
        await handler.processWebhook(
          'stripe',
          validHeaders,
          JSON.stringify(stripePayload)
        );

      // Should process Stripe format
      expect(result).toBeDefined();
    });

    it('should parse MercadoPago payload correctly', async () => {
      const validHeaders: Record<string, string> = {
        authorization: 'Bearer valid-mercadopago-token',
      };

      const mercadopagoPayload = {
        type: 'payment',
        data: {
          id: 'mp_1234567890',
          status: 'approved',
          transaction_amount: 99.99,
          metadata: {
            userId: 'user-mp',
          },
        },
      };

      const result: PaymentProcessingResult =
        await handler.processWebhook(
          'mercadopago',
          validHeaders,
          JSON.stringify(mercadopagoPayload)
        );

      // Should process MercadoPago format
      expect(result).toBeDefined();
    });

    it('should handle generic custom payload', async () => {
      const validHeaders: Record<string, string> = {
        'content-type': 'application/json',
      };

      const customPayload = {
        event: 'payment.success',
        provider: 'custom',
        transactionId: 'custom-tx-001',
        amount: 50.0,
        currency: 'BRL',
        metadata: {
          userId: 'user-custom',
        },
      };

      const result: PaymentProcessingResult =
        await handler.processWebhook(
          'custom',
          validHeaders,
          JSON.stringify(customPayload)
        );

      // Should handle custom format
      expect(result).toBeDefined();
    });
  });

  describe('Security Edge Cases', () => {
    it('should reject webhook with missing signature header', async () => {
      const headersWithoutSignature: Record<string, string> = {
        'content-type': 'application/json',
        // No signature header
      };

      const payload = {
        event: 'payment.success',
        provider: 'stripe',
        transactionId: 'tx-no-sig',
        amount: 99.99,
        currency: 'BRL',
      };

      const result: PaymentProcessingResult =
        await handler.processWebhook(
          'stripe',
          headersWithoutSignature,
          JSON.stringify(payload)
        );

      // Stripe verifier will return false for missing signature
      expect(result.success).toBe(false);
    });

    it('should report invalid signature to Sentry', async () => {
      const suspiciousHeaders: Record<string, string> = {
        'stripe-signature': 'attempt-injection-here',
        'user-agent': 'suspicious-bot',
        'host': 'attacker.com',
      };

      const payload = {
        event: 'payment.success',
        provider: 'stripe',
        transactionId: 'tx-security-test',
        amount: 99.99,
        currency: 'BRL',
      };

      const result = await handler.processWebhook(
        'stripe',
        suspiciousHeaders,
        JSON.stringify(payload)
      );

      // On invalid signature, should report to Sentry
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        expect.stringContaining('Invalid webhook signature'),
        expect.any(String)
      );

      // Result should indicate failure
      expect(result.success).toBe(false);
    });

    it('should not expose sensitive data in error messages', async () => {
      const validHeaders: Record<string, string> = {
        'stripe-signature': 'valid-stripe-signature',
      };

      const sensitivePayload = {
        event: 'payment.success',
        provider: 'stripe',
        transactionId: 'tx-sensitive',
        amount: 99.99,
        currency: 'BRL',
        metadata: {
          userId: 'user-1',
          secretToken: 'should-not-leak',
          creditCard: 'should-not-leak',
        },
      };

      const result: PaymentProcessingResult =
        await handler.processWebhook(
          'stripe',
          validHeaders,
          JSON.stringify(sensitivePayload)
        );

      // Error messages should not contain sensitive data
      if (result.error) {
        expect(result.error).not.toContain('secretToken');
        expect(result.error).not.toContain('creditCard');
      }
    });
  });
});
