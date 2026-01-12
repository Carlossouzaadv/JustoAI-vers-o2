import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma'; // Update path if necessary

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(session?.user as any)?.id) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // Must fetch workspace or user to get stripeCustomerId
        // Assuming relationship User -> UserWorkspace -> Workspace
        // Or User has stripeCustomerId if it was User-based. 
        // Our schema added stripeCustomerId to Workspace.
        // So we need to know WHICH workspace the user is trying to manage.
        // For now, assuming `session.user.workspaceId` exists or we fetch the first one.

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const workspaceId = (session?.user as any).workspaceId; // Adjust based on your session shape

        if (!workspaceId) {
            return new NextResponse('Workspace ID required', { status: 400 });
        }

        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId }
        });

        if (!workspace || !workspace.stripeCustomerId) {
            return new NextResponse('No Stripe Customer found for this workspace', { status: 404 });
        }

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: workspace.stripeCustomerId,
            return_url: `${process.env.NEXTAUTH_URL}/dashboard`,
        });

        return NextResponse.json({ url: portalSession.url });
    } catch (error) {
        console.error('[STRIPE_PORTAL]', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
