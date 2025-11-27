/**
 * Credit Service
 */

import { prisma } from '@/lib/prisma';
import { isInternalDivinityAdmin, isInternalAdmin } from '@/lib/permission-validator';
import { CreditCategory, CreditTransactionType } from '@/lib/types/database';

export interface CreditBalance {
  reportCredits: number;
  fullCredits: number;
  unlimited: boolean;
  divinityAdmin: boolean;
  internalAccount?: boolean; // @justoai.com.br accounts get mock 999 credits
}

export interface CreditDebitResult {
  success: boolean;
  newBalance?: CreditBalance;
  reason?: string;
  transactionId?: string;
}

export async function getCredits(userEmail: string | undefined, workspaceId: string): Promise<CreditBalance> {
  const isDivinity = isInternalDivinityAdmin(userEmail);
  if (isDivinity) {
    return { reportCredits: 999999999, fullCredits: 999999999, unlimited: true, divinityAdmin: true };
  }

  // Mock 999 credits for @justoai.com.br internal accounts (not divinity admin)
  const isInternal = isInternalAdmin(userEmail);
  if (isInternal) {
    return { reportCredits: 999, fullCredits: 999, unlimited: false, divinityAdmin: false, internalAccount: true };
  }

  try {
    const credits = await prisma.workspaceCredits.findUnique({ where: { workspaceId } });
    if (!credits) {
      const created = await prisma.workspaceCredits.create({
        data: { workspaceId, reportCreditsBalance: 0, fullCreditsBalance: 0 }
      });
      return { reportCredits: Number(created.reportCreditsBalance), fullCredits: Number(created.fullCreditsBalance), unlimited: false, divinityAdmin: false };
    }
    return { reportCredits: Number(credits.reportCreditsBalance), fullCredits: Number(credits.fullCreditsBalance), unlimited: false, divinityAdmin: false };
  } catch (_error) {
    throw new Error('Failed to fetch');
  }
}

export async function hasEnoughCredits(userEmail: string | undefined, workspaceId: string, cost: number, category: CreditCategory = CreditCategory.FULL): Promise<boolean> {
  const balance = await getCredits(userEmail, workspaceId);
  if (balance.divinityAdmin) return true;
  const available = category === CreditCategory.REPORT ? balance.reportCredits : balance.fullCredits;
  return available >= cost;
}

export async function debitCredits(userEmail: string | undefined, workspaceId: string, cost: number, category: CreditCategory, reason: string): Promise<CreditDebitResult> {
  try {
    const balance = await getCredits(userEmail, workspaceId);
    // Don't debit credits for divinity admin or internal @justoai.com.br accounts
    if (balance.divinityAdmin || balance.internalAccount) {
      return { success: true, newBalance: balance, reason: balance.divinityAdmin ? 'DIVINITY_ADMIN_NO_DEBIT' : 'INTERNAL_ACCOUNT_NO_DEBIT' };
    }
    const available = category === CreditCategory.REPORT ? balance.reportCredits : balance.fullCredits;
    if (available < cost) {
      return { success: false, reason: 'Insufficient credits' };
    }
    const fieldName = category === CreditCategory.REPORT ? 'reportCreditsBalance' : 'fullCreditsBalance';
    const updated = await prisma.workspaceCredits.update({
      where: { workspaceId },
      data: { [fieldName]: { decrement: cost } }
    });
    await prisma.creditTransaction.create({
      data: { workspaceId, type: CreditTransactionType.DEBIT, creditCategory: category, amount: cost, reason }
    });
    return { success: true, newBalance: { reportCredits: Number(updated.reportCreditsBalance), fullCredits: Number(updated.fullCreditsBalance), unlimited: false, divinityAdmin: false } };
  } catch (_error) {
    return { success: false, reason: 'Error debiting' };
  }
}

export async function addCredits(workspaceId: string, cost: number, category: CreditCategory, reason: string): Promise<CreditDebitResult> {
  try {
    const fieldName = category === CreditCategory.REPORT ? 'reportCreditsBalance' : 'fullCreditsBalance';
    const updated = await prisma.workspaceCredits.update({
      where: { workspaceId },
      data: { [fieldName]: { increment: cost } }
    });
    await prisma.creditTransaction.create({
      data: { workspaceId, type: CreditTransactionType.CREDIT, creditCategory: category, amount: cost, reason }
    });
    return { success: true, newBalance: { reportCredits: Number(updated.reportCreditsBalance), fullCredits: Number(updated.fullCreditsBalance), unlimited: false, divinityAdmin: false } };
  } catch (_error) {
    return { success: false, reason: 'Error adding' };
  }
}

export async function getTransactionHistory(workspaceId: string, limit: number = 50) {
  return prisma.creditTransaction.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: limit });
}

/**
 * Credit Calculator Interface
 * Helps users understand how many reports they can generate with their credits
 */
export interface CreditCalculation {
  creditsPerMonth: number;
  costPerProcessInReport: number; // 1 credit per 50 processes
  avgReportSize: number; // Average processes per report
  estimatedReportsPerMonth: number; // Average reports user can generate/month
  estimatedProcessesPerMonth: number; // Total processes that can be covered/month
}

/**
 * Calculate credit usage for a report based on process count
 * 1 credit covers 50 processes
 * @param processCount Number of processes in the report
 * @returns Cost in credits
 */
export function calculateReportCost(processCount: number): number {
  const PROCESSES_PER_CREDIT = 50;
  return Math.ceil(processCount / PROCESSES_PER_CREDIT);
}

/**
 * Estimate how many reports a user can generate per month
 * @param monthlyCredits Credits available per month
 * @param avgProcessesPerReport Average processes per report (default 100)
 * @returns Credit calculation details
 */
export function estimateMonthlyReports(
  monthlyCredits: number,
  avgProcessesPerReport: number = 100
): CreditCalculation {
  const costPerReport = calculateReportCost(avgProcessesPerReport);
  const estimatedReports = Math.floor(monthlyCredits / costPerReport);
  const PROCESSES_PER_CREDIT = 50;

  return {
    creditsPerMonth: monthlyCredits,
    costPerProcessInReport: PROCESSES_PER_CREDIT,
    avgReportSize: avgProcessesPerReport,
    estimatedReportsPerMonth: estimatedReports,
    estimatedProcessesPerMonth: monthlyCredits * PROCESSES_PER_CREDIT
  };
}

/**
 * Get credit estimates for each plan tier
 * @returns Object with estimates for Gestão, Performance, and Enterprise
 */
export function getPlanCreditEstimates() {
  return {
    gestao: {
      planName: 'Gestão',
      monthlyCredits: 10,
      processLimit: 200,
      estimates: estimateMonthlyReports(10, 100)
    },
    performance: {
      planName: 'Performance',
      monthlyCredits: 30,
      processLimit: 500,
      estimates: estimateMonthlyReports(30, 150)
    },
    enterprise: {
      planName: 'Enterprise',
      monthlyCredits: null, // Unlimited
      processLimit: null,
      estimates: { creditsPerMonth: Infinity, costPerProcessInReport: 50, avgReportSize: 200, estimatedReportsPerMonth: Infinity, estimatedProcessesPerMonth: Infinity }
    }
  };
}

const creditService = { getCredits, hasEnoughCredits, debitCredits, addCredits, getTransactionHistory, calculateReportCost, estimateMonthlyReports, getPlanCreditEstimates };
export default creditService;
