// app/api/documents/upload/route.ts - Upload de PDF com análise completa
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { createClient } from '@/lib/supabase';
import { PrismaClient } from '@prisma/client';
import { PDFProcessor } from '@/lib/pdf-processor';
import { ModelRouter } from '@/lib/model-router';
import { z } from 'zod';

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
    const supabase = createClient();
    const { data: { session }, error: authError } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

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
          userWorkspaces: {
            some: {
              userId: session.user.id
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

    // 5. Criar diretório uploads se não existir
    const uploadsDir = join(process.cwd(), 'uploads', 'pdfs');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // 6. Salvar arquivo temporário
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileName = `${Date.now()}-${file.name}`;
    const filePath = join(uploadsDir, fileName);

    await writeFile(filePath, buffer);

    // 7. Inicializar processadores
    const pdfProcessor = new PDFProcessor(prisma);
    const modelRouter = new ModelRouter(
      process.env.GOOGLE_API_KEY!,
      process.env.GOOGLE_CLOUD_PROJECT_ID
    );

    // 8. Processar PDF
    const fieldsToExtract = extractFields.length > 0
      ? extractFields
      : pdfProcessor.getDefaultExtractionFields();

    const pdfResult = await pdfProcessor.processComplete({
      pdf_path: filePath,
      extract_fields: fieldsToExtract,
      custom_fields: customFields
    });

    if (!pdfResult.success) {
      return NextResponse.json(
        { error: 'Erro no processamento do PDF', details: pdfResult.error },
        { status: 500 }
      );
    }

    // 9. Análise IA com routing inteligente
    let aiAnalysis = null;
    let routingInfo = null;

    try {
      if (pdfResult.texto_ai_friendly) {
        const analysisResult = await modelRouter.analyzeDocument(
          pdfResult.texto_ai_friendly,
          pdfResult.file_size_mb || 0
        );

        aiAnalysis = analysisResult;
        routingInfo = analysisResult._routing_info;
      }
    } catch (aiError) {
      console.error('Erro na análise IA:', aiError);
      // Continuar sem análise IA - o PDF foi processado com sucesso
    }

    // 10. Salvar documento no banco
    const document = await prisma.caseDocument.create({
      data: {
        caseId,
        uploadedById: session.user.id,
        fileName: file.name,
        originalFileName: file.name,
        filePath,
        fileType: 'PDF',
        fileSize: file.size,
        status: 'PROCESSED',
        metadata: {
          extracted_fields: fieldsToExtract,
          custom_fields: customFields,
          processing_time: Date.now(),
          file_size_mb: pdfResult.file_size_mb
        }
      }
    });

    // 11. Salvar versão da análise
    let analysisVersion = null;
    if (aiAnalysis) {
      try {
        analysisVersion = await pdfProcessor.saveAnalysisVersion(
          caseId,
          pdfResult,
          routingInfo?.final_tier || 'gemini-1.5-flash',
          aiAnalysis
        );
      } catch (analysisError) {
        console.error('Erro ao salvar análise:', analysisError);
      }
    }

    // 12. Criar evento no caso
    await prisma.caseEvent.create({
      data: {
        caseId,
        userId: session.user.id,
        type: 'DOCUMENT_UPLOADED',
        title: 'PDF processado e analisado',
        description: `Arquivo "${file.name}" foi processado com sucesso. ${aiAnalysis ? 'Análise IA concluída.' : 'Análise IA não executada.'}`,
        metadata: {
          documentId: document.id,
          analysisVersionId: analysisVersion?.id,
          routing_info: routingInfo,
          extracted_fields_count: fieldsToExtract.length
        }
      }
    });

    // 13. Resposta de sucesso
    return NextResponse.json({
      success: true,
      message: 'PDF processado com sucesso',
      data: {
        documentId: document.id,
        analysisVersionId: analysisVersion?.id,
        pdf_processing: {
          success: pdfResult.success,
          extracted_fields: fieldsToExtract.length,
          file_size_mb: pdfResult.file_size_mb
        },
        ai_analysis: aiAnalysis ? {
          success: true,
          model_used: routingInfo?.final_tier,
          complexity_score: routingInfo?.complexity_score,
          cost_estimate: routingInfo?.cost_estimate,
          escalated: routingInfo?.escalated || false
        } : {
          success: false,
          reason: 'Análise IA não executada'
        },
        processing_summary: {
          total_time: Date.now(),
          pdf_extracted: !!pdfResult.texto_limpo,
          ai_analyzed: !!aiAnalysis,
          stored_in_db: true
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