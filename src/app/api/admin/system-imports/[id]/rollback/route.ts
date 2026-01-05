/**
 * POST /api/admin/system-imports/[id]/rollback
 *
 * Triggers atomic rollback of a failed batch import.
 *
 * Security: Requires admin authentication (Clerk)
 * Body: None (ID and workspace from params/auth)
 * Response: { success: boolean, message: string }
 *
 * Flow:
 * 1. Validate user is admin
 * 2. Validate systemImportId exists and belongs to workspace
 * 3. Queue rollback job (async, returns immediately)
 * 4. Return success response
 *
 * The actual rollback is processed by workers/rollback-worker.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAuthAndGetUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { addRollbackJob } from '@/lib/queues';

// ============================================================================
// TYPE GUARDS & VALIDATORS (100% Type Safe)
// ============================================================================

/**
 * Validates that user object has required properties for type narrowing
 */
function isValidUserObject(user: unknown): user is { id: string; email: string; role?: string } {
  if (typeof user !== 'object' || user === null) {
    return false;
  }

  const obj = user as Record<string, unknown>;
  return typeof obj.id === 'string' && typeof obj.email === 'string';
}

/**
 * Validates route params object
 */
function isValidRouteParams(params: unknown): params is { id: string } {
  if (typeof params !== 'object' || params === null) {
    return false;
  }

  const obj = params as Record<string, unknown>;
  return typeof obj.id === 'string' && obj.id.length > 0;
}

// ============================================================================
// REQUEST HANDLER
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Record<string, string>> }
) {
  try {
    // 1. VALIDATE ROUTE PARAMS
    const resolvedParams = await params;
    if (!isValidRouteParams(resolvedParams)) {
      console.error('❌ [Rollback API] Invalid params:', resolvedParams);
      return NextResponse.json(
        { success: false, message: 'Invalid route parameters' },
        { status: 400 }
      );
    }

    const { id: systemImportId } = resolvedParams;

    // 2. AUTHENTICATE USER
    let user;
    try {
      const authResult = await validateAuthAndGetUser();
      user = authResult.user;
    } catch (error) {
      console.warn('⚠️  [Rollback API] Authentication failed:', error instanceof Error ? error.message : String(error));
      return NextResponse.json(
        { success: false, message: 'Authentication failed' },
        { status: 401 }
      );
    }

    if (!user || !isValidUserObject(user)) {
      console.warn('⚠️  [Rollback API] Invalid user object');
      return NextResponse.json(
        { success: false, message: 'User validation failed' },
        { status: 401 }
      );
    }

    // 3. VERIFY SYSTEM IMPORT EXISTS AND GET WORKSPACE
    let systemImport;
    try {
      systemImport = await prisma.systemImport.findUnique({
        where: { id: systemImportId },
        select: {
          id: true,
          workspaceId: true,
          status: true,
          fileName: true,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ [Rollback API] Database error fetching import: ${errorMessage}`);
      return NextResponse.json(
        { success: false, message: 'Database error' },
        { status: 500 }
      );
    }

    if (!systemImport) {
      console.warn(`⚠️  [Rollback API] SystemImport not found: ${systemImportId}`);
      return NextResponse.json(
        { success: false, message: 'Import not found' },
        { status: 404 }
      );
    }

    // 4. VERIFY USER HAS ACCESS TO WORKSPACE (Admin only)
    let userWorkspace;
    try {
      userWorkspace = await prisma.userWorkspace.findFirst({
        where: {
          workspaceId: systemImport.workspaceId,
          // Verify the authenticated user has access to this workspace
          userId: user.id,
        },
        select: { role: true },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ [Rollback API] Database error checking workspace access: ${errorMessage}`);
      return NextResponse.json(
        { success: false, message: 'Authorization check failed' },
        { status: 500 }
      );
    }

    if (!userWorkspace) {
      console.warn(`⚠️  [Rollback API] User not in workspace: ${systemImport.workspaceId}`);
      return NextResponse.json(
        { success: false, message: 'Access denied' },
        { status: 403 }
      );
    }

    // Verify admin role
    if (userWorkspace.role !== 'OWNER' && userWorkspace.role !== 'ADMIN') {
      console.warn(`⚠️  [Rollback API] User lacks admin role: ${userWorkspace.role}`);
      return NextResponse.json(
        { success: false, message: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // 5. QUEUE ROLLBACK JOB (Async, Non-blocking)
    try {
      const job = await addRollbackJob(systemImportId, systemImport.workspaceId, user.id);

      console.log(`✅ [Rollback API] Rollback job queued: jobId=${job.id}, systemImportId=${systemImportId}, initiatedBy=${user.id}`);

      return NextResponse.json(
        {
          success: true,
          message: 'Rollback job queued successfully',
          data: {
            jobId: job.id,
            systemImportId,
            fileName: systemImport.fileName,
            status: 'ROLLING_BACK',
          },
        },
        { status: 202 } // 202 Accepted - job is queued
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ [Rollback API] Failed to queue rollback job: ${errorMessage}`);
      return NextResponse.json(
        { success: false, message: 'Failed to queue rollback job' },
        { status: 500 }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`🔴 [Rollback API] Unhandled error: ${errorMessage}`);
    console.error('Stack:', error);

    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
