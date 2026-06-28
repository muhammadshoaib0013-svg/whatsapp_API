import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getAnalyticsSummaryWithCache } from '@/lib/cache/analytics-cache';
import { getQuickMetrics } from '@/lib/services/analytics-service';
import { getCostSummary } from '@/lib/billing/cost-tracker';

// Force dynamic route to avoid static generation issues
export const dynamic = 'force-dynamic';

/**
 * Analytics API Endpoint
 * Provides comprehensive analytics data with tenant isolation
 * Supports filtering by date range and WABA account
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tenantId = session.tenant.id;

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const whatsappAccountId = searchParams.get('whatsappAccountId') || undefined;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const period = searchParams.get('period') || 'MONTH';
    const includeCosts = searchParams.get('includeCosts') === 'true';

    // Build date filters
    const dateFilter: any = {};
    if (startDate) {
      try {
        dateFilter.startDate = new Date(startDate);
        if (isNaN(dateFilter.startDate.getTime())) {
          console.error('[ANALYTICS_API] Invalid startDate:', startDate);
          return NextResponse.json(
            { error: 'Invalid startDate parameter' },
            { status: 400 }
          );
        }
      } catch (error) {
        console.error('[ANALYTICS_API] Error parsing startDate:', error);
        return NextResponse.json(
          { error: 'Invalid startDate parameter' },
          { status: 400 }
        );
      }
    }
    if (endDate) {
      try {
        dateFilter.endDate = new Date(endDate);
        if (isNaN(dateFilter.endDate.getTime())) {
          console.error('[ANALYTICS_API] Invalid endDate:', endDate);
          return NextResponse.json(
            { error: 'Invalid endDate parameter' },
            { status: 400 }
          );
        }
      } catch (error) {
        console.error('[ANALYTICS_API] Error parsing endDate:', error);
        return NextResponse.json(
          { error: 'Invalid endDate parameter' },
          { status: 400 }
        );
      }
    }

    // Get analytics summary with caching
    let analyticsSummary;
    try {
      analyticsSummary = await getAnalyticsSummaryWithCache({
        tenantId,
        whatsappAccountId,
        ...dateFilter,
      });
    } catch (error) {
      console.error('[ANALYTICS_API_ROUTE_ERROR]', error instanceof Error ? error.stack : error);
      return NextResponse.json(
        { error: 'Failed to fetch analytics data', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }

    // Get quick metrics for dashboard cards
    let quickMetrics;
    try {
      quickMetrics = await getQuickMetrics(tenantId, whatsappAccountId);
    } catch (error) {
      console.error('[ANALYTICS_API_ROUTE_ERROR] Quick metrics:', error instanceof Error ? error.stack : error);
      // Continue without quick metrics if they fail
      quickMetrics = {
        totalMessages: 0,
        successRate: 0,
        todayMessages: 0,
        todaySuccessRate: 0,
      };
    }

    // Build response
    const response: any = {
      tenantId,
      whatsappAccountId: whatsappAccountId || null,
      period,
      metrics: analyticsSummary.metrics,
      timeSeries: analyticsSummary.timeSeries,
      templatePerformance: analyticsSummary.templatePerformance,
      quickMetrics,
    };

    // Include cost data if requested
    if (includeCosts) {
      try {
        const costSummary = await getCostSummary(
          tenantId,
          period as 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM',
          dateFilter.startDate,
          dateFilter.endDate
        );
        response.costSummary = costSummary;
      } catch (error) {
        console.error('[ANALYTICS_API_ROUTE_ERROR] Cost summary:', error instanceof Error ? error.stack : error);
        // Continue without cost summary if it fails
        response.costSummary = null;
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[ANALYTICS_API_ROUTE_ERROR] Processing request:', error instanceof Error ? error.stack : error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
