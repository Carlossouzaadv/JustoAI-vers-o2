// ================================================================
// EXTERNAL API TYPES - Zod Validation Schemas
// ================================================================
// Runtime validation for JUDIT API and Payment Webhook payloads
// Provides type-safe parsing with runtime validation
//
// Usage:
//   const result = JuditRequestPayloadSchema.parse(unknownData);
//   type JuditRequest = z.infer<typeof JuditRequestPayloadSchema>;
//

import { z } from 'zod';

// ================================================================
// JUDIT API SCHEMAS
// ================================================================

/**
 * JUDIT Search Configuration
 * Specifies the type and parameters for the legal process search
 */
export const JuditSearchPayloadSchema = z.object({
  search_type: z.literal('lawsuit_cnj'),
  search_key: z.string(),
  on_demand: z.boolean().default(true),
});

export type JuditSearchPayload = z.infer<typeof JuditSearchPayloadSchema>;

/**
 * JUDIT Request Payload
 * Complete request structure sent to JUDIT API
 */
export const JuditRequestPayloadSchema = z.object({
  search: JuditSearchPayloadSchema,
  with_attachments: z.boolean().default(true),
  callback_url: z.string().url().optional(),
  cache_ttl_in_days: z.number().int().min(0).max(365).default(7),
});

export type JuditRequestPayload = z.infer<typeof JuditRequestPayloadSchema>;

/**
 * JUDIT Request Status
 * Possible states for a JUDIT process request
 */
export const JuditRequestStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);
export type JuditRequestStatus = z.infer<typeof JuditRequestStatusSchema>;

/**
 * JUDIT Request Response (Initial)
 * Immediate response from JUDIT API when request is accepted
 */
export const JuditRequestResponseSchema = z.object({
  request_id: z.string().uuid(),
  status: JuditRequestStatusSchema,
  all_pages_count: z.number().int().optional(),
  page: z.number().int().optional(),
  data: z.record(z.unknown()).optional(),
}).passthrough();

export type JuditRequestResponse = z.infer<typeof JuditRequestResponseSchema>;

/**
 * JUDIT Process Complete Data
 * Full process data returned via webhook or final response
 */
export const JuditProcessCompleteDataSchema = z.object({
  numeroCnj: z.string().optional(),
  dataOnboarding: z.string().datetime().optional(),
  status: z.string().optional(),
  parties: z.array(z.string()).optional(),
  movements: z.array(z.unknown()).optional(),
}).passthrough();

export type JuditProcessCompleteData = z.infer<typeof JuditProcessCompleteDataSchema>;

/**
 * JUDIT Alert Metadata
 * Metadata for JUDIT webhook alerts and notifications
 */
export const JuditAlertMetadataSchema = z.object({
  numeroCnj: z.string().optional(),
  requestId: z.string().optional(),
  trackingId: z.string().optional(),
  jobId: z.string().optional(),
  customData: z.record(z.unknown()).optional(),
}).passthrough();

export type JuditAlertMetadata = z.infer<typeof JuditAlertMetadataSchema>;

// ================================================================
// PAYMENT WEBHOOK SCHEMAS
// ================================================================

/**
 * Payment Event Type
 * All possible payment webhook events
 */
export const PaymentEventTypeSchema = z.enum([
  'payment.success',
  'payment.failed',
  'payment.pending',
  'payment.refunded',
]);

export type PaymentEventType = z.infer<typeof PaymentEventTypeSchema>;

/**
 * Payment Provider Type
 * Supported payment providers
 */
export const PaymentProviderSchema = z.enum([
  'stripe',
  'mercadopago',
  'pagseguro',
  'pix',
  'custom',
]);

export type PaymentProvider = z.infer<typeof PaymentProviderSchema>;

/**
 * Payment Metadata
 * Custom metadata associated with payment
 */
export const PaymentMetadataSchema = z.object({
  userId: z.string().optional(),
  planId: z.string().optional(),
  credits: z.number().int().optional(),
}).passthrough();

export type PaymentMetadata = z.infer<typeof PaymentMetadataSchema>;

/**
 * Generic Payment Webhook Payload
 * Normalized structure for all payment providers
 */
export const PaymentWebhookPayloadSchema = z.object({
  provider: PaymentProviderSchema,
  event: PaymentEventTypeSchema,
  transactionId: z.string(),
  amount: z.number().min(0),
  currency: z.string().length(3).toUpperCase(),
  metadata: PaymentMetadataSchema.optional(),
  rawPayload: z.unknown().optional(),
});

export type PaymentWebhookPayload = z.infer<typeof PaymentWebhookPayloadSchema>;

/**
 * Stripe Webhook Event Data
 * Event object from Stripe webhook
 */
export const StripeEventDataSchema = z.object({
  object: z.object({
    id: z.string(),
    amount: z.number().int(),
    currency: z.string(),
    metadata: z.record(z.unknown()).optional(),
  }).passthrough(),
}).passthrough();

/**
 * Stripe Webhook Payload
 * Full Stripe webhook event
 */
export const StripeWebhookSchema = z.object({
  type: z.string(),
  data: StripeEventDataSchema,
}).passthrough();

export type StripeWebhook = z.infer<typeof StripeWebhookSchema>;

/**
 * MercadoPago Webhook Payload
 * MercadoPago webhook event structure
 */
export const MercadoPagoWebhookSchema = z.object({
  id: z.string().optional(),
  status: z.enum(['approved', 'rejected', 'pending', 'refunded']).optional(),
  transaction_amount: z.number().optional(),
  currency_id: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  data: z.object({
    id: z.string().optional(),
    status: z.string().optional(),
    transaction_amount: z.number().optional(),
  }).passthrough().optional(),
}).passthrough();

export type MercadoPagoWebhook = z.infer<typeof MercadoPagoWebhookSchema>;

/**
 * PagSeguro Webhook Payload
 * PagSeguro webhook event structure
 */
export const PagSeguroWebhookSchema = z.object({
  id: z.string().optional(),
  amount: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
}).passthrough();

export type PagSeguroWebhook = z.infer<typeof PagSeguroWebhookSchema>;

// ================================================================
// WEBHOOK DELIVERY PAYLOAD SCHEMAS
// ================================================================

/**
 * Generic Webhook Delivery Payload
 * Structure for delivering webhook data internally
 */
export const WebhookDeliveryPayloadSchema = z.object({
  eventType: z.string().optional(),
  processNumber: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  data: z.record(z.unknown()).optional(),
}).passthrough();

export type WebhookDeliveryPayload = z.infer<typeof WebhookDeliveryPayloadSchema>;

// ================================================================
// VALIDATION UTILITY FUNCTIONS
// ================================================================

/**
 * Format ZodError into readable message
 */
function formatZodError(error: z.ZodError<unknown>): string {
  if ('issues' in error && Array.isArray(error.issues)) {
    return error.issues
      .map(issue => {
        const path = 'path' in issue ? (issue.path as (string | number)[]).join('.') : 'root';
        const message = 'message' in issue ? (issue.message as string) : 'Validation error';
        return `${path || 'root'}: ${message}`;
      })
      .join('; ');
  }
  return 'Validation error';
}

/**
 * Safely parse and validate JUDIT request payload
 * Returns Either-like structure for error handling
 */
export function parseJuditRequest(
  data: unknown
): { success: true; data: JuditRequestPayload } | { success: false; error: string } {
  try {
    const parsed = JuditRequestPayloadSchema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: formatZodError(error) };
    }
    const message = error instanceof Error ? error.message : 'Unknown validation error';
    return { success: false, error: message };
  }
}

/**
 * Safely parse and validate payment webhook payload
 */
export function parsePaymentWebhook(
  data: unknown
): { success: true; data: PaymentWebhookPayload } | { success: false; error: string } {
  try {
    const parsed = PaymentWebhookPayloadSchema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: formatZodError(error) };
    }
    const message = error instanceof Error ? error.message : 'Unknown validation error';
    return { success: false, error: message };
  }
}

/**
 * Safely parse Stripe webhook event
 */
export function parseStripeWebhook(
  data: unknown
): { success: true; data: StripeWebhook } | { success: false; error: string } {
  try {
    const parsed = StripeWebhookSchema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: formatZodError(error) };
    }
    const message = error instanceof Error ? error.message : 'Unknown validation error';
    return { success: false, error: message };
  }
}

/**
 * Safely parse MercadoPago webhook event
 */
export function parseMercadoPagoWebhook(
  data: unknown
): { success: true; data: MercadoPagoWebhook } | { success: false; error: string } {
  try {
    const parsed = MercadoPagoWebhookSchema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: formatZodError(error) };
    }
    const message = error instanceof Error ? error.message : 'Unknown validation error';
    return { success: false, error: message };
  }
}

/**
 * Safely parse JUDIT process response
 */
export function parseJuditResponse(
  data: unknown
): { success: true; data: JuditRequestResponse } | { success: false; error: string } {
  try {
    const parsed = JuditRequestResponseSchema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: formatZodError(error) };
    }
    const message = error instanceof Error ? error.message : 'Unknown validation error';
    return { success: false, error: message };
  }
}
