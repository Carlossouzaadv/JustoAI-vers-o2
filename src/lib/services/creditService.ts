/**
 * Credit Service
 */

import { prisma } from '@/lib/prisma';
import { isInternalDivinityAdmin } from '@/lib/permission-validator';
import { CreditCategory, CreditTransactionType } from '@/lib/types/database';

export interface CreditBalance {
  reportCredits: number;
  fullCredits: number;
  unlimited: boolean;
  divinityAdmin: boolean;
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
  try {
    const credits = await prisma.workspaceCredits.findUnique({ where: { workspaceId } });
    if (!credits) {
      const created = await prisma.workspaceCredits.create({
        data: { workspaceId, reportCreditsBalance: 0, fullCreditsBalance: 0 }
      });
      return { reportCredits: Number(created.reportCreditsBalance), fullCredits: Number(created.fullCreditsBalance), unlimited: false, divinityAdmin: false };
    }
    return { reportCredits: Number(credits.reportCreditsBalance), fullCredits: Number(credits.fullCreditsBalance), unlimited: false, divinityAdmin: false };
  } catch (error) {
    console.error('[CREDIT] Error:', error);
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
    if (balance.divinityAdmin) {
      return { success: true, newBalance: balance, reason: 'DIVINITY_ADMIN_NO_DEBIT' };
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

const creditService = { getCredits, hasEnoughCredits, debitCredits, addCredits, getTransactionHistory };
export default creditService;
