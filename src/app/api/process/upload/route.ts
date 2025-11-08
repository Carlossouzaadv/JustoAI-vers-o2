// ================================================================
// API ROUTE: POST /api/process/upload
// Novo fluxo de onboarding com Preview (FASE 1)
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';
import { ICONS } from '@/lib/icons';

// API Schema imports (SINGLE SOURCE OF TRUTH)
import {
  ProcessUploadPayloadSchema,
  ProcessUploadPayload,
  parseProcessUpload
} from '@/lib/types/api-schemas';

// Services
import { extractTextFromPDF, ExtractionResult } from '@/lib/pdf-processor';
import { TextCleaner, CleaningResult } from '@/lib/text-cleaner';
import { generatePreview, validatePreviewSnapshot } from '@/lib/services/previewAnalysisService';
import { addOnboardingJob } from '@/lib/queue/juditQueue';
import { getDocumentHashManager } from '@/lib/document-hash';
import { extractPDFMetadata } from '@/lib/services/localPDFMetadataExtractor';
import { updateCaseSummaryDescription } from '@/lib/services/summaryConsolidator';
import { uploadCaseDocument } from '@/lib/services/supabaseStorageService';

// ================================================================
// TYPE GUARDS & NARROWING
// ================================================================

/**
 * Type guard for ExtractionResult - validates structure
 * Safe narrowing: first to Record<string, unknown>, then validate properties
 */
function isExtractionResult(data: unknown): data is ExtractionResult {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  // Safe narrowing to generic object record for property access
  const record = data as Record<string, unknown>;
  return (
    typeof record.text === 'string' &&
    typeof record.method === 'string' &&
    typeof record.success === 'boolean' &&
    typeof record.quality === 'string' &&
    typeof record.originalLength === 'number' &&
    typeof record.processedLength === 'number'
  );
}

/**
 * Type guard for CleaningResult - validates structure
 * Safe narrowing: first to Record<string, unknown>, then validate properties
 */
function isCleaningResult(data: unknown): data is CleaningResult {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  // Safe narrowing to generic object record for property access
  const record = data as Record<string, unknown>;
  return (
    typeof record.cleanedText === 'string' &&
    typeof record.originalLength === 'number' &&
    typeof record.cleanedLength === 'number' &&
    typeof record.reductionPercentage === 'number'
  );
}

/**
 * Helper to get error message safely from unknown
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Erro desconhecido ao processar upload';
}

/**
 * Helper to validate clientId - must be string when provided
 */
function isValidClientId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Valid DocumentType enum values
 */
type DocumentTypeValue = 'PETITION' | 'EVIDENCE' | 'DECISION' | 'MOVEMENT' | 'OTHER';

/**
 * Type guard for DocumentType validation
 */
function isDocumentType(value: unknown): value is DocumentTypeValue {
  return (
    typeof value === 'string' &&
    ['PETITION', 'EVIDENCE', 'DECISION', 'MOVEMENT', 'OTHER'].includes(value)
  );
}

/**
 * Helper to map extracted document type category to DocumentType
 */
function mapToDocumentType(category: unknown): DocumentTypeValue {
  if (isDocumentType(category)) {
    return category;
  }
  return 'OTHER'; // Default fallback
}

/**
 * Helper to build Case creation data with type safety
 * Note: clientId is handled separately because it may be optional in API but required in schema
 */
function buildCaseCreateData(params: {
  workspaceId: string;
  number: string;
  title: string;
  description: string;
  createdById: string;
  detectedCnj: string;
  firstPageText: string;
  clientId: string; // Now required - caller must provide a value (or use workspace default)
}) {
  return {
    workspaceId: params.workspaceId,
    clientId: params.clientId,
    number: params.number,
    title: params.title,
    description: params.description,
    type: 'CIVIL' as const,
    status: 'ACTIVE' as const,
    priority: 'MEDIUM' as const,
    createdById: params.createdById,
    detectedCnj: params.detectedCnj,
    firstPageText: params.firstPageText,
    onboardingStatus: 'created' as const
  };
}

// ================================================================
// CONSTANTS
// ================================================================

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = ['application/pdf'];

// ================================================================
// MAIN HANDLER
// ================================================================

export async function POST(request: NextRequest) {
  const overallStartTime = Date.now();

  try {
    // ============================================================
    // 1. AUTENTICAÇÃO
    // ============================================================

    const user = await getAuthenticatedUser(request);

    if (!user) {
      return unauthorizedResponse('Não autenticado');
    }

    const userId = user.id;

    console.log(`${ICONS.UPLOAD} [Upload] Iniciando upload - User: ${userId}`);

    // ============================================================
    // 2. PARSE FORM DATA & VALIDATE WITH ZOD
    // ============================================================

    const formData = await request.formData();
    const file = formData.get('file');

    // Extract form fields for Zod validation
    const rawPayload = {
      workspaceId: formData.get('workspaceId'),
      manualCnj: formData.get('manualCnj'),
      clientId: formData.get('clientId'),
      skipEnrichment: formData.get('skipEnrichment') === 'true'
    };

    // Validate payload using Zod (SINGLE SOURCE OF TRUTH)
    const parseResult = ProcessUploadPayloadSchema.safeParse(rawPayload);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Payload de upload inválido.',
          details: parseResult.error.flatten()
        },
        { status: 400 }
      );
    }

    // Type-safe payload from Zod validation
    const data: ProcessUploadPayload = parseResult.data;
    const { workspaceId, manualCnj, clientId, skipEnrichment } = data;

    // ============================================================
    // 3. VALIDAÇÕES DO ARQUIVO
    // ============================================================

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'Nenhum arquivo fornecido' },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Apenas arquivos PDF são permitidos' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `Arquivo muito grande. Máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB`
        },
        { status: 400 }
      );
    }

    // ============================================================
    // 4. VALIDAR WORKSPACE
    // ============================================================

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId }
    });

    if (!workspace) {
      return NextResponse.json(
        { success: false, error: 'Workspace não encontrado' },
        { status: 404 }
      );
    }

    console.log(`${ICONS.SUCCESS} [Upload] Validações OK - File: ${file.name} (${(file.size / 1024).toFixed(2)}KB)`);

    // ============================================================
    // 4. SALVAR ARQUIVO TEMPORARIAMENTE
    // ============================================================

    const buffer = Buffer.from(await file.arrayBuffer());
    const tempPath = `/tmp/upload-${Date.now()}-${file.name}`;

    const fs = await import('fs/promises');
    await fs.writeFile(tempPath, buffer);

    console.log(`${ICONS.SAVE} [Upload] Arquivo salvo: ${tempPath}`);

    // ============================================================
    // 5. CALCULAR HASH SHA256
    // ============================================================

    const hashManager = getDocumentHashManager();
    const hashResult = hashManager.calculateSHA256(buffer);
    const fileSha256 = hashResult.textSha;

    console.log(`${ICONS.CLOCK} [Upload] SHA256: ${fileSha256.substring(0, 16)}...`);

    // ============================================================
    // 6. VERIFICAR DUPLICATA
    // ============================================================

    const existingDoc = await prisma.caseDocument.findFirst({
      where: { textSha: fileSha256 },
      include: { case: true }
    });

    if (existingDoc) {
      console.log(`${ICONS.WARNING} [Upload] Documento duplicado encontrado: ${existingDoc.id}`);

      return NextResponse.json({
        success: true,
        isDuplicate: true,
        existingCaseId: existingDoc.caseId,
        existingCaseNumber: existingDoc.case?.number,
        message: 'Este documento já foi enviado anteriormente'
      });
    }

    // ============================================================
    // 7. EXTRAIR TEXTO DO PDF
    // ============================================================

    console.log(`${ICONS.EXTRACT} [Upload] Extraindo texto...`);

    const extractStartTime = Date.now();
    const extractionResult = await extractTextFromPDF(tempPath);
    const extractDuration = Date.now() - extractStartTime;

    // Type guard: validar ExtractionResult
    if (!isExtractionResult(extractionResult)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Resultado inválido da extração de PDF'
        },
        { status: 400 }
      );
    }

    const extractedText = extractionResult.text;

    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Não foi possível extrair texto do PDF. O arquivo pode estar vazio ou protegido.'
        },
        { status: 400 }
      );
    }

    console.log(`${ICONS.SUCCESS} [Upload] Texto extraído: ${extractedText.length} chars em ${extractDuration}ms`);

    // ============================================================
    // 8. LIMPAR E NORMALIZAR TEXTO
    // ============================================================

    const textCleaner = new TextCleaner();
    const cleaningResult = textCleaner.cleanLegalDocument(extractedText);

    // Type guard: validar CleaningResult
    if (!isCleaningResult(cleaningResult)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Erro ao limpar texto do documento'
        },
        { status: 400 }
      );
    }

    const cleanText = cleaningResult.cleanedText;

    console.log(`${ICONS.CLEAN} [Upload] Texto limpo: ${cleanText.length} chars (redução: ${cleaningResult.reductionPercentage.toFixed(1)}%)`);

    // ============================================================
    // 8.5 EXTRAIR METADATA DO DOCUMENTO
    // ============================================================

    console.log(`${ICONS.EXTRACT} [Upload] Extraindo metadata do documento...`);

    let documentMetadata;
    try {
      documentMetadata = await extractPDFMetadata(cleanText, file.name);
      console.log(`${ICONS.SUCCESS} [Upload] Metadata extraída:`, {
        documentType: documentMetadata.documentType,
        documentDate: documentMetadata.documentDate?.toISOString(),
        confidence: documentMetadata.confidence
      });
    } catch (metadataError) {
      console.warn(`${ICONS.WARNING} [Upload] Erro ao extrair metadata (continuando mesmo assim):`, metadataError);
      documentMetadata = {
        documentType: 'UNKNOWN',
        documentTypeCategory: 'OTHER' as const,
        description: `Documento: ${file.name}`,
        confidence: 0.1,
        courtLevel: 'UNKNOWN' as const
      };
    }

    // ============================================================
    // 9. DETECTAR CNJ
    // ============================================================

    console.log(`${ICONS.SEARCH} [Upload] Detectando CNJ...`);

    let detectedCnj = textCleaner.extractProcessNumber(cleanText);

    // Se não encontrou CNJ e usuário forneceu manualmente
    if (!detectedCnj && manualCnj) {
      detectedCnj = manualCnj;
      console.log(`${ICONS.INFO} [Upload] CNJ fornecido manualmente: ${detectedCnj}`);
    }

    // Se ainda não tem CNJ, retornar erro pedindo CNJ manual
    if (!detectedCnj) {
      console.log(`${ICONS.WARNING} [Upload] CNJ não detectado automaticamente`);

      return NextResponse.json({
        success: false,
        error: 'missing_cnj',
        message: 'Não foi possível identificar o número do processo automaticamente. Por favor, informe o CNJ manualmente.',
        canRetry: true,
        extractedTextPreview: cleanText.substring(0, 500) + '...'
      }, { status: 400 });
    }

    console.log(`${ICONS.SUCCESS} [Upload] CNJ detectado: ${detectedCnj}`);

    // ============================================================
    // 10. EXTRAIR PRIMEIRA PÁGINA
    // ============================================================

    const firstPageText = cleanText.substring(0, 5000);

    // ============================================================
    // 11. CRIAR CASE
    // ============================================================

    console.log(`${ICONS.DATABASE} [Upload] Criando Case...`);

    // Type narrowing: validate clientId only if provided
    const safeClientId = isValidClientId(clientId) ? clientId : undefined;

    // OPÇÃO B: JSON serialization segura para JSON fields
    // JSON.parse(JSON.stringify(...)) garante JSON-serializable data
    const caseMetadata = JSON.parse(
      JSON.stringify({
        uploadedFileName: file.name,
        uploadedFileSize: file.size,
        uploadedAt: new Date().toISOString()
      })
    );

    // OPÇÃO A (Mandato Inegociável): Use helper function for type-safe object building
    // clientId is required by Prisma schema - use provided value or workspace default
    const effectiveClientId = safeClientId || workspaceId; // Fallback to workspace ID if not provided

    const caseCreateData = buildCaseCreateData({
      workspaceId,
      clientId: effectiveClientId,
      number: detectedCnj,
      title: `Processo ${detectedCnj}`,
      description: `Criado via upload de PDF em ${new Date().toISOString()}`,
      createdById: userId,
      detectedCnj,
      firstPageText
    });

    const newCase = await prisma.case.create({
      data: caseCreateData
    });

    // Update case with metadata after creation (separate operation)
    // This avoids type issues with JSON.parse() return type
    if (caseMetadata) {
      await prisma.case.update({
        where: { id: newCase.id },
        data: { metadata: caseMetadata }
      });
    }

    console.log(`${ICONS.SUCCESS} [Upload] Case criado: ${newCase.id}`);

    // ============================================================
    // 12. SALVAR DOCUMENTO (PERMANENTE EM SUPABASE STORAGE)
    // ============================================================

    // Upload to Supabase Storage with fallback to temp storage
    let documentUrl = tempPath; // Default fallback
    try {
      const permanentUrl = await uploadCaseDocument(
        workspaceId,
        newCase.id,
        file.name,
        buffer,
        file.type
      );

      if (permanentUrl) {
        documentUrl = permanentUrl;
        console.log(`${ICONS.SUCCESS} [Storage] Document stored permanently: ${permanentUrl}`);
      } else {
        console.warn(`${ICONS.WARNING} [Storage] Could not upload to Supabase, using temporary path`);
      }
    } catch (storageError) {
      console.error(`${ICONS.ERROR} [Storage] Error uploading document:`, storageError);
      console.warn(`${ICONS.INFO} Using temporary path as fallback`);
    }

    // Type narrowing: safely validate all document metadata before use
    const safeDocumentMetadataJson = JSON.parse(
      JSON.stringify({
        documentType: typeof documentMetadata.documentType === 'string' ? documentMetadata.documentType : 'UNKNOWN',
        documentDate: documentMetadata.documentDate instanceof Date ? documentMetadata.documentDate.toISOString() : null,
        confidence: typeof documentMetadata.confidence === 'number' ? documentMetadata.confidence : 0,
        courtLevel: typeof documentMetadata.courtLevel === 'string' ? documentMetadata.courtLevel : 'UNKNOWN'
      })
    );

    // For document type, use 'OTHER' as safe default for now
    // The actual document type will be determined by JUDIT enrichment
    const document = await prisma.caseDocument.create({
      data: {
        caseId: newCase.id,
        name: file.name.replace('.pdf', ''),
        originalName: file.name,
        type: 'OTHER', // Safe default; will be updated during enrichment
        mimeType: file.type,
        size: file.size,
        url: documentUrl, // Supabase Storage URL or temp fallback
        path: documentUrl,
        extractedText: extractedText, // Now safely typed as string
        cleanText: cleanText, // Already string from cleaningResult.cleanedText
        textSha: fileSha256,
        textExtractedAt: new Date(),
        documentDate: documentMetadata.documentDate instanceof Date ? documentMetadata.documentDate : undefined,
        metadata: safeDocumentMetadataJson, // Salvar metadata serializada e validada
        processed: true,
        ocrStatus: 'COMPLETED',
        sourceOrigin: 'USER_UPLOAD'
      }
    });

    console.log(`${ICONS.SUCCESS} [Upload] Documento salvo: ${document.id}`);

    // ============================================================
    // 12.5 CONSOLIDAR RESUMO DO CASO
    // ============================================================

    console.log(`${ICONS.EXTRACT} [Upload] Consolidando resumo do caso...`);

    try {
      const consolidatedDescription = await updateCaseSummaryDescription(newCase.id);
      console.log(`${ICONS.SUCCESS} [Upload] Resumo consolidado e salvo no caso`);
    } catch (summaryError) {
      console.warn(`${ICONS.WARNING} [Upload] Erro ao consolidar resumo (continuando mesmo assim):`, summaryError);
      // Não falhar o upload por causa disso
    }

    // ============================================================
    // 13. GERAR PREVIEW COM GEMINI FLASH (COM FALLBACK)
    // ============================================================

    console.log(`${ICONS.ROBOT} [Upload] Gerando preview...`);

    const previewStartTime = Date.now();
    const previewResult = await generatePreview(cleanText, newCase.id);
    const previewDuration = Date.now() - previewStartTime;

    // Type narrowing: safely check preview result structure
    const isValidPreviewResult =
      previewResult.success &&
      typeof previewResult.preview === 'object' &&
      previewResult.preview !== null &&
      'model' in previewResult.preview;

    if (!isValidPreviewResult) {
      // ERRO CRÍTICO: Análise de IA falhou mesmo após fallback
      console.error(`${ICONS.ERROR} [Upload] Falha ao gerar preview após todas as tentativas:`, previewResult.error);

      // Limpar o case incompleto
      await prisma.case.delete({
        where: { id: newCase.id }
      });

      // Retornar erro explícito para o frontend
      return NextResponse.json(
        {
          success: false,
          error: 'ai_analysis_failed',
          message: `Falha na análise de IA do documento: ${previewResult.error || 'Erro desconhecido'}. Todas as tentativas com diferentes modelos falharam. Verifique se a chave da API Google está configurada corretamente.`,
          canRetry: true,
          detailedError: previewResult.error
        },
        { status: 503 } // Service Unavailable - indica problema com serviço de IA
      );
    }

    // At this point, previewResult.preview is guaranteed to be non-null and non-undefined
    // Safe narrowing via unknown first, then validation
    const previewAsUnknown = previewResult.preview as unknown;
    if (typeof previewAsUnknown !== 'object' || previewAsUnknown === null || !('model' in previewAsUnknown)) {
      throw new Error('Invalid preview structure after validation');
    }
    const preview = previewAsUnknown as Record<string, unknown>;

    // Preview gerado com sucesso
    const modelValue = typeof preview.model === 'string' ? preview.model : 'unknown';
    console.log(`${ICONS.SUCCESS} [Upload] Preview gerado em ${previewDuration}ms com modelo ${modelValue}`);

    // Validar estrutura
    if (!validatePreviewSnapshot(preview)) {
      console.warn(`${ICONS.WARNING} [Upload] Preview com estrutura inválida, mas salvando mesmo assim`);
    }

    // Prepare preview snapshot with safe JSON serialization
    const previewSnapshot = JSON.parse(JSON.stringify(preview));

    // Atualizar Case com preview
    await prisma.case.update({
      where: { id: newCase.id },
      data: {
        previewSnapshot,
        previewGeneratedAt: new Date(),
        onboardingStatus: 'previewed'
      }
    });

    // IMPORTANTE: Salvar preview como análise inicial em CaseAnalysisVersion
    // Isso permite que o preview apareça na aba "Análise IA"
    try {
      // Type narrowing: safely extract arrays and values
      const lastMovements = Array.isArray(preview.lastMovements) ? preview.lastMovements : [];
      const keyPoints = lastMovements
        .filter((m: unknown) => typeof m === 'object' && m !== null && 'type' in m && 'description' in m)
        .map((m: unknown) => {
          const movement = m as Record<string, unknown>;
          const type = typeof movement.type === 'string' ? movement.type : 'unknown';
          const desc = typeof movement.description === 'string' ? movement.description : 'no description';
          return `${type}: ${desc}`;
        });

      // Safely serialize analysis data
      const analysisData = JSON.parse(
        JSON.stringify({
          summary: typeof preview.summary === 'string' ? preview.summary : '',
          keyPoints,
          metadata: {
            parties: preview.parties,
            subject: typeof preview.subject === 'string' ? preview.subject : '',
            object: typeof preview.object === 'string' ? preview.object : '',
            claimValue: preview.claimValue,
            source: 'preview_initial'
          }
        })
      );

      // OPÇÃO B (Mandato Inegociável): JSON serialization segura para JSON fields
      // JSON.parse(JSON.stringify(...)) garante que o objeto é JSON-serializable
      const analysisMetadata = JSON.parse(
        JSON.stringify({
          source: 'initial_preview',
          model: modelValue,
          tokensUsed: typeof previewResult.tokensUsed === 'number' ? previewResult.tokensUsed : 0,
          generatedAt: typeof preview.generatedAt === 'string' ? preview.generatedAt : new Date().toISOString()
        })
      );

      await prisma.caseAnalysisVersion.create({
        data: {
          caseId: newCase.id,
          workspaceId,
          version: 1,
          status: 'COMPLETED',
          analysisType: 'FAST',
          modelUsed: modelValue, // Already validated as string earlier
          aiAnalysis: analysisData,
          confidence: 0.85,
          processingTime: previewDuration,
          metadata: analysisMetadata
        }
      });

      console.log(`${ICONS.SUCCESS} [Upload] Análise inicial (preview) salva em CaseAnalysisVersion`);
    } catch (analysisError) {
      console.error(`${ICONS.WARNING} [Upload] Erro ao salvar análise inicial:`, analysisError);
      // Não falhar o upload se não conseguir salvar a análise
    }

    // ============================================================
    // 14. ENFILEIRAR JUDIT (se não skipado)
    // ============================================================

    let juditJobId: string | undefined;

    if (!skipEnrichment) {
      console.log(`${ICONS.ROCKET} [Upload] Enfileirando JUDIT...`);

      try {
        const { jobId } = await addOnboardingJob(detectedCnj, {
          workspaceId,
          userId,
          priority: 5
        });

        juditJobId = jobId;

        // Atualizar status para 'enriching'
        await prisma.case.update({
          where: { id: newCase.id },
          data: {
            onboardingStatus: 'enriching',
            enrichmentStartedAt: new Date()
          }
        });

        console.log(`${ICONS.SUCCESS} [Upload] Job de onboarding da JUDIT adicionado à fila para o processo ${detectedCnj}. Job ID: ${jobId}`);
        console.log(`${ICONS.INFO} [Async Flow] JUDIT worker processará caso em background (workspaceId: ${workspaceId}, caseId: ${newCase.id})`);

      } catch (error) {
        console.error(`${ICONS.ERROR} [Upload] Erro ao enfileirar JUDIT:`, error);
        // Não falhar o upload por causa disso
      }
    }

    // ============================================================
    // 15. RETORNAR RESPOSTA
    // ============================================================

    const overallDuration = Date.now() - overallStartTime;

    console.log(`${ICONS.SUCCESS} [Upload] Upload completo em ${overallDuration}ms`);

    // Type-safe response: serialize preview for response
    const responsePreviewRaw = JSON.parse(JSON.stringify(preview));
    const responsePreview = typeof responsePreviewRaw === 'object' && responsePreviewRaw !== null
      ? responsePreviewRaw
      : {};

    return NextResponse.json({
      success: true,
      caseId: newCase.id,
      caseNumber: newCase.number,
      status: newCase.onboardingStatus,
      detectedCnj,
      preview: responsePreview,
      analysisModel: modelValue,
      juditJobId,
      timing: {
        total: overallDuration,
        extraction: extractDuration,
        preview: previewDuration
      },
      message: `Preview gerado com sucesso via ${modelValue}! Buscando histórico oficial e anexos (aguarde notificação).`
    }, { status: 200 });

  } catch (error) {
    console.error(`${ICONS.ERROR} [Upload] Erro geral:`, error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao processar upload'
      },
      { status: 500 }
    );
  }
}

// ================================================================
// MÉTODO NÃO PERMITIDO
// ================================================================

export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Método não permitido. Use POST.' },
    { status: 405 }
  );
}
