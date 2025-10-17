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

    // Return mock data - this endpoint is called from authenticated frontend
    return NextResponse.json({
      success: true,
      data: {
        month: new Date().toISOString().substring(0, 7),
        uploadsCount: 0,
        analysisCount: 0,
        reportsGenerated: 0,
        totalCreditsUsed: 0,
        creditsAvailable: 1000,
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
