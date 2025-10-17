import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Get workspaceId from query
    const workspaceId = request.nextUrl.searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      )
    }

    // Return quota status - this endpoint is called from authenticated frontend
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
