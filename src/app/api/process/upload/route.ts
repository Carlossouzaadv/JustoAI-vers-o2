// ================================================================
// API ROUTE: POST /api/process/upload
// Novo fluxo de onboarding com Preview (FASE 1)
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';
import { ICONS } from '@/lib/icons';

// Services
import { extractTextFromPDF } from '@/lib/pdf-processor';
import { TextCleaner } from '@/lib/text-cleaner';
import { generatePreview, validatePreviewSnapshot } from '@/lib/services/previewAnalysisService';
import { addOnboardingJob } from '@/lib/queue/juditQueue';
import { getDocumentHashManager } from '@/lib/document-hash';
import { extractPDFMetadata } from '@/lib/services/localPDFMetadataExtractor';
import { updateCaseSummaryDescription } from '@/lib/services/summaryConsolidator';
import { uploadCaseDocument } from '@/lib/services/supabaseStorageService';

// ================================================================
// VALIDATION SCHEMA
// ================================================================

const uploadSchema = z.object({
  workspaceId: z.string().cuid(),
  manualCnj: z.string().optional(), // CNJ fornecido manualmente se detecção falhar
  clientId: z.string().cuid().optional(), // Cliente associado (opcional)
  skipEnrichment: z.boolean().default(false) // Se true, não dispara JUDIT
});

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
    // 2. PARSE FORM DATA
    // ============================================================

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const workspaceId = formData.get('workspaceId') as string;
    const manualCnj = formData.get('manualCnj') as string | null;
    const clientId = formData.get('clientId') as string | null;
    const skipEnrichment = formData.get('skipEnrichment') === 'true';

    // ============================================================
    // 3. VALIDAÇÕES BÁSICAS
    // ============================================================

    if (!file) {
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

    // Validar workspace
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

    console.log(`${ICONS.FILE} [Upload] Arquivo salvo: ${tempPath}`);

    // ============================================================
    // 5. CALCULAR HASH SHA256
    // ============================================================

    const hashManager = getDocumentHashManager();
    const fileSha256 = await hashManager.calculateHash(buffer);

    console.log(`${ICONS.LOCK} [Upload] SHA256: ${fileSha256.substring(0, 16)}...`);

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
    const extractedText = await extractTextFromPDF(tempPath);
    const extractDuration = Date.now() - extractStartTime;

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
    const cleaningResult = textCleaner.clean(extractedText, {
      documentType: 'legal',
      aggressiveness: 'balanced',
      preserveStructure: true
    });

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

    const newCase = await prisma.case.create({
      data: {
        workspaceId,
        clientId: clientId || undefined,
        number: detectedCnj,
        title: `Processo ${detectedCnj}`,
        description: `Criado via upload de PDF em ${new Date().toISOString()}`,
        type: 'CIVIL', // Default, será atualizado após análise
        status: 'ACTIVE',
        priority: 'MEDIUM',
        createdById: userId,
        detectedCnj,
        firstPageText,
        onboardingStatus: 'created',
        metadata: {
          uploadedFileName: file.name,
          uploadedFileSize: file.size,
          uploadedAt: new Date().toISOString()
        }
      }
    });

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

    const document = await prisma.caseDocument.create({
      data: {
        caseId: newCase.id,
        name: file.name.replace('.pdf', ''),
        originalName: file.name,
        type: documentMetadata.documentTypeCategory as any, // Usar metadata extraída
        mimeType: file.type,
        size: file.size,
        url: documentUrl, // Supabase Storage URL or temp fallback
        path: documentUrl,
        extractedText,
        cleanText,
        textSha: fileSha256,
        textExtractedAt: new Date(),
        documentDate: documentMetadata.documentDate || undefined, // Data extraída do documento
        metadata: documentMetadata, // Salvar metadata completa
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

    if (!previewResult.success || !previewResult.preview) {
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

    } else {
      // Preview gerado com sucesso
      console.log(`${ICONS.SUCCESS} [Upload] Preview gerado em ${previewDuration}ms com modelo ${previewResult.preview.model}`);

      // Validar estrutura
      if (!validatePreviewSnapshot(previewResult.preview)) {
        console.warn(`${ICONS.WARNING} [Upload] Preview com estrutura inválida, mas salvando mesmo assim`);
      }

      // Atualizar Case com preview
      await prisma.case.update({
        where: { id: newCase.id },
        data: {
          previewSnapshot: previewResult.preview as any,
          previewGeneratedAt: new Date(),
          onboardingStatus: 'previewed'
        }
      });

      // IMPORTANTE: Salvar preview como análise inicial em CaseAnalysisVersion
      // Isso permite que o preview apareça na aba "Análise IA"
      try {
        await prisma.caseAnalysisVersion.create({
          data: {
            caseId: newCase.id,
            workspaceId,
            version: 1,
            status: 'COMPLETED',
            analysisType: 'FAST',
            modelUsed: previewResult.preview.model,
            aiAnalysis: {
              summary: previewResult.preview.summary,
              keyPoints: previewResult.preview.lastMovements.map(m => `${m.type}: ${m.description}`),
              metadata: {
                parties: previewResult.preview.parties,
                subject: previewResult.preview.subject,
                object: previewResult.preview.object,
                claimValue: previewResult.preview.claimValue,
                source: 'preview_initial'
              }
            } as any,
            confidence: 0.85,
            processingTime: previewDuration,
            metadata: {
              source: 'initial_preview',
              model: previewResult.preview.model,
              tokensUsed: previewResult.tokensUsed,
              generatedAt: previewResult.preview.generatedAt
            }
          }
        });

        console.log(`${ICONS.SUCCESS} [Upload] Análise inicial (preview) salva em CaseAnalysisVersion`);
      } catch (analysisError) {
        console.error(`${ICONS.WARNING} [Upload] Erro ao salvar análise inicial:`, analysisError);
        // Não falhar o upload se não conseguir salvar a análise
      }
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

    return NextResponse.json({
      success: true,
      caseId: newCase.id,
      caseNumber: newCase.number,
      status: newCase.onboardingStatus,
      detectedCnj,
      preview: previewResult.preview || null,
      analysisModel: previewResult.preview?.model || null, // Mostrar qual modelo foi usado
      juditJobId,
      timing: {
        total: overallDuration,
        extraction: extractDuration,
        preview: previewDuration
      },
      message: previewResult.preview
        ? `Preview gerado com sucesso via ${previewResult.preview.model}! Buscando histórico oficial e anexos (aguarde notificação).`
        : 'Documento salvo. Preview não disponível no momento.'
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
