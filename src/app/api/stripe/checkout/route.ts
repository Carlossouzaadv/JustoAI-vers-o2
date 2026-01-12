import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { PLANS, isValidPlanId } from '@/config/plans';

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const { planId, interval } = await req.json();

        if (!isValidPlanId(planId)) {
            return new NextResponse('Invalid plan ID', { status: 400 });
        }

        const planConfig = PLANS[planId];
        const priceId = interval === 'annual'
            ? planConfig.stripe.annualPriceId
            : planConfig.stripe.monthlyPriceId;

        if (!priceId) {
            return new NextResponse('Price ID not found for this plan/interval', { status: 400 });
        }

        // Create Checkout Session
        const checkoutSession = await stripe.checkout.sessions.create({
            customer_email: session.user.email,
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${process.env.NEXTAUTH_URL}/dashboard?checkout=success`,
            cancel_url: `${process.env.NEXTAUTH_URL}/pricing?checkout=cancel`,
            metadata: {
                userId: (session.user as any).id,
                planId: planId,
                workspaceId: (session.user as any).workspaceId || '', // Make sure we pass workspaceId if needed
            },
            allow_promotion_codes: true,
        });

        return NextResponse.json({ url: checkoutSession.url });
    } catch (error) {
        console.error('[STRIPE_CHECKOUT]', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
