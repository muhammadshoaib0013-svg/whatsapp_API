import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import Stripe from 'stripe';
import { requireOwnerOrAdmin } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

// Safe Stripe initialization
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-06-24.dahlia',
});

export async function POST(request: Request) {
  try {
    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe is not configured. Please add STRIPE_SECRET_KEY to your environment variables.' },
        { status: 500 }
      );
    }

    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check permission: only OWNER and ADMIN can access billing
    try {
      await requireOwnerOrAdmin();
    } catch (permError) {
      return NextResponse.json(
        { error: 'Forbidden: Only Owner and Admin can access billing' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { stripePriceId } = body;

    if (!stripePriceId) {
      return NextResponse.json(
        { error: 'Missing stripePriceId' },
        { status: 400 }
      );
    }

    // Get tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.tenant.id },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Create or get Stripe customer
    let customerId = tenant.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email,
        name: tenant.name,
        metadata: {
          tenantId: tenant.id,
        },
      });
      customerId = customer.id;

      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create checkout session with 7-day trial
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          tenantId: tenant.id,
        },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/billing?canceled=true`,
      allow_promotion_codes: true,
    });

    return NextResponse.json(
      { checkoutUrl: checkoutSession.url },
      { status: 200 }
    );
  } catch (error) {
    console.error('[CREATE_CHECKOUT_SESSION] Error:', error);
    // Log detailed Stripe error if available
    if (error && typeof error === 'object' && 'raw' in error) {
      console.error('[CREATE_CHECKOUT_SESSION] Stripe Raw Error:', (error as any).raw);
    }
    const errorMessage = error instanceof Error ? error.message : 'Failed to create checkout session';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
