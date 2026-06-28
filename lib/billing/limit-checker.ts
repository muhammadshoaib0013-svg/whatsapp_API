/**
 * Limit Checker Utility
 * High-performance validation backed by Redis and Prisma
 * Checks usage BEFORE triggering campaigns or individual messages
 * Implements both Soft Limits (warnings) and Hard Limits (blocking)
 */

import Redis from 'ioredis';
import { prisma } from '@/lib/db';
import { recordRateLimitViolation } from '@/lib/rate-limit';
import {
  getPlanLimits,
  canSendMessage,
  canCreateCampaign,
  canAddWaba,
  getRemainingMessages,
  getRemainingCampaigns,
  getRemainingWabaSlots,
} from '@/config/subscription-plans';

// Redis client for usage tracking
let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }
  return redisClient;
}

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  remaining?: number;
  limit?: number;
  softLimitWarning?: boolean;
}

export interface UsageStats {
  messagesSentToday: number;
  campaignsCreatedThisMonth: number;
  wabaCount: number;
}

/**
 * Get usage statistics for a tenant
 * Combines Redis counters for real-time data and Prisma for historical data
 */
export async function getUsageStats(tenantId: string): Promise<UsageStats> {
  const redis = getRedisClient();
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = new Date().toISOString().slice(0, 7);

  // Get messages sent today from Redis
  const messagesKey = `usage:${tenantId}:messages:${today}`;
  const messagesSentToday = parseInt(await redis.get(messagesKey) || '0', 10);

  // Get campaigns created this month from Prisma
  const campaignsCreatedThisMonth = await prisma.campaign.count({
    where: {
      tenantId,
      createdAt: {
        gte: new Date(`${thisMonth}-01`),
      },
    },
  });

  // Get WABA count from Prisma
  const wabaCount = await prisma.whatsappAccount.count({
    where: { tenantId },
  });

  return {
    messagesSentToday,
    campaignsCreatedThisMonth,
    wabaCount,
  };
}

/**
 * Check if a tenant can send a message
 * Implements both soft and hard limits
 */
export async function checkMessageLimit(
  tenantId: string,
  planId: string
): Promise<LimitCheckResult> {
  const usage = await getUsageStats(tenantId);
  const limits = getPlanLimits(planId);

  if (!limits) {
    return {
      allowed: false,
      reason: 'Invalid plan configuration',
    };
  }

  const remaining = getRemainingMessages(planId, usage.messagesSentToday);

  // Hard limit check
  if (!canSendMessage(planId, usage.messagesSentToday)) {
    console.log('[LIMIT_CHECK] Message hard limit exceeded', {
      tenantId,
      planId,
      messagesSentToday: usage.messagesSentToday,
      limit: limits.maxMessagesPerDay,
    });

    // Record rate limit violation for abuse detection
    await recordRateLimitViolation(tenantId, 'whatsapp');

    return {
      allowed: false,
      reason: 'Message limit exceeded',
      remaining: 0,
      limit: limits.maxMessagesPerDay,
    };
  }

  // Soft limit warning (80% threshold)
  const softLimitThreshold = Math.floor(limits.maxMessagesPerDay * 0.8);
  const softLimitWarning = usage.messagesSentToday >= softLimitThreshold;

  if (softLimitWarning) {
    console.log('[LIMIT_CHECK] Message soft limit warning', {
      tenantId,
      planId,
      messagesSentToday: usage.messagesSentToday,
      softLimitThreshold,
    });
  }

  return {
    allowed: true,
    remaining,
    limit: limits.maxMessagesPerDay,
    softLimitWarning,
  };
}

/**
 * Check if a tenant can create a campaign
 * Implements both soft and hard limits
 */
export async function checkCampaignLimit(
  tenantId: string,
  planId: string
): Promise<LimitCheckResult> {
  const usage = await getUsageStats(tenantId);
  const limits = getPlanLimits(planId);

  if (!limits) {
    return {
      allowed: false,
      reason: 'Invalid plan configuration',
    };
  }

  const remaining = getRemainingCampaigns(planId, usage.campaignsCreatedThisMonth);

  // Hard limit check
  if (!canCreateCampaign(planId, usage.campaignsCreatedThisMonth)) {
    console.log('[LIMIT_CHECK] Campaign hard limit exceeded', {
      tenantId,
      planId,
      campaignsCreatedThisMonth: usage.campaignsCreatedThisMonth,
      limit: limits.maxCampaignsPerMonth,
    });

    // Record rate limit violation for abuse detection
    await recordRateLimitViolation(tenantId, 'campaign');

    return {
      allowed: false,
      reason: 'Campaign limit exceeded',
      remaining: 0,
      limit: limits.maxCampaignsPerMonth,
    };
  }

  // Soft limit warning (80% threshold)
  if (limits.maxCampaignsPerMonth > 0) {
    const softLimitThreshold = Math.floor(limits.maxCampaignsPerMonth * 0.8);
    const softLimitWarning = usage.campaignsCreatedThisMonth >= softLimitThreshold;

    if (softLimitWarning) {
      console.log('[LIMIT_CHECK] Campaign soft limit warning', {
        tenantId,
        planId,
        campaignsCreatedThisMonth: usage.campaignsCreatedThisMonth,
        softLimitThreshold,
      });

      return {
        allowed: true,
        remaining,
        limit: limits.maxCampaignsPerMonth,
        softLimitWarning,
      };
    }
  }

  return {
    allowed: true,
    remaining,
    limit: limits.maxCampaignsPerMonth,
  };
}

/**
 * Check if a tenant can add a WABA account
 * Implements both soft and hard limits
 */
export async function checkWabaLimit(
  tenantId: string,
  planId: string
): Promise<LimitCheckResult> {
  const usage = await getUsageStats(tenantId);
  const limits = getPlanLimits(planId);

  if (!limits) {
    return {
      allowed: false,
      reason: 'Invalid plan configuration',
    };
  }

  const remaining = getRemainingWabaSlots(planId, usage.wabaCount);

  // Hard limit check
  if (!canAddWaba(planId, usage.wabaCount)) {
    console.log('[LIMIT_CHECK] WABA hard limit exceeded', {
      tenantId,
      planId,
      wabaCount: usage.wabaCount,
      limit: limits.maxWabas,
    });

    // Record rate limit violation for abuse detection
    await recordRateLimitViolation(tenantId, 'tenant');

    return {
      allowed: false,
      reason: 'WABA account limit exceeded',
      remaining: 0,
      limit: limits.maxWabas,
    };
  }

  // Soft limit warning (80% threshold)
  if (limits.maxWabas > 0) {
    const softLimitThreshold = Math.floor(limits.maxWabas * 0.8);
    const softLimitWarning = usage.wabaCount >= softLimitThreshold;

    if (softLimitWarning) {
      console.log('[LIMIT_CHECK] WABA soft limit warning', {
        tenantId,
        planId,
        wabaCount: usage.wabaCount,
        softLimitThreshold,
      });

      return {
        allowed: true,
        remaining,
        limit: limits.maxWabas,
        softLimitWarning,
      };
    }
  }

  return {
    allowed: true,
    remaining,
    limit: limits.maxWabas,
  };
}

/**
 * Increment message counter for a tenant
 * Called after a message is successfully sent
 */
export async function incrementMessageCount(tenantId: string): Promise<void> {
  const redis = getRedisClient();
  const today = new Date().toISOString().split('T')[0];
  const messagesKey = `usage:${tenantId}:messages:${today}`;

  await redis.incr(messagesKey);

  // Set expiry at end of day
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const ttl = Math.floor((endOfDay.getTime() - Date.now()) / 1000);
  await redis.expire(messagesKey, ttl);
}

/**
 * Get detailed usage report for a tenant
 */
export async function getUsageReport(tenantId: string, planId: string) {
  const usage = await getUsageStats(tenantId);
  const limits = getPlanLimits(planId);

  if (!limits) {
    return null;
  }

  return {
    planId,
    limits: {
      maxWabas: limits.maxWabas,
      maxMessagesPerDay: limits.maxMessagesPerDay,
      maxCampaignsPerMonth: limits.maxCampaignsPerMonth,
    },
    usage: {
      wabaCount: usage.wabaCount,
      messagesSentToday: usage.messagesSentToday,
      campaignsCreatedThisMonth: usage.campaignsCreatedThisMonth,
    },
    remaining: {
      wabaSlots: getRemainingWabaSlots(planId, usage.wabaCount),
      messages: getRemainingMessages(planId, usage.messagesSentToday),
      campaigns: getRemainingCampaigns(planId, usage.campaignsCreatedThisMonth),
    },
    percentages: {
      wabaUsage: limits.maxWabas > 0 ? (usage.wabaCount / limits.maxWabas) * 100 : 0,
      messageUsage: limits.maxMessagesPerDay > 0 ? (usage.messagesSentToday / limits.maxMessagesPerDay) * 100 : 0,
      campaignUsage: limits.maxCampaignsPerMonth > 0 ? (usage.campaignsCreatedThisMonth / limits.maxCampaignsPerMonth) * 100 : 0,
    },
  };
}

/**
 * Reset daily message counters (called by cron job)
 */
export async function resetDailyMessageCounters(): Promise<void> {
  const redis = getRedisClient();
  const today = new Date().toISOString().split('T')[0];
  const pattern = `usage:*:messages:${today}`;

  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
    console.log('[LIMIT_CHECK] Reset daily message counters', { count: keys.length });
  }
}

/**
 * Reset monthly campaign counters (called by cron job at month start)
 */
export async function resetMonthlyCampaignCounters(): Promise<void> {
  // Campaign counters are based on Prisma queries, so no explicit reset needed
  // The query automatically filters by month
  console.log('[LIMIT_CHECK] Monthly campaign counters reset via query filter');
}
