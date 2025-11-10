// ================================
// API PARA GERENCIAMENTO DE AGENDAMENTO ESPECÍFICO
// ================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateAuthAndGetUser } from '@/lib/auth';
import { ICONS } from '@/lib/icons';
import { prisma } from '@/lib/prisma';
import { ReportScheduler } from '@/lib/report-scheduler';
import { getNotificationService } from '@/lib/notification-service';

const updateScheduleSchema = z.object({
  name: z.string().optional(),
  processIds: z.array(z.string()).optional(),
  frequency: z.enum(['weekly', 'biweekly', 'monthly']).optional(),
  reportType: z.enum(['complete', 'updates']).optional(),
  deliveryMethod: z.enum(['email', 'whatsapp']).optional(),
  deliveryTime: z.string().optional(),
  recipientEmail: z.string().email().optional(),
  recipientPhone: z.string().optional(),
  isActive: z.boolean().optional(),
});

// ================================
// GET - Obter agendamento específico
// ================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, workspace } = await validateAuthAndGetUser();
    const { id: scheduleId } = await params;

    // Buscar agendamento do banco
    const schedule = await prisma.reportSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        executions: {
          orderBy: { startedAt: 'desc' },
          take: 5 // Últimas 5 execuções
        }
      }
    });

    if (!schedule) {
      return NextResponse.json(
        { success: false, error: 'Agendamento não encontrado' },
        { status: 404 }
      );
    }

    if (schedule.workspaceId !== workspace.id) {
      return NextResponse.json(
        { success: false, error: 'Acesso negado' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      schedule: {
        ...schedule,
        isActive: schedule.enabled,
        executionHistory: schedule.executions
      }
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao obter agendamento:`, error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// ================================
// PATCH - Atualizar agendamento
// ================================

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, workspace } = await validateAuthAndGetUser();
    const { id: scheduleId } = await params;

    const body = await req.json();
    const validatedData = updateScheduleSchema.parse(body);

    // Buscar agendamento atual
    const schedule = await prisma.reportSchedule.findUnique({
      where: { id: scheduleId }
    });

    if (!schedule) {
      return NextResponse.json(
        { success: false, error: 'Agendamento não encontrado' },
        { status: 404 }
      );
    }

    if (schedule.workspaceId !== workspace.id) {
      return NextResponse.json(
        { success: false, error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // Mapear dados para campos do schema Prisma
    const updateData: Record<string, unknown> = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.processIds !== undefined) updateData.processIds = validatedData.processIds;
    if (validatedData.frequency !== undefined) {
      // Mapear 'weekly' -> 'WEEKLY', etc
      const frequencyMap: Record<string, string> = {
        'daily': 'DAILY',
        'weekly': 'WEEKLY',
        'biweekly': 'BIWEEKLY',
        'monthly': 'MONTHLY'
      };
      updateData.frequency = frequencyMap[validatedData.frequency] || validatedData.frequency;
    }
    if (validatedData.reportType !== undefined) {
      const typeMap: Record<string, string> = {
        'complete': 'COMPLETO',
        'updates': 'NOVIDADES'
      };
      updateData.type = typeMap[validatedData.reportType] || validatedData.reportType;
    }
    if (validatedData.recipientEmail !== undefined) {
      updateData.recipients = [validatedData.recipientEmail];
    }
    if (validatedData.isActive !== undefined) {
      updateData.enabled = validatedData.isActive;
    }

    // Recalcular próxima execução se necessário
    if (validatedData.frequency || validatedData.deliveryTime) {
      const nextRun = new Date();
      nextRun.setDate(nextRun.getDate() + 7); // Próxima semana como padrão
      if (validatedData.deliveryTime) {
        const [hours, minutes] = validatedData.deliveryTime.split(':').map(Number);
        nextRun.setHours(hours, minutes, 0, 0);
      }
      updateData.nextRun = nextRun;
    }

    // Atualizar no banco
    const updatedSchedule = await prisma.reportSchedule.update({
      where: { id: scheduleId },
      data: updateData
    });

    console.log(`${ICONS.EDIT} Agendamento atualizado: ${scheduleId}`);

    return NextResponse.json({
      success: true,
      message: 'Agendamento atualizado com sucesso',
      schedule: {
        ...updatedSchedule,
        isActive: updatedSchedule.enabled
      }
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao atualizar agendamento:`, error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// ================================
// DELETE - Excluir agendamento
// ================================

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, workspace } = await validateAuthAndGetUser();
    const { id: scheduleId } = await params;

    // Buscar agendamento para validar workspace
    const schedule = await prisma.reportSchedule.findUnique({
      where: { id: scheduleId }
    });

    if (!schedule) {
      return NextResponse.json(
        { success: false, error: 'Agendamento não encontrado' },
        { status: 404 }
      );
    }

    if (schedule.workspaceId !== workspace.id) {
      return NextResponse.json(
        { success: false, error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // Deletar agendamento (Cascade delete removerá execuções relacionadas)
    await prisma.reportSchedule.delete({
      where: { id: scheduleId }
    });

    console.log(`${ICONS.DELETE} Agendamento excluído: ${scheduleId}`);

    return NextResponse.json({
      success: true,
      message: 'Agendamento excluído com sucesso'
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao excluir agendamento:`, error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// ================================
// POST - Ações especiais no agendamento
// ================================

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, workspace } = await validateAuthAndGetUser();
    const { id: scheduleId } = await params;

    const body = await req.json();
    const { action } = body;

    // Validar workspace
    const schedule = await prisma.reportSchedule.findUnique({
      where: { id: scheduleId }
    });

    if (!schedule) {
      return NextResponse.json(
        { success: false, error: 'Agendamento não encontrado' },
        { status: 404 }
      );
    }

    if (schedule.workspaceId !== workspace.id) {
      return NextResponse.json(
        { success: false, error: 'Acesso negado' },
        { status: 403 }
      );
    }

    switch (action) {
      case 'execute_now': {
        // Executar relatório imediatamente
        console.log(`${ICONS.ROCKET} Executando relatório imediatamente: ${scheduleId}`);

        // Criar execução imediata
        const execution = await prisma.reportExecution.create({
          data: {
            workspaceId: schedule.workspaceId,
            scheduleId: schedule.id,
            reportType: schedule.type,
            parameters: schedule.filters || {},
            recipients: schedule.recipients,
            status: 'AGENDADO',
            audienceType: schedule.audienceType,
            outputFormats: schedule.outputFormats,
            processCount: schedule.processIds.length,
            quotaConsumed: 1,
            scheduledFor: new Date() // Executar assim que possível
          }
        });

        console.log(`${ICONS.SUCCESS} Execução criada: ${execution.id}`);

        return NextResponse.json({
          success: true,
          message: 'Relatório sendo gerado...',
          executionId: execution.id
        });
      }

      case 'pause': {
        // Pausar agendamento
        console.log(`${ICONS.WARNING} Pausando agendamento: ${scheduleId}`);

        await prisma.reportSchedule.update({
          where: { id: scheduleId },
          data: { enabled: false }
        });

        return NextResponse.json({
          success: true,
          message: 'Agendamento pausado'
        });
      }

      case 'resume': {
        // Retomar agendamento
        console.log(`${ICONS.SUCCESS} Retomando agendamento: ${scheduleId}`);

        // Recalcular próxima execução
        const nextRun = new Date();
        nextRun.setDate(nextRun.getDate() + 1);

        await prisma.reportSchedule.update({
          where: { id: scheduleId },
          data: {
            enabled: true,
            nextRun
          }
        });

        return NextResponse.json({
          success: true,
          message: 'Agendamento retomado'
        });
      }

      case 'test_delivery': {
        // Testar entrega com notificação
        console.log(`${ICONS.INFO} Testando entrega: ${scheduleId}`);

        const notificationService = getNotificationService();

        // Enviar notificação de teste
        await notificationService.sendNotification({
          email: {
            enabled: true,
            recipients: schedule.recipients,
            template: 'report-ready',
            data: {
              reportName: `${schedule.name} (TESTE)`,
              generatedAt: new Date().toISOString(),
              downloadUrl: '#',
              testMode: true
            }
          },
          slack: {
            enabled: true,
            title: '🧪 Teste de Entrega de Relatório',
            description: `Teste de entrega do agendamento: ${schedule.name}`,
            severity: 'info'
          }
        });

        console.log(`${ICONS.SUCCESS} Teste de entrega enviado`);

        return NextResponse.json({
          success: true,
          message: 'Teste de entrega enviado com sucesso'
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Ação não reconhecida' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao executar ação:`, error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}