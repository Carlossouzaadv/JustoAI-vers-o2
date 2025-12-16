import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Type guard to validate workspace structure
function isWorkspaceWithDetails(workspace: unknown): workspace is {
  id: string;
  name: string;
  slug: string;
  plan?: string;
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
  workspace: { id: string; name: string; slug: string; plan?: string };
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
      workspace: { id: string; name: string; slug: string; plan?: string };
    }> = user.workspaces.filter(isUserWorkspaceWithRelation);

    // Fetch workspace details (plan and credits) for each workspace
    const workspacesWithPlanAndCredits = await Promise.all(
      validWorkspaces.map(async (uw) => {
        try {
          // Fetch workspace details including plan
          const workspace = await prisma.workspace.findUnique({
            where: { id: uw.workspaceId },
            select: {
              id: true,
              name: true,
              slug: true,
              plan: true,
            }
          });

          // Fetch workspace credits
          const credits = await prisma.workspaceCredits.findUnique({
            where: { workspaceId: uw.workspaceId },
            select: {
              fullCreditsBalance: true,
              reportCreditsBalance: true,
            }
          });

          return {
            workspaceId: uw.workspaceId,
            workspace: {
              id: workspace?.id || uw.workspace.id,
              name: workspace?.name || uw.workspace.name,
              slug: workspace?.slug || uw.workspace.slug,
              plan: workspace?.plan || 'FREE',
            },
            credits: credits ? {
              full: Number(credits.fullCreditsBalance),
              fullHeld: 0,
              report: Number(credits.reportCreditsBalance),
              reportHeld: 0,
            } : {
              full: 0,
              fullHeld: 0,
              report: 0,
              reportHeld: 0,
            }
          };
        } catch (error) {
          console.error(`Error fetching workspace details for ${uw.workspaceId}:`, error);
          // Return minimal data if fetch fails
          return {
            workspaceId: uw.workspaceId,
            workspace: {
              id: uw.workspace.id,
              name: uw.workspace.name,
              slug: uw.workspace.slug,
              plan: 'FREE',
            },
            credits: {
              full: 0,
              fullHeld: 0,
              report: 0,
              reportHeld: 0,
            }
          };
        }
      })
    );

    // Return user with workspaces, plan, and credits
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      supabaseId: user.supabaseId,
      workspaces: workspacesWithPlanAndCredits,
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
