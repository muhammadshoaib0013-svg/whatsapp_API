/**
 * Analytics Cache Layer
 * Redis-based caching for dashboard metrics to prevent database bottlenecks
 * Cache keys structured as tenant:{tenantId}:analytics:summary
 */

import Redis from 'ioredis';
import { AnalyticsSummary, AnalyticsFilters } from '@/lib/services/analytics-service';
import { getAnalyticsSummary } from '@/lib/services/analytics-service';

// Redis client for analytics caching
let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }
  return redisClient;
}

const CACHE_TTL_SECONDS = 600; // 10 minutes cache TTL

/**
 * Generate cache key for analytics summary
 */
function getCacheKey(tenantId: string, whatsappAccountId?: string): string {
  const wabaSuffix = whatsappAccountId ? `:${whatsappAccountId}` : '';
  return `tenant:${tenantId}:analytics:summary${wabaSuffix}`;
}

/**
 * Get cached analytics summary
 */
export async function getCachedAnalyticsSummary(
  tenantId: string,
  whatsappAccountId?: string
): Promise<AnalyticsSummary | null> {
  const redis = getRedisClient();
  const cacheKey = getCacheKey(tenantId, whatsappAccountId);

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log('[ANALYTICS_CACHE] Cache hit', { tenantId, whatsappAccountId });
      return JSON.parse(cached) as AnalyticsSummary;
    }
    console.log('[ANALYTICS_CACHE] Cache miss', { tenantId, whatsappAccountId });
    return null;
  } catch (error) {
    console.error('[ANALYTICS_CACHE] Error getting cached data', error);
    return null;
  }
}

/**
 * Set cached analytics summary
 */
export async function setCachedAnalyticsSummary(
  tenantId: string,
  data: AnalyticsSummary,
  whatsappAccountId?: string
): Promise<void> {
  const redis = getRedisClient();
  const cacheKey = getCacheKey(tenantId, whatsappAccountId);

  try {
    await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(data));
    console.log('[ANALYTICS_CACHE] Cache set', { tenantId, whatsappAccountId, ttl: CACHE_TTL_SECONDS });
  } catch (error) {
    console.error('[ANALYTICS_CACHE] Error setting cache', error);
  }
}

/**
 * Invalidate analytics cache for a tenant
 * Called when new bulk campaign completes or major batch webhook failure occurs
 */
export async function invalidateAnalyticsCache(
  tenantId: string,
  whatsappAccountId?: string
): Promise<void> {
  const redis = getRedisClient();
  const cacheKey = getCacheKey(tenantId, whatsappAccountId);

  try {
    await redis.del(cacheKey);
    console.log('[ANALYTICS_CACHE] Cache invalidated', { tenantId, whatsappAccountId });
  } catch (error) {
    console.error('[ANALYTICS_CACHE] Error invalidating cache', error);
  }
}

/**
 * Get analytics summary with automatic caching
 * Returns cached data if available, otherwise computes and caches it
 */
export async function getAnalyticsSummaryWithCache(
  filters: AnalyticsFilters
): Promise<AnalyticsSummary> {
  const { tenantId, whatsappAccountId } = filters;

  // Try to get from cache first
  const cached = await getCachedAnalyticsSummary(tenantId, whatsappAccountId);
  if (cached) {
    return cached;
  }

  // Compute fresh data
  const data = await getAnalyticsSummary(filters);

  // Cache the result
  await setCachedAnalyticsSummary(tenantId, data, whatsappAccountId);

  return data;
}

/**
 * Invalidate all analytics cache for a tenant
 * Useful for tenant-wide cache invalidation
 */
export async function invalidateAllAnalyticsCache(tenantId: string): Promise<void> {
  const redis = getRedisClient();
  const pattern = `tenant:${tenantId}:analytics:*`;

  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log('[ANALYTICS_CACHE] All cache invalidated', { tenantId, count: keys.length });
    }
  } catch (error) {
    console.error('[ANALYTICS_CACHE] Error invalidating all cache', error);
  }
}

/**
 * Get cache statistics for monitoring
 */
export async function getCacheStats(tenantId: string): Promise<{
  hitRate: number;
  keysCount: number;
  ttl: number;
}> {
  const redis = getRedisClient();
  const pattern = `tenant:${tenantId}:analytics:*`;

  try {
    const keys = await redis.keys(pattern);
    return {
      hitRate: 0, // Would need to track hits/misses separately
      keysCount: keys.length,
      ttl: CACHE_TTL_SECONDS,
    };
  } catch (error) {
    console.error('[ANALYTICS_CACHE] Error getting cache stats', error);
    return {
      hitRate: 0,
      keysCount: 0,
      ttl: CACHE_TTL_SECONDS,
    };
  }
}
