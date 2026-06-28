import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Redis client for rate limiting
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// Rate limiter for authentication endpoints (strict: 5 requests per minute)
export const authRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  analytics: true,
  prefix: 'auth:',
});

// Rate limiter for WhatsApp messaging (moderate: 30 requests per minute)
export const whatsappRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 m'),
  analytics: true,
  prefix: 'whatsapp:',
});

// Generic rate limiter for other endpoints (100 requests per minute)
export const genericRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  analytics: true,
  prefix: 'generic:',
});

// Helper function to check rate limit
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<{ success: boolean; remaining: number; reset: number }> {
  try {
    // If Upstash is not configured, allow all requests (fail-open)
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      console.warn('[RATE_LIMIT] Upstash Redis not configured, rate limiting disabled');
      return { success: true, remaining: 1000, reset: Date.now() + 60000 };
    }

    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    console.error('[RATE_LIMIT] Error checking rate limit:', error);
    // Fail-open: allow request if rate limiter fails
    return { success: true, remaining: 1000, reset: Date.now() + 60000 };
  }
}

// Helper function to get identifier from request
export function getRateLimitIdentifier(request: Request): string {
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  return ip;
}
