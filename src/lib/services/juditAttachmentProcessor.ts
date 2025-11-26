
// ================================================================
// JUDIT ATTACHMENT PROCESSOR
// Download e processamento de anexos da API JUDIT
// ================================================================

import { prisma } from '@/lib/prisma';
import { ICONS } from '@/lib/icons';
import { extractTextFromPDF } from '@/lib/pdf-processor';
import { validateAttachment } from './attachment-validation-service';
import { createHash } from 'crypto';
import { TimelineSource } from '@/lib/types/database';
import { log, logError } from '@/lib/services/logger';

// ================================================================
// TYPES
// ================================================================

/**
 * Type Guard: Validar se data é um objeto com estrutura de resposta JUDIT
 */
function isJuditResponseObject(data: unknown): data is Record<string, unknown> {
  return (
    typeof data === 'object' &&
    data !== null &&
    (('attachments' in data && Array.isArray((data as Record<string, unknown>).attachments)) ||
     ('pages' in data && Array.isArray((data as Record<string, unknown>).pages)) ||
     ('data' in data && typeof (data as Record<string, unknown>).data === 'object'))
  );
}

// Valores válidos para DocumentType conforme Prisma schema
const VALID_DOCUMENT_TYPES = ['PETITION', 'MOTION', 'COURT_ORDER', 'JUDGMENT', 'APPEAL', 'AGREEMENT', 'EVIDENCE', 'OTHER'] as const;

/**
 * Type Guard: Validar se valor é um DocumentType válido
 * Retorna uma assertion que o valor é um membro do tipo literal union
 */
function isValidDocumentType(value: unknown): value is typeof VALID_DOCUMENT_TYPES[number] {
  return typeof value === 'string' && VALID_DOCUMENT_TYPES.includes(value as typeof VALID_DOCUMENT_TYPES[number]);
}

export interface JuditAttachment {
  id: string;
  attachment_id: string; // ID fornecido pela API JUDIT
  name: string;
  type: string;
  extension?: string;
  size?: number;
  date?: string;
  step_id?: string;
}

export interface AttachmentProcessResult {
  total: number;
  downloaded: number;
  processed: number;
  failed: number;
  errors: string[];
}

// ================================================================
// CONSTANTS
// ================================================================

const MAX_CONCURRENT_DOWNLOADS = 5;
const DOWNLOAD_TIMEOUT_MS = 60000; // 60s por arquivo
const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024; // 50MB

// ================================================================
// MAIN FUNCTION
// ================================================================

/**
 * Processa todos os anexos de uma resposta JUDIT
 * Download paralelo + extração de texto + salvamento no banco
 */
export async function processJuditAttachments(
  caseId: string,
  juditResponse: unknown,
  cnj_code?: string,
  instance?: number
): Promise<AttachmentProcessResult> {
  const result: AttachmentProcessResult = {
    total: 0,
    downloaded: 0,
    processed: 0,
    failed: 0,
    errors: []
  };

  try {
    log.info({
      msg: 'Starting attachment processing',
      component: 'juditAttachmentProcessor',
      caseId: caseId,
    });

    // ============================================================
    // 1. EXTRAIR LISTA DE ANEXOS
    // ============================================================

    const attachments = extractAttachmentsFromJuditResponse(juditResponse);

    result.total = attachments.length;

    if (attachments.length === 0) {
      log.info({
        msg: 'No attachments found',
        component: 'juditAttachmentProcessor',
        caseId: caseId,
      });
      return result;
    }

    log.info({
      msg: 'Attachments extracted',
      component: 'juditAttachmentProcessor',
      caseId: caseId,
      attachmentCount: attachments.length,
    });

    // Guard: validar se temos cnj_code e instance para baixar
    if (!cnj_code || instance === undefined) {
      log.warn({
        msg: 'CNJ code or instance not provided - cannot download attachments',
        component: 'juditAttachmentProcessor',
        caseId: caseId,
        cnj_code: cnj_code,
        instance: instance,
      });
      return result;
    }

    // ============================================================
    // 2. DOWNLOAD PARALELO (máx 5 por vez)
    // ============================================================

    const downloadPromises = [];

    for (let i = 0; i < attachments.length; i += MAX_CONCURRENT_DOWNLOADS) {
      const batch = attachments.slice(i, i + MAX_CONCURRENT_DOWNLOADS);

      const batchPromises = batch.map(attachment =>
        downloadAndProcessAttachment(caseId, attachment, result, cnj_code, instance)
      );

      downloadPromises.push(...batchPromises);
    }

    await Promise.allSettled(downloadPromises);

    log.info({
      msg: 'Attachment processing completed',
      component: 'juditAttachmentProcessor',
      caseId: caseId,
      processed: result.processed,
      total: result.total,
      failed: result.failed,
    });

    return result;

  } catch (error) {
    logError(error, 'General _error in attachment processing', {
      component: 'juditAttachmentProcessor',
      caseId: caseId,
      processedCount: result.processed,
      failedCount: result.failed,
    });
    result.errors.push(error instanceof Error ? error.message : 'Erro desconhecido');
    return result;
  }
}

// ================================================================
// HELPER FUNCTIONS
// ================================================================

/**
 * Extrai lista de anexos do response JUDIT
 * A estrutura pode variar, ajustar conforme API real
 */
function extractAttachmentsFromJuditResponse(juditResponse: unknown): JuditAttachment[] {
  const attachments: JuditAttachment[] = [];

  try {
    // Guard: validar se juditResponse existe
    if (!juditResponse) {
      return attachments;
    }

    // Estrutura esperada (ajustar conforme API JUDIT real):
    // juditResponse.data.attachments[] ou similar

    // Narrowing: Primeiro tenta juditResponse.data, depois juditResponse
    let data: unknown = null;
    if (typeof juditResponse === 'object' && juditResponse !== null && 'data' in juditResponse) {
      data = (juditResponse as Record<string, unknown>).data;
    } else {
      data = juditResponse;
    }

    // Type Guard: Validar que data tem estrutura correta
    if (!isJuditResponseObject(data)) {
      return attachments;
    }

    // Agora data é Record<string, unknown> e podemos acessar propriedades com segurança
    if ('attachments' in data && Array.isArray(data.attachments)) {
      for (const att of data.attachments) {
        // A API JUDIT retorna: attachment_id, attachment_name, extension, status, attachment_date, step_id
        if (typeof att === 'object' && att !== null) {
          const attachment = att as Record<string, unknown>;
          attachments.push({
            id: (attachment.attachment_id || attachment.id) as string || 'unknown',
            attachment_id: String(attachment.attachment_id || 'unknown'),
            name: String(attachment.attachment_name || attachment.name || attachment.filename || 'anexo-sem-nome'),
            type: classifyDocumentByName(String(attachment.attachment_name || attachment.name || '')),
            extension: String(attachment.extension || 'pdf'),
            size: typeof attachment.size === 'number' ? attachment.size : undefined,
            date: typeof attachment.attachment_date === 'string' ? attachment.attachment_date : typeof attachment.date === 'string' ? attachment.date : typeof attachment.created_at === 'string' ? attachment.created_at : undefined,
            step_id: typeof attachment.step_id === 'string' ? attachment.step_id : undefined
          });
        }
      }
    }

    // Verificar se há attachments em páginas (paginação)
    if ('pages' in data && Array.isArray(data.pages)) {
      for (const page of data.pages) {
        if (typeof page === 'object' && page !== null && 'attachments' in page && Array.isArray((page as Record<string, unknown>).attachments)) {
          const pageAttachments = (page as Record<string, unknown>).attachments as unknown[];
          for (const att of pageAttachments) {
            if (typeof att === 'object' && att !== null) {
              const attachment = att as Record<string, unknown>;
              attachments.push({
                id: (attachment.attachment_id || attachment.id) as string || 'unknown',
                attachment_id: String(attachment.attachment_id || 'unknown'),
                name: String(attachment.attachment_name || attachment.name || attachment.filename || 'anexo-sem-nome'),
                type: classifyDocumentByName(String(attachment.attachment_name || attachment.name || '')),
                extension: String(attachment.extension || 'pdf'),
                size: typeof attachment.size === 'number' ? attachment.size : undefined,
                date: typeof attachment.attachment_date === 'string' ? attachment.attachment_date : typeof attachment.date === 'string' ? attachment.date : typeof attachment.created_at === 'string' ? attachment.created_at : undefined,
                step_id: typeof attachment.step_id === 'string' ? attachment.step_id : undefined
              });
            }
          }
        }
      }
    }

  } catch (error) {
    logError(error, 'Error extracting attachments from JUDIT response', {
      component: 'extractAttachmentsFromJuditResponse',
    });
  }

  return attachments;
}

/**
 * Download e processa um único anexo
 */
async function downloadAndProcessAttachment(
  caseId: string,
  attachment: JuditAttachment,
  result: AttachmentProcessResult,
  cnj_code: string,
  instance: number
): Promise<void> {
  try {
    log.info({
      msg: 'Starting attachment download',
      component: 'downloadAndProcessAttachment',
      attachmentId: attachment.attachment_id,
      attachmentName: attachment.name,
      caseId: caseId,
    });

    // ============================================================
    // 1. CONSTRUIR URL DE DOWNLOAD (usando API JUDIT)
    // ============================================================

    // Rota: GET /lawsuits/{cnj_code}/{instance}/attachments/{attachment_id}
    const downloadUrl = `https://lawsuits.production.judit.io/lawsuits/${cnj_code}/${instance}/attachments/${attachment.attachment_id}`;

    // Obter API key da JUDIT
    const juditApiKey = process.env.JUDIT_API_KEY;
    if (!juditApiKey) {
      throw new Error('JUDIT_API_KEY não configurada - não é possível baixar anexos');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

    const response = await fetch(downloadUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/pdf,application/octet-stream,*/*',
        'api-key': juditApiKey
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText} ao baixar de ${downloadUrl}`);
    }

    // Verificar tamanho
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_ATTACHMENT_SIZE) {
      throw new Error(`Arquivo muito grande: ${contentLength} bytes`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    result.downloaded++;

    log.info({
      msg: 'Attachment downloaded successfully',
      component: 'downloadAndProcessAttachment',
      attachmentName: attachment.name,
      attachmentSize: buffer.length,
      attachmentId: attachment.attachment_id,
      caseId: caseId,
    });

    // ============================================================
    // 2. ⭐ VALIDAÇÃO (PORTÃO DE FERRO - Fase 21)
    // ============================================================
    // Valida o anexo ANTES de qualquer processamento adicional
    // Se falhar: logar erro + criar timeline entry (NÃO enfileirar IA)

    const fileType = attachment.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'doc';
    const validationResult = await validateAttachment(buffer, attachment.name, fileType);

    if (!validationResult.isValid) {
      log.warn({
        msg: 'Attachment validation failed',
        component: 'downloadAndProcessAttachment',
        attachmentId: attachment.attachment_id,
        attachmentName: attachment.name,
        caseId: caseId,
        validationReason: validationResult.reason,
        validationDetails: validationResult.details,
      });

      // Incrementar falhas
      result.failed++;

      // Adicionar mensagem de erro ao resultado
      const errorMsg = `[Validação] ${attachment.name}: ${validationResult.reason || 'Desconhecido'} - ${validationResult.details || ''}`;
      result.errors.push(errorMsg);

      // ⭐ CRIAR TIMELINE ENTRY VISÍVEL PARA O ADVOGADO
      await createAttachmentValidationFailureTimeline(
        caseId,
        attachment,
        validationResult
      );

      // NÃO CONTINUAR - pular enfileiramento de IA
      return;
    }

    log.info({
      msg: 'Attachment validation passed',
      component: 'downloadAndProcessAttachment',
      attachmentId: attachment.attachment_id,
      attachmentName: attachment.name,
      caseId: caseId,
    });

    // ============================================================
    // 4. VERIFICAR SE JÁ FOI BAIXADO DA JUDIT (Deduplicação)
    // ============================================================
    // Para anexos JUDIT: usar attachment_id como chave única (NÃO usar hash)
    // Razão: Cada anexo da API JUDIT tem um ID único
    //        Andamentos antigos não são re-processados → anexos antigos nunca são baixados novamente
    //        "Relatório/Voto" é o mesmo nome em vários processos, mas são arquivos diferentes (IDs diferentes)
    // NÃO calcular SHA256 para JUDIT - seria desnecessário overhead

    const juditAttachmentUrl = `attachment_${attachment.attachment_id}`;
    const existingJuditAttachment = await prisma.caseDocument.findFirst({
      where: { juditAttachmentUrl }
    });

    if (existingJuditAttachment) {
      log.warn({
        msg: 'JUDIT attachment already downloaded - skipping',
        component: 'downloadAndProcessAttachment',
        attachmentId: attachment.attachment_id,
        attachmentName: attachment.name,
        caseId: caseId,
      });
      // NÃO incrementar downloaded novamente - o arquivo não foi baixado agora
      // (apenas reutilizando um já existente)
      result.processed++;
      return;
    }

    // ============================================================
    // 5. SALVAR ARQUIVO TEMPORARIAMENTE
    // ============================================================

    // Sanitizar nome do arquivo: remover / e caracteres inválidos para evitar path traversal
    // Preservar acentos e caracteres especiais legítimos em português
    const sanitizedName = attachment.name
      .replace(/\//g, '_') // Substituir / por _
      .replace(/\\/g, '_') // Substituir \ por _
      .replace(/[\x00-\x1f\x7f]/g, '_') // Remover caracteres de controle apenas
      .replace(/[\\/:"*?<>|]/g, '_') // Remover caracteres inválidos para filesystem
      .substring(0, 255); // Limitar tamanho do nome (max filename length em NTFS/ext4)

    const tempPath = `/tmp/judit-attachment-${Date.now()}-${sanitizedName}`;
    const fs = await import('fs/promises');
    await fs.writeFile(tempPath, buffer);

    // ============================================================
    // 6. EXTRAIR TEXTO (se PDF)
    // ============================================================

    let extractedText = '';

    if (attachment.name.toLowerCase().endsWith('.pdf')) {
      try {
        const extractionResult = await extractTextFromPDF(tempPath);

        // Narrowing: ExtractionResult é um objeto com propriedade 'text: string'
        if (typeof extractionResult === 'object' &&
            extractionResult !== null &&
            'text' in extractionResult &&
            typeof extractionResult.text === 'string' &&
            extractionResult.text.length > 0) {
          extractedText = extractionResult.text;
          log.info({
            msg: 'Text extracted from PDF',
            component: 'downloadAndProcessAttachment',
            attachmentName: attachment.name,
            extractedCharCount: extractedText.length,
            attachmentId: attachment.attachment_id,
            caseId: caseId,
          });
        }
      } catch (error) {
        log.warn({
          msg: 'Failed to extract text from PDF',
          component: 'downloadAndProcessAttachment',
          attachmentName: attachment.name,
          attachmentId: attachment.attachment_id,
          caseId: caseId,
          _error: _error instanceof Error ? _error.message : String(_error),
        });
      }
    }

    // ============================================================
    // 7. CLASSIFICAR TIPO DE DOCUMENTO
    // ============================================================

    const classifiedType = classifyDocumentByName(attachment.name);

    // Narrowing: Validar que o tipo classificado é um DocumentType válido
    if (!isValidDocumentType(classifiedType)) {
      // Se não for válido, usar 'OTHER' como fallback
      throw new Error(`Tipo de documento inválido: ${classifiedType}`);
    }

    // Agora classifiedType é garantido ser um dos valores válidos
    const documentType = classifiedType;

    // ============================================================
    // 8. SALVAR NO BANCO
    // ============================================================

    const createdDoc = await prisma.caseDocument.create({
      data: {
        caseId,
        name: sanitizedName.replace(/\.(pdf|PDF)$/, ''),
        originalName: attachment.name,
        type: documentType,
        mimeType: attachment.extension === 'pdf' ? 'application/pdf' : 'application/octet-stream',
        size: buffer.length,
        url: `/api/documents/${undefined}/download`, // Será atualizado abaixo com o ID correto
        path: tempPath,
        extractedText: extractedText || null,
        textSha: null, // JUDIT attachments não usam hash - usam attachment_id como chave única
        textExtractedAt: extractedText ? new Date() : null,
        processed: true,
        ocrStatus: extractedText ? 'COMPLETED' : 'PENDING',
        sourceOrigin: 'JUDIT_ATTACHMENT',
        juditAttachmentUrl // Usa a variável definida acima (attachment_${attachment.attachment_id})
      }
    });

    // Atualizar URL com o ID do documento criado
    await prisma.caseDocument.update({
      where: { id: createdDoc.id },
      data: {
        url: `/api/documents/${createdDoc.id}/download`
      }
    });

    result.processed++;

    log.info({
      msg: 'Attachment saved to database',
      component: 'downloadAndProcessAttachment',
      attachmentName: sanitizedName,
      attachmentId: attachment.attachment_id,
      documentId: createdDoc.id,
      caseId: caseId,
      size: buffer.length,
      hasExtractedText: !!extractedText,
    });

  } catch (error) {
    result.failed++;
    const errorMsg = `Erro em ${attachment.name}: ${_error instanceof Error ? _error.message : 'Desconhecido'}`;
    result.errors.push(errorMsg);
    logError(error, 'Error processing attachment', {
      component: 'downloadAndProcessAttachment',
      attachmentName: attachment.name,
      attachmentId: attachment.attachment_id,
      caseId: caseId,
    });
  }
}

/**
 * Classifica tipo de documento baseado no nome
 * Heurística simples para identificar peças principais
 */
function classifyDocumentByName(filename: string): string {
  const lower = filename.toLowerCase();

  // Petição inicial
  if (lower.includes('inicial') || lower.includes('peticao') || lower.includes('petição')) {
    return 'PETITION';
  }

  // Contestação
  if (lower.includes('contestacao') || lower.includes('contestação') || lower.includes('defesa')) {
    return 'MOTION';
  }

  // Decisão
  if (lower.includes('decisao') || lower.includes('decisão') || lower.includes('despacho')) {
    return 'COURT_ORDER';
  }

  // Sentença
  if (lower.includes('sentenca') || lower.includes('sentença')) {
    return 'JUDGMENT';
  }

  // Recurso
  if (lower.includes('recurso') || lower.includes('apelacao') || lower.includes('apelação')) {
    return 'APPEAL';
  }

  // Acordo
  if (lower.includes('acordo') || lower.includes('transacao') || lower.includes('transação')) {
    return 'AGREEMENT';
  }

  // Prova
  if (lower.includes('prova') || lower.includes('documento') || lower.includes('evidencia')) {
    return 'EVIDENCE';
  }

  return 'OTHER';
}

/**
 * ========================================================================
 * HELPER: Criar Timeline Entry para Falha de Validação
 * ========================================================================
 * Cria uma ProcessTimelineEntry visível ao advogado quando anexo falha validação
 * Mensagem clara e acionável
 */
async function createAttachmentValidationFailureTimeline(
  caseId: string,
  attachment: JuditAttachment,
  validationResult: { isValid: boolean; reason?: string; details?: string }
): Promise<void> {
  try {
    // Extrair reason com type safety
    const reason = validationResult.reason;

    if (!reason || !['ZERO_BYTE', 'INVALID_TYPE', 'CORRUPTED', 'PASSWORD_PROTECTED'].includes(reason)) {
      log.warn({
        msg: 'Invalid validation failure reason',
        component: 'createAttachmentValidationFailureTimeline',
        caseId: caseId,
        attachmentId: attachment.attachment_id,
        attachmentName: attachment.name,
        reason: reason,
      });
      return;
    }

    // Mapear ValidationFailureReason para mensagem legível em PT
    const reasonMessages: Record<string, string> = {
      ZERO_BYTE: 'O arquivo está vazio (0 bytes)',
      INVALID_TYPE: 'O arquivo não é um PDF válido (type inválido)',
      CORRUPTED: 'O arquivo PDF está corrompido ou danificado',
      PASSWORD_PROTECTED: 'O arquivo PDF está protegido por senha e não pode ser lido',
    };

    const reasonMsg = reasonMessages[reason] || 'Motivo desconhecido';

    // Criar descrição clara e acionável
    const description = `Falha na Análise de IA: O anexo "${attachment.name}" não pôde ser processado. Motivo: ${reasonMsg}.`;

    // Hash para deduplicação (evitar múltiplas entradas do mesmo erro)
    const contentHash = createHash('sha256')
      .update(`validation-failure-${attachment.attachment_id}-${reason}`)
      .digest('hex');

    // Criar ou atualizar entry de timeline
    await prisma.processTimelineEntry.upsert({
      where: {
        caseId_contentHash: { caseId, contentHash },
      },
      create: {
        caseId,
        contentHash,
        eventDate: new Date(),
        eventType: 'ATTACHMENT_VALIDATION_FAILED',
        description,
        normalizedContent: `validation-failure-${reason}`,
        source: 'SYSTEM_IMPORT',
        sourceId: `attachment-validation-${attachment.attachment_id}`,
        confidence: 1.0, // Certeza de 100% (é um erro de validação)
        contributingSources: ['SYSTEM_IMPORT'] as TimelineSource[],
        originalTexts: {
          SYSTEM_IMPORT: description,
        },
        metadata: {
          attachmentId: attachment.attachment_id,
          attachmentName: attachment.name,
          validationReason: reason,
          validationDetails: validationResult.details,
        },
      },
      update: {
        eventDate: new Date(), // Atualizar timestamp se já existir
      },
    });

    log.info({
      msg: 'Timeline entry created for validation failure',
      component: 'createAttachmentValidationFailureTimeline',
      caseId: caseId,
      attachmentId: attachment.attachment_id,
      attachmentName: attachment.name,
      validationReason: reason,
    });
  } catch (error) {
    // Se falhar criar timeline, logar mas não falhar o job
    logError(error, 'Failed to create validation failure timeline entry', {
      component: 'createAttachmentValidationFailureTimeline',
      caseId: caseId,
      attachmentId: attachment.attachment_id,
      attachmentName: attachment.name,
    });
  }
}
