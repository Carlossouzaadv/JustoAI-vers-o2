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

    // Return empty alerts - this endpoint is called from authenticated frontend
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
