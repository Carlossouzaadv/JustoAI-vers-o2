import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, successResponse, errorResponse } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
    try {
        const { user, error: authError } = await requireAuth(request);

        if (authError) {
            return authError;
        }

        // Parallelize queries for performance
        const [
            dbUser,
            documentsCount,
            clientsCount,
            reportsCount,
            pendingCasesCount
        ] = await Promise.all([
            prisma.user.findUnique({
                where: { id: user.id },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                    role: true,
                    onboardingCompleted: true,
                    plan: true,
                    subscriptionStatus: true,
                }
            }),
            prisma.document.count({
                where: { userId: user.id }
            }),
            prisma.client.count({
                where: {
                    userId: user.id,
                    // Exclude the placeholder client from the "real clients" count
                    NOT: {
                        name: {
                            in: ['Cliente a Definir', 'cliente_a_definir']
                        }
                    }
                }
            }),
            prisma.report.count({ // Assuming there is a Report model, otherwise check logical equivalent
                where: { userId: user.id }
            }),
            prisma.case.count({
                where: {
                    userId: user.id,
                    client: {
                        name: { in: ['Cliente a Definir', 'cliente_a_definir'] }
                    }
                }
            })
        ]);

        if (!dbUser) {
            return errorResponse('User not found', 404);
        }

        // Construct the comprehensive state
        const userData = {
            ...dbUser,
            hasUploadedDocuments: documentsCount > 0,
            hasCreatedClient: clientsCount > 0,
            hasGeneratedReport: reportsCount > 0,
            hasPendingCases: pendingCasesCount > 0,
            pendingCount: pendingCasesCount,
            documentsCount,
            clientsCount,
        };

        return successResponse(userData);

    } catch (error) {
        console.error('User Me API Error:', error);
        return errorResponse('Internal Server Error', 500);
    }
}
