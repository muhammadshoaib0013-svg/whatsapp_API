import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { DatabaseUnavailableError } from '@/lib/auth/session';
import { enqueueCampaignBatch, isQStashConfigured } from '@/lib/queues/campaign-sender';

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
      include: {
        template: {
          select: {
            id: true,
            name: true,
            language: true,
            status: true,
          },
        },
        account: {
          select: {
            id: true,
            displayName: true,
            businessPhoneNumber: true,
            connectionStatus: true,
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Only allow starting DRAFT campaigns
    if (campaign.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only DRAFT campaigns can be started' },
        { status: 400 }
      );
    }

    // Validate template exists and is approved
    if (!campaign.template || campaign.template.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Template must be approved to start campaign' },
        { status: 400 }
      );
    }

    // Validate recipient count > 0
    if (campaign.validRecipientCount === 0) {
      return NextResponse.json(
        { error: 'Campaign must have at least one valid recipient' },
        { status: 400 }
      );
    }

    // Update campaign status to SENDING and set startedAt
    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: 'SENDING',
        startedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        startedAt: true,
      },
    });

    // Update all valid recipients to PENDING status
    await prisma.campaignRecipient.updateMany({
      where: {
        campaignId: campaign.id,
        isValid: true,
      },
      data: {
        status: 'PENDING',
      },
    });

    // Enqueue campaign for background processing via QStash
    
    if (!isQStashConfigured()) {
      console.warn('[CAMPAIGN_START] QStash not configured, falling back to direct processing');
      // Fallback to direct processing if QStash is not configured
      const { processCampaignRecipients } = await import('@/lib/campaign-executor');
      const executionResult = await processCampaignRecipients(campaign.id, session.tenant.id);
      return NextResponse.json({ campaign: updatedCampaign, executionResult });
    }

    await enqueueCampaignBatch(campaign.id, session.tenant.id);

    return NextResponse.json({ 
      campaign: updatedCampaign, 
      message: 'Campaign started and queued for processing' 
    });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json(
        { error: 'Database temporarily unavailable. Please retry.' },
        { status: 503 }
      );
    }

    console.error('Start campaign error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
