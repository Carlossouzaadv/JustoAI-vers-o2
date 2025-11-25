import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      )
    }

    // Return workspace summary with the structure the dashboard expects
    return NextResponse.json({
      success: true,
      statistics: {
        totalProcesses: 0,
        completedAnalysis: 0,
        completedCases: 0,
        partialAnalysis: 0,
        attentionRequired: 0,
        recentUpdates: 0,
        pendingActions: 0,
        documents: 0,
      },
      recentActivity: [],
    })
  } catch (_error) {
    console.error('Error getting workspace summary:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
