import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { processCampaignRecipients } from '@/lib/campaign-executor';
import { enqueueCampaignBatch } from '@/lib/queues/campaign-sender';

const BATCH_SIZE = 50;
const RATE_LIMIT_DELAY_MS = 1500; // 1.5 seconds between API calls

interface WorkerPayload {
  campaignId: string;
  tenantId: string;
}

/**
 * QStash Worker for processing campaign batches
 * This endpoint is called by QStash to process a batch of campaign recipients
 */
export async function POST(request: NextRequest) {
  try {
    const body: WorkerPayload = await request.json();
    const { campaignId, tenantId } = body;

    // Verify campaign exists and is in SENDING status
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        tenantId: tenantId,
      },
      select: {
        id: true,
        status: true,
        whatsappAccountId: true,
        templateId: true,
      },
    });

    if (!campaign) {
      console.error('[WORKER] Campaign not found');
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (campaign.status !== 'SENDING') {
      return NextResponse.json({ 
        success: true, 
        message: `Campaign status is ${campaign.status}, skipping processing` 
      });
    }

    // Process a batch of recipients
    const result = await processCampaignRecipients(campaignId, tenantId);

    // Check if there are more pending recipients
    const remainingPending = await prisma.campaignRecipient.count({
      where: {
        campaignId: campaignId,
        tenantId: tenantId,
        status: 'PENDING',
        isValid: true,
      },
    });

    // If more recipients remain, enqueue next batch
    if (remainingPending > 0) {
      await enqueueCampaignBatch(campaignId, tenantId);
    }

    return NextResponse.json({ 
      success: true, 
      processed: result.processed,
      sent: result.sent,
      failed: result.failed,
      remaining: remainingPending,
    });
  } catch (error) {
    console.error('[WORKER] Error processing campaign batch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
