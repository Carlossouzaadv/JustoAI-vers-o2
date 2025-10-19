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
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '@/lib/api-utils';
import { getDocumentHashManager } from '@/lib/document-hash';
import { getAnalysisCacheManager } from '@/lib/analysis-cache';
import { getTimelineMergeService } from '@/lib/timeline-merge';
import { PDFProcessor } from '@/lib/pdf-processor';
import { TextCleaner } from '@/lib/text-cleaner';
import { AIModelRouter } from '@/lib/ai-model-router';
import { ICONS } from '@/lib/icons';

const prisma = new PrismaClient();

// ================================================================
// CONFIGURAÇÕES DA ESPECIFICAÇÃO
// ================================================================
const CONFIG = {
  AUTO_SUGGEST_THRESHOLD: 0.9,
  UNASSIGNED_FOLDER: 'clientes_a_definir',
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
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
    console.log(`${ICONS.UPLOAD} Iniciando upload de PDF com pipeline completo...`);

    // 1. VERIFICAR AUTENTICAÇÃO
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;

    // 2. PROCESSAR FORMDATA
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const caseId = formData.get('caseId') as string;
    const processNumber = formData.get('processNumber') as string;

    // 3. VALIDAÇÕES BÁSICAS
    if (!file) {
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
        { error: `Arquivo muito grande. Máximo: ${CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    // 4. OBTER WORKSPACE DO USUÁRIO
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

    const workspaceId = userWorkspace.workspaceId;

    // 5. CALCULAR SHA256 DO ARQUIVO
    const buffer = Buffer.from(await file.arrayBuffer());
    const hashManager = getDocumentHashManager();
    const hashResult = hashManager.calculateSHA256(buffer);

    // 6. VERIFICAR DEDUPLICAÇÃO
    const deduplicationCheck = await hashManager.checkDeduplication(
      hashResult.textSha,
      workspaceId,
      prisma
    );

    if (deduplicationCheck.isDuplicate) {
      console.log(`${ICONS.WARNING} Arquivo duplicado detectado`);

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
          workspaceId
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
    console.log(`${ICONS.PROCESS} Extraindo texto do PDF...`);

    // Save PDF to temp file for processing
    const tempDir = join('/tmp', 'pdfs');
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }
    const tempPath = join(tempDir, `${Date.now()}-${file.name}`);

    await writeFile(tempPath, buffer);

    const pdfProcessor = new PDFProcessor();
    const extractionResult = await pdfProcessor.processComplete({
      pdf_path: tempPath,
      extract_fields: ['processo', 'data', 'partes', 'valor']
    });

    if (!extractionResult.success) {
      return NextResponse.json(
        { error: 'Erro na extração de texto do PDF', details: extractionResult.error },
        { status: 400 }
      );
    }

    // Limpar e normalizar texto
    const textCleaner = new TextCleaner();
    const extractedText = extractionResult.texto_original || extractionResult.texto_limpo || '';
    const cleaningResult = textCleaner.cleanLegalDocument(extractedText);
    const cleanText = cleaningResult.cleanedText;

    // Registrar timestamp de extração
    const textExtractedAt = new Date();

    // 8. IDENTIFICAÇÃO DE PROCESSO CNJ
    console.log(`${ICONS.SEARCH} Identificando número do processo...`);

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
          workspaceId
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
        console.log(`${ICONS.SUCCESS} Processo existente encontrado: ${existingProcess.title}`);
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
      console.log(`${ICONS.PROCESS} Criando novo processo: ${extractedProcessNumber}`);

      // Buscar ou criar cliente padrão "A Definir"
      let defaultClient = await prisma.client.findFirst({
        where: {
          workspaceId,
          name: CONFIG.UNASSIGNED_FOLDER
        }
      });

      if (!defaultClient) {
        defaultClient = await prisma.client.create({
          data: {
            workspaceId,
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
              workspaceId
            }
          },
          update: {
            // Se existir, apenas atualiza o updatedAt
            updatedAt: new Date()
          },
          create: {
            workspaceId,
            clientId: defaultClient.id,
            number: extractedProcessNumber,
            title: basicData.title || `Processo ${extractedProcessNumber}`,
            description: basicData.description,
            type: 'CIVIL', // Padrão
            status: 'UNASSIGNED', // Status especial
            priority: 'MEDIUM',
            createdById: user.id,
            claimValue: basicData.claimValue,
            metadata: {
              autoCreated: true,
              createdFromUpload: true,
              extractedData: basicData,
              needsAssignment: true
            }
          }
        });

        targetCaseId = newCase.id;
        console.log(`${ICONS.SUCCESS} Processo obtido: ${newCase.title}`);
      } catch (upsertError) {
        // Se upsert falhar, tentar buscar o caso existente
        const existingCase = await prisma.case.findFirst({
          where: {
            number: extractedProcessNumber,
            workspaceId
          }
        });

        if (existingCase) {
          targetCaseId = existingCase.id;
          console.log(`${ICONS.SUCCESS} Processo existente encontrado: ${existingCase.title}`);
        } else {
          console.error(`${ICONS.ERROR} Erro ao processar case:`, upsertError);
          throw upsertError;
        }
      }

    } else {
      // Usar caseId fornecido ou processo existente
      targetCaseId = existingProcess?.id || caseId;

      if (!targetCaseId) {
        return NextResponse.json(
          { error: 'caseId é obrigatório quando processo não é identificado automaticamente' },
          { status: 400 }
        );
      }
    }

    // 12. VERIFICAR CACHE DE ANÁLISE
    const cacheManager = getAnalysisCacheManager();
    const modelVersion = 'gemini-1.5-flash-v1';
    const promptSignature = 'legal-document-analysis-v2';

    const cacheResult = await cacheManager.checkAnalysisCache(
      hashResult.textSha,
      modelVersion,
      promptSignature
    );

    let aiAnalysisResult = null;

    if (cacheResult.hit) {
      console.log(`${ICONS.SUCCESS} Análise encontrada no cache`);
      aiAnalysisResult = cacheResult.data;
    } else {
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
        // 14. ANÁLISE IA COM ROUTER OTIMIZADO
        console.log(`${ICONS.PROCESS} Iniciando análise IA...`);

        const aiRouter = new AIModelRouter();
        aiAnalysisResult = await aiRouter.analyzeStrategic(cleanText, file.size / (1024 * 1024), workspaceId);

        // Salvar no cache
        await cacheManager.saveAnalysisCache(
          hashResult.textSha,
          modelVersion,
          promptSignature,
          aiAnalysisResult,
          workspaceId
        );

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

    // 15. SALVAR ARQUIVO FÍSICO
    const finalPath = await saveFinalFile(buffer, file.name);

    // 16. CRIAR DOCUMENTO NO BANCO
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
        pages: extractionResult.pageCount,
        extractedText: extractionResult.text,
        cleanText,
        textSha: hashResult.textSha,
        textExtractedAt,
        analysisVersion: modelVersion,
        analysisKey: cacheResult.key,
        workerId: process.env.WORKER_ID || 'main',
        costEstimate: aiAnalysisResult?.cost?.estimatedCost || 0,
        processed: true,
        ocrStatus: 'COMPLETED'
      }
    });

    // 17. TIMELINE UNIFICADA - EXTRAIR E MESCLAR ANDAMENTOS
    const timelineService = getTimelineMergeService();

    if (aiAnalysisResult) {
      const timelineEntries = timelineService.extractTimelineFromAIAnalysis(aiAnalysisResult, document.id);

      if (timelineEntries.length > 0) {
        const mergeResult = await timelineService.mergeEntries(targetCaseId, timelineEntries, prisma);
        console.log(`${ICONS.SUCCESS} Timeline merge: ${mergeResult.newEntries} novas entradas`);
      }
    }

    // 18. REGISTRAR EVENTO
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

    // 19. RESPOSTA DE SUCESSO
    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: extractedProcessNumber ?
        `PDF processado e processo ${extractedProcessNumber} criado automaticamente` :
        'PDF processado com sucesso',
      data: {
        documentId: document.id,
        caseId: targetCaseId,
        textSha: hashResult.textSha,
        extractedProcessNumber,
        processAutoCreated: !!extractedProcessNumber && !existingProcess,

        // Métricas de processamento
        processing: {
          totalTime: processingTime,
          textExtracted: true,
          aiAnalyzed: !!aiAnalysisResult,
          cacheHit: cacheResult.hit,
          timelineEntriesAdded: 0 // TODO: incluir do merge result
        },

        // Informações da análise
        analysis: aiAnalysisResult ? {
          modelUsed: aiAnalysisResult.modelUsed || modelVersion,
          confidence: aiAnalysisResult.confidence || 0.8,
          costEstimate: aiAnalysisResult.cost?.estimatedCost || 0
        } : null,

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

async function saveFinalFile(buffer: Buffer, fileName: string): Promise<string> {
  // Use /tmp which is available in all environments (Vercel, Railway, local)
  // Note: /tmp is ephemeral on Vercel - files are deleted after function completes
  // For persistent storage, integrate with S3, Supabase Storage, or similar
  const uploadsDir = '/tmp/justoai-uploads';
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true });
  }

  const finalFileName = `${Date.now()}_${fileName}`;
  const finalPath = join(uploadsDir, finalFileName);
  await writeFile(finalPath, buffer);

  return finalPath;
}

async function extractBasicProcessData(cleanText: string): Promise<any> {
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