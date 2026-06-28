import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { DatabaseUnavailableError } from '@/lib/auth/session';
import { AuditAction } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Find campaign and verify ownership
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: params.id,
        tenantId: session.tenant.id,
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Only allow canceling SENDING or PAUSED campaigns
    if (campaign.status !== 'SENDING' && campaign.status !== 'PAUSED') {
      return NextResponse.json(
        { error: 'Only SENDING or PAUSED campaigns can be cancelled' },
        { status: 400 }
      );
    }

    // Update campaign status to CANCELLED and set cancelledAt
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    // Log CAMPAIGN_CANCELLED to AuditLog
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.tenant.id,
        action: 'CAMPAIGN_CANCELLED' as any,
        metadata: {
          campaignId: campaign.id,
          campaignName: campaign.name,
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json({ message: 'Campaign cancelled successfully' });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json(
        { error: 'Database temporarily unavailable. Please retry.' },
        { status: 503 }
      );
    }

    console.error('Cancel campaign error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
