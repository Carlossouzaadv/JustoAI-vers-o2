// ================================================================
// PERMISSION VALIDATOR - Workspace Role Verification
// ================================================================
// Validates user permissions for workspace operations

import { prisma } from './prisma';
import { ICONS } from './icons';

export type WorkspaceRole = 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface PermissionCheck {
  isAuthorized: boolean;
  role?: WorkspaceRole;
  workspaceId: string;
  userId: string;
  denialReason?: string;
}

/**
 * Check if user is internal JustoAI admin (by email domain)
 * Internal admins have full access to all dashboards and data
 */
export function isInternalAdmin(email: string | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith('@justoai.com.br');
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
        role: 'ADMIN'
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
  const check = await validateUserRole(userId, workspaceId, 'ADMIN');

  if (!check.isAuthorized) {
    console.warn(
      `${ICONS.SHIELD} Admin access denied for user ${userId} on workspace ${workspaceId}: ${check.denialReason}`
    );
    return {
      authorized: false,
      error: check.denialReason || 'Unauthorized'
    };
  }

  console.log(`${ICONS.SHIELD} Admin access granted for user ${userId} on workspace ${workspaceId}`);
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
      `${ICONS.SHIELD} Access denied for user ${userId} on workspace ${workspaceId}: ${check.denialReason}`
    );
    return {
      authorized: false,
      error: check.denialReason || 'Unauthorized'
    };
  }

  console.log(
    `${ICONS.SHIELD} Access granted (${check.role}) for user ${userId} on workspace ${workspaceId}`
  );
  return { authorized: true, role: check.role || 'MEMBER' };
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
      role: 'MEMBER' as WorkspaceRole // Default role
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

  const check = await validateUserRole(userId, workspaceId, 'ADMIN');

  return {
    valid: check.isAuthorized,
    reason: check.denialReason,
    role: check.role
  };
}

/**
 * Validate access to admin endpoints
 * Allows: Internal admins (@justoai.com.br) OR workspace admins
 *
 * @param email User email address
 * @param userId User ID
 * @param workspaceId Workspace ID
 * @returns { authorized: true } | { authorized: false; error: string }
 */
export async function requireAdminAccess(
  email: string | undefined,
  userId: string | undefined,
  workspaceId: string | undefined
): Promise<{ authorized: true; isInternal: boolean } | { authorized: false; error: string }> {
  if (!email || !userId) {
    return {
      authorized: false,
      error: 'User not authenticated'
    };
  }

  // Check if internal admin
  if (isInternalAdmin(email)) {
    console.log(
      `${ICONS.SHIELD} Internal admin access granted for user ${userId} (${email})`
    );
    return {
      authorized: true,
      isInternal: true
    };
  }

  // Check if workspace admin
  if (!workspaceId) {
    return {
      authorized: false,
      error: 'Workspace ID not provided'
    };
  }

  const isAdmin = await isWorkspaceAdmin(userId, workspaceId);

  if (!isAdmin) {
    console.warn(
      `${ICONS.SHIELD} Admin access denied for user ${userId} (${email}) on workspace ${workspaceId}`
    );
    return {
      authorized: false,
      error: 'Admin access required'
    };
  }

  console.log(
    `${ICONS.SHIELD} Workspace admin access granted for user ${userId} (${email}) on workspace ${workspaceId}`
  );
  return {
    authorized: true,
    isInternal: false
  };
}
