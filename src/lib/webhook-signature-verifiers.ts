/**
 * ================================================================
 * WEBHOOK SIGNATURE VERIFICATION
 * ================================================================
 * Verifies webhook signatures from multiple payment providers
 * using HMAC-SHA256 and provider-specific verification methods
 */

import { createHmac } from 'crypto';
import { ICONS } from './icons';
import { log, logError } from '@/lib/services/logger';

/**
 * Verify Stripe webhook signature
 * Stripe uses HMAC-SHA256 with format: t=timestamp,v1=signature
 *
 * @param headers HTTP headers from request
 * @param body Raw request body (NOT parsed JSON)
 * @returns true if signature is valid
 */
export function verifyStripeSignature(headers: Record<string, string>, body: string): boolean {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      log.warn({ msg: "${ICONS.WARNING} STRIPE_WEBHOOK_SECRET not configured", component: "webhookSignatureVerifiers" });
      return false;
    }

    const signature = headers['stripe-signature'];
    if (!signature) {
      log.warn({ msg: "${ICONS.WARNING} Missing stripe-signature header", component: "webhookSignatureVerifiers" });
      return false;
    }

    // Parse signature header: t=timestamp,v1=signature
    const parts = signature.split(',').reduce((acc, part) => {
      const [key, value] = part.split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    const timestamp = parts.t;
    const providedSignature = parts.v1;

    if (!timestamp || !providedSignature) {
      log.warn({ msg: "${ICONS.WARNING} Invalid stripe-signature format", component: "webhookSignatureVerifiers" });
      return false;
    }

    // Prevent replay attacks (timestamp should be recent)
    const now = Math.floor(Date.now() / 1000);
    const diff = now - parseInt(timestamp);
    if (diff > 300) { // 5 minutes
      log.warn({ msg: "${ICONS.WARNING} Stripe webhook timestamp too old: ${diff}s", component: "webhookSignatureVerifiers" });
      return false;
    }

    // Compute expected signature: HMAC-SHA256(timestamp.body, secret)
    const signedContent = `${timestamp}.${body}`;
    const computedSignature = createHmac('sha256', secret)
      .update(signedContent)
      .digest('hex');

    const isValid = computedSignature === providedSignature;

    if (!isValid) {
      log.warn({ msg: "${ICONS.WARNING} Stripe signature mismatch", component: "webhookSignatureVerifiers" });
      console.debug(`Expected: ${computedSignature}`);
      console.debug(`Received: ${providedSignature}`);
    } else {
      log.info({ msg: "${ICONS.SUCCESS} Stripe signature verified", component: "webhookSignatureVerifiers" });
    }

    return isValid;

  } catch (error) {
    logError(`${ICONS.ERROR} Error verifying Stripe signature:`, "error", { component: "webhookSignatureVerifiers" });
    return false;
  }
}

/**
 * Verify MercadoPago webhook signature
 * MercadoPago uses HMAC-SHA256 in x-signature header
 *
 * @param headers HTTP headers from request
 * @param body Raw request body
 * @returns true if signature is valid
 */
export function verifyMercadoPagoSignature(headers: Record<string, string>, body: string): boolean {
  try {
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    if (!secret) {
      log.warn({ msg: "${ICONS.WARNING} MERCADOPAGO_WEBHOOK_SECRET not configured", component: "webhookSignatureVerifiers" });
      return false;
    }

    const signature = headers['x-signature'];
    if (!signature) {
      log.warn({ msg: "${ICONS.WARNING} Missing x-signature header for MercadoPago", component: "webhookSignatureVerifiers" });
      return false;
    }

    // MercadoPago signature format: timestamp,v1=signature
    const parts = signature.split(',').reduce((acc, part) => {
      const [key, value] = part.split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    const timestamp = parts.timestamp;
    const providedSignature = parts.v1;

    if (!timestamp || !providedSignature) {
      log.warn({ msg: "${ICONS.WARNING} Invalid MercadoPago x-signature format", component: "webhookSignatureVerifiers" });
      return false;
    }

    // Compute signature: HMAC-SHA256(id.timestamp, secret)
    // For MercadoPago, we need to extract the resource ID from the body
    let resourceId = '';
    try {
      const data = JSON.parse(body);
      resourceId = data.id || data.resource?.id || '';
    } catch {
      log.warn({ msg: "${ICONS.WARNING} Could not parse MercadoPago body", component: "webhookSignatureVerifiers" });
    }

    const signedContent = `${resourceId}.${timestamp}`;
    const computedSignature = createHmac('sha256', secret)
      .update(signedContent)
      .digest('hex');

    const isValid = computedSignature === providedSignature;

    if (!isValid) {
      log.warn({ msg: "${ICONS.WARNING} MercadoPago signature mismatch", component: "webhookSignatureVerifiers" });
    } else {
      log.info({ msg: "${ICONS.SUCCESS} MercadoPago signature verified", component: "webhookSignatureVerifiers" });
    }

    return isValid;

  } catch (error) {
    logError(`${ICONS.ERROR} Error verifying MercadoPago signature:`, "error", { component: "webhookSignatureVerifiers" });
    return false;
  }
}

/**
 * Verify PagSeguro webhook signature
 * PagSeguro uses HMAC-SHA256 in X-PagSeguro-Signature header
 *
 * @param headers HTTP headers from request
 * @param body Raw request body
 * @returns true if signature is valid
 */
export function verifyPagSeguroSignature(headers: Record<string, string>, body: string): boolean {
  try {
    const secret = process.env.PAGSEGURO_WEBHOOK_SECRET;
    if (!secret) {
      log.warn({ msg: "${ICONS.WARNING} PAGSEGURO_WEBHOOK_SECRET not configured", component: "webhookSignatureVerifiers" });
      return false;
    }

    // PagSeguro uses various header names, try both
    const signature = headers['x-pagseguro-signature'] || headers['X-PagSeguro-Signature'];
    if (!signature) {
      log.warn({ msg: "${ICONS.WARNING} Missing PagSeguro signature header", component: "webhookSignatureVerifiers" });
      return false;
    }

    // Compute signature: HMAC-SHA256(body, secret)
    const computedSignature = createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    const isValid = computedSignature === signature;

    if (!isValid) {
      log.warn({ msg: "${ICONS.WARNING} PagSeguro signature mismatch", component: "webhookSignatureVerifiers" });
    } else {
      log.info({ msg: "${ICONS.SUCCESS} PagSeguro signature verified", component: "webhookSignatureVerifiers" });
    }

    return isValid;

  } catch (error) {
    logError(`${ICONS.ERROR} Error verifying PagSeguro signature:`, "error", { component: "webhookSignatureVerifiers" });
    return false;
  }
}

/**
 * Verify Pix webhook signature (Brazilian instant payment)
 * Uses HMAC-SHA256 in x-signature header
 *
 * @param headers HTTP headers from request
 * @param body Raw request body
 * @returns true if signature is valid
 */
export function verifyPixSignature(headers: Record<string, string>, body: string): boolean {
  try {
    const secret = process.env.PIX_WEBHOOK_SECRET;
    if (!secret) {
      log.warn({ msg: "${ICONS.WARNING} PIX_WEBHOOK_SECRET not configured", component: "webhookSignatureVerifiers" });
      return false;
    }

    const signature = headers['x-signature'];
    if (!signature) {
      log.warn({ msg: "${ICONS.WARNING} Missing x-signature header for Pix", component: "webhookSignatureVerifiers" });
      return false;
    }

    // Pix uses simple HMAC-SHA256 of body
    const computedSignature = createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    const isValid = computedSignature === signature;

    if (!isValid) {
      log.warn({ msg: "${ICONS.WARNING} Pix signature mismatch", component: "webhookSignatureVerifiers" });
    } else {
      log.info({ msg: "${ICONS.SUCCESS} Pix signature verified", component: "webhookSignatureVerifiers" });
    }

    return isValid;

  } catch (error) {
    logError(`${ICONS.ERROR} Error verifying Pix signature:`, "error", { component: "webhookSignatureVerifiers" });
    return false;
  }
}

/**
 * Generic HMAC-SHA256 verification (fallback for custom providers)
 *
 * @param body Raw request body
 * @param providedSignature Signature from header
 * @param secret Shared secret
 * @returns true if signature matches
 */
export function verifyGenericHmacSignature(
  body: string,
  providedSignature: string,
  secret: string
): boolean {
  try {
    const computedSignature = createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    return computedSignature === providedSignature;
  } catch (error) {
    logError(`${ICONS.ERROR} Error in generic HMAC verification:`, "error", { component: "webhookSignatureVerifiers" });
    return false;
  }
}

/**
 * Map of provider names to their verification functions
 */
export const SIGNATURE_VERIFIERS = {
  stripe: verifyStripeSignature,
  mercadopago: verifyMercadoPagoSignature,
  pagseguro: verifyPagSeguroSignature,
  pix: verifyPixSignature,
} as const;

/**
 * Get the appropriate verifier function for a provider
 */
export function getSignatureVerifier(
  provider: string
): ((_headers: Record<string, string>, _body: string) => boolean) | null {
  const verifier = SIGNATURE_VERIFIERS[provider.toLowerCase() as keyof typeof SIGNATURE_VERIFIERS];
  return verifier || null;
}
