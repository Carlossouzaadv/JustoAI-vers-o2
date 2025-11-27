/**
 * ========================================================================
 * ATTACHMENT VALIDATION SERVICE
 * Fase 21: Padrão-Ouro - Validação de Anexos da API JUDIT
 *
 * Filosofia: Nunca enfileirar um job de análise IA para um anexo inválido.
 * Devemos validar o anexo no exato momento do download, antes que o
 * deep-analysis-service seja acionado.
 * ========================================================================
 */

import { ICONS } from '@/lib/icons';
import { PDFDocument } from 'pdf-lib';
import { logError } from '@/lib/services/logger';
import {
  ValidationFailureReason,
  ValidationResult,
  AttachmentMetadata,
} from '@/lib/types/attachment-validation';

/**
 * ========================================================================
 * CONSTANTS
 * ========================================================================
 */

const MAGIC_NUMBERS = {
  PDF: Buffer.from('%PDF', 'utf-8'), // 0x25 0x50 0x44 0x46
};

const MAX_PDF_LOAD_TIMEOUT = 5000; // 5 segundos para carregar PDF
const MIN_VALID_PDF_SIZE = 100; // Mínimo 100 bytes para PDF válido

/**
 * ========================================================================
 * TYPE GUARDS - 100% Mandato Inegociável
 * ========================================================================
 */

/**
 * Type Guard: Verifica se o erro é um erro de PDF corrompido/não-parseável
 */
function isPdfLoadError(error: unknown): error is Error {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('pdf') ||
    message.includes('corrupt') ||
    message.includes('syntax') ||
    message.includes('parse') ||
    message.includes('timeout')
  );
}

/**
 * ========================================================================
 * MAIN VALIDATION FUNCTION
 * ========================================================================
 */

/**
 * Valida um anexo antes de enviar para IA
 *
 * Checklist:
 * 1. ZERO-BYTE: Buffer vazio?
 * 2. INVALID-TYPE: Magic number não corresponde ao tipo?
 * 3. CORRUPTED: PDF corrompido ou não-parseável?
 * 4. PASSWORD-PROTECTED: PDF protegido por senha?
 *
 * @param buffer - Dados brutos do arquivo
 * @param filename - Nome do arquivo (para logging)
 * @param fileType - Tipo esperado ('pdf' ou 'doc')
 * @returns ValidationResult com resultado da validação
 */
export async function validateAttachment(
  buffer: Buffer,
  _filename: string,
  fileType: 'pdf' | 'doc' = 'pdf'
): Promise<ValidationResult> {
  const startTime = Date.now();

  try {
    // Validation starting - info logged below

    // ================================================================
    // CHECK 1: ZERO-BYTE
    // ================================================================

    const zeroByteCheck = checkZeroByte(buffer);
    if (!zeroByteCheck.isValid) {
      return zeroByteCheck;
    }

    // ================================================================
    // CHECK 2: MAGIC NUMBER (INVALID TYPE)
    // ================================================================

    const magicNumberCheck = checkMagicNumber(buffer, fileType);
    if (!magicNumberCheck.isValid) {
      return magicNumberCheck;
    }

    // ================================================================
    // CHECK 3: CORRUPTION + PASSWORD (PDF-specific)
    // ================================================================

    if (fileType === 'pdf') {
      const pdfCheck = await checkPdfIntegrity(buffer);
      if (!pdfCheck.isValid) {
        return pdfCheck;
      }
    }

    // ================================================================
    // ALL CHECKS PASSED ✅
    // ================================================================

    const result: ValidationResult = {
      isValid: true,
      checkedAt: new Date(),
    };

    const _elapsedMs = Date.now() - startTime;

    return result;

  } catch (error) {
    // Erro inesperado durante validação
    const errorMsg = error instanceof Error ? error.message : String(error);
    logError(errorMsg, '${ICONS.ERROR} AttachmentValidation Erro inesperado:', { component: 'refactored' });

    return {
      isValid: false,
      reason: 'CORRUPTED', // Fallback seguro
      details: `Erro durante validação: ${errorMsg}`,
      checkedAt: new Date(),
    };
  }
}

/**
 * ========================================================================
 * INDIVIDUAL CHECKS (HELPER FUNCTIONS)
 * ========================================================================
 */

/**
 * CHECK 1: Arquivo não está vazio (zero-byte)
 */
function checkZeroByte(buffer: Buffer): ValidationResult {
  if (buffer.length === 0) {
    return {
      isValid: false,
      reason: 'ZERO_BYTE',
      details: 'Arquivo vazio (0 bytes)',
      checkedAt: new Date(),
    };
  }

  return { isValid: true, checkedAt: new Date() };
}

/**
 * CHECK 2: Magic number corresponde ao tipo esperado
 * Não confiamos na extensão - conferimos os primeiros bytes
 */
function checkMagicNumber(buffer: Buffer, fileType: 'pdf' | 'doc'): ValidationResult {
  const magicBytesToCheck = MAGIC_NUMBERS.PDF; // Apenas PDF por enquanto

  // Narrowing: Garantir que temos bytes suficientes
  if (buffer.length < magicBytesToCheck.length) {
    return {
      isValid: false,
      reason: 'INVALID_TYPE',
      details: `Buffer muito pequeno: ${buffer.length} bytes (esperado ${magicBytesToCheck.length}+)`,
      checkedAt: new Date(),
    };
  }

  // Para PDF: comparar %PDF
  if (fileType === 'pdf') {
    const header = buffer.subarray(0, 4).toString('utf-8');
    if (!header.startsWith('%PDF')) {
      return {
        isValid: false,
        reason: 'INVALID_TYPE',
        details: `Header inválido: "${header}" (esperado "%PDF")`,
        checkedAt: new Date(),
      };
    }
  }

  return { isValid: true, checkedAt: new Date() };
}

/**
 * CHECK 3: PDF não está corrompido e não é protegido por senha
 * Usa pdf-lib com timeout
 */
async function checkPdfIntegrity(
  buffer: Buffer
): Promise<ValidationResult> {
  try {
    // Validação de tamanho mínimo
    if (buffer.length < MIN_VALID_PDF_SIZE) {
      return {
        isValid: false,
        reason: 'CORRUPTED',
        details: `PDF muito pequeno: ${buffer.length} bytes (mínimo ${MIN_VALID_PDF_SIZE})`,
        checkedAt: new Date(),
      };
    }

    // Carregar PDF com timeout
    let pdfDoc: PDFDocument | null = null;

    try {
      // Promise com timeout de 5 segundos
      const loadPromise = PDFDocument.load(buffer, {
        ignoreEncryption: false, // Queremos detectar encriptação!
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('PDF load timeout after 5 seconds')),
          MAX_PDF_LOAD_TIMEOUT
        )
      );

      pdfDoc = await Promise.race([loadPromise, timeoutPromise]);

    } catch (error) {
      // Se o erro for "timeout" ou "parse _error" → CORRUPTED
      if (isPdfLoadError(error)) {
        return {
          isValid: false,
          reason: 'CORRUPTED',
          details: `PDF corrompido: ${error instanceof Error ? error.message : String(error)}`,
          checkedAt: new Date(),
        };
      }
      // Se for outro erro → re-throw para catcher externo
      throw error;
    }

    // Se pdfDoc não foi carregado → erro
    if (!pdfDoc) {
      return {
        isValid: false,
        reason: 'CORRUPTED',
        details: 'Falha ao carregar PDF (pdfDoc é nulo)',
        checkedAt: new Date(),
      };
    }

    // Narrowing: Se chegou aqui, pdfDoc é um PDFDocument válido
    // Conferir se é protegido por senha
    const isEncrypted = pdfDoc.isEncrypted;

    if (isEncrypted) {
      return {
        isValid: false,
        reason: 'PASSWORD_PROTECTED',
        details: 'PDF protegido por senha e não pode ser lido',
        checkedAt: new Date(),
      };
    }

    // ✅ PDF válido, não corrompido, não protegido
    return { isValid: true, checkedAt: new Date() };

  } catch (error) {
    // Erro inesperado
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      isValid: false,
      reason: 'CORRUPTED',
      details: `Erro ao validar PDF: ${errorMsg}`,
      checkedAt: new Date(),
    };
  }
}

/**
 * ========================================================================
 * METADATA EXTRACTION
 * ========================================================================
 */

/**
 * Retorna metadados do arquivo (para observabilidade/logging)
 */
export function getAttachmentMetadata(
  buffer: Buffer,
  _filename: string
): AttachmentMetadata {
  // Extract first 8 bytes as hex magic number
  const magicNumber = buffer
    .subarray(0, 8)
    .toString('hex')
    .toUpperCase();

  return {
    size: buffer.length,
    magicNumber,
  };
}

/**
 * ========================================================================
 * UTILITY: Get Failure Reason Message (PT-BR)
 * ========================================================================
 */

/**
 * Traduz ValidationFailureReason para mensagem legível em português
 */
export function getFailureReasonMessage(
  reason: ValidationFailureReason
): string {
  const messages: Record<ValidationFailureReason, string> = {
    ZERO_BYTE: 'O arquivo está vazio (0 bytes)',
    INVALID_TYPE: 'O arquivo não é um PDF válido (type inválido)',
    CORRUPTED: 'O arquivo PDF está corrompido ou danificado',
    PASSWORD_PROTECTED: 'O arquivo PDF está protegido por senha e não pode ser lido',
  };

  return messages[reason];
}
