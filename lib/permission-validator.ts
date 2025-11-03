// ================================================================
// PERMISSION VALIDATOR - Workspace Role Verification
// ================================================================
// Validates user permissions for workspace operations

import { prisma } from './prisma';
import { ICONS } from './icons';

export type WorkspaceRole = 'admin' | 'member' | 'viewer';

export interface PermissionCheck {
  isAuthorized: boolean;
  role?: WorkspaceRole;
  workspaceId: string;
  userId: string;
  denialReason?: string;
}

/**
 * Check if user is admin of workspace
 */
export async function isWorkspaceAdmin(
  userId: string,
  workspaceId: string
): Promise<boolean> {
  try {
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        workspaceId,
        role: 'admin' // Assuming 'admin' role exists in schema
      }
    });

    return !!userWorkspace;
  } catch (error) {
    console.error(`${ICONS.ERROR} Error checking admin status:`, error);
    return false;
  }
}

/**
 * Get user role in workspace
 */
export async function getUserWorkspaceRole(
  userId: string,
  workspaceId: string
): Promise<WorkspaceRole | null> {
  try {
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        workspaceId
      }
    });

    if (!userWorkspace) {
      return null;
    }

    // Assuming 'role' field exists - adjust based on actual schema
    return (userWorkspace as any).role || 'member';
  } catch (error) {
    console.error(`${ICONS.ERROR} Error getting user role:`, error);
    return null;
  }
}

/**
 * Validate user has required role
 */
export async function validateUserRole(
  userId: string,
  workspaceId: string,
  requiredRole: WorkspaceRole | WorkspaceRole[]
): Promise<PermissionCheck> {
  const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

  try {
    // Check if user is member of workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        workspaceId
      }
    });

    if (!userWorkspace) {
      return {
        isAuthorized: false,
        workspaceId,
        userId,
        denialReason: 'User is not a member of this workspace'
      };
    }

    const userRole = (userWorkspace as any).role || 'member';

    // Check if user has required role
    if (!requiredRoles.includes(userRole as WorkspaceRole)) {
      return {
        isAuthorized: false,
        role: userRole as WorkspaceRole,
        workspaceId,
        userId,
        denialReason: `User role '${userRole}' does not have permission. Required: ${requiredRoles.join(' or ')}`
      };
    }

    return {
      isAuthorized: true,
      role: userRole as WorkspaceRole,
      workspaceId,
      userId
    };
  } catch (error) {
    console.error(`${ICONS.ERROR} Error validating user role:`, error);
    return {
      isAuthorized: false,
      workspaceId,
      userId,
      denialReason: 'Error validating permissions'
    };
  }
}

/**
 * Middleware-style validator for API routes
 * Returns error response if not authorized
 */
export async function requireWorkspaceAdmin(
  userId: string,
  workspaceId: string
): Promise<{ authorized: true } | { authorized: false; error: string }> {
  const check = await validateUserRole(userId, workspaceId, 'admin');

  if (!check.isAuthorized) {
    console.warn(
      `${ICONS.LOCK} Admin access denied for user ${userId} on workspace ${workspaceId}: ${check.denialReason}`
    );
    return {
      authorized: false,
      error: check.denialReason || 'Unauthorized'
    };
  }

  console.log(`${ICONS.LOCK} Admin access granted for user ${userId} on workspace ${workspaceId}`);
  return { authorized: true };
}

/**
 * Middleware-style validator for API routes with multiple roles
 */
export async function requireWorkspaceRole(
  userId: string,
  workspaceId: string,
  requiredRoles: WorkspaceRole | WorkspaceRole[]
): Promise<{ authorized: true; role: WorkspaceRole } | { authorized: false; error: string }> {
  const check = await validateUserRole(userId, workspaceId, requiredRoles);

  if (!check.isAuthorized) {
    console.warn(
      `${ICONS.LOCK} Access denied for user ${userId} on workspace ${workspaceId}: ${check.denialReason}`
    );
    return {
      authorized: false,
      error: check.denialReason || 'Unauthorized'
    };
  }

  console.log(
    `${ICONS.LOCK} Access granted (${check.role}) for user ${userId} on workspace ${workspaceId}`
  );
  return { authorized: true, role: check.role || 'member' };
}

/**
 * Check multiple workspaces at once
 */
export async function getUserWorkspaceAccess(
  userId: string
): Promise<Array<{ workspaceId: string; role: WorkspaceRole }>> {
  try {
    const userWorkspaces = await prisma.userWorkspace.findMany({
      where: { userId },
      select: {
        workspaceId: true
      }
    });

    const access = userWorkspaces.map(uw => ({
      workspaceId: uw.workspaceId,
      role: 'member' as WorkspaceRole // Default role
    }));

    return access;
  } catch (error) {
    console.error(`${ICONS.ERROR} Error getting user workspace access:`, error);
    return [];
  }
}

/**
 * Validate request has proper user and workspace context
 * with admin role
 */
export async function validateAdminRequest(
  userId: string | undefined,
  workspaceId: string | undefined
): Promise<{
  valid: boolean;
  reason?: string;
  role?: WorkspaceRole;
}> {
  if (!userId) {
    return { valid: false, reason: 'User not authenticated' };
  }

  if (!workspaceId) {
    return { valid: false, reason: 'Workspace ID not provided' };
  }

  const check = await validateUserRole(userId, workspaceId, 'admin');

  return {
    valid: check.isAuthorized,
    reason: check.denialReason,
    role: check.role
  };
}
