// ================================
// API PARA AGENDAMENTO DE RELATÓRIOS EXECUTIVOS
// ================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateAuthAndGetUser } from '@/lib/auth';
import { ICONS } from '@/lib/icons';

const createScheduleSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  clientId: z.string(),
  clientName: z.string(),
  processIds: z.array(z.string()).min(1, 'Selecione pelo menos um processo'),
  frequency: z.enum(['weekly', 'biweekly', 'monthly']),
  reportType: z.enum(['complete', 'updates']),
  deliveryMethod: z.enum(['email', 'whatsapp']),
  deliveryTime: z.string(),
  recipientEmail: z.string().email().optional(),
  recipientPhone: z.string().optional(),
  isActive: z.boolean().default(true),
  estimatedCost: z.object({
    monthly: z.number(),
    perReport: z.number(),
    tokensEstimate: z.number(),
  }),
});

// ================================
// POST - Criar agendamento
// ================================

export async function POST(req: NextRequest) {
  try {
    console.log(`${ICONS.CALENDAR} Nova requisição de agendamento de relatório`);

    // 1. Autenticação
    const { user, workspace } = await validateAuthAndGetUser(req);

    // 2. Validação do input
    const body = await req.json();
    const validatedData = createScheduleSchema.parse(body);

    // 3. Validar se o usuário tem acesso aos processos
    // TODO: Implementar verificação de acesso aos processos

    // 4. Criar agendamento no banco de dados
    // TODO: Implementar no Prisma
    const scheduleId = `schedule_${Date.now()}`;

    // Simular criação no banco
    const newSchedule = {
      id: scheduleId,
      workspaceId: workspace.id,
      ...validatedData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nextExecution: calculateNextExecution(validatedData.frequency, validatedData.deliveryTime),
    };

    console.log(`${ICONS.SUCCESS} Agendamento criado: ${newSchedule.name}`);

    return NextResponse.json({
      success: true,
      message: 'Agendamento criado com sucesso',
      schedule: newSchedule,
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao criar agendamento:`, error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos', details: error.errors },
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
// GET - Listar agendamentos
// ================================

export async function GET(req: NextRequest) {
  try {
    const { user, workspace } = await validateAuthAndGetUser(req);

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');

    // TODO: Buscar do banco de dados
    // Dados simulados
    const schedules = [
      {
        id: 'schedule_1',
        workspaceId: workspace.id,
        name: 'Relatório Semanal - Empresa ABC',
        clientId: 'client_1',
        clientName: 'Empresa ABC Ltda',
        processIds: ['proc_1', 'proc_2'],
        frequency: 'weekly',
        reportType: 'updates',
        deliveryMethod: 'email',
        deliveryTime: '07:00',
        recipientEmail: 'contato@empresaabc.com',
        isActive: true,
        estimatedCost: {
          monthly: 12.50,
          perReport: 3.12,
          tokensEstimate: 15600
        },
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
        nextExecution: '2024-01-22T07:00:00Z',
        lastExecution: null,
        executionCount: 0
      }
    ].filter(schedule => !clientId || schedule.clientId === clientId);

    return NextResponse.json({
      success: true,
      schedules,
      total: schedules.length
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao listar agendamentos:`, error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// ================================
// UTILITÁRIOS
// ================================

function calculateNextExecution(frequency: string, deliveryTime: string): string {
  const now = new Date();
  const [hours, minutes] = deliveryTime.split(':').map(Number);

  let nextExecution = new Date(now);
  nextExecution.setHours(hours, minutes, 0, 0);

  switch (frequency) {
    case 'weekly':
      // Próxima segunda-feira
      const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
      nextExecution.setDate(now.getDate() + daysUntilMonday);
      break;

    case 'biweekly':
      // A cada 2 semanas (próxima segunda-feira de semana par)
      const daysUntilBiweekly = (8 - now.getDay()) % 7 || 7;
      nextExecution.setDate(now.getDate() + daysUntilBiweekly + 7);
      break;

    case 'monthly':
      // Primeiro dia do próximo mês
      nextExecution.setMonth(now.getMonth() + 1, 1);
      break;
  }

  // Se a data calculada já passou hoje, adicionar o período correspondente
  if (nextExecution <= now) {
    switch (frequency) {
      case 'weekly':
        nextExecution.setDate(nextExecution.getDate() + 7);
        break;
      case 'biweekly':
        nextExecution.setDate(nextExecution.getDate() + 14);
        break;
      case 'monthly':
        nextExecution.setMonth(nextExecution.getMonth() + 1);
        break;
    }
  }

  return nextExecution.toISOString();
}