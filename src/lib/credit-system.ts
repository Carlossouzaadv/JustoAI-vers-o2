// ================================================================
// SISTEMA UNIFICADO DE CRÉDITOS - Business Logic
// ================================================================
// Implementa Report Credits + FULL Credits com FIFO, rollover e expiration

import { PrismaClient, Prisma } from '@prisma/client';
import { ICONS } from './icons';
import { isCreditTransactionMetadata } from './types/type-guards';
import { log, logError } from '@/lib/services/logger';

// Tipos locais para dados do Prisma (Padrão-Ouro: interfaces explícitas)
interface WorkspaceCreditsRecord {
  id: string;
  workspaceId: string;
  reportCreditsBalance: number | { toNumber(): number };
  fullCreditsBalance: number | { toNumber(): number };
  reportCreditsRolloverCap: number | { toNumber(): number };
  fullCreditsRolloverCap: number | { toNumber(): number };
  createdAt: Date;
  updatedAt: Date;
}

interface CreditAllocationRecord {
  id: string;
  workspaceId: string;
  type: string;
  amount: number | { toNumber(): number };
  remainingAmount: number | { toNumber(): number };
  expiresAt: Date | null;
  sourceDescription: string | null;
  createdAt: Date;
}

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

export interface CreditRefundResult {
  success: boolean;
  error?: string;
  refundedAmount?: {
    reportCredits: number;
    fullCredits: number;
  };
  creditTransactionIds?: string[];
  newBalance?: CreditBalance;
}

export interface CreditAllocationBreakdown {
  type: 'MONTHLY' | 'BONUS' | 'PACK';
  amount: number;
  remaining: number;
  consumed: number;
  expiresAt?: Date;
}

/**
 * DEPRECATED: Plan configurations below are superseded by src/config/plans.ts (SSOT)
 *
 * ⚠️  IMPORTANT:
 * - The SINGLE SOURCE OF TRUTH for plans is now: src/config/plans.ts
 * - Plan names have changed: STARTER→gestao, PROFESSIONAL→performance, ENTERPRISE→enterprise
 * - Credit rates have unified: micro-tiers (0.25/0.5/1.0) → unified (1 credit per 50 processes)
 *
 * This CREDIT_CONFIG is kept for backwards compatibility with existing database records.
 * New code should use PlanService from src/lib/services/planService.ts
 *
 * Migration path for old plan names:
 * - 'starter' / 'STARTER' → 'gestao'
 * - 'professional' / 'PROFESSIONAL' → 'performance'
 * - 'enterprise' / 'ENTERPRISE' → 'enterprise'
 */
export const CREDIT_CONFIG = {
  // DEPRECATED: These micro-tier rates are superseded by unified rate from SSOT
  // New rate: 1 credit per ~50 processes (see src/config/plans.ts)
  REPORT_CREDIT_UNIT: 25, // [DEPRECATED] Use src/config/plans.ts instead
  FULL_CREDIT_PER_BATCH: 10, // [DEPRECATED] Use src/config/plans.ts instead

  // Micro-tiers para report credits [DEPRECATED]
  TIER_1_PROCESSES: 5,    // [DEPRECATED] Use SSOT from src/config/plans.ts
  TIER_1_COST: 0.25,      // [DEPRECATED]
  TIER_2_PROCESSES: 12,   // [DEPRECATED]
  TIER_2_COST: 0.5,       // [DEPRECATED]
  TIER_3_PROCESSES: 25,   // [DEPRECATED]
  TIER_3_COST: 1.0,       // [DEPRECATED]

  // Configurações de plano [DEPRECATED - See src/config/plans.ts]
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
  constructor(private prisma: PrismaClient) { }

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let credits: WorkspaceCreditsRecord | null = await (this.prisma as any).workspaceCredits.findUnique({
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
      logError(`${ICONS.ERROR} Erro ao buscar saldo de créditos:`, 'error', { component: 'creditSystem' });
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
    log.info({ msg: '${ICONS.PROCESS} Debitando créditos: ${reportCredits} report, ${fullCredits} full', component: 'creditSystem' });

    try {
      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

        log.info({ msg: '${ICONS.SUCCESS} Créditos debitados com sucesso', component: 'creditSystem' });

        return {
          success: true,
          remainingBalance: newBalance,
          transactionIds
        };
      });

    } catch (error) {
      logError(`${ICONS.ERROR} Erro ao debitar créditos:`, 'error', { component: 'creditSystem' });
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
        log.warn({ msg: '${ICONS.WARNING} Failed to serialize transaction metadata:`, error', component: 'creditSystem' });
        // Use undefined for invalid metadata
        validatedMetadata = undefined;
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

      log.info({ msg: '${ICONS.INFO} Debitado ${toDebitFromThisAllocation} ${category} credits da allocation ${allocation.id}', component: 'creditSystem' });
    }

    if (remainingToDebit > 0) {
      throw new Error(`Créditos insuficientes para débito completo. Faltam ${remainingToDebit} ${category} credits`);
    }

    return transactionIds;
  }

  /**
   * Reembolsa créditos atomicamente (rollback de débitos anteriores)
   *
   * **Garantias Padrão-Ouro:**
   * 1. Atomicidade: Tudo ou nada (prisma.$transaction)
   * 2. Auditoria: Cada reembolso cria uma CreditTransaction CREDIT vinculada aos DEBITs originais
   * 3. Idempotência: Pode ser chamado 2x com mesmos transactionIds (segunda vez não faz nada)
   * 4. Rastreabilidade: Campo metadata.relatedDebits liga CREDIT → DEBITs originais
   */
  async refundCredits(
    debitTransactionIds: string[],
    refundReason: string,
    metadata: unknown = {}
  ): Promise<CreditRefundResult> {
    log.info({
      msg: `${ICONS.PROCESS} Iniciando reembolso para ${debitTransactionIds.length} transações de débito`,
      component: 'creditSystem'
    });

    try {
      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Step 1: Buscar transações originais (validar que são DEBITs)
        const originalDebits = await tx.creditTransaction.findMany({
          where: {
            id: { in: debitTransactionIds },
            type: 'DEBIT'
          }
        });

        if (originalDebits.length === 0) {
          return {
            success: false,
            error: 'Nenhuma transação de débito válida encontrada para reembolso'
          };
        }

        if (originalDebits.length !== debitTransactionIds.length) {
          log.warn({
            msg: `${ICONS.WARNING} Aviso: ${debitTransactionIds.length - originalDebits.length} IDs não são transações de débito válidas`,
            component: 'creditSystem'
          });
        }

        // Step 2: Agrupar por workspaceId e allocation para validação
        const debitsByWorkspace = new Map<string, typeof originalDebits>();
        const debitsByAllocation = new Map<string, typeof originalDebits>();
        const debitsWithoutAllocation: typeof originalDebits = [];

        for (const debit of originalDebits) {
          // Agrupar por workspace
          if (!debitsByWorkspace.has(debit.workspaceId)) {
            debitsByWorkspace.set(debit.workspaceId, []);
          }
          debitsByWorkspace.get(debit.workspaceId)!.push(debit);

          // Agrupar por allocation (para refazer o FIFO)
          if (debit.allocationId) {
            if (!debitsByAllocation.has(debit.allocationId)) {
              debitsByAllocation.set(debit.allocationId, []);
            }
            debitsByAllocation.get(debit.allocationId)!.push(debit);
          } else {
            debitsWithoutAllocation.push(debit);
          }
        }

        // Validar: todos os débitos devem ser do mesmo workspace
        if (debitsByWorkspace.size > 1) {
          return {
            success: false,
            error: 'Não é permitido reembolsar débitos de múltiplos workspaces em uma única transação'
          };
        }

        const workspaceId = Array.from(debitsByWorkspace.keys())[0];
        const workspaceDebits = debitsByWorkspace.get(workspaceId)!;

        // Step 3: Calcular totais por categoria
        let totalReportCredits = 0;
        let totalFullCredits = 0;

        for (const debit of workspaceDebits) {
          const amount = Number(debit.amount);
          if (debit.creditCategory === 'REPORT') {
            totalReportCredits += amount;
          } else if (debit.creditCategory === 'FULL') {
            totalFullCredits += amount;
          }
        }

        // Step 4: Reembolsar allocations (incrementar remainingAmount)
        for (const [allocationId, debits] of debitsByAllocation.entries()) {
          let amountToRefund = 0;
          for (const debit of debits) {
            amountToRefund += Number(debit.amount);
          }

          await tx.creditAllocation.update({
            where: { id: allocationId },
            data: {
              remainingAmount: { increment: amountToRefund }
            }
          });

          log.info({
            msg: `${ICONS.INFO} Reembolsado ${amountToRefund} créditos na allocation ${allocationId}`,
            component: 'creditSystem'
          });
        }

        // Step 5: Atualizar saldo total do workspace
        await tx.workspaceCredits.update({
          where: { workspaceId },
          data: {
            reportCreditsBalance: { increment: totalReportCredits },
            fullCreditsBalance: { increment: totalFullCredits }
          }
        });

        // Step 6: Criar transações de CREDIT (auditoria do reembolso)
        const creditTransactionIds: string[] = [];

        // Validar metadata com type guard (Padrão-Ouro)
        let validatedMetadata: Prisma.InputJsonValue | undefined = undefined;
        if (metadata && typeof metadata === 'object') {
          try {
            const enrichedMetadata = {
              ...metadata,
              relatedDebits: debitTransactionIds,
              refundedAt: new Date().toISOString(),
              refundReason
            };
            validatedMetadata = JSON.parse(JSON.stringify(enrichedMetadata));
          } catch (error) {
            log.warn({
              msg: `${ICONS.WARNING} Falha ao serializar metadata de reembolso`,
              component: 'creditSystem'
            });
          }
        }

        // Criar transação de CREDIT para REPORT
        if (totalReportCredits > 0) {
          const creditTx = await tx.creditTransaction.create({
            data: {
              workspaceId,
              type: 'CREDIT',
              creditCategory: 'REPORT',
              amount: totalReportCredits,
              reason: `Reembolso: ${refundReason}`,
              metadata: validatedMetadata,
              allocationId: null
            }
          });
          creditTransactionIds.push(creditTx.id);
        }

        // Criar transação de CREDIT para FULL
        if (totalFullCredits > 0) {
          const creditTx = await tx.creditTransaction.create({
            data: {
              workspaceId,
              type: 'CREDIT',
              creditCategory: 'FULL',
              amount: totalFullCredits,
              reason: `Reembolso: ${refundReason}`,
              metadata: validatedMetadata,
              allocationId: null
            }
          });
          creditTransactionIds.push(creditTx.id);
        }

        const newBalance = await this.getCreditBalance(workspaceId);

        log.info({
          msg: `${ICONS.SUCCESS} Reembolso concluído: +${totalReportCredits} REPORT, +${totalFullCredits} FULL`,
          component: 'creditSystem'
        });

        return {
          success: true,
          refundedAmount: {
            reportCredits: totalReportCredits,
            fullCredits: totalFullCredits
          },
          creditTransactionIds,
          newBalance
        };
      });

    } catch (error) {
      logError(`${ICONS.ERROR} Erro ao reembolsar créditos:`, 'error', { component: 'creditSystem' });
      return {
        success: false,
        error: 'Erro ao processar reembolso de créditos'
      };
    }
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
    log.info({ msg: '${ICONS.PROCESS} Creditando: ${reportCredits} report, ${fullCredits} full (${type})', component: 'creditSystem' });

    try {
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

      log.info({ msg: '${ICONS.SUCCESS} Créditos creditados com sucesso', component: 'creditSystem' });

    } catch (error) {
      logError(`${ICONS.ERROR} Erro ao creditar créditos:`, 'error', { component: 'creditSystem' });
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

      log.info({ msg: '${ICONS.SUCCESS} Créditos reservados: ${reportCredits} report, ${fullCredits} full', component: 'creditSystem' });

      return {
        success: true,
        holdId: hold.id
      };

    } catch (error) {
      logError(`${ICONS.ERROR} Erro ao reservar créditos:`, 'error', { component: 'creditSystem' });
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

      log.info({ msg: '${ICONS.SUCCESS} Reserva de créditos liberada: ${holdId}', component: 'creditSystem' });

    } catch (error) {
      logError(`${ICONS.ERROR} Erro ao liberar reserva:`, 'error', { component: 'creditSystem' });
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

      return allocations.map((allocation: CreditAllocationRecord) => {
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
      logError(`${ICONS.ERROR} Erro ao buscar breakdown:`, 'error', { component: 'creditSystem' });
      throw new Error('Erro ao consultar breakdown de créditos');
    }
  }

  /**
   * Inicializa créditos para novo workspace
   */
  async initializeWorkspaceCredits(
    workspaceId: string,
    planName: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' = 'STARTER'
  ): Promise<WorkspaceCreditsRecord> {
    try {
      const planConfig = CREDIT_CONFIG.PLANS[planName];

      const credits = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Criar registro de créditos
        return await tx.workspaceCredits.create({
          data: {
            workspaceId,
            reportCreditsBalance: 0,
            fullCreditsBalance: 0,
            reportCreditsRolloverCap: planConfig.reportRolloverCap,
            fullCreditsRolloverCap: planConfig.fullRolloverCap
          }
        });
      });

      // Adicionar bônus do primeiro mês (se aplicável) - fora da transação
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

      log.info({ msg: '${ICONS.SUCCESS} Créditos inicializados para workspace ${workspaceId} (${planName})', component: 'creditSystem' });

      return credits;

    } catch (error) {
      logError(`${ICONS.ERROR} Erro ao inicializar créditos:`, 'error', { component: 'creditSystem' });
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

      log.info({ msg: '${ICONS.PROCESS} Alocação mensal para ${workspaceId} (${planName})', component: 'creditSystem' });

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
          log.info({ msg: '${ICONS.WARNING} Rollover cap aplicado para report credits: ${reportCreditsToAdd}/${planConfig.reportCreditsMonth}', component: 'creditSystem' });
        }

        if (fullCreditsToAdd < planConfig.fullCreditsMonth) {
          log.info({ msg: '${ICONS.WARNING} Rollover cap aplicado para full credits: ${fullCreditsToAdd}/${planConfig.fullCreditsMonth}', component: 'creditSystem' });
        }
      }

    } catch (error) {
      logError(`${ICONS.ERROR} Erro na alocação mensal:`, 'error', { component: 'creditSystem' });
      throw new Error('Erro na alocação mensal de créditos');
    }
  }

  /**
   * Job de limpeza de créditos expirados
   */
  async cleanupExpiredCredits(): Promise<{ expiredAllocations: number; expiredHolds: number }> {
    try {
      log.info({ msg: '${ICONS.PROCESS} Iniciando limpeza de créditos expirados...', component: 'creditSystem' });

      const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

      log.info({ msg: '${ICONS.SUCCESS} Limpeza concluída: ${result.expiredAllocations} allocations, ${result.expiredHolds} holds', component: 'creditSystem' });

      return result;

    } catch (error) {
      logError(`${ICONS.ERROR} Erro na limpeza de créditos:`, 'error', { component: 'creditSystem' });
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