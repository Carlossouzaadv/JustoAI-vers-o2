import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireWorkspaceAccess } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    // Check auth
    const { user, error: authError } = await requireAuth(request)
    if (!user) return authError!

    // Get workspaceId from query
    const workspaceId = request.nextUrl.searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      )
    }

    // Check access
    const { hasAccess, error: accessError } = await requireWorkspaceAccess(user.id, workspaceId)
    if (!hasAccess) return accessError!

    // Return quota status
    return NextResponse.json({
      success: true,
      data: {
        plan: 'FREE',
        quotaLimit: 100,
        quotaUsed: 0,
        quotaPercentage: 0,
        reportsRemaining: 100,
      },
    })
  } catch (error) {
    console.error('Error getting quota status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
