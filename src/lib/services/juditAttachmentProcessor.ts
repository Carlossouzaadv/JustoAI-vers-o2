// ================================================================
// JUDIT ATTACHMENT PROCESSOR
// Download e processamento de anexos da API JUDIT
// ================================================================

import { prisma } from '@/lib/prisma';
import { ICONS } from '@/lib/icons';
import { extractTextFromPDF } from '@/lib/pdf-processor';
import { getDocumentHashManager } from '@/lib/document-hash';

// ================================================================
// TYPES
// ================================================================

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
  juditResponse: any,
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
    console.log(`${ICONS.PROCESS} [JUDIT Attachments] Processando anexos para case ${caseId}`);

    // ============================================================
    // 1. EXTRAIR LISTA DE ANEXOS
    // ============================================================

    const attachments = extractAttachmentsFromJuditResponse(juditResponse);

    result.total = attachments.length;

    if (attachments.length === 0) {
      console.log(`${ICONS.INFO} [JUDIT Attachments] Nenhum anexo encontrado`);
      return result;
    }

    console.log(`${ICONS.INFO} [JUDIT Attachments] ${attachments.length} anexos encontrados`);

    // Guard: validar se temos cnj_code e instance para baixar
    if (!cnj_code || instance === undefined) {
      console.warn(`${ICONS.WARNING} [JUDIT Attachments] CNJ code ou instance não fornecidos - não é possível baixar anexos`);
      console.log(`${ICONS.INFO} [JUDIT Attachments] cnj_code: ${cnj_code}, instance: ${instance}`);
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

    console.log(`${ICONS.SUCCESS} [JUDIT Attachments] Processamento completo: ${result.processed}/${result.total} processados`);

    return result;

  } catch (error) {
    console.error(`${ICONS.ERROR} [JUDIT Attachments] Erro geral:`, error);
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
function extractAttachmentsFromJuditResponse(juditResponse: any): JuditAttachment[] {
  const attachments: JuditAttachment[] = [];

  try {
    // Guard: validar se juditResponse existe
    if (!juditResponse) {
      return attachments;
    }

    // Estrutura esperada (ajustar conforme API JUDIT real):
    // juditResponse.data.attachments[] ou similar

    const data = juditResponse?.data || juditResponse;

    // Guard: validar se data é objeto antes de acessar propriedades
    if (!data || typeof data !== 'object') {
      return attachments;
    }

    if (data.attachments && Array.isArray(data.attachments)) {
      for (const att of data.attachments) {
        // A API JUDIT retorna: attachment_id, attachment_name, extension, status, attachment_date, step_id
        attachments.push({
          id: att.attachment_id || att.id,
          attachment_id: att.attachment_id,
          name: att.attachment_name || att.name || att.filename || 'anexo-sem-nome',
          type: classifyDocumentByName(att.attachment_name || att.name || ''),
          extension: att.extension || 'pdf',
          size: att.size,
          date: att.attachment_date || att.date || att.created_at,
          step_id: att.step_id
        });
      }
    }

    // Verificar se há attachments em páginas (paginação)
    if (data.pages && Array.isArray(data.pages)) {
      for (const page of data.pages) {
        if (page.attachments && Array.isArray(page.attachments)) {
          for (const att of page.attachments) {
            attachments.push({
              id: att.attachment_id || att.id,
              attachment_id: att.attachment_id,
              name: att.attachment_name || att.name || att.filename || 'anexo-sem-nome',
              type: classifyDocumentByName(att.attachment_name || att.name || ''),
              extension: att.extension || 'pdf',
              size: att.size,
              date: att.attachment_date || att.date || att.created_at,
              step_id: att.step_id
            });
          }
        }
      }
    }

  } catch (error) {
    console.error(`${ICONS.ERROR} [JUDIT Attachments] Erro ao extrair anexos:`, error);
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
    console.log(`${ICONS.DOWNLOAD} [JUDIT Attachments] Baixando: ${attachment.name} (ID: ${attachment.attachment_id})`);

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

    console.log(`${ICONS.SUCCESS} [JUDIT Attachments] Baixado: ${attachment.name} (${buffer.length} bytes)`);

    // ============================================================
    // 2. CALCULAR HASH
    // ============================================================

    const hashManager = getDocumentHashManager();
    const { textSha: fileSha256 } = hashManager.calculateSHA256(buffer);

    // ============================================================
    // 2.5. VERIFICAR SE JÁ FOI BAIXADO DA JUDIT
    // ============================================================
    // Para anexos JUDIT: usar attachment_id como chave única (não hash)
    // Razão: Cada anexo da API JUDIT tem um ID único
    //        Andamentos antigos não são re-processados → anexos antigos nunca são baixados novamente
    //        "Relatório/Voto" é o mesmo nome em vários processos, mas são arquivos diferentes (IDs diferentes)

    const juditAttachmentUrl = `attachment_${attachment.attachment_id}`;
    const existingJuditAttachment = await prisma.caseDocument.findFirst({
      where: { juditAttachmentUrl }
    });

    if (existingJuditAttachment) {
      console.log(`${ICONS.WARNING} [JUDIT Attachments] Anexo JUDIT já baixado (ID: ${attachment.attachment_id}): ${attachment.name}`);
      result.downloaded++; // Contar como "já processado"
      return;
    }

    // ============================================================
    // 3. SALVAR ARQUIVO TEMPORARIAMENTE
    // ============================================================

    // Sanitizar nome do arquivo: remover / e caracteres inválidos para evitar path traversal
    const sanitizedName = attachment.name
      .replace(/\//g, '_') // Substituir / por _
      .replace(/\\/g, '_') // Substituir \ por _
      .replace(/[^\w\s\-\.]/g, '_') // Remover caracteres especiais (manter apenas word chars, espaço, hífen, ponto)
      .substring(0, 200); // Limitar tamanho do nome

    const tempPath = `/tmp/judit-attachment-${Date.now()}-${sanitizedName}`;
    const fs = await import('fs/promises');
    await fs.writeFile(tempPath, buffer);

    // ============================================================
    // 4. EXTRAIR TEXTO (se PDF)
    // ============================================================

    let extractedText = '';

    if (attachment.name.toLowerCase().endsWith('.pdf')) {
      try {
        extractedText = await extractTextFromPDF(tempPath);
        console.log(`${ICONS.EXTRACT} [JUDIT Attachments] Texto extraído: ${extractedText.length} chars`);
      } catch (error) {
        console.warn(`${ICONS.WARNING} [JUDIT Attachments] Falha ao extrair texto:`, error);
      }
    }

    // ============================================================
    // 5. CLASSIFICAR TIPO DE DOCUMENTO
    // ============================================================

    const documentType = classifyDocumentByName(attachment.name);

    // ============================================================
    // 6. SALVAR NO BANCO
    // ============================================================

    await prisma.caseDocument.create({
      data: {
        caseId,
        name: sanitizedName.replace(/\.(pdf|PDF)$/, ''),
        originalName: attachment.name,
        type: documentType as any,
        mimeType: attachment.extension === 'pdf' ? 'application/pdf' : 'application/octet-stream',
        size: buffer.length,
        url: tempPath, // TODO: substituir por S3
        path: tempPath,
        extractedText: extractedText || null,
        textSha: fileSha256,
        textExtractedAt: extractedText ? new Date() : null,
        processed: true,
        ocrStatus: extractedText ? 'COMPLETED' : 'PENDING',
        sourceOrigin: 'JUDIT_ATTACHMENT',
        juditAttachmentUrl // Usa a variável definida acima (attachment_${attachment.attachment_id})
      }
    });

    result.processed++;

    console.log(`${ICONS.SUCCESS} [JUDIT Attachments] Salvo no banco: ${sanitizedName}`);

  } catch (error) {
    result.failed++;
    const errorMsg = `Erro em ${attachment.name}: ${error instanceof Error ? error.message : 'Desconhecido'}`;
    result.errors.push(errorMsg);
    console.error(`${ICONS.ERROR} [JUDIT Attachments] ${errorMsg}`);
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
