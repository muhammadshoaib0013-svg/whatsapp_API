import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import Stripe from 'stripe';
import { requireOwnerOrAdmin } from '@/lib/auth/permissions';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-06-24.dahlia',
});

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permission: only OWNER and ADMIN can access billing
    try {
      await requireOwnerOrAdmin();
    } catch (permError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = params;

    // Get tenant to verify ownership
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.tenant.id },
    });

    if (!tenant || !tenant.stripeCustomerId) {
      return NextResponse.json({ error: 'Tenant not found or no Stripe customer' }, { status: 404 });
    }

    // Fetch invoice from Stripe
    const invoice = await stripe.invoices.retrieve(id);

    // Verify the invoice belongs to this tenant
    if (invoice.customer !== tenant.stripeCustomerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the PDF URL
    const invoicePdfUrl = invoice.invoice_pdf;
    if (!invoicePdfUrl) {
      return NextResponse.json({ error: 'PDF not available for this invoice' }, { status: 404 });
    }

    // Fetch the PDF file from Stripe
    const pdfResponse = await fetch(invoicePdfUrl);
    if (!pdfResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch PDF from Stripe' }, { status: 500 });
    }

    // Get the PDF buffer
    const pdfBuffer = await pdfResponse.arrayBuffer();

    // Stream the PDF back to the client
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.number || id}.pdf"`,
      },
    });
  } catch (error) {
    console.error('[INVOICE_DOWNLOAD] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to download invoice';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
