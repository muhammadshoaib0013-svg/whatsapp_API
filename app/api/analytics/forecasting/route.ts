import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { predictNextCampaignStats } from '@/lib/analytics/forecasting';

export const dynamic = 'force-dynamic';

/**
 * Analytics Forecasting API
 * Provides predictive cost and performance forecasting
 * Strictly enforces tenant isolation
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

    // Get forecasting data with tenant isolation
    const forecastingResult = await predictNextCampaignStats(tenantId, whatsappAccountId);

    return NextResponse.json(forecastingResult);
  } catch (error) {
    console.error('[ANALYTICS_FORECASTING] Error processing request', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
