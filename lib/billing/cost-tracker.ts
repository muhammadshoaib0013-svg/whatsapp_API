/**
 * Conversation-Based Cost Tracker
 * Implements Meta's Conversation-Based Pricing logic
 * Categorizes costs by Business-Initiated vs User-Initiated conversations
 */

import Redis from 'ioredis';
import { prisma } from '@/lib/db';

// Redis client for cost tracking
let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }
  return redisClient;
}

export interface ConversationCost {
  conversationId: string;
  tenantId: string;
  whatsappAccountId: string;
  conversationType: 'BUSINESS_INITIATED' | 'USER_INITIATED';
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION' | 'SERVICE';
  startTime: Date;
  endTime?: Date;
  messageCount: number;
  estimatedCost: number;
  currency: string;
}

export interface CostSummary {
  tenantId: string;
  period: 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM';
  startDate: Date;
  endDate: Date;
  totalCost: number;
  businessInitiatedCost: number;
  userInitiatedCost: number;
  marketingCost: number;
  utilityCost: number;
  authenticationCost: number;
  serviceCost: number;
  conversationCount: number;
  messageCount: number;
}

/**
 * Meta Conversation-Based Pricing Rates (USD)
 * These are approximate rates and should be updated based on actual Meta pricing
 */
const CONVERSATION_RATES = {
  MARKETING: 0.015, // Business-initiated marketing
  UTILITY: 0.008, // Business-initiated utility
  AUTHENTICATION: 0.005, // Business-initiated authentication
  SERVICE: 0.003, // User-initiated service conversations
};

/**
 * Track cost for a message based on conversation type
 */
export async function trackMessageCost(
  tenantId: string,
  whatsappAccountId: string,
  messageId: string,
  messageType: string,
  templateCategory?: string,
  isBusinessInitiated?: boolean
): Promise<void> {
  const redis = getRedisClient();
  const today = new Date().toISOString().split('T')[0];

  // Determine conversation type
  const conversationType = isBusinessInitiated ? 'BUSINESS_INITIATED' : 'USER_INITIATED';
  
  // Determine category
  let category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION' | 'SERVICE' = 'SERVICE';
  
  if (isBusinessInitiated && templateCategory) {
    switch (templateCategory.toUpperCase()) {
      case 'MARKETING':
        category = 'MARKETING';
        break;
      case 'UTILITY':
        category = 'UTILITY';
        break;
      case 'AUTHENTICATION':
        category = 'AUTHENTICATION';
        break;
      default:
        category = 'UTILITY';
    }
  }

  // Get cost rate
  const rate = CONVERSATION_RATES[category];

  // Increment daily cost counters in Redis
  const costKey = `cost:${tenantId}:${today}:${category}`;
  const messageKey = `cost:${tenantId}:${today}:messages`;
  const typeKey = `cost:${tenantId}:${today}:${conversationType}`;

  await redis.incrbyfloat(costKey, rate);
  await redis.incr(messageKey);
  await redis.incr(typeKey);

  // Set expiry at end of day
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const ttl = Math.floor((endOfDay.getTime() - Date.now()) / 1000);
  
  await redis.expire(costKey, ttl);
  await redis.expire(messageKey, ttl);
  await redis.expire(typeKey, ttl);

  console.log('[COST_TRACKER] Message cost tracked', {
    tenantId,
    whatsappAccountId,
    messageId,
    conversationType,
    category,
    rate,
  });
}

/**
 * Get cost summary for a tenant for a specific period
 */
export async function getCostSummary(
  tenantId: string,
  period: 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM',
  startDate?: Date,
  endDate?: Date
): Promise<CostSummary> {
  const redis = getRedisClient();

  // Determine date range
  const now = new Date();
  let start: Date;
  let end: Date;

  switch (period) {
    case 'TODAY':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = now;
      break;
    case 'WEEK':
      start = new Date(now);
      start.setDate(now.getDate() - 7);
      end = now;
      break;
    case 'MONTH':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = now;
      break;
    case 'CUSTOM':
      start = startDate || new Date(now);
      start.setDate(now.getDate() - 7);
      end = endDate || now;
      break;
  }

  // Aggregate costs from Redis for the period
  const totalCost = await aggregateCostsFromRedis(tenantId, start, end);

  // Get message count from database
  const messageCount = await prisma.whatsAppMessageLog.count({
    where: {
      tenantId,
      createdAt: {
        gte: start,
        lte: end,
      },
    },
  });

  // Get conversation count (estimated as unique conversations)
  const conversationCount = await getConversationCount(tenantId, start, end);

  return {
    tenantId,
    period,
    startDate: start,
    endDate: end,
    totalCost: totalCost.marketing + totalCost.utility + totalCost.authentication + totalCost.service,
    businessInitiatedCost: totalCost.marketing + totalCost.utility + totalCost.authentication,
    userInitiatedCost: totalCost.service,
    marketingCost: totalCost.marketing,
    utilityCost: totalCost.utility,
    authenticationCost: totalCost.authentication,
    serviceCost: totalCost.service,
    conversationCount,
    messageCount,
  };
}

/**
 * Aggregate costs from Redis for a date range
 */
async function aggregateCostsFromRedis(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  marketing: number;
  utility: number;
  authentication: number;
  service: number;
}> {
  const redis = getRedisClient();
  const costs = {
    marketing: 0,
    utility: 0,
    authentication: 0,
    service: 0,
  };

  // Iterate through each day in the range
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateKey = currentDate.toISOString().split('T')[0];

    // Get costs for each category
    const marketingCost = parseFloat(await redis.get(`cost:${tenantId}:${dateKey}:MARKETING`) || '0');
    const utilityCost = parseFloat(await redis.get(`cost:${tenantId}:${dateKey}:UTILITY`) || '0');
    const authenticationCost = parseFloat(await redis.get(`cost:${tenantId}:${dateKey}:AUTHENTICATION`) || '0');
    const serviceCost = parseFloat(await redis.get(`cost:${tenantId}:${dateKey}:SERVICE`) || '0');

    costs.marketing += marketingCost;
    costs.utility += utilityCost;
    costs.authentication += authenticationCost;
    costs.service += serviceCost;

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return costs;
}

/**
 * Get estimated conversation count for a period
 * This is an approximation based on message patterns
 */
async function getConversationCount(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  // Group by phone number to estimate conversations
  const conversations = await prisma.whatsAppMessageLog.groupBy({
    by: ['toPhoneNumber'],
    where: {
      tenantId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    _count: {
      toPhoneNumber: true,
    },
  });

  // Estimate conversations (simplified logic)
  // In production, this would use actual conversation windows from Meta
  return conversations.length;
}

/**
 * Get cost breakdown by category for a tenant
 */
export async function getCostBreakdown(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  marketing: number;
  utility: number;
  authentication: number;
  service: number;
  total: number;
}> {
  const costs = await aggregateCostsFromRedis(tenantId, startDate, endDate);
  const total = costs.marketing + costs.utility + costs.authentication + costs.service;

  return {
    ...costs,
    total,
  };
}

/**
 * Reset daily cost counters (called by cron job at end of day)
 */
export async function resetDailyCostCounters(): Promise<void> {
  const redis = getRedisClient();
  const today = new Date().toISOString().split('T')[0];
  const pattern = `cost:*:${today}:*`;

  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
    console.log('[COST_TRACKER] Reset daily cost counters', { count: keys.length });
  }
}

/**
 * Get cost trend data for charts
 */
export async function getCostTrend(
  tenantId: string,
  days: number = 30
): Promise<Array<{
  date: string;
  cost: number;
  businessInitiated: number;
  userInitiated: number;
}>> {
  const redis = getRedisClient();
  const trend: Array<{
    date: string;
    cost: number;
    businessInitiated: number;
    userInitiated: number;
  }> = [];

  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];

    const marketingCost = parseFloat(await redis.get(`cost:${tenantId}:${dateKey}:MARKETING`) || '0');
    const utilityCost = parseFloat(await redis.get(`cost:${tenantId}:${dateKey}:UTILITY`) || '0');
    const authenticationCost = parseFloat(await redis.get(`cost:${tenantId}:${dateKey}:AUTHENTICATION`) || '0');
    const serviceCost = parseFloat(await redis.get(`cost:${tenantId}:${dateKey}:SERVICE`) || '0');

    const businessInitiated = marketingCost + utilityCost + authenticationCost;
    const total = businessInitiated + serviceCost;

    trend.push({
      date: dateKey,
      cost: total,
      businessInitiated,
      userInitiated: serviceCost,
    });
  }

  return trend;
}
