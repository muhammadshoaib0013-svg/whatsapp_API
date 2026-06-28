/**
 * Predictive Cost Forecasting Engine
 * Lightweight statistical projection engine for cost and performance forecasting
 * Analyzes historical message velocity, billing tier parameters, and category distribution
 */

import { prisma } from '@/lib/db';
import { getPlanLimits } from '@/config/subscription-plans';

export interface ForecastingInput {
  tenantId: string;
  whatsappAccountId?: string;
  daysToAnalyze?: number; // Default: 30 days
}

export interface ForecastingResult {
  tenantId: string;
  analysisPeriod: {
    startDate: Date;
    endDate: Date;
    daysAnalyzed: number;
  };
  historicalMetrics: {
    totalMessages: number;
    averageDailyMessages: number;
    messageVelocityTrend: 'increasing' | 'decreasing' | 'stable';
    growthRate: number; // Percentage change
    volatility: number; // Standard deviation of daily volumes
  };
  categoryDistribution: {
    marketing: number; // Percentage
    utility: number; // Percentage
    authentication: number; // Percentage
    service: number; // Percentage
  };
  costForecast: {
    projectedDailyCost: number;
    projectedMonthlyCost: number;
    projectedQuarterlyCost: number;
    confidence: 'high' | 'medium' | 'low';
  };
  performanceForecast: {
    projectedDeliveryRate: number;
    projectedReadRate: number;
    trend: 'improving' | 'declining' | 'stable';
  };
  recommendations: string[];
}

/**
 * Predict next campaign stats and costs based on historical trends
 */
export async function predictNextCampaignStats(
  tenantId: string,
  whatsappAccountId?: string
): Promise<ForecastingResult> {
  const daysToAnalyze = 30;
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - daysToAnalyze);

  // Get historical message data
  const historicalData = await getHistoricalMessageData(tenantId, whatsappAccountId, startDate, endDate);

  // Calculate message velocity and trend
  const velocityAnalysis = analyzeMessageVelocity(historicalData, daysToAnalyze);

  // Analyze category distribution (simplified based on template categories)
  const categoryDistribution = await analyzeCategoryDistribution(tenantId, whatsappAccountId, startDate, endDate);

  // Calculate cost forecast
  const costForecast = calculateCostForecast(velocityAnalysis, categoryDistribution);

  // Calculate performance forecast
  const performanceForecast = calculatePerformanceForecast(historicalData);

  // Generate recommendations
  const recommendations = generateRecommendations(velocityAnalysis, costForecast, performanceForecast);

  return {
    tenantId,
    analysisPeriod: {
      startDate,
      endDate,
      daysAnalyzed: daysToAnalyze,
    },
    historicalMetrics: velocityAnalysis,
    categoryDistribution,
    costForecast,
    performanceForecast,
    recommendations,
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
): Promise<Array<{ date: string; sent: number; delivered: number; read: number; failed: number }>> {
  const where: any = {
    tenantId,
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
    ...(whatsappAccountId && { whatsappAccountId }),
  };

  // Group by date using Prisma aggregation
  const dateGroups = await prisma.whatsAppMessageLog.groupBy({
    by: ['status', 'createdAt'],
    where,
    _count: {
      status: true,
    },
  });

  // Aggregate by date
  const dateMap = new Map<string, { sent: number; delivered: number; read: number; failed: number }>();

  dateGroups.forEach((group) => {
    const dateKey = group.createdAt instanceof Date
      ? group.createdAt.toISOString().split('T')[0]
      : new Date(group.createdAt).toISOString().split('T')[0];

    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, {
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
      });
    }

    const data = dateMap.get(dateKey)!;
    const count = group._count.status;

    switch (group.status) {
      case 'SENT':
        data.sent += count;
        break;
      case 'DELIVERED':
        data.delivered += count;
        break;
      case 'READ':
        data.read += count;
        break;
      case 'FAILED':
        data.failed += count;
        break;
    }
  });

  // Convert to array and sort by date
  return Array.from(dateMap.entries())
    .map(([date, metrics]) => ({ date, ...metrics }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Analyze message velocity and trend with volumetric variation handling
 */
function analyzeMessageVelocity(
  historicalData: Array<{ date: string; sent: number; delivered: number; read: number; failed: number }>,
  daysAnalyzed: number
): {
  totalMessages: number;
  averageDailyMessages: number;
  messageVelocityTrend: 'increasing' | 'decreasing' | 'stable';
  growthRate: number;
  volatility: number;
} {
  const totalMessages = historicalData.reduce((sum, day) => sum + day.sent, 0);
  const averageDailyMessages = totalMessages / daysAnalyzed;

  // Remove outliers using IQR method
  const values = historicalData.map((d) => d.sent).sort((a, b) => a - b);
  const q1 = values[Math.floor(values.length * 0.25)];
  const q3 = values[Math.floor(values.length * 0.75)];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  const filteredValues = values.filter((v) => v >= lowerBound && v <= upperBound);

  // Calculate weighted average (more recent days have higher weight)
  const weightedSum = filteredValues.reduce((sum, value, index) => {
    const weight = (index + 1) / filteredValues.length; // Linear weight
    return sum + value * weight;
  }, 0);
  const totalWeight = filteredValues.reduce((sum, _, index) => {
    return sum + (index + 1) / filteredValues.length;
  }, 0);
  const weightedAverage = totalWeight > 0 ? weightedSum / totalWeight : averageDailyMessages;

  // Calculate volatility (standard deviation)
  const variance = filteredValues.reduce((sum, value) => {
    return sum + Math.pow(value - weightedAverage, 2);
  }, 0) / filteredValues.length;
  const volatility = Math.sqrt(variance);

  // Calculate trend by comparing first half vs second half
  const midPoint = Math.floor(historicalData.length / 2);
  const firstHalf = historicalData.slice(0, midPoint);
  const secondHalf = historicalData.slice(midPoint);

  const firstHalfAvg = firstHalf.reduce((sum, day) => sum + day.sent, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, day) => sum + day.sent, 0) / secondHalf.length;

  const growthRate = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0;

  // Adjust trend threshold based on volatility
  const volatilityAdjustedThreshold = 5 + (volatility / weightedAverage) * 10;

  let messageVelocityTrend: 'increasing' | 'decreasing' | 'stable';
  if (growthRate > volatilityAdjustedThreshold) {
    messageVelocityTrend = 'increasing';
  } else if (growthRate < -volatilityAdjustedThreshold) {
    messageVelocityTrend = 'decreasing';
  } else {
    messageVelocityTrend = 'stable';
  }

  return {
    totalMessages,
    averageDailyMessages: weightedAverage,
    messageVelocityTrend,
    growthRate,
    volatility,
  };
}

/**
 * Analyze category distribution (simplified)
 */
async function analyzeCategoryDistribution(
  tenantId: string,
  whatsappAccountId: string | undefined,
  startDate: Date,
  endDate: Date
): Promise<{
  marketing: number;
  utility: number;
  authentication: number;
  service: number;
}> {
  // Get template usage data
  const where: any = {
    tenantId,
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
    ...(whatsappAccountId && { whatsappAccountId }),
  };

  const templateUsage = await prisma.whatsAppMessageLog.groupBy({
    by: ['templateId'],
    where,
    _count: {
      templateId: true,
    },
  });

  // Get template categories
  const templateIds = templateUsage.map((t) => t.templateId).filter((id): id is string => id !== null);
  const templates = await prisma.whatsAppTemplate.findMany({
    where: {
      id: { in: templateIds },
    },
    select: {
      id: true,
      category: true,
    },
  });

  const templateCategoryMap = new Map(templates.map((t) => [t.id, t.category]));

  // Count messages by category
  const categoryCounts = {
    MARKETING: 0,
    UTILITY: 0,
    AUTHENTICATION: 0,
    SERVICE: 0, // User-initiated
  };

  templateUsage.forEach((usage) => {
    if (usage.templateId) {
      const category = templateCategoryMap.get(usage.templateId);
      if (category) {
        categoryCounts[category as keyof typeof categoryCounts] += usage._count.templateId;
      }
    }
  });

  // Assume remaining messages are service (user-initiated)
  const totalCategorized = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);
  const totalMessages = templateUsage.reduce((sum, t) => sum + t._count.templateId, 0);
  const uncategorized = totalMessages - totalCategorized;
  categoryCounts.SERVICE += uncategorized;

  // Calculate percentages
  const total = totalMessages || 1;
  return {
    marketing: (categoryCounts.MARKETING / total) * 100,
    utility: (categoryCounts.UTILITY / total) * 100,
    authentication: (categoryCounts.AUTHENTICATION / total) * 100,
    service: (categoryCounts.SERVICE / total) * 100,
  };
}

/**
 * Calculate cost forecast based on velocity and distribution
 */
function calculateCostForecast(
  velocityAnalysis: { averageDailyMessages: number; messageVelocityTrend: string },
  categoryDistribution: { marketing: number; utility: number; authentication: number; service: number }
): {
  projectedDailyCost: number;
  projectedMonthlyCost: number;
  projectedQuarterlyCost: number;
  confidence: 'high' | 'medium' | 'low';
} {
  // Meta conversation-based pricing rates (USD)
  const rates = {
    marketing: 0.015,
    utility: 0.008,
    authentication: 0.005,
    service: 0.003,
  };

  // Calculate projected daily cost
  const projectedDailyCost =
    (velocityAnalysis.averageDailyMessages * (categoryDistribution.marketing / 100) * rates.marketing) +
    (velocityAnalysis.averageDailyMessages * (categoryDistribution.utility / 100) * rates.utility) +
    (velocityAnalysis.averageDailyMessages * (categoryDistribution.authentication / 100) * rates.authentication) +
    (velocityAnalysis.averageDailyMessages * (categoryDistribution.service / 100) * rates.service);

  // Calculate monthly and quarterly projections
  const projectedMonthlyCost = projectedDailyCost * 30;
  const projectedQuarterlyCost = projectedDailyCost * 90;

  // Determine confidence based on trend stability
  let confidence: 'high' | 'medium' | 'low';
  if (velocityAnalysis.messageVelocityTrend === 'stable') {
    confidence = 'high';
  } else if (velocityAnalysis.messageVelocityTrend === 'increasing' || velocityAnalysis.messageVelocityTrend === 'decreasing') {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    projectedDailyCost,
    projectedMonthlyCost,
    projectedQuarterlyCost,
    confidence,
  };
}

/**
 * Calculate performance forecast
 */
function calculatePerformanceForecast(
  historicalData: Array<{ date: string; sent: number; delivered: number; read: number; failed: number }>
): {
  projectedDeliveryRate: number;
  projectedReadRate: number;
  trend: 'improving' | 'declining' | 'stable';
} {
  const totalSent = historicalData.reduce((sum, day) => sum + day.sent, 0);
  const totalDelivered = historicalData.reduce((sum, day) => sum + day.delivered, 0);
  const totalRead = historicalData.reduce((sum, day) => sum + day.read, 0);

  const projectedDeliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
  const projectedReadRate = totalDelivered > 0 ? (totalRead / totalDelivered) * 100 : 0;

  // Analyze trend by comparing recent performance vs overall
  const recentDays = historicalData.slice(-7);
  const recentSent = recentDays.reduce((sum, day) => sum + day.sent, 0);
  const recentDelivered = recentDays.reduce((sum, day) => sum + day.delivered, 0);
  const recentDeliveryRate = recentSent > 0 ? (recentDelivered / recentSent) * 100 : 0;

  let trend: 'improving' | 'declining' | 'stable';
  if (recentDeliveryRate > projectedDeliveryRate + 2) {
    trend = 'improving';
  } else if (recentDeliveryRate < projectedDeliveryRate - 2) {
    trend = 'declining';
  } else {
    trend = 'stable';
  }

  return {
    projectedDeliveryRate,
    projectedReadRate,
    trend,
  };
}

/**
 * Generate recommendations based on analysis
 */
function generateRecommendations(
  velocityAnalysis: { messageVelocityTrend: string; growthRate: number },
  costForecast: { projectedMonthlyCost: number; confidence: string },
  performanceForecast: { trend: string; projectedDeliveryRate: number }
): string[] {
  const recommendations: string[] = [];

  // Velocity recommendations
  if (velocityAnalysis.messageVelocityTrend === 'increasing' && velocityAnalysis.growthRate > 20) {
    recommendations.push('Message volume is growing rapidly. Consider upgrading your plan to accommodate increased usage.');
  } else if (velocityAnalysis.messageVelocityTrend === 'decreasing') {
    recommendations.push('Message volume is declining. Review your campaign strategy to re-engage audiences.');
  }

  // Cost recommendations
  if (costForecast.projectedMonthlyCost > 100) {
    recommendations.push(`Projected monthly cost of $${costForecast.projectedMonthlyCost.toFixed(2)} is significant. Monitor usage closely.`);
  }

  if (costForecast.confidence === 'low') {
    recommendations.push('Forecast confidence is low due to volatile message patterns. Monitor trends closely.');
  }

  // Performance recommendations
  if (performanceForecast.trend === 'declining') {
    recommendations.push('Delivery rates are declining. Review your message content and recipient list quality.');
  } else if (performanceForecast.projectedDeliveryRate < 90) {
    recommendations.push('Delivery rate is below 90%. Investigate failed messages and improve recipient data quality.');
  }

  if (performanceForecast.trend === 'improving') {
    recommendations.push('Performance is improving. Continue current campaign strategies.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Your messaging metrics are stable. Continue monitoring for any changes.');
  }

  return recommendations;
}
