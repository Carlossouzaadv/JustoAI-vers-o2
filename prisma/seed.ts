import { PrismaClient } from '@prisma/client'
import { Plan } from '@/lib/types/database'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // 1. Create Workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'acme-law-firm' },
    update: {},
    create: {
      name: 'ACME Law Firm',
      slug: 'acme-law-firm',
      description: 'Escritório de advocacia especializado em direito empresarial',
      plan: Plan.PROFESSIONAL,
      settings: {
        theme: 'light',
        language: 'pt-BR',
        timezone: 'America/Sao_Paulo'
      }
    }
  })

  // 2. Create Users
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@acmelaw.com' },
    update: {},
    create: {
      email: 'admin@acmelaw.com',
      name: 'João Silva',
      role: 'ADMIN',
      supabaseId: 'admin-supabase-id',
      emailVerified: true,
      settings: {
        notifications: true,
        darkMode: false
      }
    }
  })

  const lawyerUser = await prisma.user.upsert({
    where: { email: 'lawyer@acmelaw.com' },
    update: {},
    create: {
      email: 'lawyer@acmelaw.com',
      name: 'Maria Santos',
      role: 'USER',
      supabaseId: 'lawyer-supabase-id',
      emailVerified: true
    }
  })

  // 3. Create UserWorkspace relationships
  await prisma.userWorkspace.upsert({
    where: {
      userId_workspaceId: {
        userId: adminUser.id,
        workspaceId: workspace.id
      }
    },
    update: {},
    create: {
      userId: adminUser.id,
      workspaceId: workspace.id,
      role: 'OWNER',
      permissions: {
        canManageUsers: true,
        canManageSettings: true,
        canViewReports: true
      }
    }
  })

  await prisma.userWorkspace.upsert({
    where: {
      userId_workspaceId: {
        userId: lawyerUser.id,
        workspaceId: workspace.id
      }
    },
    update: {},
    create: {
      userId: lawyerUser.id,
      workspaceId: workspace.id,
      role: 'MEMBER'
    }
  })

  // 4. Create Clients
  const client1 = await prisma.client.create({
    data: {
      workspaceId: workspace.id,
      name: 'Tech Solutions Ltda',
      email: 'contato@techsolutions.com',
      phone: '(11) 99999-9999',
      document: '12.345.678/0001-90',
      type: 'COMPANY',
      address: 'Av. Paulista, 1000',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01310-100',
      notes: 'Cliente desde 2020, foco em direito empresarial'
    }
  })

  const client2 = await prisma.client.create({
    data: {
      workspaceId: workspace.id,
      name: 'Carlos Mendes',
      email: 'carlos.mendes@email.com',
      phone: '(11) 88888-8888',
      document: '123.456.789-00',
      type: 'INDIVIDUAL',
      address: 'Rua das Flores, 123',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '04567-890',
      notes: 'Caso de direito de família'
    }
  })

  // 5. Create Cases
  const case1 = await prisma.case.create({
    data: {
      workspaceId: workspace.id,
      clientId: client1.id,
      number: '5005681-45.2024.4.03.6109',
      title: 'Ação de Cobrança - Serviços de Consultoria',
      description: 'Cobrança de serviços de consultoria não pagos no valor de R$ 50.000,00',
      type: 'COMMERCIAL',
      status: 'ACTIVE',
      priority: 'HIGH',
      createdById: adminUser.id,
      assignedToId: lawyerUser.id,
      claimValue: 50000.00,
      fee: 15000.00,
      feeType: 'SUCCESS_FEE',
      filingDate: new Date('2024-01-15'),
      dueDate: new Date('2024-12-15'),
      tags: ['cobrança', 'consultoria', 'empresarial']
    }
  })

  const case2 = await prisma.case.create({
    data: {
      workspaceId: workspace.id,
      clientId: client2.id,
      number: '8005432-12.2024.8.26.0001',
      title: 'Divórcio Consensual',
      description: 'Processo de divórcio consensual com partilha de bens',
      type: 'FAMILY',
      status: 'ACTIVE',
      priority: 'MEDIUM',
      createdById: lawyerUser.id,
      assignedToId: lawyerUser.id,
      fee: 5000.00,
      feeType: 'FIXED',
      filingDate: new Date('2024-02-01'),
      tags: ['divórcio', 'família', 'consensual']
    }
  })

  // 6. Create Case Events
  await prisma.caseEvent.createMany({
    data: [
      {
        caseId: case1.id,
        userId: adminUser.id,
        type: 'NOTE',
        title: 'Caso iniciado',
        description: 'Cliente procurou escritório para cobrança de dívida',
        eventDate: new Date('2024-01-10')
      },
      {
        caseId: case1.id,
        userId: lawyerUser.id,
        type: 'DOCUMENT_SENT',
        title: 'Petição inicial protocolada',
        description: 'Petição inicial enviada ao tribunal',
        eventDate: new Date('2024-01-15')
      },
      {
        caseId: case2.id,
        userId: lawyerUser.id,
        type: 'MEETING',
        title: 'Reunião com cliente',
        description: 'Definição dos termos do divórcio',
        eventDate: new Date('2024-01-20')
      }
    ]
  })

  // 7. Create Case Analysis Version
  await prisma.caseAnalysisVersion.create({
    data: {
      workspaceId: workspace.id,
      caseId: case1.id,
      version: 1,
      analysisType: 'RISK_ASSESSMENT',
      aiAnalysis: {
        riskLevel: 'LOW',
        successProbability: 0.85,
        recommendations: [
          'Documentação bem fundamentada',
          'Cliente tem histórico positivo',
          'Valor dentro da capacidade de pagamento'
        ],
        timeEstimate: '6-8 meses'
      },
      modelUsed: 'gemini-1.5-flash',
      confidence: 0.85,
      processingTime: 1250,
      costEstimate: 0.025
    }
  })

  // 8. Create Report Schedule
  await prisma.reportSchedule.create({
    data: {
      workspaceId: workspace.id,
      name: 'Relatório Semanal de Casos',
      description: 'Resumo semanal dos casos ativos e suas atualizações',
      type: 'CASE_SUMMARY',
      frequency: 'WEEKLY',
      dayOfWeek: 1, // Segunda-feira
      time: '09:00',
      filters: {
        status: ['ACTIVE'],
        priority: ['HIGH', 'URGENT']
      },
      recipients: ['admin@acmelaw.com', 'lawyer@acmelaw.com'],
      nextRun: new Date('2024-09-16T09:00:00Z')
    }
  })

  // 9. Create AI Cache examples
  await prisma.aiCache.createMany({
    data: [
      {
        workspaceId: workspace.id,
        cacheKey: 'analysis_risk_commercial_standard',
        type: 'ANALYSIS',
        prompt: 'Analise os riscos padrão de um caso comercial',
        result: {
          template: 'commercial_risk_template',
          factors: ['contract_validity', 'payment_capacity', 'legal_precedents']
        },
        model: 'gpt-4',
        tokens: 800,
        cost: 0.016,
        hits: 15,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias
      },
      {
        workspaceId: workspace.id,
        cacheKey: 'document_summary_contract_template',
        type: 'DOCUMENT_SUMMARY',
        prompt: 'Resuma um contrato de prestação de serviços padrão',
        result: {
          summary: 'Contrato padrão com cláusulas usuais de prestação de serviços',
          key_points: ['prazo', 'valor', 'obrigações', 'rescisão']
        },
        model: 'claude-3',
        tokens: 650,
        cost: 0.013,
        hits: 8,
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 dias
      }
    ]
  })

  console.log('✅ Seed completed successfully!')
  console.log(`Created workspace: ${workspace.name}`)
  console.log(`Created users: ${adminUser.name}, ${lawyerUser.name}`)
  console.log(`Created clients: ${client1.name}, ${client2.name}`)
  console.log(`Created cases: ${case1.title}, ${case2.title}`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })