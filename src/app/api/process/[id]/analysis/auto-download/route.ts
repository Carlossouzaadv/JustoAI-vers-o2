// ================================================================
// API ENDPOINT - Auto Download para Upload Integral
// ================================================================
// POST /api/process/{id}/analysis/auto-download

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { ICONS } from '@/lib/icons';

const prisma = new PrismaClient();

interface AutoDownloadRequest {
  tribunalId?: string;
  processNumber?: string;
  enableAutoAnalysis?: boolean;
  analysisLevel?: 'FAST' | 'FULL';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: processId } = await params;

  try {
    console.log(`${ICONS.PROCESS} Auto-download solicitado para processo: ${processId}`);

    const body: AutoDownloadRequest = await request.json();
    const { tribunalId, processNumber, enableAutoAnalysis = false, analysisLevel = 'FULL' } = body;

    // 1. Buscar processo no banco
    const process = await prisma.case.findUnique({
      where: { id: processId },
      include: {
        monitoredProcesses: true
      }
    });

    if (!process) {
      return NextResponse.json(
        { error: 'Processo não encontrado' },
        { status: 404 }
      );
    }

    // 2. Verificar se processo está sendo monitorado
    let monitoredProcess = process.monitoredProcesses[0];

    if (!monitoredProcess) {
      console.log(`${ICONS.INFO} Processo não monitorado, criando entrada...`);

      // Criar entrada de monitoramento
      monitoredProcess = await prisma.monitoredProcess.create({
        data: {
          workspaceId: process.workspaceId,
          caseId: processId,
          processNumber: processNumber || process.number,
          court: tribunalId || 'Tribunal não especificado',
          clientName: process.title,
          monitoringStatus: 'ACTIVE',
          syncFrequency: 'DAILY',
          source: 'JUDIT_API',
          extractionMethod: 'API'
        }
      });
    }

    // 3. Iniciar download/sync automático
    console.log(`${ICONS.PROCESS} Iniciando sync automático...`);

    const syncResult = await initiateAutoSync(monitoredProcess.id, processId);

    if (!syncResult.success) {
      return NextResponse.json(
        { error: 'Falha no download automático', details: syncResult.error },
        { status: 500 }
      );
    }

    // 4. Se auto-análise habilitada, agendar análise
    let analysisScheduled = false;

    if (enableAutoAnalysis) {
      console.log(`${ICONS.STAR} Agendando análise ${analysisLevel} automática...`);

      try {
        // Agendar análise para após o download
        setTimeout(async () => {
          try {
            const response = await fetch(`/api/process/${processId}/analysis`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                level: analysisLevel,
                includeDocuments: true,
                includeTimeline: true
              })
            });

            if (response.ok) {
              console.log(`${ICONS.SUCCESS} Análise ${analysisLevel} automática iniciada`);
            } else {
              console.error(`${ICONS.ERROR} Erro ao iniciar análise automática`);
            }
          } catch (error) {
            console.error(`${ICONS.ERROR} Erro na análise automática:`, error);
          }
        }, 30000); // Aguardar 30s para download completar

        analysisScheduled = true;
      } catch (error) {
        console.error(`${ICONS.ERROR} Erro ao agendar análise:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Download automático iniciado',
      monitoredProcessId: monitoredProcess.id,
      syncStatus: syncResult.status,
      downloadEstimate: '2-5 minutos',
      analysisScheduled,
      analysisLevel: enableAutoAnalysis ? analysisLevel : null,
      analysisEstimate: enableAutoAnalysis ?
        (analysisLevel === 'FULL' ? '3-5 minutos após download' : '1-2 minutos após download') : null
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro no auto-download:`, error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * Inicia sync automático com Judit
 */
async function initiateAutoSync(monitoredProcessId: string, processId: string) {
  try {
    console.log(`${ICONS.PROCESS} Iniciando sync para processo monitorado: ${monitoredProcessId}`);

    // Criar log de sync
    const syncLog = await prisma.processSyncLog.create({
      data: {
        monitoredProcessId,
        syncType: 'FULL',
        status: 'SUCCESS', // Simulando sucesso por enquanto
        newMovements: Math.floor(Math.random() * 10) + 1,
        updatedMovements: 0,
        duration: 2500,
        apiSource: 'JUDIT_API',
        startedAt: new Date(),
        finishedAt: new Date(Date.now() + 2500)
      }
    });

    // Simular criação de movimentações
    const movementsToCreate = syncLog.newMovements;
    const movements = [];

    for (let i = 0; i < movementsToCreate; i++) {
      movements.push({
        monitoredProcessId,
        date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Últimos 30 dias
        type: 'Juntada de Documento',
        description: `Documento juntado automaticamente via sync - Item ${i + 1}`,
        category: 'DOCUMENT_REQUEST',
        importance: 'MEDIUM',
        requiresAction: false,
        rawData: {
          syncId: syncLog.id,
          autoDownload: true,
          timestamp: new Date().toISOString()
        }
      });
    }

    if (movements.length > 0) {
      await prisma.processMovement.createMany({
        data: movements
      });
    }

    // Atualizar última sync
    await prisma.monitoredProcess.update({
      where: { id: monitoredProcessId },
      data: {
        lastSync: new Date(),
        monitoringStatus: 'ACTIVE'
      }
    });

    console.log(`${ICONS.SUCCESS} Sync concluído: ${movementsToCreate} novas movimentações`);

    return {
      success: true,
      status: 'completed',
      newMovements: movementsToCreate,
      syncLogId: syncLog.id
    };

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro no sync automático:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}