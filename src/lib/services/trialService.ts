/**
 * Trial Service - Manages trial period logic and notifications
 */

import { prisma } from '@/lib/prisma';
import { log, logError } from '@/lib/services/logger';

export interface TrialStatus {
  isActive: boolean;
  daysRemaining: number;
  endsAt: Date | null;
  requiresAction: boolean; // True if credit card needed within 2 days
}

/**
 * Check if a workspace is still in trial period
 */
export async function getTrialStatus(workspaceId: string): Promise<TrialStatus> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true, trialEndsAt: true }
  });

  if (!workspace || workspace.plan !== 'TRIAL') {
    return {
      isActive: false,
      daysRemaining: 0,
      endsAt: null,
      requiresAction: false
    };
  }

  if (!workspace.trialEndsAt) {
    return {
      isActive: false,
      daysRemaining: 0,
      endsAt: null,
      requiresAction: false
    };
  }

  const now = new Date();
  const msUntilEnd = workspace.trialEndsAt.getTime() - now.getTime();
  const daysRemaining = Math.ceil(msUntilEnd / (1000 * 60 * 60 * 24));
  const isActive = daysRemaining > 0;
  const requiresAction = isActive && daysRemaining <= 2; // Alert if 2 days or less

  return {
    isActive,
    daysRemaining: Math.max(0, daysRemaining),
    endsAt: workspace.trialEndsAt,
    requiresAction
  };
}

/**
 * Find all trials that expire within the next N days
 * Used for sending reminder emails
 */
export async function getTrialsExpiringWithin(daysFromNow: number = 2) {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + daysFromNow);

  const expiring = await prisma.workspace.findMany({
    where: {
      plan: 'TRIAL',
      trialEndsAt: {
        gte: startDate,
        lte: endDate
      },
      // Only get trials that haven't been reminded yet
      // (could add a "trialReminderSentAt" field for this)
    },
    include: {
      users: {
        include: {
          user: {
            select: { email: true, name: true }
          }
        }
      }
    }
  });

  return expiring;
}

/**
 * Get workspaces with expired trials that need to be downgraded
 */
export async function getExpiredTrials() {
  const now = new Date();

  const expired = await prisma.workspace.findMany({
    where: {
      plan: 'TRIAL',
      trialEndsAt: {
        lt: now
      }
    },
    include: {
      users: {
        include: {
          user: {
            select: { email: true, name: true }
          }
        }
      }
    }
  });

  return expired;
}

/**
 * Downgrade an expired trial workspace to FREE plan
 * Blocks access until user adds payment method
 */
export async function downgradeExpiredTrial(workspaceId: string) {
  try {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        plan: 'FREE',
        status: 'SUSPENDED' // Suspend access until upgrade/payment
      }
    });

    log.info({ msg: '[TRIAL] Downgraded expired trial workspace:' });
    return true;
  } catch (_error) {
    logError(error, 'TRIAL Error downgrading trial ${workspaceId}:', { component: 'refactored' });
    return false;
  }
}

/**
 * Convert trial to paid plan (when user upgrades)
 */
export async function convertTrialToPaidPlan(
  workspaceId: string,
  newPlan: 'GESTAO' | 'PERFORMANCE' | 'ENTERPRISE'
) {
  try {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        plan: newPlan,
        trialEndsAt: null, // Clear trial end date
        status: 'ACTIVE'
      }
    });

    log.info({ msg: '[TRIAL] Converted trial workspace  to  plan' });
    return true;
  } catch (_error) {
    logError(error, 'TRIAL Error converting trial ${workspaceId}:', { component: 'refactored' });
    return false;
  }
}

const trialService = {
  getTrialStatus,
  getTrialsExpiringWithin,
  getExpiredTrials,
  downgradeExpiredTrial,
  convertTrialToPaidPlan
};

export default trialService;
