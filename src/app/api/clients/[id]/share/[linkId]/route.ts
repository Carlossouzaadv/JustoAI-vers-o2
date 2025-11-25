import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '@/lib/api-utils';

const prisma = new PrismaClient();

/**
 * DELETE /api/clients/[id]/share/[linkId]
 * Revoke a client share link
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  try {
    // 1. Authenticate user
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;

    const { id: clientId, linkId } = await params;

    // 2. Verify user has access to this client
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        workspace: {
          users: {
            some: {
              userId: user.id,
            },
          },
        },
      },
      select: {
        id: true,
        workspaceId: true,
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found or no permission' },
        { status: 404 }
      );
    }

    // 3. Verify the share link belongs to this client
    const shareLink = await prisma.clientShareLink.findFirst({
      where: {
        id: linkId,
        clientId,
      },
      select: { id: true },
    });

    if (!shareLink) {
      return NextResponse.json(
        { error: 'Share link not found' },
        { status: 404 }
      );
    }

    // 4. Mark the link as inactive (soft delete for audit trail)
    await prisma.clientShareLink.update({
      where: { id: linkId },
      data: { isActive: false },
    });

    // 5. Log the action
    await prisma.globalLog.create({
      data: {
        workspaceId: client.workspaceId,
        userId: user.id,
        category: 'USER_ACTION',
        level: 'INFO',
        message: 'Client share link revoked',
        data: {
          clientId,
          shareLinkId: linkId,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Share link revoked',
    });
  } catch (error) {
    console.error('Error revoking client share link:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * GET /api/clients/[id]/share/[linkId]
 * Get details of a specific share link (without token)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  try {
    // 1. Authenticate user
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;

    const { id: clientId, linkId } = await params;

    // 2. Verify user has access to this client
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        workspace: {
          users: {
            some: {
              userId: user.id,
            },
          },
        },
      },
      select: { id: true },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found or no permission' },
        { status: 404 }
      );
    }

    // 3. Fetch share link (without exposing token)
    const shareLink = await prisma.clientShareLink.findFirst({
      where: {
        id: linkId,
        clientId,
      },
      select: {
        id: true,
        expiresAt: true,
        accessCount: true,
        lastAccessedAt: true,
        permissions: true,
        isActive: true,
        createdAt: true,
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!shareLink) {
      return NextResponse.json(
        { error: 'Share link not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: shareLink,
    });
  } catch (error) {
    console.error('Error fetching client share link:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
