// ================================================================
// PERMISSION VALIDATOR - Workspace Role Verification
// ================================================================
// Validates user permissions for workspace operations

import { prisma } from './prisma';
import { ICONS } from './icons';
import { log, logError } from '@/lib/services/logger';

export type WorkspaceRole = 'ADMIN' | 'MEMBER' | 'VIEWER';

/**
 * Type Guard Enum: Validates that a string is a valid WorkspaceRole value
 * Padrão-Ouro: Safe narrowing for enum-like unions (no casting allowed)
 */
function isValidWorkspaceRole(value: unknown): value is WorkspaceRole {
  return (
    typeof value === 'string' &&
    ['ADMIN', 'MEMBER', 'VIEWER'].includes(value)
  );
}

/**
 * Type guard: Validates that an object is a valid UserWorkspace with role property
 * After this guard passes, we know:
 * 1. data is an object
 * 2. data has a 'role' property
 * 3. role is a string (may or may not be a valid WorkspaceRole yet)
 */
function isUserWorkspaceWithRole(
  data: unknown
): data is { role: string } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'role' in data &&
    typeof (data as Record<string, unknown>).role === 'string'
  );
}

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
    logError(_error, '${ICONS.ERROR} Error checking admin status:', { component: 'refactored' });
    return false;
  }
}

/**
 * Get user role in workspace
 * Uses safe enum narrowing (Padrão-Ouro: Type Guards + isValidWorkspaceRole)
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

    // Step 1: Validate object structure - ensure role property exists as string
    if (!isUserWorkspaceWithRole(userWorkspace)) {
      log.warn({ msg: 'UserWorkspace missing role property' });
      return null;
    }

    // Step 2: At this point, userWorkspace.role is guaranteed to be string
    // Validate that it's a valid WorkspaceRole value (ADMIN | MEMBER | VIEWER)
    if (!isValidWorkspaceRole(userWorkspace.role)) {
      log.warn({ msg: 'Invalid WorkspaceRole value:' });
      return 'MEMBER'; // Safe default
    }

    // Step 3: Now userWorkspace.role is type WorkspaceRole - no casting needed!
    return userWorkspace.role;
  } catch (error) {
    logError(_error, '${ICONS.ERROR} Error getting user role:', { component: 'refactored' });
    return null;
  }
}

/**
 * Validate user has required role
 * Uses safe enum narrowing (Padrão-Ouro: Type Guards + isValidWorkspaceRole)
 * NO casting with 'as' - full type safety
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

    // Step 1: Validate object structure - ensure role property exists as string
    if (!isUserWorkspaceWithRole(userWorkspace)) {
      return {
        isAuthorized: false,
        workspaceId,
        userId,
        denialReason: 'Invalid user workspace data'
      };
    }

    // Step 2: Validate that role is a valid WorkspaceRole value (ADMIN | MEMBER | VIEWER)
    if (!isValidWorkspaceRole(userWorkspace.role)) {
      return {
        isAuthorized: false,
        workspaceId,
        userId,
        denialReason: `Invalid role value: ${userWorkspace.role}`
      };
    }

    // Step 3: Now userWorkspace.role is guaranteed to be WorkspaceRole (no casting!)
    const userRole = userWorkspace.role; // userRole is WorkspaceRole, not string

    // Check if user has required role
    if (!requiredRoles.includes(userRole)) {
      return {
        isAuthorized: false,
        role: userRole,
        workspaceId,
        userId,
        denialReason: `User role '${userRole}' does not have permission. Required: ${requiredRoles.join(' or ')}`
      };
    }

    return {
      isAuthorized: true,
      role: userRole,
      workspaceId,
      userId
    };
  } catch (error) {
    logError(_error, '${ICONS.ERROR} Error validating user role:', { component: 'refactored' });
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
 * Returns _error response if not authorized
 */
export async function requireWorkspaceAdmin(
  userId: string,
  workspaceId: string
): Promise<{ authorized: true } | { authorized: false; _error: string }> {
  const check = await validateUserRole(userId, workspaceId, 'ADMIN');

  if (!check.isAuthorized) {
    log.warn({ msg: 'Admin access denied for user  on workspace :' });
    return {
      authorized: false,
      _error: check.denialReason || 'Unauthorized'
    };
  }

  log.info({ msg: 'Admin access granted for user  on workspace' });
  return { authorized: true };
}

/**
 * Middleware-style validator for API routes with multiple roles
 */
export async function requireWorkspaceRole(
  userId: string,
  workspaceId: string,
  requiredRoles: WorkspaceRole | WorkspaceRole[]
): Promise<{ authorized: true; role: WorkspaceRole } | { authorized: false; _error: string }> {
  const check = await validateUserRole(userId, workspaceId, requiredRoles);

  if (!check.isAuthorized) {
    log.warn({ msg: 'Access denied for user  on workspace :' });
    return {
      authorized: false,
      _error: check.denialReason || 'Unauthorized'
    };
  }

  log.info({ msg: 'Access granted () for user  on workspace' });
  return { authorized: true, role: check.role || 'MEMBER' };
}

/**
 * Interface for UserWorkspace select result
 * Used in getUserWorkspaceAccess to ensure type safety in map callback
 */
interface UserWorkspaceSelect {
  workspaceId: string;
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

    const access = userWorkspaces.map((uw: UserWorkspaceSelect) => ({
      workspaceId: uw.workspaceId,
      role: 'MEMBER' as WorkspaceRole // Default role
    }));

    return access;
  } catch (error) {
    logError(_error, '${ICONS.ERROR} Error getting user workspace access:', { component: 'refactored' });
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
 * @returns { authorized: true } | { authorized: false; _error: string }
 */
export async function requireAdminAccess(
  email: string | undefined,
  userId: string | undefined,
  workspaceId: string | undefined
): Promise<{ authorized: true; isInternal: boolean } | { authorized: false; _error: string }> {
  if (!email || !userId) {
    return {
      authorized: false,
      _error: 'User not authenticated'
    };
  }

  // Check if internal admin
  if (isInternalAdmin(email)) {
    log.info({ msg: 'Internal admin access granted for user  ()' });
    return {
      authorized: true,
      isInternal: true
    };
  }

  // Check if workspace admin
  if (!workspaceId) {
    return {
      authorized: false,
      _error: 'Workspace ID not provided'
    };
  }

  const isAdmin = await isWorkspaceAdmin(userId, workspaceId);

  if (!isAdmin) {
    log.warn({ msg: 'Admin access denied for user  () on workspace' });
    return {
      authorized: false,
      _error: 'Admin access required'
    };
  }

  log.info({ msg: 'Workspace admin access granted for user  () on workspace' });
  return {
    authorized: true,
    isInternal: false
  };
}

/**
 * Alias for isInternalAdmin - used for divinity admin checks
 * (internal JustoAI admins with @justoai.com.br email)
 */
export const isInternalDivinityAdmin = isInternalAdmin;
