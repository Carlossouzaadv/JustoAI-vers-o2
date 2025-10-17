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

    // Return workspace summary - mock data for now
    return NextResponse.json({
      success: true,
      data: {
        id: workspaceId,
        totalClients: 0,
        totalCases: 0,
        totalDocuments: 0,
        creditsUsed: 0,
        creditsAvailable: 0,
      },
    })
  } catch (error) {
    console.error('Error getting workspace summary:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
