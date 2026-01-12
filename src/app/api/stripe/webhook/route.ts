import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma'; // Assuming prisma client is exported from here
import Stripe from 'stripe';

export async function POST(req: NextRequest) {
    const body = await req.text();
    const signature = req.headers.get('Stripe-Signature') as string;

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return new NextResponse(`Webhook Error: ${errorMessage}`, { status: 400 });
    }

    const session = event.data.object as Stripe.Checkout.Session;

    if (event.type === 'checkout.session.completed') {
        const subscriptionId = session.subscription as string;
        const workspaceId = session.metadata?.workspaceId;

        if (!workspaceId) {
            return new NextResponse('Workspace ID missing in metadata', { status: 400 });
        }

        // Retrieve subscription details to get end date
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;

        await prisma.workspace.update({
            where: { id: workspaceId },
            data: {
                stripeSubscriptionId: subscriptionId,
                stripeCustomerId: session.customer as string,
                stripePriceId: subscription.items.data[0]?.price.id,
                stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
                plan: 'PRO', // Or logic to map Plan ID to Enum (need to match schema enum presumably)
                status: 'ACTIVE',
            },
        });
    }

    if (event.type === 'invoice.payment_succeeded') {
        // Explicitly casting to any to avoid strict type checks if version mismatch
        // Explicitly casting to any to avoid strict type checks if version mismatch
        const invoice = event.data.object as Stripe.Invoice;
        // Explicitly casting to any locally for subscription access to avoid version mismatch issues
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subscriptionId = (invoice as any).subscription as string;

        if (subscriptionId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;

            // Find workspace by subscription ID
            await prisma.workspace.update({
                where: { stripeSubscriptionId: subscriptionId },
                data: {
                    stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
                    status: 'ACTIVE',
                }
            }).catch(err => console.error('Error updating workspace for invoice payment', err));
        }
    }

    return new NextResponse(null, { status: 200 });
}
