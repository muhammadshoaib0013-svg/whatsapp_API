/**
 * Anomaly Detection Engine
 * Early-warning system for detecting unusual patterns in WhatsApp message traffic
 * Uses rule-based and moving-average statistical logic
 * Strict tenant isolation enforced
 */

import { prisma } from '@/lib/db';

export interface AnomalyDetectionInput {
  tenantId: string;
  whatsappAccountId?: string;
  daysToAnalyze?: number; // Default: 30 days
}

export interface AnomalyDetectionResult {
  tenantId: string;
  whatsappAccountId?: string;
  analysisPeriod: {
    startDate: Date;
    endDate: Date;
    daysAnalyzed: number;
  };
  anomalies: Anomaly[];
  summary: {
    totalAnomalies: number;
    severity: 'low' | 'medium' | 'high';
    recommendations: string[];
  };
}

export interface Anomaly {
  type: 'high_failure_rate' | 'low_read_rate' | 'sudden_failure_spike' | 'template_revocation';
  severity: 'low' | 'medium' | 'high';
  description: string;
  detectedAt: Date;
  metrics: {
    current: number;
    historical: number;
    threshold: number;
    deviation: number;
  };
  recommendation: string;
}

/**
 * Detect anomalies in WhatsApp message traffic
 */
export async function detectAnomalies(
  input: AnomalyDetectionInput
): Promise<AnomalyDetectionResult> {
  const { tenantId, whatsappAccountId, daysToAnalyze = 30 } = input;
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - daysToAnalyze);

  // Get historical message data
  const historicalData = await getHistoricalMessageData(tenantId, whatsappAccountId, startDate, endDate);

  // Get recent message data (last 24 hours)
  const recentStartDate = new Date();
  recentStartDate.setDate(endDate.getDate() - 1);
  const recentData = await getHistoricalMessageData(tenantId, whatsappAccountId, recentStartDate, endDate);

  // Detect anomalies
  const anomalies: Anomaly[] = [];

  // 1. High failure rate anomaly
  const failureRateAnomaly = detectHighFailureRate(historicalData, recentData);
  if (failureRateAnomaly) {
    anomalies.push(failureRateAnomaly);
  }

  // 2. Low read rate anomaly
  const readRateAnomaly = detectLowReadRate(historicalData, recentData);
  if (readRateAnomaly) {
    anomalies.push(readRateAnomaly);
  }

  // 3. Sudden failure spike anomaly
  const failureSpikeAnomaly = detectSuddenFailureSpike(historicalData, recentData);
  if (failureSpikeAnomaly) {
    anomalies.push(failureSpikeAnomaly);
  }

  // 4. Template revocation anomaly (high rejection rate)
  const templateRevocationAnomaly = await detectTemplateRevocation(tenantId, whatsappAccountId, recentStartDate, endDate);
  if (templateRevocationAnomaly) {
    anomalies.push(templateRevocationAnomaly);
  }

  // Calculate summary
  const summary = calculateAnomalySummary(anomalies);

  return {
    tenantId,
    whatsappAccountId,
    analysisPeriod: {
      startDate,
      endDate,
      daysAnalyzed: daysToAnalyze,
    },
    anomalies,
    summary,
  };
}

/**
 * Get historical message data for analysis
 */
async function getHistoricalMessageData(
  tenantId: string,
  whatsappAccountId: string | undefined,
  startDate: Date,
  endDate: Date
): Promise<{
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  failureRate: number;
  readRate: number;
}> {
  const where: any = {
    tenantId,
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
  };

  if (whatsappAccountId) {
    where.whatsappAccountId = whatsappAccountId;
  }

  const messages = await prisma.whatsAppMessageLog.findMany({
    where,
    select: {
      status: true,
    },
  });

  const total = messages.length;
  const sent = messages.filter((m) => m.status === 'SENT' || m.status === 'DELIVERED' || m.status === 'READ').length;
  const delivered = messages.filter((m) => m.status === 'DELIVERED' || m.status === 'READ').length;
  const read = messages.filter((m) => m.status === 'READ').length;
  const failed = messages.filter((m) => m.status === 'FAILED').length;

  const failureRate = sent > 0 ? (failed / sent) * 100 : 0;
  const readRate = delivered > 0 ? (read / delivered) * 100 : 0;

  return {
    total,
    sent,
    delivered,
    read,
    failed,
    failureRate,
    readRate,
  };
}

/**
 * Detect high failure rate anomaly
 */
function detectHighFailureRate(
  historicalData: { failureRate: number },
  recentData: { failureRate: number }
): Anomaly | null {
  const threshold = 10; // 10% failure rate threshold
  const deviation = recentData.failureRate - historicalData.failureRate;

  if (recentData.failureRate > threshold && deviation > 5) {
    const severity = recentData.failureRate > 20 ? 'high' : 'medium';
    return {
      type: 'high_failure_rate',
      severity,
      description: `Failure rate is ${recentData.failureRate.toFixed(1)}%, which is significantly higher than the historical average of ${historicalData.failureRate.toFixed(1)}%`,
      detectedAt: new Date(),
      metrics: {
        current: recentData.failureRate,
        historical: historicalData.failureRate,
        threshold,
        deviation,
      },
      recommendation: severity === 'high'
        ? 'Immediate action required: Check your WhatsApp Business Account status, verify phone number is not banned, and review template quality.'
        : 'Monitor closely: Review message content and recipient lists to improve delivery rates.',
    };
  }

  return null;
}

/**
 * Detect low read rate anomaly
 */
function detectLowReadRate(
  historicalData: { readRate: number },
  recentData: { readRate: number }
): Anomaly | null {
  const threshold = 30; // 30% read rate threshold
  const deviation = historicalData.readRate - recentData.readRate;

  if (recentData.readRate < threshold && deviation > 10) {
    const severity = recentData.readRate < 15 ? 'high' : 'medium';
    return {
      type: 'low_read_rate',
      severity,
      description: `Read rate is ${recentData.readRate.toFixed(1)}%, which is significantly lower than the historical average of ${historicalData.readRate.toFixed(1)}%`,
      detectedAt: new Date(),
      metrics: {
        current: recentData.readRate,
        historical: historicalData.readRate,
        threshold,
        deviation,
      },
      recommendation: severity === 'high'
        ? 'Critical: Review message content quality, timing, and relevance to improve engagement.'
        : 'Consider optimizing message content and send times to improve read rates.',
    };
  }

  return null;
}

/**
 * Detect sudden failure spike anomaly
 */
function detectSuddenFailureSpike(
  historicalData: { failed: number; total: number },
  recentData: { failed: number; total: number }
): Anomaly | null {
  const historicalFailureRate = historicalData.total > 0 ? (historicalData.failed / historicalData.total) * 100 : 0;
  const recentFailureRate = recentData.total > 0 ? (recentData.failed / recentData.total) * 100 : 0;

  const threshold = 15; // 15% spike threshold
  const deviation = recentFailureRate - historicalFailureRate;

  if (deviation > threshold && recentData.failed > 10) {
    const severity = deviation > 30 ? 'high' : 'medium';
    return {
      type: 'sudden_failure_spike',
      severity,
      description: `Sudden spike in failures detected: ${recentData.failed} failures in recent period (${recentFailureRate.toFixed(1)}% failure rate) vs historical average of ${historicalFailureRate.toFixed(1)}%`,
      detectedAt: new Date(),
      metrics: {
        current: recentFailureRate,
        historical: historicalFailureRate,
        threshold,
        deviation,
      },
      recommendation: severity === 'high'
        ? 'URGENT: Your WhatsApp Business Account may be at risk. Check for number bans, template revocations, or policy violations immediately.'
        : 'Investigate recent message batches for potential issues with recipient numbers or content.',
    };
  }

  return null;
}

/**
 * Detect template revocation anomaly
 */
async function detectTemplateRevocation(
  tenantId: string,
  whatsappAccountId: string | undefined,
  startDate: Date,
  endDate: Date
): Promise<Anomaly | null> {
  const where: any = {
    tenantId,
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
    status: 'FAILED',
  };

  if (whatsappAccountId) {
    where.whatsappAccountId = whatsappAccountId;
  }

  const failedMessages = await prisma.whatsAppMessageLog.findMany({
    where,
    select: {
      errorMessage: true,
    },
    take: 50,
  });

  // Check for template-related error messages
  const templateErrorKeywords = [
    'template',
    'revoked',
    'disabled',
    'rejected',
    'policy',
    'quality',
  ];

  const templateErrors = failedMessages.filter((msg) => {
    const errorMsg = msg.errorMessage?.toLowerCase() || '';
    return templateErrorKeywords.some((keyword) => errorMsg.includes(keyword));
  });

  const threshold = 0.2; // 20% of failed messages have template-related errors
  const templateErrorRate = failedMessages.length > 0 ? templateErrors.length / failedMessages.length : 0;

  if (templateErrorRate > threshold && templateErrors.length > 3) {
    const severity = templateErrorRate > 0.5 ? 'high' : 'medium';
    return {
      type: 'template_revocation',
      severity,
      description: `Detected ${templateErrors.length} template-related errors out of ${failedMessages.length} failed messages (${(templateErrorRate * 100).toFixed(1)}%)`,
      detectedAt: new Date(),
      metrics: {
        current: templateErrorRate * 100,
        historical: 0,
        threshold: threshold * 100,
        deviation: templateErrorRate * 100,
      },
      recommendation: severity === 'high'
        ? 'CRITICAL: Your message templates may be revoked or disabled. Check Meta Business Manager and WhatsApp Business Manager immediately.'
        : 'Review your message templates in Meta Business Manager to ensure they are active and compliant with WhatsApp policies.',
    };
  }

  return null;
}

/**
 * Calculate anomaly summary
 */
function calculateAnomalySummary(anomalies: Anomaly[]): {
  totalAnomalies: number;
  severity: 'low' | 'medium' | 'high';
  recommendations: string[];
} {
  const totalAnomalies = anomalies.length;

  let severity: 'low' | 'medium' | 'high' = 'low';
  if (anomalies.some((a) => a.severity === 'high')) {
    severity = 'high';
  } else if (anomalies.some((a) => a.severity === 'medium')) {
    severity = 'medium';
  }

  const recommendations = anomalies.map((a) => a.recommendation);

  return {
    totalAnomalies,
    severity,
    recommendations,
  };
}
