import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analytics/overview
 * Fetch message analytics for the current tenant for the last 30 days
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tenantId = session.tenant.id;

    // Calculate date range (last 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    // Fetch all messages for the tenant in the last 30 days
    const messages = await prisma.whatsAppMessageLog.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      select: {
        status: true,
        createdAt: true,
      },
    });

    // Calculate totals
    const totals = {
      sent: messages.filter((m) => m.status === 'SENT').length,
      delivered: messages.filter((m) => m.status === 'DELIVERED').length,
      read: messages.filter((m) => m.status === 'READ').length,
      failed: messages.filter((m) => m.status === 'FAILED').length,
    };

    // Group by date for daily breakdown
    const dailyStatsMap = new Map<string, { sent: number; delivered: number; read: number; failed: number }>();

    // Initialize all days in the range with 0
    for (let i = 0; i < 30; i++) {
      const date = new Date(thirtyDaysAgo);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      dailyStatsMap.set(dateStr, { sent: 0, delivered: 0, read: 0, failed: 0 });
    }

    // Aggregate messages by date
    messages.forEach((message) => {
      const dateStr = message.createdAt.toISOString().split('T')[0];
      const stats = dailyStatsMap.get(dateStr);
      if (stats) {
        if (message.status === 'SENT') stats.sent++;
        if (message.status === 'DELIVERED') stats.delivered++;
        if (message.status === 'READ') stats.read++;
        if (message.status === 'FAILED') stats.failed++;
      }
    });

    // Convert map to array and sort by date
    const dailyStats = Array.from(dailyStatsMap.entries())
      .map(([date, stats]) => ({
        date,
        ...stats,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      dailyStats,
      totals,
    });
  } catch (error) {
    console.error('[ANALYTICS_OVERVIEW] Error fetching analytics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch analytics';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
