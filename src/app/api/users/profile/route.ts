import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import {
  successResponse,
  errorResponse,
  requireAuth,
  rateLimit,
  getClientIP,
} from '@/lib/api-utils';

/**
 * Type for UserWorkspace relation with included workspace data
 */
interface UserWorkspaceWithWorkspace {
  workspaceId: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
}

/**
 * PUT /api/users/profile
 * Update current user's profile (name, phone, etc)
 */
export async function PUT(request: NextRequest) {
  // Rate limiting
  const clientIP = getClientIP(request);
  const { allowed, error: rateLimitError } = await rateLimit(
    `profile-update:${clientIP}`,
    30
  );
  if (!allowed) return rateLimitError!;

  // Auth check
  const { user, error: authError } = await requireAuth(request);
  if (!user) return authError!;

  try {
    const body = await request.json();
    const { name, phone } = body;

    // Validate input
    if (name !== undefined && typeof name !== 'string') {
      return errorResponse('Invalid name format', 400);
    }

    if (phone !== undefined && typeof phone !== 'string') {
      return errorResponse('Invalid phone format', 400);
    }

    // Update user in database
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        updatedAt: new Date(),
      },
      include: {
        workspaces: {
          include: {
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    console.log('✅ User profile updated:', user.id);

    return successResponse(
      {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        phone: updatedUser.phone,
        avatar: updatedUser.avatar,
        createdAt: updatedUser.createdAt,
        workspaces: updatedUser.workspaces.map((uw: UserWorkspaceWithWorkspace) => ({
          workspaceId: uw.workspaceId,
          workspace: uw.workspace,
        })),
      },
      'Profile updated successfully'
    );
  } catch (error) {
    console.error('Error updating user profile:', error);
    return errorResponse('Failed to update profile', 500);
  }
}

/**
 * GET /api/users/profile
 * Get current user's profile
 */
export async function GET(request: NextRequest) {
  // Rate limiting
  const clientIP = getClientIP(request);
  const { allowed, error: rateLimitError } = await rateLimit(
    `profile-get:${clientIP}`
  );
  if (!allowed) return rateLimitError!;

  // Auth check
  const { user, error: authError } = await requireAuth(request);
  if (!user) return authError!;

  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return errorResponse('User not found', 404);
    }

    return successResponse(
      {
        id: currentUser.id,
        email: currentUser.email,
        name: currentUser.name,
        phone: currentUser.phone,
        avatar: currentUser.avatar,
        role: currentUser.role,
        createdAt: currentUser.createdAt,
        workspaces: currentUser.workspaces.map((uw: UserWorkspaceWithWorkspace) => ({
          workspaceId: uw.workspaceId,
          workspace: uw.workspace,
        })),
      },
      'Profile retrieved successfully'
    );
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return errorResponse('Failed to fetch profile', 500);
  }
}
