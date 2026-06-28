import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-06-24.dahlia',
});

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = headers().get('stripe-signature');

    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'Missing signature or webhook secret' },
        { status: 400 }
      );
    }

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        // Find tenant by stripe customer ID
        const tenant = await prisma.tenant.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (!tenant) {
          console.error('[STRIPE_WEBHOOK] Tenant not found for customer:', customerId);
          return NextResponse.json(
            { error: 'Tenant not found' },
            { status: 404 }
          );
        }

        // Determine plan from subscription (you may need to fetch subscription details)
        // For now, we'll update with the subscription ID and set status to active
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            stripeSubscriptionId: subscriptionId,
            subscriptionStatus: 'ACTIVE',
            trialEndsAt: null, // Trial ends when they subscribe
          },
        });
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const tenant = await prisma.tenant.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (!tenant) {
          console.error('[STRIPE_WEBHOOK] Tenant not found for customer:', customerId);
          return NextResponse.json(
            { error: 'Tenant not found' },
            { status: 404 }
          );
        }

        // Update subscription status based on Stripe status
        const statusMap: Record<string, 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED'> = {
          trialing: 'TRIALING',
          active: 'ACTIVE',
          past_due: 'PAST_DUE',
          canceled: 'CANCELED',
          incomplete: 'TRIALING',
          incomplete_expired: 'CANCELED',
          unpaid: 'PAST_DUE',
        };

        const subscriptionStatus = statusMap[subscription.status] || 'TRIALING';

        await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            subscriptionStatus,
            trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
          },
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const tenant = await prisma.tenant.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (!tenant) {
          console.error('[STRIPE_WEBHOOK] Tenant not found for customer:', customerId);
          return NextResponse.json(
            { error: 'Tenant not found' },
            { status: 404 }
          );
        }

        await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            subscriptionStatus: 'CANCELED',
            stripeSubscriptionId: null,
            subscriptionPlan: 'FREE',
          },
        });
        break;
      }

      default:
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('[STRIPE_WEBHOOK] Error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
