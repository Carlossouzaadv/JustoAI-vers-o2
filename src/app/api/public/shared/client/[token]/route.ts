import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { hashShareToken, isShareLinkValid } from '@/lib/share-token-service';

const prisma = new PrismaClient();

/**
 * GET /api/public/shared/client/[token]
 *
 * PUBLIC ENDPOINT - No authentication required
 * Access a shared client dashboard using a share token
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // 1. Hash the token and look it up
    const tokenHash = hashShareToken(token);

    const shareLink = await prisma.clientShareLink.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            document: true,
            type: true,
            address: true,
            city: true,
            state: true,
            country: true,
            _count: {
              select: { cases: true },
            },
          },
        },
        expiresAt: true,
        accessCount: true,
        permissions: true,
        isActive: true,
      },
    });

    // 2. Validate share link exists
    if (!shareLink) {
      return NextResponse.json(
        { error: 'Invalid or expired share link' },
        { status: 404 }
      );
    }

    // 3. Validate share link is active
    if (!shareLink.isActive) {
      return NextResponse.json(
        { error: 'Share link has been revoked' },
        { status: 403 }
      );
    }

    // 4. Validate expiration
    if (!isShareLinkValid(shareLink.expiresAt)) {
      return NextResponse.json(
        { error: 'Share link has expired' },
        { status: 403 }
      );
    }

    // 5. Increment access count and update lastAccessedAt
    await prisma.clientShareLink.update({
      where: { id: shareLink.id },
      data: {
        accessCount: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    });

    // 6. Return client data (respecting permissions)
    const permissions = shareLink.permissions as {
      canViewCases: boolean;
      canDownload: boolean;
    } | null;

    const responseData: Record<string, unknown> = {
      client: shareLink.client,
      shareInfo: {
        expiresAt: shareLink.expiresAt,
        canViewCases: permissions?.canViewCases ?? true,
        canDownload: permissions?.canDownload ?? false,
      },
    };

    // 7. Fetch cases if permission granted
    if (permissions?.canViewCases) {
      const cases = await prisma.case.findMany({
        where: { clientId: shareLink.client.id },
        select: {
          id: true,
          number: true,
          title: true,
          type: true,
          status: true,
          priority: true,
          filingDate: true,
          dueDate: true,
          claimValue: true,
          _count: {
            select: { documents: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      responseData.cases = cases;
    }

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('Error accessing shared client link:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
