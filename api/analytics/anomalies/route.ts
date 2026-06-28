import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { detectAnomalies } from '@/lib/analytics/anomaly-detector';

// Force dynamic route to avoid static generation issues
export const dynamic = 'force-dynamic';

/**
 * Anomaly Detection API
 * Provides real-time anomaly detection for WhatsApp message traffic
 * Strict tenant isolation enforced
 */
export async function GET(request: NextRequest) {
  // Get authenticated session
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = session.tenant.id;

  try {
    // Get query parameters
    const whatsappAccountId = request.nextUrl.searchParams.get('whatsappAccountId') || undefined;
    const daysToAnalyze = parseInt(request.nextUrl.searchParams.get('daysToAnalyze') || '30', 10);

    // Detect anomalies
    const result = await detectAnomalies({
      tenantId,
      whatsappAccountId,
      daysToAnalyze,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[ANOMALY_DETECTION_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to detect anomalies' },
      { status: 500 }
    );
  }
}
