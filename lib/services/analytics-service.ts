/**
 * Analytics Aggregation Service
 * High-performance analytics engine for WhatsApp message metrics
 * Strictly enforces tenant isolation and uses optimized database queries
 */

import { prisma } from '@/lib/db';

export interface AnalyticsFilters {
  tenantId: string;
  whatsappAccountId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface MessageMetrics {
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalFailed: number;
  deliverySuccessRate: number;
  readReceiptRate: number;
  failureReasons: Record<string, number>;
}

export interface TimeSeriesData {
  date: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

export interface TemplatePerformance {
  templateId: string;
  templateName: string;
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  deliverySuccessRate: number;
}

export interface AnalyticsSummary {
  metrics: MessageMetrics;
  timeSeries: TimeSeriesData[];
  templatePerformance: TemplatePerformance[];
}

/**
 * Get comprehensive analytics summary for a tenant
 * Uses optimized Prisma aggregations with tenant isolation
 */
export async function getAnalyticsSummary(filters: AnalyticsFilters): Promise<AnalyticsSummary> {
  const { tenantId, whatsappAccountId, startDate, endDate } = filters;

  // Build date filter
  const dateFilter = startDate || endDate ? {
    createdAt: {
      ...(startDate && { gte: startDate }),
      ...(endDate && { lte: endDate }),
    },
  } : {};

  // Build WABA filter
  const wabaFilter = whatsappAccountId ? { whatsappAccountId } : {};

  // Get message metrics using Prisma aggregations
  const metrics = await getMessageMetrics(tenantId, whatsappAccountId, dateFilter);

  // Get time series data
  const timeSeries = await getTimeSeriesData(tenantId, whatsappAccountId, startDate, endDate);

  // Get template performance
  const templatePerformance = await getTemplatePerformance(tenantId, whatsappAccountId, dateFilter);

  return {
    metrics,
    timeSeries,
    templatePerformance,
  };
}

/**
 * Get message metrics using optimized aggregations
 */
async function getMessageMetrics(
  tenantId: string,
  whatsappAccountId?: string,
  dateFilter?: any
): Promise<MessageMetrics> {
  const where: any = {
    tenantId,
    ...(whatsappAccountId && { whatsappAccountId }),
    ...dateFilter,
  };

  // Get counts by status using Prisma aggregation
  const statusCounts = await prisma.whatsAppMessageLog.groupBy({
    by: ['status'],
    where,
    _count: {
      status: true,
    },
  });

  // Extract counts
  const counts = statusCounts.reduce((acc, item) => {
    acc[item.status] = item._count.status;
    return acc;
  }, {} as Record<string, number>);

  const totalSent = counts.SENT || 0;
  const totalDelivered = counts.DELIVERED || 0;
  const totalRead = counts.READ || 0;
  const totalFailed = counts.FAILED || 0;

  // Calculate rates
  const deliverySuccessRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
  const readReceiptRate = totalDelivered > 0 ? (totalRead / totalDelivered) * 100 : 0;

  // Get failure reasons distribution
  const failureReasons = await getFailureReasons(tenantId, whatsappAccountId, dateFilter);

  return {
    totalSent,
    totalDelivered,
    totalRead,
    totalFailed,
    deliverySuccessRate,
    readReceiptRate,
    failureReasons,
  };
}

/**
 * Get failure reasons distribution
 */
async function getFailureReasons(
  tenantId: string,
  whatsappAccountId?: string,
  dateFilter?: any
): Promise<Record<string, number>> {
  const where: any = {
    tenantId,
    status: 'FAILED',
    ...(whatsappAccountId && { whatsappAccountId }),
    ...dateFilter,
  };

  const failedMessages = await prisma.whatsAppMessageLog.findMany({
    where,
    select: {
      errorMessage: true,
    },
    take: 1000, // Limit to prevent excessive memory usage
  });

  const reasons: Record<string, number> = {};

  failedMessages.forEach((msg) => {
    if (msg.errorMessage) {
      // Categorize common error patterns
      const category = categorizeError(msg.errorMessage);
      reasons[category] = (reasons[category] || 0) + 1;
    }
  });

  return reasons;
}

/**
 * Categorize error messages into common failure reasons
 */
function categorizeError(errorMessage: string): string {
  const lowerError = errorMessage.toLowerCase();

  if (lowerError.includes('policy') || lowerError.includes('template')) {
    return 'Policy Violation';
  }
  if (lowerError.includes('invalid') || lowerError.includes('format')) {
    return 'Invalid Number';
  }
  if (lowerError.includes('rate') || lowerError.includes('limit')) {
    return 'Rate Limit';
  }
  if (lowerError.includes('timeout') || lowerError.includes('network')) {
    return 'Network Error';
  }
  if (lowerError.includes('unsubscribed') || lowerError.includes('blocked')) {
    return 'User Blocked';
  }

  return 'Other';
}

/**
 * Get time series data for message volumes over time
 */
async function getTimeSeriesData(
  tenantId: string,
  whatsappAccountId?: string,
  startDate?: Date,
  endDate?: Date
): Promise<TimeSeriesData[]> {
  // Default to last 30 days if no date range provided
  const defaultStartDate = new Date();
  defaultStartDate.setDate(defaultStartDate.getDate() - 30);

  const start = startDate || defaultStartDate;
  const end = endDate || new Date();

  const where: any = {
    tenantId,
    createdAt: {
      gte: start,
      lte: end,
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
  const dateMap = new Map<string, TimeSeriesData>();

  dateGroups.forEach((group) => {
    const dateKey = group.createdAt.toISOString().split('T')[0];

    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, {
        date: dateKey,
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
  return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get template performance metrics
 */
async function getTemplatePerformance(
  tenantId: string,
  whatsappAccountId?: string,
  dateFilter?: any
): Promise<TemplatePerformance[]> {
  const where: any = {
    tenantId,
    templateId: { not: null },
    ...(whatsappAccountId && { whatsappAccountId }),
    ...dateFilter,
  };

  // Group by template using Prisma aggregation
  const templateGroups = await prisma.whatsAppMessageLog.groupBy({
    by: ['templateId', 'status'],
    where,
    _count: {
      status: true,
    },
  });

  // Aggregate by template
  const templateMap = new Map<string, {
    templateId: string;
    totalSent: number;
    totalDelivered: number;
    totalRead: number;
  }>();

  templateGroups.forEach((group) => {
    const templateId = group.templateId!;
    const count = group._count.status;

    if (!templateMap.has(templateId)) {
      templateMap.set(templateId, {
        templateId,
        totalSent: 0,
        totalDelivered: 0,
        totalRead: 0,
      });
    }

    const data = templateMap.get(templateId)!;

    switch (group.status) {
      case 'SENT':
        data.totalSent += count;
        break;
      case 'DELIVERED':
        data.totalDelivered += count;
        break;
      case 'READ':
        data.totalRead += count;
        break;
    }
  });

  // Get template names
  const templateIds = Array.from(templateMap.keys());
  const templates = await prisma.whatsAppTemplate.findMany({
    where: {
      id: { in: templateIds },
    },
    select: {
      id: true,
      name: true,
    },
  });

  const templateNameMap = new Map(templates.map((t) => [t.id, t.name]));

  // Convert to array with delivery rates
  return Array.from(templateMap.values()).map((data) => ({
    templateId: data.templateId,
    templateName: templateNameMap.get(data.templateId) || 'Unknown Template',
    totalSent: data.totalSent,
    totalDelivered: data.totalDelivered,
    totalRead: data.totalRead,
    deliverySuccessRate: data.totalSent > 0 ? (data.totalDelivered / data.totalSent) * 100 : 0,
  })).sort((a, b) => b.totalSent - a.totalSent); // Sort by volume
}

/**
 * Get quick summary metrics for dashboard cards
 * Optimized for high-frequency dashboard queries
 */
export async function getQuickMetrics(tenantId: string, whatsappAccountId?: string): Promise<{
  totalMessages: number;
  successRate: number;
  todayMessages: number;
  todaySuccessRate: number;
}> {
  const wabaFilter = whatsappAccountId ? { whatsappAccountId } : {};

  // Get total metrics
  const totalCounts = await prisma.whatsAppMessageLog.groupBy({
    by: ['status'],
    where: {
      tenantId,
      ...wabaFilter,
    },
    _count: {
      status: true,
    },
  });

  const totalSent = totalCounts.find((c) => c.status === 'SENT')?._count.status || 0;
  const totalDelivered = totalCounts.find((c) => c.status === 'DELIVERED')?._count.status || 0;
  const totalMessages = totalCounts.reduce((sum, c) => sum + c._count.status, 0);
  const successRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;

  // Get today's metrics
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayCounts = await prisma.whatsAppMessageLog.groupBy({
    by: ['status'],
    where: {
      tenantId,
      createdAt: { gte: today },
      ...wabaFilter,
    },
    _count: {
      status: true,
    },
  });

  const todaySent = todayCounts.find((c) => c.status === 'SENT')?._count.status || 0;
  const todayDelivered = todayCounts.find((c) => c.status === 'DELIVERED')?._count.status || 0;
  const todayMessages = todayCounts.reduce((sum, c) => sum + c._count.status, 0);
  const todaySuccessRate = todaySent > 0 ? (todayDelivered / todaySent) * 100 : 0;

  return {
    totalMessages,
    successRate,
    todayMessages,
    todaySuccessRate,
  };
}
