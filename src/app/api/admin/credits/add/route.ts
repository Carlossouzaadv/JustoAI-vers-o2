/**
 * Admin Endpoint - Add Credits to Workspace
 * POST /api/admin/credits/add
 *
 * Allows admins to manually add credits to a workspace
 * Protected: Internal admins (@justoai.com.br) only
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAuthAndGetUser } from '@/lib/auth';
import { isInternalDivinityAdmin } from '@/lib/permission-validator';
import { addCredits } from '@/lib/services/creditService';
import { CreditCategory } from '@prisma/client';
import { z } from 'zod';

// Validation schema
const addCreditsSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID required'),
  amount: z.number().positive('Amount must be positive'),
  category: z.enum(['REPORT', 'FULL'] as const).default('FULL'),
  reason: z.string().min(1, 'Reason required')
});

type AddCreditsRequest = z.infer<typeof addCreditsSchema>;

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { user } = await validateAuthAndGetUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Check if internal admin ONLY (not workspace admin)
    if (!isInternalDivinityAdmin(user.email)) {
      return NextResponse.json(
        { error: 'Only internal admins can add credits' },
        { status: 403 }
      );
    }

    // 3. Validate request body
    const body = await request.json();
    const validation = addCreditsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validation.error.flatten()
        },
        { status: 400 }
      );
    }

    const { workspaceId, amount, category, reason } = validation.data;

    // 4. Add credits using creditService
    const result = await addCredits(
      workspaceId,
      amount,
      category as CreditCategory,
      `[ADMIN] ${reason}`
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.reason || 'Failed to add credits' },
        { status: 500 }
      );
    }

    // 5. Return success response
    return NextResponse.json({
      success: true,
      message: `Added ${amount} ${category} credits to workspace`,
      data: {
        workspaceId,
        amountAdded: amount,
        category,
        reason,
        newBalance: result.newBalance,
        transactionId: result.transactionId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[ADMIN] Error adding credits:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add credits'
      },
      { status: 500 }
    );
  }
}
