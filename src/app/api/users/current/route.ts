import { getCurrentUser } from '@/lib/auth';
import { NextResponse } from 'next/server';

// Type guard to validate workspace structure
function isWorkspaceWithDetails(workspace: unknown): workspace is {
  id: string;
  name: string;
  slug: string;
} {
  if (typeof workspace !== 'object' || workspace === null) {
    return false;
  }
  const ws = workspace as Record<string, unknown>;
  return (
    typeof ws.id === 'string' &&
    typeof ws.name === 'string' &&
    typeof ws.slug === 'string'
  );
}

// Type guard for UserWorkspace with workspace relation
function isUserWorkspaceWithRelation(uw: unknown): uw is {
  workspaceId: string;
  workspace: { id: string; name: string; slug: string };
} {
  if (typeof uw !== 'object' || uw === null) {
    return false;
  }
  const userWorkspace = uw as Record<string, unknown>;
  return (
    typeof userWorkspace.workspaceId === 'string' &&
    'workspace' in userWorkspace &&
    isWorkspaceWithDetails(userWorkspace.workspace)
  );
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Filter and validate workspaces with proper type narrowing
    const validWorkspaces: Array<{
      workspaceId: string;
      workspace: { id: string; name: string; slug: string };
    }> = user.workspaces.filter(isUserWorkspaceWithRelation);

    // Return user with workspaces
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      supabaseId: user.supabaseId,
      workspaces: validWorkspaces.map((uw) => ({
        workspaceId: uw.workspaceId,
        workspace: {
          id: uw.workspace.id,
          name: uw.workspace.name,
          slug: uw.workspace.slug,
        }
      })),
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
