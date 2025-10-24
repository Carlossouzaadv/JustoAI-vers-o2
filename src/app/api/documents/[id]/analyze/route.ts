// app/api/documents/[id]/analyze/route.ts - Analisar documento específico
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { AIModelRouter } from '@/lib/ai-model-router';
import { PDFProcessor } from '@/lib/pdf-processor';
import { requireAuth } from '@/lib/api-utils';
import { z } from 'zod';

const prisma = new PrismaClient();

const analyzeSchema = z.object({
  forceReanalysis: z.boolean().default(false),
  customFields: z.array(z.string()).optional()
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
            title: true
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
    const pdfProcessor = new PDFProcessor(prisma);
    const modelRouter = new AIModelRouter();

    // 5. Reprocessar PDF se necessário
    let pdfResult: any = null;

    if (document.mimeType === 'application/pdf' && document.path) {
      const extractFields = customFields?.length
        ? customFields
        : pdfProcessor.getDefaultExtractionFields();

      pdfResult = await pdfProcessor.processComplete({
        pdf_path: document.path,
        extract_fields: extractFields,
        custom_fields: customFields
      });

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

    // 6. Análise IA ESTRATÉGICA COMPLETA (sempre cobra dos créditos completos)
    // Esta função "Aprofundar Análise" sempre utiliza analyzeStrategic (não analyzeEssential)
    // para fornecer insights detalhados e deve ser cobrada dos créditos de análise completa
    let aiAnalysis = null;
    let routingInfo = null;

    if (pdfResult?.texto_ai_friendly) {
      try {
        const analysisResult = await modelRouter.analyzeStrategic(
          pdfResult.texto_ai_friendly,
          pdfResult.file_size_mb || 0
        );

        aiAnalysis = analysisResult;
        routingInfo = analysisResult._routing_info;

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
        version: nextVersion,
        analysisType: 'PDF_UPLOAD',
        extractedData: pdfResult,
        aiAnalysis,
        modelUsed: routingInfo?.final_tier || 'gemini-2.5-flash',
        confidence: aiAnalysis ? 0.85 : 0.5, // Confiança menor se não houve análise IA
        processingTime: Date.now(), // TODO: medir tempo real
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
    const analyses = document.case.analysisVersions.map(analysis => ({
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