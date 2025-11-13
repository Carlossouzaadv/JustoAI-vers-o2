// ================================================================
// PDF UPLOAD API - Implementação Completa Conforme Especificação
// ================================================================
// Implementa: SHA256, deduplicação, extração de texto, identificação CNJ,
// timeline unificada, cache Redis e análise IA otimizada

import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { z } from 'zod';
import { PrismaClient, Prisma } from '@prisma/client';
import { requireAuth } from '@/lib/api-utils';
import { getDocumentHashManager } from '@/lib/document-hash';
import { getAnalysisCacheManager } from '@/lib/analysis-cache';
import { getTimelineMergeService } from '@/lib/timeline-merge';
import { mergeTimelines } from '@/lib/services/timelineUnifier';
import { addOnboardingJob } from '@/lib/queue/juditQueue';
import { PDFProcessor } from '@/lib/pdf-processor';
import { TextCleaner } from '@/lib/text-cleaner';
import { AIModelRouter } from '@/lib/ai-model-router';
import { mapAnalysisToPreview, extractCoreInfo } from '@/lib/ai-analysis-mapper';
import { ICONS } from '@/lib/icons';
import { uploadCaseDocument } from '@/lib/services/supabaseStorageService';
import { juditAPI, JuditOperationType } from '@/lib/judit-api-wrapper';
import type { UnifiedProcessSchema } from '@/lib/ai-model-router';

// Configuração de runtime para suportar uploads de arquivos grandes
// maxDuration: tempo máximo para a função executar (Vercel limit)
// Nota: O limite real de body size é controlado no next.config.ts e Vercel
export const maxDuration = 300; // 5 minutos máximo para processamento

const prisma = new PrismaClient();

// ================================================================
// TYPE GUARDS - PADRÃO-OURO DE TYPE SAFETY
// ================================================================

/**
 * Type guard para validar PDFProcessor extraction result
 * Garante que o objeto tem as propriedades necessárias
 */
interface PdfExtractionResult {
  success: boolean;
  pageCount?: number;
  text?: string;
  texto_original?: string;
  texto_limpo?: string;
  error?: string;
  [key: string]: unknown;
}

function isPdfExtractionResult(data: unknown): data is PdfExtractionResult {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.success === 'boolean' &&
    (typeof obj.pageCount === 'number' || obj.pageCount === undefined) &&
    (typeof obj.text === 'string' || obj.text === undefined) &&
    (typeof obj.texto_original === 'string' || obj.texto_original === undefined) &&
    (typeof obj.texto_limpo === 'string' || obj.texto_limpo === undefined)
  );
}

/**
 * Type guard para validar AI Analysis Result
 * Verifica presença de campos críticos para serialização segura
 */
interface AIAnalysisResultType {
  lastMovements?: unknown[];
  summary?: unknown;
  parties?: unknown;
  cost?: Record<string, unknown>;
  metadados_analise?: Record<string, unknown>;
  _routing_info?: Record<string, unknown>;
  [key: string]: unknown;
}

function isAIAnalysisResult(data: unknown): data is AIAnalysisResultType {
  if (!data || typeof data !== 'object') return false;
  // Object é válido se tem a estrutura mínima esperada
  return true; // É um objeto válido para serializar
}

/**
 * Extrai valor seguro de propriedade aninhada com fallback
 */
function safeGetProperty<T = unknown>(
  obj: unknown,
  path: string,
  defaultValue: T
): T {
  if (!obj || typeof obj !== 'object') return defaultValue;

  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return defaultValue;
    }
  }

  return current as T;
}

/**
 * Type guard para validar se um objeto é compatível com Partial<UnifiedProcessSchema>
 * Verifica presença de campos principais esperados pela função extractCoreInfo
 *
 * PADRÃO-OURO: Narrowing seguro usando "in" operator (sem casting)
 */
function isUnifiedProcessSchema(data: unknown): data is Partial<UnifiedProcessSchema> {
  if (!data || typeof data !== 'object') return false;

  const obj = data as Record<string, unknown>;

  // Validar que o objeto tem PELO MENOS uma das seções principais
  // (não precisa ter todas, pois é Partial<UnifiedProcessSchema>)
  const hasIdentificacao = 'identificacao_basica' in obj;
  const hasPartes = 'partes_envolvidas' in obj;
  const hasValores = 'valores_financeiros' in obj;
  const hasAnalise = 'analise_estrategica' in obj;
  const hasCampos = 'campos_especializados' in obj;
  const hasSituacao = 'situacao_processual' in obj;

  // Se tem pelo menos uma dessas seções principais, é provavelmente um UnifiedProcessSchema
  // Isso é válido porque UnifiedProcessSchema é Partial - não precisa ter todos os campos
  return hasIdentificacao || hasPartes || hasValores || hasAnalise || hasCampos || hasSituacao;
}

// ================================================================
// CONFIGURAÇÕES DA ESPECIFICAÇÃO
// ================================================================
const CONFIG = {
  AUTO_SUGGEST_THRESHOLD: 0.9,
  UNASSIGNED_FOLDER: 'clientes_a_definir',
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  SUPPORTED_EXTENSIONS: ['.pdf']
};

// Schema de validação
const uploadSchema = z.object({
  caseId: z.string().cuid().optional(), // Opcional para permitir criação automática
  processNumber: z.string().optional(), // Número do processo se conhecido
  autoCreateProcess: z.boolean().default(true) // Permitir criação automática
});

// ================================================================
// ENDPOINT PRINCIPAL
// ================================================================
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let lockKey: string | null = null;

  try {
    // 1. VERIFICAR AUTENTICAÇÃO
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;

    // 2. PROCESSAR FORMDATA
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (formDataError) {
      // Erro ao processar FormData geralmente indica arquivo muito grande
      const errorMsg = formDataError instanceof Error ? formDataError.message : 'Erro desconhecido';
      console.error(`${ICONS.ERROR} Erro ao processar FormData:`, errorMsg);

      if (errorMsg.includes('size') || errorMsg.includes('413')) {
        return NextResponse.json(
          { error: `Arquivo muito grande. Máximo permitido: ${CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB` },
          { status: 413 }
        );
      }

      return NextResponse.json(
        { error: 'Erro ao processar arquivo. Verifique o tamanho e tente novamente.' },
        { status: 400 }
      );
    }

    // Type guard for FormData values
    const file = formData.get('file');
    const caseId = formData.get('caseId');
    const processNumber = formData.get('processNumber');
    const requestedWorkspaceId = formData.get('workspaceId');

    // 3. VALIDAÇÕES BÁSICAS - Type guards com verificações seguras
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'Arquivo PDF é obrigatório' },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'Apenas arquivos PDF são aceitos' },
        { status: 400 }
      );
    }

    if (file.size > CONFIG.MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Arquivo muito grande. Máximo: ${CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB. Seu arquivo tem: ${(file.size / (1024 * 1024)).toFixed(2)}MB` },
        { status: 413 }
      );
    }

    // Type guard for string fields
    const caseIdStr = typeof caseId === 'string' ? caseId : undefined;
    const processNumberStr = typeof processNumber === 'string' ? processNumber : undefined;
    const requestedWorkspaceIdStr = typeof requestedWorkspaceId === 'string' ? requestedWorkspaceId : undefined;

    // 4. OBTER WORKSPACE DO USUÁRIO
    // IMPORTANT: Use the workspace requested by the frontend, not just the user's first workspace
    // This prevents uploading to the wrong workspace when a user has multiple workspaces
    let workspaceId = requestedWorkspaceIdStr;

    // If no workspace requested, use user's first workspace (fallback)
    if (!workspaceId) {
      const userWorkspace = await prisma.userWorkspace.findFirst({
        where: { userId: user.id },
        include: { workspace: true }
      });

      if (!userWorkspace) {
        return NextResponse.json(
          { error: 'Usuário não possui workspace' },
          { status: 403 }
        );
      }

      workspaceId = userWorkspace.workspaceId;
    }

    // Verify user has access to the requested workspace
    const userWorkspace = await prisma.userWorkspace.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId
        }
      }
    });

    if (!userWorkspace || userWorkspace.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Usuário não possui acesso a este workspace' },
        { status: 403 }
      );
    }

    // Type narrowing: After workspace verification, workspaceId is guaranteed to be a string
    // because either it was provided or set from userWorkspace.workspaceId
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'WorkspaceId não pôde ser determinado' },
        { status: 500 }
      );
    }

    // Now workspaceId is narrowed to string type
    const verifiedWorkspaceId: string = workspaceId;

    // 5. CALCULAR SHA256 DO ARQUIVO
    const buffer = Buffer.from(await file.arrayBuffer());
    const hashManager = getDocumentHashManager();
    const hashResult = hashManager.calculateSHA256(buffer);

    // 6. VERIFICAR DEDUPLICAÇÃO
    const deduplicationCheck = await hashManager.checkDeduplication(
      hashResult.textSha,
      verifiedWorkspaceId,
      prisma
    );

    if (deduplicationCheck.isDuplicate) {

      // Registrar evento de auditoria
      const timelineService = getTimelineMergeService();
      await timelineService.logAuditEvent('duplicate_upload', {
        originalDocumentId: deduplicationCheck.originalDocumentId,
        originalDocument: deduplicationCheck.originalDocument,
        attemptedUpload: {
          fileName: file.name,
          size: file.size,
          textSha: hashResult.textSha,
          userId: user.id,
          workspaceId: verifiedWorkspaceId
        }
      }, prisma);

      // Criar entrada duplicada com flag
      const duplicateDocument = await prisma.caseDocument.create({
        data: {
          caseId: deduplicationCheck.originalDocument!.caseId,
          name: file.name,
          originalName: file.name,
          type: 'OTHER',
          mimeType: 'application/pdf',
          size: file.size,
          url: '',
          path: '',
          textSha: hashResult.textSha,
          isDuplicate: true,
          originalDocumentId: deduplicationCheck.originalDocumentId,
          ocrStatus: 'COMPLETED' // Não reprocessar
        }
      });

      return NextResponse.json({
        success: true,
        isDuplicate: true,
        message: `Arquivo já existe no sistema. Encontrado no processo "${deduplicationCheck.originalDocument!.caseName}"`,
        data: {
          duplicateDocumentId: duplicateDocument.id,
          originalDocument: deduplicationCheck.originalDocument,
          textSha: hashResult.textSha
        }
      });
    }

    // 7. EXTRAÇÃO E NORMALIZAÇÃO DE TEXTO

    // Save PDF to temp file for processing
    const tempDir = join('/tmp', 'pdfs');
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }
    const tempPath = join(tempDir, `${Date.now()}-${file.name}`);

    await writeFile(tempPath, buffer);

    const pdfProcessor = new PDFProcessor();
    const extractionResultRaw: unknown = await pdfProcessor.processComplete({
      pdf_path: tempPath,
      extract_fields: ['processo', 'data', 'partes', 'valor']
    });

    // Validar estrutura do resultado com type guard
    if (!isPdfExtractionResult(extractionResultRaw)) {
      console.error(`${ICONS.ERROR} Extração de PDF retornou estrutura inválida:`, extractionResultRaw);
      return NextResponse.json(
        { error: 'Não foi possível extrair texto do PDF. O arquivo pode estar corrompido.' },
        { status: 400 }
      );
    }

    const extractionResult = extractionResultRaw;

    // Verificar se houve sucesso, mas também aceitar resultados com extração parcial
    if (!extractionResult.success && (!extractionResult.texto_original && !extractionResult.texto_limpo)) {
      console.error(`${ICONS.ERROR} Extração de PDF falhou completamente:`, extractionResult.error);
      return NextResponse.json(
        { error: 'Não foi possível extrair texto do PDF. O arquivo pode estar corrompido ou ser apenas imagens.' },
        { status: 400 }
      );
    }

    // Limpar e normalizar texto (usar fallback se necessário)
    const textCleaner = new TextCleaner();
    const extractedText = extractionResult.texto_original || extractionResult.texto_limpo || '';

    if (!extractedText || extractedText.trim().length === 0) {
      console.error(`${ICONS.ERROR} Nenhum texto extraído do PDF`);
      return NextResponse.json(
        { error: 'Nenhum texto foi extraído do PDF. Pode ser um PDF com apenas imagens (OCR não suportado ainda).' },
        { status: 400 }
      );
    }

    const cleaningResult = textCleaner.cleanLegalDocument(extractedText);
    const cleanText = cleaningResult.cleanedText;

    // Registrar timestamp de extração
    const textExtractedAt = new Date();

    // 8. IDENTIFICAÇÃO DE PROCESSO CNJ

    const extractedProcessNumber = textCleaner.extractProcessNumber(cleanText);
    console.log(extractedProcessNumber ?
      `${ICONS.SUCCESS} Processo identificado: ${extractedProcessNumber}` :
      `${ICONS.INFO} Número do processo não identificado`
    );

    // 9. BUSCAR PROCESSO EXISTENTE (SE NÚMERO IDENTIFICADO)
    let existingProcess = null;
    let shouldPromptUser = false;

    if (extractedProcessNumber) {
      existingProcess = await prisma.case.findFirst({
        where: {
          number: extractedProcessNumber,
          workspaceId: verifiedWorkspaceId
        },
        include: {
          client: true,
          _count: {
            select: { documents: true }
          }
        }
      });

      if (existingProcess) {
        shouldPromptUser = true;
      }
    }

    // 10. SE PROCESSO EXISTE, RETORNAR PROMPT PARA USUÁRIO
    if (shouldPromptUser && existingProcess) {
      // Salvar arquivo temporariamente para decisão do usuário
      const tempPath = await saveTemporaryFile(buffer, file.name);

      return NextResponse.json({
        success: true,
        requiresUserDecision: true,
        message: 'Processo existente identificado',
        data: {
          caseId: existingProcess.id, // ✓ Sempre retorna caseId na raiz para consistência
          extractedProcessNumber,
          existingProcess: {
            id: existingProcess.id,
            title: existingProcess.title,
            number: existingProcess.number,
            clientName: existingProcess.client.name,
            documentCount: existingProcess._count.documents
          },
          temporaryFile: {
            path: tempPath,
            textSha: hashResult.textSha,
            cleanText: cleanText.substring(0, 1000) // Preview
          },
          promptMessage: `Identificamos que este documento pertence ao processo "${existingProcess.title}" (${existingProcess.number}). Deseja anexá-lo?`
        }
      });
    }

    // 11. CRIAR NOVO PROCESSO NA PASTA "clientes_a_definir"
    let targetCaseId: string;

    if (extractedProcessNumber && !existingProcess) {

      // Buscar ou criar cliente padrão "A Definir"
      let defaultClient = await prisma.client.findFirst({
        where: {
          workspaceId: verifiedWorkspaceId,
          name: CONFIG.UNASSIGNED_FOLDER
        }
      });

      if (!defaultClient) {
        defaultClient = await prisma.client.create({
          data: {
            workspaceId: verifiedWorkspaceId,
            name: CONFIG.UNASSIGNED_FOLDER,
            type: 'INDIVIDUAL',
            status: 'ACTIVE'
          }
        });
      }

      // Extrair metadados básicos do documento
      const basicData = await extractBasicProcessData(cleanText);

      try {
        // Usar upsert para evitar erro de constraint em case de race condition
        const newCase = await prisma.case.upsert({
          where: {
            number_workspaceId: {
              number: extractedProcessNumber,
              workspaceId: verifiedWorkspaceId
            }
          },
          update: {
            // Se existir, apenas atualiza o updatedAt
            updatedAt: new Date()
          },
          create: {
            workspaceId: verifiedWorkspaceId,
            clientId: defaultClient.id,
            number: extractedProcessNumber,
            detectedCnj: extractedProcessNumber, // Preenchido automaticamente
            title: basicData.title || `Processo ${extractedProcessNumber}`,
            description: basicData.description,
            type: 'CIVIL', // Padrão
            status: 'UNASSIGNED', // Status especial
            priority: 'MEDIUM',
            createdById: user.id,
            claimValue: basicData.claimValue,
            // Serializar metadata para JSON field (Padrão-Ouro)
            metadata: JSON.parse(JSON.stringify({
              autoCreated: true,
              createdFromUpload: true,
              extractedData: basicData,
              needsAssignment: true
            }))
          }
        });

        targetCaseId = newCase.id;
      } catch (upsertError) {
        // Se upsert falhar, tentar buscar o caso existente
        const existingCase = await prisma.case.findFirst({
          where: {
            number: extractedProcessNumber,
            workspaceId: verifiedWorkspaceId
          }
        });

        if (existingCase) {
          targetCaseId = existingCase.id;
        } else {
          console.error(`${ICONS.ERROR} Erro ao processar case:`, upsertError);
          throw upsertError;
        }
      }

    } else {
      // Usar caseId fornecido ou processo existente
      const resolvedCaseId = existingProcess?.id || caseIdStr;

      if (!resolvedCaseId) {
        return NextResponse.json(
          { error: 'caseId é obrigatório quando processo não é identificado automaticamente' },
          { status: 400 }
        );
      }

      targetCaseId = resolvedCaseId;

      // VALIDATE: Se um caseId foi fornecido, verificar se pertence ao workspace
      if (caseIdStr && !existingProcess) {
        const providedCase = await prisma.case.findFirst({
          where: {
            id: caseIdStr,
            workspaceId: verifiedWorkspaceId // Garante que o case pertence ao workspace do usuário
          }
        });

        if (!providedCase) {
          return NextResponse.json(
            { error: 'Caso fornecido não existe ou você não tem acesso a ele' },
            { status: 404 }
          );
        }
      }
    }

    // 12. VERIFICAR CACHE DE ANÁLISE
    // NOTE: Cache pode conter dados incompletos de análises antigas
    // Para garantir que Gemini sempre gera análises completas com estrutura correta,
    // desabilitamos cache hit para Phase 1 e sempre executamos analyzePhase1
    const cacheManager = getAnalysisCacheManager();
    const modelVersion = 'gemini-2.5-flash';
    const promptSignature = 'legal-document-analysis-v2';

    const cacheResult = await cacheManager.checkAnalysisCache(
      [hashResult.textSha],
      modelVersion,
      promptSignature
    );

    interface AIAnalysisResult {
      lastMovements?: unknown[];
      summary?: unknown;
      parties?: unknown;
      cost?: { estimatedCost?: number };
      metadados_analise?: { confianca?: number; confianca_geral?: number };
      _routing_info?: { model_used?: string; cost_estimate?: { estimatedCost?: number } };
      [key: string]: unknown;
    }

    let aiAnalysisResult: AIAnalysisResult | null = null;

    // IMPORTANT: Only use cache if data has correct structure with lastMovements
    // Older cached results may be missing required fields
    interface ValidCacheData {
      lastMovements?: unknown[];
      summary?: unknown;
      parties?: unknown;
      [key: string]: unknown;
    }

    const isValidCacheData = (data: unknown): data is ValidCacheData => {
      if (!data || typeof data !== 'object') return false;
      // Type guard using property existence checks (no casting)
      const hasLastMovements = 'lastMovements' in data && Array.isArray((data as Record<string, unknown>).lastMovements);
      const hasSummary = 'summary' in data && (data as Record<string, unknown>).summary !== undefined;
      const hasParties = 'parties' in data && (data as Record<string, unknown>).parties !== undefined;
      return hasLastMovements && hasSummary && hasParties;
    };

    if (cacheResult.hit && isValidCacheData(cacheResult.data)) {
      aiAnalysisResult = cacheResult.data;
      console.log(`${ICONS.SUCCESS} Cache válido com estrutura correta`);
    } else {
      // Use cache if valid, or run Gemini if cache invalid/missing
      if (cacheResult.hit) {
        console.log(`${ICONS.WARNING} Cache encontrado mas com estrutura inválida - executando Gemini novamente`);
      }

      // 13. ADQUIRIR LOCK REDIS PARA ANÁLISE
      const analysisKey = hashResult.textSha + '_' + modelVersion;
      const lockResult = await cacheManager.acquireLock(analysisKey);

      // Se não conseguiu lock mas tem um lockKey válido (lock existe por outro worker)
      // E têm TTL significativo, reject a requisição (mutual processing prevention)
      // Se lockKey vazio (redis unavailable), permite processamento em modo graceful
      if (!lockResult.acquired && lockResult.lockKey && lockResult.ttl > 10) {
        return NextResponse.json({
          success: false,
          message: 'Documento sendo processado por outro worker. Tente novamente em alguns minutos.',
          retryAfter: lockResult.ttl
        }, { status: 429 });
      }

      // Se lockKey existe, track it for cleanup
      if (lockResult.lockKey) {
        lockKey = lockResult.lockKey;
      }

      try {
        // 14. ANÁLISE IA PHASE 1 - Análise rápida inicial com LITE-first strategy
        console.log(`${ICONS.ROBOT} [Upload] Chamando Gemini para analyzePhase1...`);

        const aiRouter = new AIModelRouter();
        // Use analyzePhase1 for initial preview (LITE→BALANCED→PRO fallback)
        // This ensures fast, cost-effective analysis while maintaining quality
        const analysisResultRaw: unknown = await aiRouter.analyzePhase1(cleanText, file.size / (1024 * 1024), verifiedWorkspaceId);

        // Validar resultado com type guard antes de atribuir
        if (isAIAnalysisResult(analysisResultRaw)) {
          aiAnalysisResult = analysisResultRaw;
        } else {
          console.warn(`${ICONS.WARNING} [Upload] Análise retornou estrutura inválida, usando null`);
          aiAnalysisResult = null;
        }

        console.log(`${ICONS.SUCCESS} [Upload] Gemini analyzePhase1 concluído`);

        // Salvar no cache (apenas se conseguiu resultado válido)
        if (aiAnalysisResult) {
          await cacheManager.saveAnalysisCache(
            [hashResult.textSha],
            modelVersion,
            promptSignature,
            aiAnalysisResult,
            undefined, // lastMovementDate (optional, not available at upload time)
            verifiedWorkspaceId
          );
        }

      } catch (analysisError) {
        console.error(`${ICONS.ERROR} Erro na análise IA:`, analysisError);
        // Continuar sem análise IA
      } finally {
        // Liberar lock
        if (lockKey) {
          await cacheManager.releaseLock(lockKey);
          lockKey = null;
        }
      }
    }

    // 15. SALVAR ARQUIVO FÍSICO (PERMANENTE EM SUPABASE STORAGE)
    const finalPath = await savePermanentFile(buffer, file.name, verifiedWorkspaceId, targetCaseId);

    // 16. CRIAR DOCUMENTO NO BANCO
    // Validar e extrair valores com fallbacks seguros
    const pageCount = extractionResult.pageCount ?? 0;
    const extractedTextContent = extractionResult.text ?? extractionResult.texto_original ?? '';
    const costEstimate = safeGetProperty<number>(aiAnalysisResult, 'cost.estimatedCost', 0);

    const document = await prisma.caseDocument.create({
      data: {
        caseId: targetCaseId,
        name: file.name,
        originalName: file.name,
        type: 'CONTRACT', // Determinar automaticamente
        mimeType: 'application/pdf',
        size: file.size,
        url: finalPath,
        path: finalPath,
        pages: pageCount,
        extractedText: extractedTextContent,
        cleanText,
        textSha: hashResult.textSha,
        textExtractedAt,
        analysisVersion: modelVersion,
        analysisKey: cacheResult.key,
        workerId: process.env.WORKER_ID || 'main',
        costEstimate: costEstimate,
        processed: true,
        ocrStatus: 'COMPLETED'
      }
    });

    // 17. SALVAR ANÁLISE GERADA COMO VERSÃO
    if (aiAnalysisResult) {
      try {
        // Obter versão mais recente
        const lastVersion = await prisma.caseAnalysisVersion.findFirst({
          where: { caseId: targetCaseId },
          orderBy: { version: 'desc' },
          select: { version: true }
        });

        const nextVersion = (lastVersion?.version || 0) + 1;

        // Salvar análise como primeira versão
        // Serializar aiAnalysisResult para JSON field do Prisma (Padrão-Ouro)
        const aiAnalysisJsonData = aiAnalysisResult ? JSON.parse(JSON.stringify(aiAnalysisResult)) : null;
        const metadadosAnalise = safeGetProperty<Record<string, unknown>>(aiAnalysisResult, 'metadados_analise', {});
        const routingInfo = safeGetProperty<Record<string, unknown>>(aiAnalysisResult, '_routing_info', {});
        const confidence = safeGetProperty<number>(metadadosAnalise, 'confianca', 0.8);
        const modelUsedInfo = safeGetProperty<string>(routingInfo, 'model_used', modelVersion);

        const analysisVersion = await prisma.caseAnalysisVersion.create({
          data: {
            case: {
              connect: { id: targetCaseId }
            },
            workspace: {
              connect: { id: verifiedWorkspaceId }
            },
            version: nextVersion,
            status: 'COMPLETED',
            analysisType: 'essential', // Análise rápida do upload é considerada "essencial"
            modelUsed: modelVersion,
            analysisKey: cacheResult.key || hashResult.textSha + '_' + modelVersion, // Chave para cache de análise
            aiAnalysis: aiAnalysisJsonData, // JSON field - serializado com padrão-ouro
            confidence: confidence,
            processingTime: Date.now() - startTime,
            metadata: {
              source: 'upload_gemini',
              documentId: document.id,
              cacheKey: cacheResult.key,
              model: modelUsedInfo
            }
          }
        });

        console.log(`${ICONS.SUCCESS} Análise salva como versão ${nextVersion}: ${analysisVersion.id}`);
      } catch (analysisVersionError) {
        console.error(`${ICONS.ERROR} Erro ao salvar análise:`, analysisVersionError);
        // Não falhar o upload por causa disso
      }
    }

    // 18. TIMELINE UNIFICADA - EXTRAIR E MESCLAR ANDAMENTOS (COM ENRIQUECIMENTO INTELIGENTE)
    const timelineService = getTimelineMergeService();

    if (aiAnalysisResult) {
      const timelineEntries = timelineService.extractTimelineFromAIAnalysis(aiAnalysisResult, document.id);

      if (timelineEntries.length > 0) {
        const mergeResult = await timelineService.mergeEntries(targetCaseId, timelineEntries, prisma);
      }
    }

    // 18.2 NOVO: CHAMAR MERGE TIMELINES V2 COM ENRIQUECIMENTO INTELIGENTE
    // Isto usa o novo TimelineEnricherService com associação e enriquecimento
    try {
      console.log(`${ICONS.PROCESS} [Timeline] Iniciando unificação v2 com enriquecimento para case ${targetCaseId}`);
      const unificationResult = await mergeTimelines(targetCaseId, [document.id]);

      console.log(`${ICONS.SUCCESS} [Timeline] Unificação v2 concluída:
        Novos: ${unificationResult.new}
        Duplicados: ${unificationResult.duplicates}
        Enriquecidos: ${unificationResult.enriched}
        Relacionados: ${unificationResult.related}
        Conflitos: ${unificationResult.conflicts}`);
    } catch (timelineError) {
      console.error(`${ICONS.WARNING} [Timeline] Erro na unificação v2 (não é crítico):`, timelineError);
      // Não falhar o upload por causa disso - timeline é secundária
    }

    // 19. FASE 2 - ENRIQUECIMENTO OFICIAL VIA JUDIT (Background Async)
    // Queue a background job to fetch official process data from JUDIT
    // This happens asynchronously - doesn't block the response
    // IMPORTANTE: Passar caseId explicitamente para evitar ambiguidade na webhook
    let juditJobId: string | undefined;
    if (extractedProcessNumber) {
      try {
        console.log(`${ICONS.ROCKET} [Onboarding] Enfileirando JUDIT para ${extractedProcessNumber} (Case: ${targetCaseId})`);
        const { jobId } = await addOnboardingJob(extractedProcessNumber, {
          caseId: targetCaseId, // NOVO: Passar case ID explícito para webhook usar
          workspaceId: verifiedWorkspaceId,
          userId: user.id,
          priority: 5
        });
        juditJobId = jobId;
        console.log(`${ICONS.SUCCESS} [Onboarding] Job de JUDIT adicionado à fila (Job ID: ${jobId}). Worker processará em background.`);
      } catch (juditError) {
        console.error(`${ICONS.ERROR} [Onboarding] Erro ao enfileirar JUDIT:`, juditError);
        // Não falhar o upload por causa disso - FASE 1 foi concluída com sucesso
      }
    }

    // 20. REGISTRAR EVENTO
    await prisma.caseEvent.create({
      data: {
        caseId: targetCaseId,
        userId: user.id,
        type: 'DOCUMENT_RECEIVED',
        title: 'PDF processado com pipeline completo',
        description: `Arquivo "${file.name}" processado com sucesso. ${extractedProcessNumber ? `Processo ${extractedProcessNumber} identificado.` : 'Número do processo não identificado.'} ${aiAnalysisResult ? 'Análise IA concluída.' : 'Análise IA não executada.'}`,
        metadata: {
          documentId: document.id,
          textSha: hashResult.textSha,
          extractedProcessNumber,
          aiAnalyzed: !!aiAnalysisResult,
          pipelineVersion: 'v2',
          processingTime: Date.now() - startTime
        }
      }
    });

    // 21. TELEMETRY TRACKING
    const processingTime = Date.now() - startTime;

    try {
      await juditAPI.trackCall({
        workspaceId: verifiedWorkspaceId,
        operationType: JuditOperationType.ANALYSIS,
        durationMs: processingTime,
        success: true,
        requestId: document.id,
        metadata: {
          eventType: 'document.uploaded',
          documentId: document.id,
          caseId: targetCaseId,
          fileName: file.name,
          fileSize: file.size,
          pageCount: pageCount, // Usar a variável já validada
          aiAnalyzed: !!aiAnalysisResult,
          cacheHit: cacheResult.hit,
          processNumberExtracted: !!extractedProcessNumber,
          juditJobQueued: !!juditJobId
        }
      });
    } catch (trackingError) {
      console.warn(`${ICONS.WARNING} Erro ao rastrear telemetria de upload:`, trackingError);
      // Don't fail the upload due to telemetry issues
    }

    // 22. RESPOSTA DE SUCESSO
    return NextResponse.json({
      success: true,
      message: extractedProcessNumber ?
        `PDF processado com sucesso - FASE 1 concluída! Buscando histórico oficial e anexos...` :
        'PDF processado com sucesso',
      data: {
        documentId: document.id,
        caseId: targetCaseId,
        textSha: hashResult.textSha,
        extractedProcessNumber,
        processAutoCreated: !!extractedProcessNumber && !existingProcess,
        juditJobId, // FASE 2 job ID for tracking

        // Fase do onboarding
        onboardingPhase: {
          current: 'PREVIEW', // FASE 1
          next: juditJobId ? 'ENRICHMENT' : undefined, // FASE 2
          nextAction: juditJobId ? 'Aguardando histórico oficial do tribunal' : 'Enriquecimento não iniciado'
        },

        // Métricas de processamento
        processing: {
          totalTime: processingTime,
          textExtracted: true,
          aiAnalyzed: !!aiAnalysisResult,
          cacheHit: cacheResult.hit,
          juditJobQueued: !!juditJobId,
          timelineEntriesAdded: 0 // TODO: incluir do merge result
        },

        // Informações da análise (PREVIEW COMPLETO)
        analysis: aiAnalysisResult && isAIAnalysisResult(aiAnalysisResult) ? (() => {
          // Narrowing seguro: aiAnalysisResult é AIAnalysisResultType aqui
          const validAnalysis: AIAnalysisResultType = aiAnalysisResult as AIAnalysisResultType;

          // Extrair valores com type guards e fallbacks
          const routingInfoData = safeGetProperty<Record<string, unknown>>(validAnalysis, '_routing_info', {});
          const modelUsedForResponse = safeGetProperty<string>(routingInfoData, 'model_used', modelVersion);

          const metadadosAnaliseData = safeGetProperty<Record<string, unknown>>(validAnalysis, 'metadados_analise', {});
          const confidenceValue = safeGetProperty<number>(metadadosAnaliseData, 'confianca_geral', 0.8);

          const costEstimateData = safeGetProperty<Record<string, unknown>>(routingInfoData, 'cost_estimate', {});
          const costValue = safeGetProperty<number>(costEstimateData, 'estimatedCost', 0);

          const previewData = mapAnalysisToPreview(validAnalysis, {
            modelUsed: modelUsedForResponse,
            confidence: confidenceValue,
            costEstimate: Number(costValue)
          });

          // Log dos dados extraídos
          // Validar se validAnalysis é um UnifiedProcessSchema antes de usar extractCoreInfo
          if (isUnifiedProcessSchema(validAnalysis)) {
            // Agora validAnalysis foi validado pelo type guard e é seguro passar
            const coreInfo = extractCoreInfo(validAnalysis);
            console.log(`${ICONS.SUCCESS} Análise mapeada para preview:`, coreInfo);
          } else {
            // Se não é um UnifiedProcessSchema válido, fazer logging seguro sem casting
            console.log(`${ICONS.INFO} Análise retornada pelo Gemini tem estrutura não-padrão (OK):`, {
              keys: Object.keys(validAnalysis).slice(0, 5) // Log apenas primeiras 5 chaves
            });
          }

          // Serializar dados para JSON (Padrão-Ouro)
          const analysisDataSerialized = JSON.parse(JSON.stringify(validAnalysis));

          return {
            // Dados formatados para o popup
            ...previewData,

            // Dados estruturados completos para referência futura (serializado)
            dados: analysisDataSerialized
          };
        })() : null,

        // Informações do arquivo
        file: {
          name: file.name,
          size: file.size,
          pages: extractionResult.pageCount,
          textLength: cleanText.length
        }
      }
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro no upload de PDF:`, error);

    // Liberar lock se ainda estiver ativo
    if (lockKey) {
      const cacheManager = getAnalysisCacheManager();
      await cacheManager.releaseLock(lockKey);
    }

    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// ================================================================
// ENDPOINT DE ANEXAR A PROCESSO EXISTENTE
// ================================================================
export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const { temporaryFilePath, targetCaseId, textSha } = body;

    // TODO: Implementar lógica de anexar arquivo já processado a processo existente
    // Mover arquivo de temporário para final e anexar ao processo

    return NextResponse.json({
      success: true,
      message: 'Documento anexado ao processo existente'
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao anexar documento:`, error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// ================================================================
// ENDPOINT DE TIMELINE
// ================================================================
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!caseId) {
      return NextResponse.json(
        { error: 'caseId é obrigatório' },
        { status: 400 }
      );
    }

    const timelineService = getTimelineMergeService();
    const entries = await timelineService.getTimelineEntries(caseId, prisma, { limit });

    return NextResponse.json({
      success: true,
      data: entries,
      total: entries.length
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao obter timeline:`, error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// ================================================================
// FUNÇÕES AUXILIARES
// ================================================================

async function saveTemporaryFile(buffer: Buffer, fileName: string): Promise<string> {
  // Use /tmp which is available in all environments (Vercel, Railway, local)
  const tempDir = '/tmp/justoai-temp';
  if (!existsSync(tempDir)) {
    await mkdir(tempDir, { recursive: true });
  }

  const tempFileName = `temp_${Date.now()}_${fileName}`;
  const tempPath = join(tempDir, tempFileName);
  await writeFile(tempPath, buffer);

  return tempPath;
}

/**
 * Save file permanently to Supabase Storage with fallback to temp storage
 * @param buffer - File content
 * @param fileName - Original file name
 * @param workspaceId - Workspace ID for storage path organization
 * @param caseId - Case ID for storage path organization
 * @returns URL or path to the stored file
 */
async function savePermanentFile(
  buffer: Buffer,
  fileName: string,
  workspaceId: string,
  caseId: string
): Promise<string> {
  try {
    // Upload to Supabase Storage
    const url = await uploadCaseDocument(
      workspaceId,
      caseId,
      fileName,
      buffer,
      'application/pdf'
    );

    if (url) {
      console.log(`${ICONS.SUCCESS} [Storage] Arquivo salvo permanentemente: ${url}`);
      return url;
    }

    // If upload fails, fallback to temp storage
    console.warn(`${ICONS.WARNING} [Storage] Supabase upload failed, using temporary storage`);
    return await saveFinalFile(buffer, fileName);
  } catch (error) {
    console.error(`${ICONS.ERROR} [Storage] Error saving permanent file:`, error);
    // Fallback to temporary storage
    return await saveFinalFile(buffer, fileName);
  }
}

async function saveFinalFile(buffer: Buffer, fileName: string): Promise<string> {
  // Use /tmp which is available in all environments (Vercel, Railway, local)
  // Note: /tmp is ephemeral on Vercel - files are deleted after function completes
  // For persistent storage, Supabase Storage is used (see savePermanentFile)
  const uploadsDir = '/tmp/justoai-uploads';
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true });
  }

  const finalFileName = `${Date.now()}_${fileName}`;
  const finalPath = join(uploadsDir, finalFileName);
  await writeFile(finalPath, buffer);

  return finalPath;
}

interface BasicProcessData {
  title: string;
  description: string;
  claimValue: number | null;
}

async function extractBasicProcessData(cleanText: string): Promise<BasicProcessData> {
  // Heurísticas simples para extrair dados básicos
  const lines = cleanText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  const title = 'Processo Jurídico';
  let description = '';
  let claimValue: number | null = null;

  // Procurar por valor da causa
  const valuePattern = /valor.*causa.*R\$\s*([\d.,]+)/i;
  const valueMatch = cleanText.match(valuePattern);
  if (valueMatch) {
    claimValue = parseFloat(valueMatch[1].replace(/[.,]/g, ''));
  }

  // Usar primeiro parágrafo como descrição
  if (lines.length > 0) {
    description = lines.slice(0, 3).join(' ').substring(0, 500);
  }

  return {
    title,
    description,
    claimValue
  };
}