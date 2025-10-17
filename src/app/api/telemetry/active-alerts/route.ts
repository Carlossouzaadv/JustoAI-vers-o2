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

    // Return empty alerts
    return NextResponse.json({
      success: true,
      data: {
        count: 0,
        alerts: [],
      },
    })
  } catch (error) {
    console.error('Error getting active alerts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
