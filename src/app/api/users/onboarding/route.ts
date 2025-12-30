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
                // role: data.role, // ❌ Don't update system role with job title (causes 500 if not Enum)
                settings: {
                    ...(user.settings as Record<string, unknown> || {}),
                    jobTitle: data.role, // ✅ Store job title in settings
                },
                practiceAreas: data.practiceAreas || [],
                mainGoals: data.mainGoals || [],
                onboardingCompleted: true,
                onboardingCompletedAt: new Date(),
            },
        });

        return successResponse(updatedUser, 'Onboarding data saved successfully');

    } catch (error) {
        console.error('❌ Onboarding API Error:', error);
        
        // Detailed error logging
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Stack:', error.stack);
        }
        
        return errorResponse('Internal Server Error: ' + (error instanceof Error ? error.message : 'Unknown error'), 500);
    }
}
