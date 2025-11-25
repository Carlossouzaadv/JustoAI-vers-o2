import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '@/lib/api-utils';
import { generateShareToken, hashShareToken, generateShareUrl } from '@/lib/share-token-service';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schema for share link creation
const createShareLinkSchema = z.object({
  expiresInDays: z.number().int().positive().max(365).optional(),
  permissions: z.object({
    canViewCases: z.boolean().default(true),
    canDownload: z.boolean().default(false),
  }).optional(),
});

/**
 * POST /api/clients/[id]/share
 * Generate a shareable link for a client
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate user
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;

    const { id: clientId } = await params;

    // 2. Validate request body
    const body = await request.json();
    const validated = createShareLinkSchema.parse(body);

    // 3. Verify user has access to this client
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
        name: true,
        workspaceId: true,
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found or no permission' },
        { status: 404 }
      );
    }

    // 4. Generate secure token
    const token = generateShareToken();
    const tokenHash = hashShareToken(token);

    // 5. Calculate expiration date
    let expiresAt: Date | null = null;
    if (validated.expiresInDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + validated.expiresInDays);
    }

    // 6. Create share link in database
    const shareLink = await prisma.clientShareLink.create({
      data: {
        clientId,
        token,
        tokenHash,
        expiresAt,
        createdById: user.id,
        permissions: validated.permissions || {
          canViewCases: true,
          canDownload: false,
        },
      },
    });

    // 7. Generate public URL
    const shareUrl = generateShareUrl(token, 'client');

    // 8. Log the action
    await prisma.globalLog.create({
      data: {
        workspaceId: client.workspaceId,
        userId: user.id,
        category: 'USER_ACTION',
        level: 'INFO',
        message: `Client share link created: ${client.name}`,
        data: {
          clientId,
          clientName: client.name,
          shareLinkId: shareLink.id,
          expiresAt,
          permissions: validated.permissions,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: shareLink.id,
        token: shareLink.token,
        shareUrl,
        expiresAt: shareLink.expiresAt,
        permissions: shareLink.permissions,
        createdAt: shareLink.createdAt,
      },
    });
  } catch (_error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', issues: error.issues },
        { status: 400 }
      );
    }

    console.error('Error creating client share link:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * GET /api/clients/[id]/share
 * List all active share links for a client
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate user
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;

    const { id: clientId } = await params;

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

    // 3. Fetch all active share links (without exposing the plaintext token)
    const shareLinks = await prisma.clientShareLink.findMany({
      where: {
        clientId,
        isActive: true,
      },
      select: {
        id: true,
        expiresAt: true,
        accessCount: true,
        lastAccessedAt: true,
        permissions: true,
        createdAt: true,
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      data: shareLinks,
      total: shareLinks.length,
    });
  } catch (_error) {
    console.error('Error fetching client share links:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
