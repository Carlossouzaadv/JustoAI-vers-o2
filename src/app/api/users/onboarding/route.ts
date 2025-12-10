import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, successResponse, errorResponse } from '@/lib/api-utils';

export async function PUT(request: NextRequest) {
    try {
        const { user, error: authError } = await requireAuth(request);

        if (authError) {
            return authError;
        }

        const data = await request.json();

        // Validate required fields
        if (!data.fullName || !data.role) {
            return errorResponse('Missing required fields: fullName and role', 400);
        }

        // Update user in database
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: {
                name: data.fullName,
                role: data.role,
                practiceAreas: data.practiceAreas || [],
                mainGoals: data.mainGoals || [],
                onboardingCompleted: true,
                onboardingCompletedAt: new Date(),
            },
        });

        return successResponse(updatedUser, 'Onboarding data saved successfully');

    } catch (error) {
        console.error('Onboarding API Error:', error);
        return errorResponse('Internal Server Error', 500);
    }
}
