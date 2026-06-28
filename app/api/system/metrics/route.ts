import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  getCounter,
  CacheKeys,
} from '@/lib/cache/redis';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get queue depth (pending recipients across all active campaigns)
    const queueDepth = await prisma.campaignRecipient.count({
      where: {
        tenantId: session.tenant.id,
        status: 'PENDING',
        isValid: true,
      },
    });

    // Get active workers (campaigns in SENDING status)
    const activeWorkers = await prisma.campaign.count({
      where: {
        tenantId: session.tenant.id,
        status: 'SENDING',
      },
    });

    // Get failed rate from Redis or calculate from DB
    const totalSent = await prisma.campaignRecipient.count({
      where: {
        tenantId: session.tenant.id,
        status: 'SENT',
        isValid: true,
      },
    });

    const totalFailed = await prisma.campaignRecipient.count({
      where: {
        tenantId: session.tenant.id,
        status: 'FAILED',
        isValid: true,
      },
    });

    const totalProcessed = totalSent + totalFailed;
    const failedRate = totalProcessed > 0 ? (totalFailed / totalProcessed) * 100 : 0;

    // Get average delivery time (from sent to delivered)
    const deliveredRecipients = await prisma.campaignRecipient.findMany({
      where: {
        tenantId: session.tenant.id,
        status: 'DELIVERED',
        isValid: true,
        sentAt: { not: null },
        deliveredAt: { not: null },
      },
      select: {
        sentAt: true,
        deliveredAt: true,
      },
      take: 100, // Sample for performance
    });

    let avgDeliveryTime = 0;
    if (deliveredRecipients.length > 0) {
      const totalDeliveryTime = deliveredRecipients.reduce((sum, recipient) => {
        if (recipient.sentAt && recipient.deliveredAt) {
          return sum + (recipient.deliveredAt.getTime() - recipient.sentAt.getTime());
        }
        return sum;
      }, 0);
      avgDeliveryTime = totalDeliveryTime / deliveredRecipients.length;
    }

    // Get campaign stats
    const totalCampaigns = await prisma.campaign.count({
      where: {
        tenantId: session.tenant.id,
      },
    });

    const activeCampaigns = await prisma.campaign.count({
      where: {
        tenantId: session.tenant.id,
        status: 'SENDING',
      },
    });

    const completedCampaigns = await prisma.campaign.count({
      where: {
        tenantId: session.tenant.id,
        status: {
          in: ['COMPLETED', 'COMPLETED_WITH_ERRORS'],
        },
      },
    });

    return NextResponse.json({
      queue: {
        depth: queueDepth,
        activeWorkers,
        failedRate: Math.round(failedRate * 100) / 100,
        avgDeliveryTime: Math.round(avgDeliveryTime / 1000), // Convert to seconds
      },
      campaigns: {
        total: totalCampaigns,
        active: activeCampaigns,
        completed: completedCampaigns,
      },
      recipients: {
        totalSent,
        totalFailed,
        totalProcessed,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get metrics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
