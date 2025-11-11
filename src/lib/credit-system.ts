// ================================================================
// SISTEMA UNIFICADO DE CRÉDITOS - Business Logic
// ================================================================
// Implementa Report Credits + FULL Credits com FIFO, rollover e expiration

import { PrismaClient, Prisma } from '@prisma/client';
import type { WorkspaceCredits } from '@prisma/client';
import { ICONS } from './icons';
import { isCreditTransactionMetadata } from './types/type-guards';
import type { CreditTransactionMetadata } from './types/json-fields';

// Tipos principais
export interface CreditCost {
  reportCredits: number;
  fullCredits: number;
}

export interface CreditBalance {
  reportCreditsBalance: number;
  fullCreditsBalance: number;
  reportCreditsAvailable: number; // Considerando holds
  fullCreditsAvailable: number;
  reportCreditsHeld: number;
  fullCreditsHeld: number;
}

export interface CreditDebitResult {
  success: boolean;
  error?: string;
  remainingBalance?: CreditBalance;
  transactionIds?: string[];
}

export interface CreditAllocationBreakdown {
  type: 'MONTHLY' | 'BONUS' | 'PACK';
  amount: number;
  remaining: number;
  consumed: number;
  expiresAt?: Date;
}

// Configurações default conforme especificação
export const CREDIT_CONFIG = {
  REPORT_CREDIT_UNIT: 25, // Até 25 processos = 1 report credit
  FULL_CREDIT_PER_BATCH: 10, // Até 10 processos = 1 FULL credit

  // Micro-tiers para report credits
  TIER_1_PROCESSES: 5,    // 1-5 processes = 0.25 credit
  TIER_1_COST: 0.25,
  TIER_2_PROCESSES: 12,   // 6-12 processes = 0.5 credit
  TIER_2_COST: 0.5,
  TIER_3_PROCESSES: 25,   // 13-25 processes = 1 credit
  TIER_3_COST: 1.0,

  // Configurações de plano
  PLANS: {
    STARTER: {
      monitorLimit: 100,
      reportCreditsMonth: 12,
      fullCreditsMonth: 5,
      firstMonthFullBonus: 25,
      firstMonthBonusExpiryDays: 90,
      fullRolloverCap: 50,
      reportRolloverCap: 36
    },
    PROFESSIONAL: {
      monitorLimit: 300,
      reportCreditsMonth: 40,
      fullCreditsMonth: 15,
      firstMonthFullBonus: 75,
      firstMonthBonusExpiryDays: 90,
      fullRolloverCap: 150,
      reportRolloverCap: 120
    },
    ENTERPRISE: {
      monitorLimit: -1, // Unlimited
      reportCreditsMonth: -1, // Unlimited
      fullCreditsMonth: -1, // Unlimited
      firstMonthFullBonus: 0,
      firstMonthBonusExpiryDays: 0,
      fullRolloverCap: -1, // Unlimited
      reportRolloverCap: -1 // Unlimited
    }
  },

  // TTLs
  HOLD_TTL_DAYS: 30,
  BONUS_EXPIRY_DAYS: 90
} as const;

export class CreditManager {
  constructor(private prisma: PrismaClient) {}

  /**
   * Calcula custo de report credit baseado no número de processos
   */
  calculateReportCreditCost(processCount: number): number {
    if (processCount <= 0) return 0;

    if (processCount <= CREDIT_CONFIG.TIER_1_PROCESSES) {
      return CREDIT_CONFIG.TIER_1_COST;
    } else if (processCount <= CREDIT_CONFIG.TIER_2_PROCESSES) {
      return CREDIT_CONFIG.TIER_2_COST;
    } else if (processCount <= CREDIT_CONFIG.TIER_3_PROCESSES) {
      return CREDIT_CONFIG.TIER_3_COST;
    } else {
      // Acima de 25 processos, usar múltiplos de 25
      return Math.ceil(processCount / CREDIT_CONFIG.REPORT_CREDIT_UNIT);
    }
  }

  /**
   * Calcula custo de FULL credit baseado no número de processos
   */
  calculateFullCreditCost(processCount: number): number {
    if (processCount <= 0) return 0;
    return Math.ceil(processCount / CREDIT_CONFIG.FULL_CREDIT_PER_BATCH);
  }

  /**
   * Obtém saldo atual de créditos com disponibilidade
   */
  async getCreditBalance(workspaceId: string): Promise<CreditBalance> {
    try {
      // Buscar créditos base
      let credits = await this.prisma.workspaceCredits.findUnique({
        where: { workspaceId }
      });

      if (!credits) {
        // Criar registro de créditos se não existir
        credits = await this.initializeWorkspaceCredits(workspaceId);
      }

      // Calcular holds ativos
      const holds = await this.prisma.scheduledCreditHold.aggregate({
        where: {
          workspaceId,
          expiresAt: { gt: new Date() }
        },
        _sum: {
          reportCreditsReserved: true,
          fullCreditsReserved: true
        }
      });

      const reportCreditsHeld = Number(holds._sum.reportCreditsReserved || 0);
      const fullCreditsHeld = Number(holds._sum.fullCreditsReserved || 0);

      return {
        reportCreditsBalance: Number(credits?.reportCreditsBalance || 0),
        fullCreditsBalance: Number(credits?.fullCreditsBalance || 0),
        reportCreditsAvailable: Number(credits?.reportCreditsBalance || 0) - reportCreditsHeld,
        fullCreditsAvailable: Number(credits?.fullCreditsBalance || 0) - fullCreditsHeld,
        reportCreditsHeld,
        fullCreditsHeld
      };

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao buscar saldo de créditos:`, error);
      throw new Error('Erro ao consultar saldo de créditos');
    }
  }

  /**
   * Débita créditos usando FIFO por expiração
   */
  async debitCredits(
    workspaceId: string,
    reportCredits: number,
    fullCredits: number,
    reason: string,
    metadata: unknown = {}
  ): Promise<CreditDebitResult> {
    console.log(`${ICONS.PROCESS} Debitando créditos: ${reportCredits} report, ${fullCredits} full`);

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Verificar saldo disponível
        const balance = await this.getCreditBalance(workspaceId);

        if (balance.reportCreditsAvailable < reportCredits) {
          return {
            success: false,
            error: `Créditos de relatório insuficientes. Disponível: ${balance.reportCreditsAvailable}, Necessário: ${reportCredits}`
          };
        }

        if (balance.fullCreditsAvailable < fullCredits) {
          return {
            success: false,
            error: `Créditos de análise completa insuficientes. Disponível: ${balance.fullCreditsAvailable}, Necessário: ${fullCredits}`
          };
        }

        const transactionIds: string[] = [];

        // Debitar report credits usando FIFO
        if (reportCredits > 0) {
          const reportTxIds = await this.debitFromAllocations(
            tx, workspaceId, reportCredits, 'REPORT', reason, metadata
          );
          transactionIds.push(...reportTxIds);
        }

        // Debitar full credits usando FIFO
        if (fullCredits > 0) {
          const fullTxIds = await this.debitFromAllocations(
            tx, workspaceId, fullCredits, 'FULL', reason, metadata
          );
          transactionIds.push(...fullTxIds);
        }

        // Atualizar saldo no workspace_credits
        await tx.workspaceCredits.update({
          where: { workspaceId },
          data: {
            reportCreditsBalance: { decrement: reportCredits },
            fullCreditsBalance: { decrement: fullCredits }
          }
        });

        const newBalance = await this.getCreditBalance(workspaceId);

        console.log(`${ICONS.SUCCESS} Créditos debitados com sucesso`);

        return {
          success: true,
          remainingBalance: newBalance,
          transactionIds
        };
      });

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao debitar créditos:`, error);
      return {
        success: false,
        error: 'Erro interno ao processar débito de créditos'
      };
    }
  }

  /**
   * Débita de allocations usando FIFO (expiração mais próxima primeiro)
   */
  private async debitFromAllocations(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    amount: number,
    category: 'REPORT' | 'FULL',
    reason: string,
    metadata: unknown
  ): Promise<string[]> {
    // Validate metadata if provided using type guard
    // Padrão-Ouro: JSON round-trip ensures Prisma compatibility without casting
    let validatedMetadata: Prisma.InputJsonValue | undefined = undefined;
    if (metadata && typeof metadata === 'object' && isCreditTransactionMetadata(metadata)) {
      // After isCreditTransactionMetadata guard, metadata is guaranteed to be valid
      // Use JSON serialization (safe, no casting) to ensure Prisma compatibility
      try {
        validatedMetadata = JSON.parse(JSON.stringify(metadata));
      } catch (error) {
        console.warn(`${ICONS.WARNING} Failed to serialize transaction metadata:`, error);
        // metadata is undefined - transaction will have no metadata
      }
    }

    const transactionIds: string[] = [];
    let remainingToDebit = amount;

    // Buscar allocations ordenadas por FIFO (expires_at ASC NULLS LAST, created_at ASC)
    const allocations = await tx.creditAllocation.findMany({
      where: {
        workspaceId,
        remainingAmount: { gt: 0 }
      },
      orderBy: [
        { expiresAt: 'asc' }, // NULLS LAST é default no Prisma
        { createdAt: 'asc' }
      ]
    });

    for (const allocation of allocations) {
      if (remainingToDebit <= 0) break;

      const availableInAllocation = Number(allocation.remainingAmount);
      const toDebitFromThisAllocation = Math.min(remainingToDebit, availableInAllocation);

      // Atualizar allocation
      await tx.creditAllocation.update({
        where: { id: allocation.id },
        data: {
          remainingAmount: { decrement: toDebitFromThisAllocation }
        }
      });

      // Criar transação
      const transaction = await tx.creditTransaction.create({
        data: {
          workspaceId,
          allocationId: allocation.id,
          type: 'DEBIT',
          creditCategory: category,
          amount: toDebitFromThisAllocation,
          reason,
          metadata: validatedMetadata
        }
      });

      transactionIds.push(transaction.id);
      remainingToDebit -= toDebitFromThisAllocation;

      console.log(`${ICONS.INFO} Debitado ${toDebitFromThisAllocation} ${category} credits da allocation ${allocation.id}`);
    }

    if (remainingToDebit > 0) {
      throw new Error(`Créditos insuficientes para débito completo. Faltam ${remainingToDebit} ${category} credits`);
    }

    return transactionIds;
  }

  /**
   * Credita créditos criando nova allocation
   */
  async creditCredits(
    workspaceId: string,
    reportCredits: number,
    fullCredits: number,
    type: 'MONTHLY' | 'BONUS' | 'PACK',
    sourceDescription: string,
    expiresAt?: Date
  ): Promise<void> {
    console.log(`${ICONS.PROCESS} Creditando: ${reportCredits} report, ${fullCredits} full (${type})`);

    try {
      await this.prisma.$transaction(async (tx) => {
        // Criar allocations para report credits
        if (reportCredits > 0) {
          const reportAllocation = await tx.creditAllocation.create({
            data: {
              workspaceId,
              type,
              amount: reportCredits,
              remainingAmount: reportCredits,
              expiresAt,
              sourceDescription: `${sourceDescription} - Report Credits`
            }
          });

          await tx.creditTransaction.create({
            data: {
              workspaceId,
              allocationId: reportAllocation.id,
              type: 'CREDIT',
              creditCategory: 'REPORT',
              amount: reportCredits,
              reason: sourceDescription
            }
          });
        }

        // Criar allocations para full credits
        if (fullCredits > 0) {
          const fullAllocation = await tx.creditAllocation.create({
            data: {
              workspaceId,
              type,
              amount: fullCredits,
              remainingAmount: fullCredits,
              expiresAt,
              sourceDescription: `${sourceDescription} - Full Credits`
            }
          });

          await tx.creditTransaction.create({
            data: {
              workspaceId,
              allocationId: fullAllocation.id,
              type: 'CREDIT',
              creditCategory: 'FULL',
              amount: fullCredits,
              reason: sourceDescription
            }
          });
        }

        // Atualizar saldo total
        await tx.workspaceCredits.upsert({
          where: { workspaceId },
          create: {
            workspaceId,
            reportCreditsBalance: reportCredits,
            fullCreditsBalance: fullCredits
          },
          update: {
            reportCreditsBalance: { increment: reportCredits },
            fullCreditsBalance: { increment: fullCredits }
          }
        });
      });

      console.log(`${ICONS.SUCCESS} Créditos creditados com sucesso`);

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao creditar créditos:`, error);
      throw new Error('Erro ao creditar créditos');
    }
  }

  /**
   * Reserva créditos temporariamente para scheduler
   */
  async reserveCredits(
    workspaceId: string,
    reportId: string,
    reportCredits: number,
    fullCredits: number,
    ttlDays: number = CREDIT_CONFIG.HOLD_TTL_DAYS
  ): Promise<{ success: boolean; error?: string; holdId?: string }> {
    try {
      const balance = await this.getCreditBalance(workspaceId);

      if (balance.reportCreditsAvailable < reportCredits) {
        return {
          success: false,
          error: `Créditos de relatório insuficientes para reserva`
        };
      }

      if (balance.fullCreditsAvailable < fullCredits) {
        return {
          success: false,
          error: `Créditos de análise completa insuficientes para reserva`
        };
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + ttlDays);

      const hold = await this.prisma.scheduledCreditHold.create({
        data: {
          workspaceId,
          reportId,
          reportCreditsReserved: reportCredits,
          fullCreditsReserved: fullCredits,
          expiresAt
        }
      });

      console.log(`${ICONS.SUCCESS} Créditos reservados: ${reportCredits} report, ${fullCredits} full`);

      return {
        success: true,
        holdId: hold.id
      };

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao reservar créditos:`, error);
      return {
        success: false,
        error: 'Erro ao reservar créditos'
      };
    }
  }

  /**
   * Libera reserva de créditos
   */
  async releaseReservation(holdId: string): Promise<void> {
    try {
      await this.prisma.scheduledCreditHold.delete({
        where: { id: holdId }
      });

      console.log(`${ICONS.SUCCESS} Reserva de créditos liberada: ${holdId}`);

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao liberar reserva:`, error);
      throw new Error('Erro ao liberar reserva de créditos');
    }
  }

  /**
   * Obtém breakdown detalhado de allocations
   */
  async getCreditBreakdown(workspaceId: string): Promise<CreditAllocationBreakdown[]> {
    try {
      const allocations = await this.prisma.creditAllocation.findMany({
        where: {
          workspaceId,
          remainingAmount: { gt: 0 }
        },
        orderBy: [
          { expiresAt: 'asc' },
          { createdAt: 'asc' }
        ]
      });

      return allocations.map((allocation) => {
        // Validate allocation type at runtime
        const type = allocation.type;

        if (type !== 'MONTHLY' && type !== 'BONUS' && type !== 'PACK') {
          throw new Error(`Invalid allocation type received from database: ${type}`);
        }

        // After validation, type is narrowed to the expected union
        return {
          type,
          amount: Number(allocation.amount),
          remaining: Number(allocation.remainingAmount),
          consumed: Number(allocation.amount) - Number(allocation.remainingAmount),
          expiresAt: allocation.expiresAt || undefined
        };
      });

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao buscar breakdown:`, error);
      throw new Error('Erro ao consultar breakdown de créditos');
    }
  }

  /**
   * Inicializa créditos para novo workspace
   */
  async initializeWorkspaceCredits(
    workspaceId: string,
    planName: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' = 'STARTER'
  ): Promise<WorkspaceCredits> {
    try {
      const planConfig = CREDIT_CONFIG.PLANS[planName];

      return await this.prisma.$transaction(async (tx) => {
        // Criar registro de créditos
        const credits = await tx.workspaceCredits.create({
          data: {
            workspaceId,
            reportCreditsBalance: 0,
            fullCreditsBalance: 0,
            reportCreditsRolloverCap: planConfig.reportRolloverCap,
            fullCreditsRolloverCap: planConfig.fullRolloverCap
          }
        });

        // Adicionar bônus do primeiro mês (se aplicável)
        if (planConfig.firstMonthFullBonus > 0) {
          const bonusExpiresAt = new Date();
          bonusExpiresAt.setDate(bonusExpiresAt.getDate() + planConfig.firstMonthBonusExpiryDays);

          await this.creditCredits(
            workspaceId,
            0,
            planConfig.firstMonthFullBonus,
            'BONUS',
            'Bônus primeiro mês',
            bonusExpiresAt
          );
        }

        console.log(`${ICONS.SUCCESS} Créditos inicializados para workspace ${workspaceId} (${planName})`);

        return credits;
      });

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao inicializar créditos:`, error);
      throw new Error('Erro ao inicializar créditos do workspace');
    }
  }

  /**
   * Job mensal para alocar créditos
   */
  async monthlyAllocation(workspaceId: string, planName: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'): Promise<void> {
    try {
      const planConfig = CREDIT_CONFIG.PLANS[planName];

      if (planConfig.reportCreditsMonth === -1) {
        // Plano enterprise (ilimitado)
        return;
      }

      console.log(`${ICONS.PROCESS} Alocação mensal para ${workspaceId} (${planName})`);

      const balance = await this.getCreditBalance(workspaceId);

      // Aplicar rollover caps
      const reportCreditsToAdd = Math.min(
        planConfig.reportCreditsMonth,
        Math.max(0, planConfig.reportRolloverCap - balance.reportCreditsBalance)
      );

      const fullCreditsToAdd = Math.min(
        planConfig.fullCreditsMonth,
        Math.max(0, planConfig.fullRolloverCap - balance.fullCreditsBalance)
      );

      if (reportCreditsToAdd > 0 || fullCreditsToAdd > 0) {
        await this.creditCredits(
          workspaceId,
          reportCreditsToAdd,
          fullCreditsToAdd,
          'MONTHLY',
          `Alocação mensal ${planName}`,
          undefined // Nunca expira
        );

        // Log de rollover se aplicável
        if (reportCreditsToAdd < planConfig.reportCreditsMonth) {
          console.log(`${ICONS.WARNING} Rollover cap aplicado para report credits: ${reportCreditsToAdd}/${planConfig.reportCreditsMonth}`);
        }

        if (fullCreditsToAdd < planConfig.fullCreditsMonth) {
          console.log(`${ICONS.WARNING} Rollover cap aplicado para full credits: ${fullCreditsToAdd}/${planConfig.fullCreditsMonth}`);
        }
      }

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro na alocação mensal:`, error);
      throw new Error('Erro na alocação mensal de créditos');
    }
  }

  /**
   * Job de limpeza de créditos expirados
   */
  async cleanupExpiredCredits(): Promise<{ expiredAllocations: number; expiredHolds: number }> {
    try {
      console.log(`${ICONS.PROCESS} Iniciando limpeza de créditos expirados...`);

      const result = await this.prisma.$transaction(async (tx) => {
        // Buscar allocations expiradas com remaining > 0
        const expiredAllocations = await tx.creditAllocation.findMany({
          where: {
            expiresAt: { lt: new Date() },
            remainingAmount: { gt: 0 }
          }
        });

        // Criar eventos de expiração
        for (const allocation of expiredAllocations) {
          await tx.usageEvent.create({
            data: {
              workspaceId: allocation.workspaceId,
              eventType: 'credit_expired',
              resourceType: 'credits',
              metadata: {
                allocationId: allocation.id,
                expiredAmount: Number(allocation.remainingAmount),
                allocationType: allocation.type
              }
            }
          });

          // Ajustar saldo no workspace
          await tx.workspaceCredits.updateMany({
            where: { workspaceId: allocation.workspaceId },
            data: {
              reportCreditsBalance: { decrement: Number(allocation.remainingAmount) },
              fullCreditsBalance: { decrement: Number(allocation.remainingAmount) }
            }
          });
        }

        // Marcar allocations como expiradas
        const { count: expiredCount } = await tx.creditAllocation.updateMany({
          where: {
            expiresAt: { lt: new Date() },
            remainingAmount: { gt: 0 }
          },
          data: {
            remainingAmount: 0
          }
        });

        // Remover holds expirados
        const { count: expiredHolds } = await tx.scheduledCreditHold.deleteMany({
          where: {
            expiresAt: { lt: new Date() }
          }
        });

        return {
          expiredAllocations: expiredCount,
          expiredHolds
        };
      });

      console.log(`${ICONS.SUCCESS} Limpeza concluída: ${result.expiredAllocations} allocations, ${result.expiredHolds} holds`);

      return result;

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro na limpeza de créditos:`, error);
      throw new Error('Erro na limpeza de créditos expirados');
    }
  }
}

// Singleton para reutilização
let creditManager: CreditManager | null = null;

export function getCreditManager(prisma?: PrismaClient): CreditManager {
  if (!creditManager && prisma) {
    creditManager = new CreditManager(prisma);
  }
  if (!creditManager) {
    throw new Error('CreditManager não inicializado. Forneça instância do Prisma.');
  }
  return creditManager;
}