/**
 * Redis caching layer for performance optimization
 * Provides caching utilities for campaign progress, analytics, and rate limiting
 */

import { Redis } from '@upstash/redis';

// Redis client singleton
let redisClient: Redis | null = null;
let redisAvailable = true;
let redisChecked = false;

/**
 * Get or create Redis client instance with fail-safe fallback
 */
export function getRedisClient(): Redis | null {
  if (!redisChecked) {
    redisChecked = true;
    // Check if Redis URL and Token are configured
    if (!process.env.REDIS_URL || !process.env.REDIS_TOKEN) {
      console.warn('[REDIS] REDIS_URL or REDIS_TOKEN not configured, caching disabled');
      redisAvailable = false;
      return null;
    }
  }

  if (!redisAvailable) {
    return null;
  }

  if (!redisClient) {
    try {
      redisClient = new Redis({
        url: process.env.REDIS_URL,
        token: process.env.REDIS_TOKEN,
      });
      console.log('[REDIS] Upstash Redis client initialized');
    } catch (err) {
      console.error('[REDIS] Failed to initialize Redis client:', err);
      redisAvailable = false;
      return null;
    }
  }

  return redisClient;
}

/**
 * Cache configuration
 */
export const CACHE_TTL = {
  PROGRESS: 10, // 10 seconds for campaign progress
  ANALYTICS: 30, // 30 seconds for analytics
  RATE_LIMIT: 60, // 60 seconds for rate limiting
  SHORT: 5, // 5 seconds for frequently changing data
  MEDIUM: 60, // 1 minute
  LONG: 300, // 5 minutes
};

/**
 * Cache key generators
 */
export const CacheKeys = {
  campaignProgress: (campaignId: string) => `campaign:progress:${campaignId}`,
  analyticsCampaign: (campaignId: string) => `analytics:campaign:${campaignId}`,
  analyticsGlobal: () => `analytics:global`,
  analyticsTenant: (tenantId: string) => `analytics:tenant:${tenantId}`,
  rateLimitTenant: (tenantId: string) => `ratelimit:tenant:${tenantId}`,
  rateLimitCampaign: (campaignId: string) => `ratelimit:campaign:${campaignId}`,
  rateLimitCampaignCreate: (tenantId: string) => `ratelimit:campaign:create:${tenantId}`,
  rateLimitCampaignUpdate: (tenantId: string) => `ratelimit:campaign:update:${tenantId}`,
  rateLimitWhatsApp: () => `ratelimit:whatsapp`,
  queueDepth: () => `queue:depth`,
  activeWorkers: () => `queue:workers:active`,
  failedRate: () => `queue:failed:rate`,
};

/**
 * Get cached value
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const client = getRedisClient();
    if (!client) {
      return null; // Redis not available, fallback to null
    }
    const value = await client.get(key);
    if (!value) return null;
    return JSON.parse(value as string) as T;
  } catch (error) {
    console.error('[REDIS] Cache get error:', error);
    redisAvailable = false; // Mark as unavailable on error
    return null;
  }
}

/**
 * Set cached value with TTL
 */
export async function setCache<T>(key: string, value: T, ttl: number): Promise<void> {
  try {
    const client = getRedisClient();
    if (!client) {
      return; // Redis not available, silently skip
    }
    await client.set(key, JSON.stringify(value), { ex: ttl });
  } catch (error) {
    console.error('[REDIS] Cache set error:', error);
    redisAvailable = false; // Mark as unavailable on error
  }
}

/**
 * Delete cached value
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    const client = getRedisClient();
    if (!client) {
      return; // Redis not available, silently skip
    }
    await client.del(key);
  } catch (error) {
    console.error('[REDIS] Cache delete error:', error);
    redisAvailable = false; // Mark as unavailable on error
  }
}

/**
 * Delete multiple cached values by pattern
 */
export async function deleteCachePattern(pattern: string): Promise<void> {
  try {
    const client = getRedisClient();
    if (!client) {
      return; // Redis not available, silently skip
    }
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch (error) {
    console.error('[REDIS] Cache delete pattern error:', error);
    redisAvailable = false; // Mark as unavailable on error
  }
}

/**
 * Increment counter
 */
export async function incrementCounter(key: string): Promise<number> {
  try {
    const client = getRedisClient();
    if (!client) {
      return 0; // Redis not available, return 0
    }
    return await client.incr(key);
  } catch (error) {
    console.error('[REDIS] Counter increment error:', error);
    redisAvailable = false; // Mark as unavailable on error
    return 0;
  }
}

/**
 * Increment counter with expiry
 */
export async function incrementCounterWithExpiry(key: string, ttl: number): Promise<number> {
  try {
    const client = getRedisClient();
    if (!client) {
      return 0; // Redis not available, return 0
    }
    const value = await client.incr(key);
    if (value === 1) {
      await client.expire(key, ttl);
    }
    return value;
  } catch (error) {
    console.error('[REDIS] Counter increment with expiry error:', error);
    redisAvailable = false; // Mark as unavailable on error
    return 0;
  }
}

/**
 * Get counter value
 */
export async function getCounter(key: string): Promise<number> {
  try {
    const client = getRedisClient();
    if (!client) {
      return 0; // Redis not available, return 0
    }
    const value = await client.get(key);
    return value ? parseInt(value as string, 10) : 0;
  } catch (error) {
    console.error('[REDIS] Counter get error:', error);
    redisAvailable = false; // Mark as unavailable on error
    return 0;
  }
}

/**
 * Set counter value
 */
export async function setCounter(key: string, value: number): Promise<void> {
  try {
    const client = getRedisClient();
    if (!client) {
      return; // Redis not available, silently skip
    }
    await client.set(key, value.toString());
  } catch (error) {
    console.error('[REDIS] Counter set error:', error);
    redisAvailable = false; // Mark as unavailable on error
  }
}

/**
 * Check if cache is available
 */
export async function isCacheAvailable(): Promise<boolean> {
  try {
    const client = getRedisClient();
    if (!client) {
      return false; // Redis not available
    }
    await client.ping();
    return true;
  } catch (error) {
    console.error('[REDIS] Cache availability check error:', error);
    redisAvailable = false; // Mark as unavailable on error
    return false;
  }
}

/**
 * Close Redis connection
 * Note: @upstash/redis doesn't have a quit method, so we just clear the client reference
 */
export async function closeRedisConnection(): Promise<void> {
  redisClient = null;
}
