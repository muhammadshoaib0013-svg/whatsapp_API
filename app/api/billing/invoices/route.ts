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

/**
 * GET /api/billing/invoices
 * Fetch invoices from Stripe for the current tenant
 */
export async function GET(request: Request) {
  try {
    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
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

    // Check if tenant has a Stripe customer ID
    if (!tenant.stripeCustomerId) {
      return NextResponse.json({
        invoices: [],
        message: 'No Stripe customer found for this tenant',
      });
    }

    // Fetch invoices from Stripe
    const invoices = await stripe.invoices.list({
      customer: tenant.stripeCustomerId,
      limit: 100,
    });

    // Transform invoices to the expected format
    const formattedInvoices = invoices.data.map((invoice) => ({
      id: invoice.id,
      amount_paid: invoice.amount_paid,
      created: invoice.created,
      invoice_pdf: invoice.invoice_pdf,
      hosted_invoice_url: invoice.hosted_invoice_url,
      status: invoice.status,
      number: invoice.number,
      currency: invoice.currency,
    }));

    return NextResponse.json({
      invoices: formattedInvoices,
      total: formattedInvoices.length,
    });
  } catch (error) {
    console.error('[BILLING_INVOICES] Error fetching invoices:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch invoices';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
