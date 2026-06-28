import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { DatabaseUnavailableError } from '@/lib/auth/session';
import {
  getCache,
  setCache,
  CacheKeys,
  CACHE_TTL,
  isCacheAvailable,
} from '@/lib/cache/redis';

export async function GET(
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

    const cacheKey = CacheKeys.campaignProgress(params.id);

    // Try to get from cache first
    const cachedProgress = await getCache(cacheKey);
    if (cachedProgress) {
      return NextResponse.json(cachedProgress);
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

    // Get recipient counts by status
    const recipientCounts = await prisma.campaignRecipient.groupBy({
      by: ['status'],
      where: {
        campaignId: campaign.id,
        isValid: true,
      },
      _count: {
        status: true,
      },
    });

    // Initialize counts
    const counts = {
      PENDING: 0,
      PROCESSING: 0,
      SENT: 0,
      DELIVERED: 0,
      READ: 0,
      FAILED: 0,
    };

    // Populate counts from database
    recipientCounts.forEach((item) => {
      counts[item.status as keyof typeof counts] = item._count.status;
    });

    const totalRecipients = campaign.validRecipientCount;
    const pending = counts.PENDING;
    const sent = counts.SENT;
    const delivered = counts.DELIVERED;
    const read = counts.READ;
    const failed = counts.FAILED;

    // Calculate rates
    const successRate = totalRecipients > 0 ? ((delivered + read) / totalRecipients) * 100 : 0;
    const deliveryRate = totalRecipients > 0 ? (delivered / totalRecipients) * 100 : 0;
    const readRate = totalRecipients > 0 ? (read / totalRecipients) * 100 : 0;

    const progressData = {
      campaignId: campaign.id,
      status: campaign.status,
      totalRecipients,
      pending,
      sent,
      delivered,
      read,
      failed,
      successRate: Math.round(successRate * 100) / 100,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
      readRate: Math.round(readRate * 100) / 100,
    };

    // Cache the result
    try {
      await setCache(cacheKey, progressData, CACHE_TTL.PROGRESS);
    } catch (cacheError) {
      // Cache failure should not block the response
      console.error('Failed to cache progress data:', cacheError);
    }

    return NextResponse.json(progressData);
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json(
        { error: 'Database temporarily unavailable. Please retry.' },
        { status: 503 }
      );
    }

    console.error('Get campaign progress error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
