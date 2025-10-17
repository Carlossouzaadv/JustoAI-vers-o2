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

    // Return mock data with the structure UsageBanner expects
    return NextResponse.json({
      success: true,
      data: {
        processes: {
          monitored: 0,
          limit: 100,
          percentage: 0,
        },
        reports: {
          used: 0,
          limit: 50,
          percentage: 0,
          status: 'ok' as const,
        },
        credits: {
          consumed: 0,
          included: 0,
          purchased: 0,
          remaining: 100,
        },
        api: {
          juditCalls: 0,
          estimatedCost: 0,
        },
      },
    })
  } catch (error) {
    console.error('Error getting monthly usage:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
