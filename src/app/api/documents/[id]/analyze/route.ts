// app/api/documents/[id]/analyze/route.ts - Analisar documento específico
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { AIModelRouter } from '@/lib/ai-model-router';
import { PDFProcessor } from '@/lib/pdf-processor';
import { requireAuth } from '@/lib/api-utils';
import { z } from 'zod';
import { getCredits, debitCredits } from '@/lib/services/creditService';
import { isInternalDivinityAdmin } from '@/lib/permission-validator';
import { juditAPI, JuditOperationType } from '@/lib/judit-api-wrapper';
import { CreditCategory } from '@/lib/types/database';

const prisma = new PrismaClient();

const analyzeSchema = z.object({
  forceReanalysis: z.boolean().default(false),
  customFields: z.array(z.string()).optional()
});

interface AnalysisVersionData {
  id: string;
  version: number;
  modelUsed: string | null;
  confidence: number | null;
  costEstimate: number | null;
  processingTime: number | bigint | null;
  createdAt: Date;
  status: string | null;
  metadata: unknown;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  try {
    // 1. Verificar autenticação
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;

    const { id: documentId } = await params;
    const body = await request.json();
    const { forceReanalysis, customFields } = analyzeSchema.parse(body);

    // 2. Buscar documento com verificação de permissão
    const document = await prisma.caseDocument.findFirst({
      where: {
        id: documentId,
        case: {
          workspace: {
            users: {
              some: {
                userId: user.id
              }
            }
          }
        }
      },
      include: {
        case: {
          select: {
            id: true,
            title: true,
            workspaceId: true
          }
        }
      }
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Documento não encontrado ou sem permissão' },
        { status: 404 }
      );
    }

    // 3. Verificar se já existe análise e se deve reanalisar
    if (!forceReanalysis) {
      const existingAnalysis = await prisma.caseAnalysisVersion.findFirst({
        where: {
          caseId: document.caseId,
          analysisType: 'PDF_UPLOAD'
        },
        orderBy: {
          version: 'desc'
        }
      });

      if (existingAnalysis) {
        return NextResponse.json({
          message: 'Análise já existe. Use forceReanalysis=true para reanalizar',
          existingAnalysis: {
            id: existingAnalysis.id,
            version: existingAnalysis.version,
            modelUsed: existingAnalysis.modelUsed,
            createdAt: existingAnalysis.createdAt,
            confidence: existingAnalysis.confidence
          }
        });
      }
    }

    // 4. Inicializar processadores
    const pdfProcessor = new PDFProcessor();
    const modelRouter = new AIModelRouter();

    // 5. Reprocessar PDF se necessário
    interface PDFProcessResult {
      success: boolean;
      error?: string;
      texto_ai_friendly?: string;
      file_size_mb?: number;
      extracted_fields?: string[];
      [key: string]: unknown;
    }

    let pdfResult: PDFProcessResult | null = null;

    if (document.mimeType === 'application/pdf' && document.path) {
      const extractFields = customFields?.length
        ? customFields
        : pdfProcessor.getDefaultExtractionFields();

      const rawResult = await pdfProcessor.processComplete({
        pdf_path: document.path,
        extract_fields: extractFields,
        custom_fields: customFields
      });

      // Validate result structure using type guard (narrowing seguro)
      function isPDFProcessResult(data: unknown): data is PDFProcessResult {
        return (
          typeof data === 'object' &&
          data !== null &&
          'success' in data &&
          typeof (data as PDFProcessResult).success === 'boolean'
        );
      }

      if (isPDFProcessResult(rawResult)) {
        pdfResult = rawResult;
      } else {
        return NextResponse.json(
          { error: 'Invalid PDF processor response' },
          { status: 500 }
        );
      }

      if (!pdfResult.success) {
        return NextResponse.json(
          { error: 'Erro no reprocessamento do PDF', details: pdfResult.error },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Documento não é um PDF válido ou arquivo não encontrado' },
        { status: 400 }
      );
    }

    // 6. Check credits before AI analysis (analyzeStrategic costs 1 credit)
    const isDivinity = isInternalDivinityAdmin(user.email);
    if (!isDivinity && pdfResult?.texto_ai_friendly) {
      const credits = await getCredits(user.email, document.case.workspaceId);
      if (credits.fullCredits < 1) {
        return NextResponse.json(
          {
            success: false,
            error: 'Créditos insuficientes para análise estratégica',
            required: 1,
            available: credits.fullCredits,
            message: 'Você precisa de 1 crédito FULL para aprofundar a análise. Entre em contato com o suporte para adquirir mais créditos.'
          },
          { status: 402 } // Payment Required
        );
      }
    }

    // 7. Análise IA ESTRATÉGICA COMPLETA (sempre cobra dos créditos completos)
    // Esta função "Aprofundar Análise" sempre utiliza analyzeStrategic (não analyzeEssential)
    // para fornecer insights detalhados e deve ser cobrada dos créditos de análise completa
    interface AIAnalysisResult {
      tipo_processo?: string;
      complexidade?: string;
      resumo?: string;
      _routing_info?: {
        final_tier?: string;
        complexity_score?: number;
        cost_estimate?: {
          estimated_cost_usd?: number;
        };
        escalated?: boolean;
      };
      [key: string]: unknown;
    }

    let aiAnalysis: AIAnalysisResult | null = null;
    let routingInfo: AIAnalysisResult['_routing_info'] | null = null;

    if (pdfResult?.texto_ai_friendly) {
      try {
        const analysisResult = await modelRouter.analyzeStrategic(
          pdfResult.texto_ai_friendly,
          pdfResult.file_size_mb || 0
        );

        // Validate analysis result using type guard (narrowing seguro)
        function isAIAnalysisResult(data: unknown): data is AIAnalysisResult {
          return (
            typeof data === 'object' &&
            data !== null &&
            '_routing_info' in data
          );
        }

        if (isAIAnalysisResult(analysisResult)) {
          aiAnalysis = analysisResult;
          routingInfo = aiAnalysis._routing_info || null;
        }

      } catch (aiError) {
        console.error('Erro na análise IA:', aiError);

        return NextResponse.json(
          { error: 'Erro na análise IA', details: aiError instanceof Error ? aiError.message : 'Erro desconhecido' },
          { status: 500 }
        );
      }
    }

    // 7. Determinar próxima versão
    const lastVersion = await prisma.caseAnalysisVersion.findFirst({
      where: { caseId: document.caseId },
      orderBy: { version: 'desc' },
      select: { version: true }
    });

    const nextVersion = (lastVersion?.version || 0) + 1;

    // 8. Salvar nova versão da análise
    const analysisVersion = await prisma.caseAnalysisVersion.create({
      data: {
        case: {
          connect: { id: document.caseId }
        },
        workspace: {
          connect: { id: document.case.workspaceId }
        },
        version: nextVersion,
        analysisType: 'PDF_UPLOAD',
        // JSON.parse(JSON.stringify()) ensures JSON-safety by removing non-serializable properties
        extractedData: pdfResult ? JSON.parse(JSON.stringify(pdfResult)) : undefined,
        aiAnalysis: aiAnalysis ? JSON.stringify(JSON.parse(JSON.stringify(aiAnalysis))) : undefined,
        modelUsed: routingInfo?.final_tier || 'gemini-2.5-flash',
        confidence: aiAnalysis ? 0.85 : 0.5, // Confiança menor se não houve análise IA
        processingTime: Date.now() - startTime,
        costEstimate: routingInfo?.cost_estimate?.estimated_cost_usd || 0.001,
        metadata: {
          document_id: documentId,
          file_size_mb: pdfResult.file_size_mb,
          extracted_fields_count: pdfResult.extracted_fields?.length || 0,
          custom_fields_count: customFields?.length || 0,
          routing_info: routingInfo,
          force_reanalysis: forceReanalysis
        }
      }
    });

    // 8.5. Debit credits if AI analysis was performed and not a divinity admin
    if (!isDivinity && aiAnalysis) {
      const debitResult = await debitCredits(
        user.email,
        document.case.workspaceId,
        1,
        CreditCategory.FULL,
        `Strategic analysis for document ${documentId} - Case ${document.caseId}`
      );

      // Use narrowing seguro to safely access newBalance
      if (debitResult.success && debitResult.newBalance) {
        console.log(`Credits debited: 1 FULL credit (new balance: ${debitResult.newBalance.fullCredits})`);
      } else {
        console.warn(`Failed to debit credits: ${debitResult.reason}`);
        // Log but don't fail the request - the analysis was already completed
      }
    }

    // 9. Criar evento no caso
    await prisma.caseEvent.create({
      data: {
        caseId: document.caseId,
        userId: user.id,
        type: 'OTHER',
        title: `Análise v${nextVersion} concluída`,
        description: `Documento "${document.name}" foi ${forceReanalysis ? 'reanalisado' : 'analisado'} com ${routingInfo?.final_tier || 'modelo padrão'}.`,
        metadata: {
          documentId: document.id,
          analysisVersionId: analysisVersion.id,
          routing_info: routingInfo,
          version: nextVersion
        }
      }
    });

    // 9.5. Track telemetry
    await juditAPI.trackCall({
      workspaceId: document.case.workspaceId,
      operationType: JuditOperationType.ANALYSIS,
      durationMs: Date.now() - startTime,
      success: true,
      requestId: analysisVersion.id,
      metadata: {
        eventType: 'document.analyzed',
        documentId: document.id,
        analysisType: 'PDF_UPLOAD',
        model: routingInfo?.final_tier || 'gemini-2.5-flash',
        confidence: analysisVersion.confidence,
        forceReanalysis,
        creditsUsed: aiAnalysis && !isDivinity ? 1 : 0,
      },
    });

    // 10. Resposta de sucesso
    return NextResponse.json({
      success: true,
      message: `Análise v${nextVersion} concluída com sucesso`,
      data: {
        analysisVersionId: analysisVersion.id,
        version: nextVersion,
        documentId: document.id,
        caseId: document.caseId,
        analysis_info: {
          model_used: routingInfo?.final_tier,
          complexity_score: routingInfo?.complexity_score,
          cost_estimate: routingInfo?.cost_estimate,
          escalated: routingInfo?.escalated || false,
          confidence: analysisVersion.confidence
        },
        pdf_processing: {
          extracted_fields: pdfResult.extracted_fields?.length || 0,
          file_size_mb: pdfResult.file_size_mb,
          success: pdfResult.success
        },
        ai_analysis: aiAnalysis ? {
          tipo_processo: aiAnalysis.tipo_processo,
          complexidade: aiAnalysis.complexidade,
          resumo: aiAnalysis.resumo?.substring(0, 200) + '...' // Resumo truncado
        } : null
      }
    });

  } catch (error) {
    console.error('Erro na análise do documento:', error);

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Verificar autenticação
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;

    const { id: documentId } = await params;

    // 2. Buscar documento e análises
    const document = await prisma.caseDocument.findFirst({
      where: {
        id: documentId,
        case: {
          workspace: {
            users: {
              some: {
                userId: user.id
              }
            }
          }
        }
      },
      include: {
        case: {
          include: {
            analysisVersions: {
              where: {
                analysisType: 'PDF_UPLOAD'
              },
              orderBy: {
                version: 'desc'
              },
              take: 5 // Últimas 5 versões
            }
          }
        }
      }
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Documento não encontrado ou sem permissão' },
        { status: 404 }
      );
    }

    // 3. Formatar resposta
    const analyses = document.case.analysisVersions.map((analysis: AnalysisVersionData) => ({
      id: analysis.id,
      version: analysis.version,
      modelUsed: analysis.modelUsed,
      confidence: analysis.confidence,
      costEstimate: analysis.costEstimate,
      processingTime: analysis.processingTime,
      createdAt: analysis.createdAt,
      status: analysis.status,
      metadata: analysis.metadata
    }));

    return NextResponse.json({
      document: {
        id: document.id,
        fileName: document.name,
        fileType: document.type,
        fileSize: document.size,
        status: document.ocrStatus,
        createdAt: document.createdAt
      },
      case: {
        id: document.case.id,
        title: document.case.title
      },
      analyses: analyses,
      total_analyses: analyses.length,
      latest_analysis: analyses[0] || null
    });

  } catch (error) {
    console.error('Erro ao buscar análises do documento:', error);

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