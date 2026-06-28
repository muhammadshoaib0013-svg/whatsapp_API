import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { DatabaseUnavailableError } from '@/lib/auth/session';
import { processCampaignRecipients } from '@/lib/campaign-executor';

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

    // Only allow retrying for COMPLETED, COMPLETED_WITH_ERRORS, or FAILED campaigns
    if (
      campaign.status !== 'COMPLETED' &&
      campaign.status !== 'COMPLETED_WITH_ERRORS' &&
      campaign.status !== 'FAILED' &&
      campaign.status !== 'CANCELLED'
    ) {
      return NextResponse.json(
        { error: 'Only COMPLETED, COMPLETED_WITH_ERRORS, FAILED, or CANCELLED campaigns can retry failed recipients' },
        { status: 400 }
      );
    }

    // Count failed recipients
    const failedCount = await prisma.campaignRecipient.count({
      where: {
        campaignId: campaign.id,
        status: 'FAILED',
        isValid: true,
      },
    });

    if (failedCount === 0) {
      return NextResponse.json(
        { error: 'No failed recipients to retry' },
        { status: 400 }
      );
    }

    // Reset failed recipients to PENDING status
    await prisma.campaignRecipient.updateMany({
      where: {
        campaignId: campaign.id,
        status: 'FAILED',
        isValid: true,
      },
      data: {
        status: 'PENDING',
        errorMessage: null,
        sentAt: null,
        deliveredAt: null,
        readAt: null,
        metaMessageId: null,
      },
    });

    // Update campaign status to SENDING
    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: 'SENDING',
        resumedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        resumedAt: true,
      },
    });

    // Trigger campaign execution for failed recipients
    const executionResult = await processCampaignRecipients(campaign.id, session.tenant.id);

    return NextResponse.json({
      campaign: updatedCampaign,
      executionResult,
      retriedCount: failedCount,
    });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json(
        { error: 'Database temporarily unavailable. Please retry.' },
        { status: 503 }
      );
    }

    console.error('Retry failed recipients error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
