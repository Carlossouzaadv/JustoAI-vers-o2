// ================================================================
// UPLOAD API - Implementa Pipeline Otimizado do JustoAI V2
// ================================================================
// Integra PDF processing, text cleaning, AI routing e economia de tokens

import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { TokenOptimizer, OptimizationOptions } from '@/lib/token-optimizer';
import { ModelTier } from '@/lib/ai-model-router';
import { requireAuth } from '@/lib/api-utils';

const prisma = new PrismaClient();

// Schema de validação
const uploadSchema = z.object({
  caseId: z.string().cuid(),
  extractFields: z.array(z.string()).optional(),
  customFields: z.array(z.string()).optional()
});

export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticação
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;

    // 2. Processar FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const caseId = formData.get('caseId') as string;
    const extractFields = JSON.parse(formData.get('extractFields') as string || '[]');
    const customFields = JSON.parse(formData.get('customFields') as string || '[]');

    // 3. Validar entrada
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

    const validation = uploadSchema.safeParse({
      caseId,
      extractFields,
      customFields
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.issues },
        { status: 400 }
      );
    }

    // 4. Verificar se case existe e usuário tem acesso
    const caseRecord = await prisma.case.findFirst({
      where: {
        id: caseId,
        workspace: {
          users: {
            some: {
              userId: user.id
            }
          }
        }
      }
    });

    if (!caseRecord) {
      return NextResponse.json(
        { error: 'Caso não encontrado ou sem permissão' },
        { status: 404 }
      );
    }

    // 5. Preparar arquivo para processamento
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 6. Determinar plano do usuário (TODO: obter do banco)
    const userPlan = 'professional'; // Placeholder - deve vir do workspace/user

    // 7. Configurar opções de otimização
    const optimizationOptions: OptimizationOptions = {
      documentType: 'legal',
      userPlan,
      aggressiveness: 'balanced',
      preserveStructure: true
    };

    // 8. Executar pipeline completo de otimização
    console.log('🚀 Iniciando pipeline de otimização V2...');
    const tokenOptimizer = new TokenOptimizer();

    const optimizationResult = await tokenOptimizer.optimizeDocument(
      buffer,
      file.name,
      optimizationOptions
    );

    console.log(`💰 Economia obtida: ${optimizationResult.savingsPercentage}% | Modelo: ${optimizationResult.selectedModel}`);

    // 9. Verificar se processo já existe (lógica principal do fluxo)
    let existingProcess = null;
    let isExistingProcess = false;
    let shouldPromptUser = false;

    if (optimizationResult.extractedProcessNumber) {
      console.log(`🔍 Verificando processo existente: ${optimizationResult.extractedProcessNumber}`);

      // Buscar processo existente do usuário
      existingProcess = await prisma.case.findFirst({
        where: {
          processNumber: optimizationResult.extractedProcessNumber,
          workspace: {
            users: {
              some: {
                userId: user.id
              }
            }
          }
        },
        include: {
          _count: {
            select: {
              documents: true
            }
          }
        }
      });

      if (existingProcess) {
        isExistingProcess = true;
        shouldPromptUser = true;
        console.log(`✅ Processo encontrado: ${existingProcess.title} (${existingProcess._count.documents} documentos)`);
      } else {
        console.log('ℹ️ Processo não encontrado - será criado automaticamente');
      }
    } else {
      console.log('⚠️ Número do processo não identificado - documento será anexado ao caso fornecido');
    }

    // 10. Se processo existe, retornar resposta para prompt do usuário
    if (shouldPromptUser && existingProcess) {
      return NextResponse.json({
        success: true,
        requiresUserDecision: true,
        message: 'Processo existente identificado',
        data: {
          extractedProcessNumber: optimizationResult.extractedProcessNumber,
          existingProcess: {
            id: existingProcess.id,
            title: existingProcess.title,
            processNumber: existingProcess.processNumber,
            documentCount: existingProcess._count.documents
          },
          optimization_metrics: {
            token_reduction: optimizationResult.totalTokenReduction,
            savings_percentage: optimizationResult.savingsPercentage,
            quality_score: optimizationResult.qualityScore
          },
          promptMessage: `Identificamos que este documento pertence ao processo "${existingProcess.title}" (${existingProcess.processNumber}). Deseja anexá-lo a este processo?`
        }
      });
    }

    // 11. Determinar caso de destino (existente ou fornecido pelo usuário)
    const targetCaseId = isExistingProcess && existingProcess ? existingProcess.id : caseId;

    // 12. Salvar arquivo físico apenas se necessário
    const uploadsDir = join(process.cwd(), 'uploads', 'pdfs');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    const fileName = `${Date.now()}-${file.name}`;
    const filePath = join(uploadsDir, fileName);
    await writeFile(filePath, buffer);

    // 13. Processar com IA usando configuração otimizada
    // Decisão: análise completa (novo processo) vs análise rápida (processo existente)
    let aiProcessingResult = null;
    let aiError = null;
    let analysisType = isExistingProcess ? 'quick_update' : 'complete_analysis';

    try {
      console.log(`🤖 Iniciando análise IA: ${analysisType}`);

      // Função de processamento IA que será chamada pelo optimizer
      const aiProcessingFunction = async (config: any, text: string) => {
        // TODO: Implementar chamada real para Gemini AI
        console.log(`🤖 Simulando ${analysisType} com modelo ${config.model}...`);

        if (analysisType === 'quick_update') {
          // ETAPA 1: Extração Bruta de Andamentos (IA Flash - mais barata)
          const extractionPrompt = `Você é um assistente de IA altamente eficiente, especializado em extrair eventos cronológicos de documentos jurídicos.

INSTRUÇÕES CRÍTICAS:
1. Analise o documento anexo e identifique TODOS os andamentos, eventos ou decisões que possuam uma data associada e que sejam efetivamente um andamento relacionado a este processo.
2. Para cada evento encontrado, extraia sua data, o tipo de evento (ex: Juntada de Petição, Despacho, Decisão, Sentença) e um resumo objetivo do ocorrido.
3. Organize os eventos em ordem cronológica, do mais antigo para o mais novo.
4. Retorne a resposta como um array JSON de andamentos. Se nenhum evento for encontrado, retorne um array vazio: [].

SCHEMA DE SAÍDA OBRIGATÓRIO:
[
  {
    "data_andamento": "DD/MM/AAAA",
    "tipo_andamento": "TIPO_DO_EVENTO_EXTRAIDO",
    "resumo_andamento": "RESUMO_OBJETIVO_DO_EVENTO_EXTRAIDO"
  }
]`;

          // Simular extração da IA (seria chamada real para Gemini Flash)
          const extractedEvents = [
            {
              data_andamento: new Date().toLocaleDateString('pt-BR'),
              tipo_andamento: "Juntada de Documento",
              resumo_andamento: `Juntada do documento "${file.name}" ao processo`
            },
            // TODO: Aqui seria a resposta real do Gemini Flash
          ];

          return {
            analysis_type: 'quick_update',
            extraction_phase: 'completed',
            raw_events_extracted: extractedEvents,
            prompt_used: extractionPrompt,
            confidence: optimizationResult.confidence,
            processing_time: optimizationResult.processingTime * 0.3, // IA Flash é mais rápida
            model_used: 'gemini-1.5-flash-8b', // Força uso do modelo mais barato
            text_analyzed_length: text.length,
            note: 'ETAPA 1 concluída - ETAPA 2 (reconciliação) será executada pelo backend'
          };
        } else {
          // Análise completa para novo processo
          const fieldsToExtract = extractFields.length > 0 ? extractFields : [
            "Número do Processo", "Tipo Processual", "Parte (nome completo)",
            "CNPJ/CPF da Parte", "Valor Principal", "Situação atual do processo",
            "Tese Jurídica", "Risco", "Principais andamentos cronológicos"
          ];

          return {
            analysis_type: 'complete_analysis',
            extracted_data: fieldsToExtract.reduce((acc, field) => {
              acc[field] = `Valor simulado para ${field}`;
              return acc;
            }, {} as Record<string, string>),
            confidence: optimizationResult.confidence,
            processing_time: optimizationResult.processingTime,
            model_used: config.model,
            text_analyzed_length: text.length
          };
        }
      };

      aiProcessingResult = await tokenOptimizer.processWithOptimizedAI(
        optimizationResult,
        aiProcessingFunction
      );

      // ETAPA 2: Reconciliação e 'Diff' (apenas para processos existentes)
      if (isExistingProcess && aiProcessingResult?.result?.analysis_type === 'quick_update') {
        console.log('🔄 Executando ETAPA 2: Reconciliação de andamentos...');

        try {
          // 1. Obter lista de andamentos extraídos pela IA
          const rawEventsFromAI = aiProcessingResult.result.raw_events_extracted || [];

          // 2. Buscar andamentos existentes no banco de dados
          const existingEvents = await prisma.caseEvent.findMany({
            where: {
              caseId: targetCaseId,
              type: { in: ['HEARING', 'DECISION', 'MOTION', 'DOCUMENT_RECEIVED'] }
            },
            select: {
              createdAt: true,
              title: true,
              description: true,
              type: true
            },
            orderBy: {
              createdAt: 'asc'
            }
          });

          // 3. Criar identificadores únicos dos andamentos existentes
          const existingIdentifiers = new Set();
          existingEvents.forEach(event => {
            const dateStr = new Date(event.createdAt).toLocaleDateString('pt-BR');
            const identifier = `${dateStr}_${event.title?.substring(0, 50) || event.description?.substring(0, 50) || ''}`;
            existingIdentifiers.add(identifier.toLowerCase().replace(/\s+/g, '_'));
          });

          // 4. Filtrar apenas andamentos novos
          const newEventsToSave = rawEventsFromAI.filter((eventFromAI: any) => {
            const identifier = `${eventFromAI.data_andamento}_${eventFromAI.resumo_andamento?.substring(0, 50) || ''}`;
            const normalizedId = identifier.toLowerCase().replace(/\s+/g, '_');
            return !existingIdentifiers.has(normalizedId);
          });

          console.log(`📊 Reconciliação: ${rawEventsFromAI.length} extraídos | ${existingEvents.length} existentes | ${newEventsToSave.length} novos`);

          // 5. Salvar apenas andamentos novos no banco
          const savedNewEvents = [];
          for (const newEvent of newEventsToSave) {
            const savedEvent = await prisma.caseEvent.create({
              data: {
                caseId: targetCaseId,
                userId: user.id,
                type: 'DOCUMENT_UPDATE',
                title: newEvent.tipo_andamento,
                description: newEvent.resumo_andamento,
                metadata: {
                  data_original: newEvent.data_andamento,
                  source: 'ai_extraction_v2',
                  document_source: file.name
                }
              }
            });
            savedNewEvents.push(savedEvent);
          }

          // 6. Atualizar resultado da análise IA com informações da reconciliação
          aiProcessingResult.result.reconciliation = {
            total_extracted: rawEventsFromAI.length,
            existing_events: existingEvents.length,
            new_events_saved: savedNewEvents.length,
            new_events_details: savedNewEvents,
            reconciliation_completed: true
          };

          console.log(`✅ ETAPA 2 concluída: ${savedNewEvents.length} novos andamentos salvos`);

        } catch (reconciliationError) {
          console.error('❌ Erro na reconciliação:', reconciliationError);

          // Adicionar informação de erro sem falhar o processo
          if (aiProcessingResult.result) {
            aiProcessingResult.result.reconciliation = {
              error: 'Erro na reconciliação de andamentos',
              reconciliation_completed: false
            };
          }
        }
      }

    } catch (error) {
      aiError = error;
      console.error('❌ Erro na análise IA:', error);
      // Continuar sem análise IA - o PDF foi processado com sucesso
    }

    // 14. Salvar documento no banco (no caso correto)
    const document = await prisma.caseDocument.create({
      data: {
        caseId: targetCaseId,
        name: file.name,
        originalName: file.name,
        path: filePath,
        type: 'CONTRACT',
        size: file.size,
        mimeType: 'application/pdf',
        url: filePath,
        ocrStatus: 'COMPLETED'
      }
    });

    // 12. Salvar versão da análise com métricas de otimização
    let analysisVersion = null;
    if (aiProcessingResult) {
      try {
        analysisVersion = await prisma.caseAnalysisVersion.create({
          data: {
            caseId: targetCaseId,
            version: 1, // TODO: implementar incremento correto
            analysisType: 'PDF_UPLOAD_V2',
            extractedData: {
              optimization_metrics: {
                total_token_reduction: optimizationResult.totalTokenReduction,
                savings_percentage: optimizationResult.savingsPercentage,
                estimated_cost_saving: optimizationResult.estimatedCostSaving,
                quality_score: optimizationResult.qualityScore,
                confidence: optimizationResult.confidence,
                processing_time: optimizationResult.processingTime
              },
              extraction_result: optimizationResult.extractionResult,
              cleaning_result: optimizationResult.cleaningResult,
              complexity_analysis: optimizationResult.complexityAnalysis,
              ai_result: aiProcessingResult?.result
            },
            aiAnalysis: aiProcessingResult?.result,
            modelUsed: aiProcessingResult?.modelUsed || optimizationResult.selectedModel,
            confidence: optimizationResult.confidence,
            processingTime: optimizationResult.processingTime,
            costEstimate: aiProcessingResult?.actualCost?.estimatedCost || 0.001,
            metadata: {
              file_size_mb: buffer.length / (1024 * 1024),
              optimization_pipeline: 'V2',
              selected_model: optimizationResult.selectedModel,
              token_reduction: optimizationResult.totalTokenReduction,
              patterns_applied: optimizationResult.cleaningResult.patternsRemoved.length
            }
          }
        });
      } catch (analysisError) {
        console.error('Erro ao salvar análise:', analysisError);
      }
    }

    // 16. Criar evento no caso
    const eventTitle = isExistingProcess ?
      'Documento anexado a processo existente' :
      'PDF processado com pipeline V2 otimizado';

    const eventDescription = isExistingProcess ?
      `Documento "${file.name}" anexado ao processo ${optimizationResult.extractedProcessNumber}. ${analysisType} executada.` :
      `Arquivo "${file.name}" processado com sucesso. ${optimizationResult.savingsPercentage}% economia de tokens. ${aiProcessingResult ? 'Análise IA concluída.' : aiError ? 'Erro na análise IA.' : 'Análise IA não executada.'}`;

    await prisma.caseEvent.create({
      data: {
        caseId: targetCaseId,
        userId: user.id,
        type: isExistingProcess ? 'DOCUMENT_ATTACHED' : 'DOCUMENT_RECEIVED',
        title: eventTitle,
        description: eventDescription,
        metadata: {
          documentId: document.id,
          analysisVersionId: analysisVersion?.id,
          extractedProcessNumber: optimizationResult.extractedProcessNumber,
          isExistingProcess,
          analysisType,
          optimization_metrics: {
            token_reduction: optimizationResult.totalTokenReduction,
            savings_percentage: optimizationResult.savingsPercentage,
            model_used: aiProcessingResult?.modelUsed || optimizationResult.selectedModel,
            quality_score: optimizationResult.qualityScore
          },
          v2_pipeline: true
        }
      }
    });

    // 14. Gerar relatório de otimização
    const optimizationReport = tokenOptimizer.generateOptimizationReport(optimizationResult);

    // 17. Resposta de sucesso com métricas completas
    const successMessage = isExistingProcess ?
      `PDF anexado ao processo existente ${optimizationResult.extractedProcessNumber}` :
      'PDF processado com pipeline V2 otimizado';

    return NextResponse.json({
      success: true,
      message: successMessage,
      processFlow: {
        extractedProcessNumber: optimizationResult.extractedProcessNumber,
        isExistingProcess,
        targetCaseId,
        analysisType,
        userPromptSkipped: !shouldPromptUser
      },
      data: {
        documentId: document.id,
        analysisVersionId: analysisVersion?.id,

        // Métricas de otimização V2
        optimization: {
          token_reduction: optimizationResult.totalTokenReduction,
          savings_percentage: optimizationResult.savingsPercentage,
          estimated_cost_saving: optimizationResult.estimatedCostSaving,
          quality_score: optimizationResult.qualityScore,
          confidence: optimizationResult.confidence,
          processing_time: optimizationResult.processingTime
        },

        // Detalhes do processamento
        processing_details: {
          extraction: {
            method: optimizationResult.extractionResult.method,
            quality: optimizationResult.extractionResult.quality,
            success: optimizationResult.extractionResult.success,
            original_length: optimizationResult.extractionResult.originalLength,
            processed_length: optimizationResult.extractionResult.processedLength
          },
          cleaning: {
            reduction_percentage: optimizationResult.cleaningResult.reductionPercentage,
            patterns_removed: optimizationResult.cleaningResult.patternsRemoved,
            confidence: optimizationResult.cleaningResult.confidence
          },
          complexity: {
            total_score: optimizationResult.complexityAnalysis.totalScore,
            recommended_model: optimizationResult.complexityAnalysis.recommendedTier,
            factors: optimizationResult.complexityAnalysis.factors
          }
        },

        // Resultado da análise IA
        ai_analysis: aiProcessingResult ? {
          success: true,
          model_used: aiProcessingResult.modelUsed,
          actual_cost: aiProcessingResult.actualCost,
          result: aiProcessingResult.result,
          savings_report: aiProcessingResult.savingsReport
        } : {
          success: false,
          reason: aiError ? 'Erro na análise IA' : 'Análise IA não executada',
          error: aiError?.message
        },

        // Relatório detalhado
        optimization_report: optimizationReport,

        // Resumo executivo
        summary: {
          pipeline_version: 'V2',
          total_time: optimizationResult.processingTime,
          pdf_extracted: true,
          ai_analyzed: !!aiProcessingResult,
          stored_in_db: true,
          cost_optimized: true,
          tokens_saved: optimizationResult.totalTokenReduction,
          model_selected: optimizationResult.selectedModel
        }
      }
    });

  } catch (error) {
    console.error('Erro no upload de PDF:', error);

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

export async function GET() {
  return NextResponse.json({
    message: 'Endpoint para upload de PDF',
    method: 'POST',
    content_type: 'multipart/form-data',
    required_fields: ['file', 'caseId'],
    optional_fields: ['extractFields', 'customFields']
  });
}