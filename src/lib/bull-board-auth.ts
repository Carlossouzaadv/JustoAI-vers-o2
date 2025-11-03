// ================================================================
// BULL BOARD AUTHENTICATION
// ================================================================
// Validates access to Bull Board queue dashboard
// Only admins from authenticated workspaces can access

import type { Request } from 'express';
import { validateAuthAndGetUser } from './auth';
import { isWorkspaceAdmin } from '../../lib/permission-validator';
import { ICONS } from './icons';

export interface BullBoardAccessValidation {
  authorized: boolean;
  userId?: string;
  workspaceId?: string;
  role?: string;
  reason?: string;
}

/**
 * Validate Bull Board access from Express request
 *
 * Steps:
 * 1. Extract auth from headers
 * 2. Validate user is authenticated
 * 3. Check if user is admin of their workspace
 * 4. Log access attempt
 */
export async function validateBullBoardAccess(
  req: Request
): Promise<BullBoardAccessValidation> {
  try {
    // Try to get auth headers
    const authHeader = req.headers.authorization;
    const sessionToken = (req as any).session?.token;

    if (!authHeader && !sessionToken) {
      return {
        authorized: false,
        reason: 'No authentication credentials provided'
      };
    }

    // Extract token
    let token = '';
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (sessionToken) {
      token = sessionToken;
    }

    if (!token) {
      return {
        authorized: false,
        reason: 'Invalid authentication token format'
      };
    }

    // For Express requests, we need to validate differently
    // Try to extract user from request context
    let userId = (req as any).userId;
    let workspaceId = (req as any).workspaceId;

    // If not in context, try to validate from session/token
    // This is a simplified approach - in production, validate JWT properly
    if (!userId || !workspaceId) {
      return {
        authorized: false,
        reason: 'User context not available in request'
      };
    }

    // Check if user is admin
    const isAdmin = await isWorkspaceAdmin(userId, workspaceId);

    if (!isAdmin) {
      return {
        authorized: false,
        userId,
        workspaceId,
        reason: `User is not an admin of workspace ${workspaceId}`
      };
    }

    return {
      authorized: true,
      userId,
      workspaceId,
      role: 'ADMIN'
    };
  } catch (error) {
    console.error(
      `${ICONS.ERROR} Error validating Bull Board access:`,
      error
    );

    return {
      authorized: false,
      reason: 'Error validating access credentials'
    };
  }
}

/**
 * Validate Bull Board access from Next.js API request
 * Note: Bull Board uses Express, so this is for reference only
 */
export async function validateBullBoardAccessNextJS(
  req: any
): Promise<BullBoardAccessValidation> {
  try {
    // For Next.js routes, extract user from request context
    const userId = (req as any).userId;
    const workspaceId = (req as any).workspaceId;

    if (!userId || !workspaceId) {
      return {
        authorized: false,
        reason: 'User context not available in request'
      };
    }

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
    console.error(
      `${ICONS.ERROR} Error validating Bull Board access (Next.js):`,
      error
    );

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
    console.warn(
      `${ICONS.WARNING} BULL_BOARD_ACCESS_TOKEN not configured`
    );
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
