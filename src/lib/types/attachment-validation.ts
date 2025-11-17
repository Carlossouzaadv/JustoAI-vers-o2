/**
 * ========================================================================
 * Attachment Validation Types
 * Mandato Inegociável: 100% Type Safe
 * ========================================================================
 */

export type ValidationFailureReason =
  | 'ZERO_BYTE'
  | 'INVALID_TYPE'
  | 'CORRUPTED'
  | 'PASSWORD_PROTECTED';

export interface ValidationResult {
  isValid: boolean;
  reason?: ValidationFailureReason;
  details?: string;
  checkedAt: Date;
}

export interface AttachmentMetadata {
  size: number;
  magicNumber: string; // First bytes in hex (e.g., "25504446" for %PDF)
  pages?: number;
  isEncrypted?: boolean;
}

export interface ValidationReport {
  attachmentId: string;
  attachmentName: string;
  result: ValidationResult;
  metadata?: AttachmentMetadata;
}

/**
 * Type guard to check if value is a valid ValidationFailureReason
 */
export function isValidationFailureReason(
  value: unknown
): value is ValidationFailureReason {
  if (typeof value !== 'string') {
    return false;
  }
  return ['ZERO_BYTE', 'INVALID_TYPE', 'CORRUPTED', 'PASSWORD_PROTECTED'].includes(
    value
  );
}

/**
 * Type guard to check if value is a ValidationResult
 */
export function isValidationResult(value: unknown): value is ValidationResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (typeof obj.isValid !== 'boolean') {
    return false;
  }

  if (
    obj.reason !== undefined &&
    !isValidationFailureReason(obj.reason)
  ) {
    return false;
  }

  if (obj.details !== undefined && typeof obj.details !== 'string') {
    return false;
  }

  if (!(obj.checkedAt instanceof Date)) {
    return false;
  }

  return true;
}
