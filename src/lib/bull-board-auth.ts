// ================================================================
// BULL BOARD AUTHENTICATION
// ================================================================
// Validates access to Bull Board queue dashboard
// Only admins from authenticated workspaces can access

import type { Request } from 'express';
import { isInternalAdmin, isWorkspaceAdmin } from './permission-validator';
import { ICONS } from './icons';
import { prisma } from './prisma';
import { log, logError } from '@/lib/services/logger';

export interface BullBoardAccessValidation {
  authorized: boolean;
  userId?: string;
  workspaceId?: string;
  email?: string;
  isInternal?: boolean;
  role?: string;
  reason?: string;
}

/**
 * Type guard to safely extract userId from unknown request context
 */
function isRequestWithUserId(data: unknown): data is { userId: string } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'userId' in data &&
    typeof (data as Record<string, unknown>).userId === 'string'
  );
}

/**
 * Type guard to safely extract workspaceId from unknown request context
 */
function isRequestWithWorkspaceId(data: unknown): data is { workspaceId: string } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'workspaceId' in data &&
    typeof (data as Record<string, unknown>).workspaceId === 'string'
  );
}

/**
 * Validate Bull Board access from Express request
 * Allows: Internal admins (@justoai.com.br) OR workspace admins
 *
 * Steps:
 * 1. Extract userId from request context
 * 2. Get user from database to get email
 * 3. Check if internal admin (@justoai.com.br) → FULL ACCESS
 * 4. Check if workspace admin → SCOPED ACCESS
 * 5. Deny access otherwise
 */
export async function validateBullBoardAccess(
  req: Request
): Promise<BullBoardAccessValidation> {
  try {
    // Try to extract user ID from request context (set by middleware)
    // Using type guards for safe narrowing
    const reqContext = req as unknown;

    if (!isRequestWithUserId(reqContext)) {
      return {
        authorized: false,
        reason: 'User ID not available in request'
      };
    }

    const userId = reqContext.userId;

    // Extract workspaceId if present
    let workspaceId: string | undefined;
    if (isRequestWithWorkspaceId(reqContext)) {
      workspaceId = reqContext.workspaceId;
    }

    // Get user from database to check email
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return {
        authorized: false,
        userId,
        reason: 'User not found in database'
      };
    }

    // Check if internal admin
    if (isInternalAdmin(user.email)) {
      log.info({ msg: 'Bull Board access granted (INTERNAL) for user  ()' });
      return {
        authorized: true,
        userId,
        email: user.email,
        isInternal: true,
        role: 'INTERNAL_ADMIN'
      };
    }

    // Check if workspace admin
    if (!workspaceId) {
      return {
        authorized: false,
        userId,
        email: user.email,
        reason: 'Workspace ID not available in request'
      };
    }

    const isAdmin = await isWorkspaceAdmin(userId, workspaceId);

    if (!isAdmin) {
      log.warn({ msg: 'Bull Board access denied for user  () - not a workspace admin' });
      return {
        authorized: false,
        userId,
        email: user.email,
        workspaceId,
        reason: `User is not an admin of workspace ${workspaceId}`
      };
    }

    log.info({ msg: 'Bull Board access granted (WORKSPACE) for user  ()' });
    return {
      authorized: true,
      userId,
      email: user.email,
      workspaceId,
      isInternal: false,
      role: 'WORKSPACE_ADMIN'
    };
  } catch (error) {
    logError(error, '${ICONS.ERROR} Error validating Bull Board access:', { component: 'refactored' });

    return {
      authorized: false,
      reason: error instanceof Error ? error.message : 'Error validating access credentials'
    };
  }
}

/**
 * Validate Bull Board access from Next.js API request
 * Note: Bull Board uses Express, so this is for reference only
 */
export async function validateBullBoardAccessNextJS(
  req: unknown
): Promise<BullBoardAccessValidation> {
  try {
    // For Next.js routes, extract user from request context using type guards
    if (!isRequestWithUserId(req)) {
      return {
        authorized: false,
        reason: 'User context not available in request'
      };
    }

    if (!isRequestWithWorkspaceId(req)) {
      return {
        authorized: false,
        reason: 'Workspace context not available in request'
      };
    }

    const userId = req.userId;
    const workspaceId = req.workspaceId;

    // Check if user is admin
    const isAdmin = await isWorkspaceAdmin(userId, workspaceId);

    if (!isAdmin) {
      return {
        authorized: false,
        userId,
        workspaceId,
        reason: 'User is not an admin of this workspace'
      };
    }

    return {
      authorized: true,
      userId,
      workspaceId,
      role: 'ADMIN'
    };
  } catch (error) {
    logError(error, '${ICONS.ERROR} Error validating Bull Board access (Next.js):', { component: 'refactored' });

    return {
      authorized: false,
      reason: 'Error validating authentication'
    };
  }
}

/**
 * Simple token-based validation for development
 * Use BULL_BOARD_ACCESS_TOKEN environment variable
 */
export function validateBullBoardTokenDev(token: string | undefined): boolean {
  const expectedToken = process.env.BULL_BOARD_ACCESS_TOKEN;

  if (!expectedToken) {
    log.warn({ msg: 'BULL_BOARD_ACCESS_TOKEN not configured' });
    return false;
  }

  if (!token) {
    return false;
  }

  return token === expectedToken;
}

/**
 * Log Bull Board access for audit trail
 */
export function logBullBoardAccess(
  userId: string | undefined,
  workspaceId: string | undefined,
  authorized: boolean,
  reason?: string
): void {
  const timestamp = new Date().toISOString();
  const status = authorized ? '✅ GRANTED' : '❌ DENIED';

  console.log(
    `[BULL_BOARD_ACCESS] ${status} | User: ${userId} | Workspace: ${workspaceId} | Time: ${timestamp}${
      reason ? ` | Reason: ${reason}` : ''
    }`
  );

  // In production, could also save to database for audit trail
  // await prisma.auditLog.create({
  //   data: {
  //     action: 'BULL_BOARD_ACCESS',
  //     userId,
  //     workspaceId,
  //     status: authorized ? 'success' : 'failure',
  //     metadata: { reason }
  //   }
  // });
}
