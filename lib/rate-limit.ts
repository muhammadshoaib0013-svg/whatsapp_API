/**
 * Dynamic rate limiting per tenant, campaign, and WhatsApp API quota
 * Uses Redis to track request counts and enforce limits
 * Includes abuse detection and mitigation
 */

import {
  incrementCounterWithExpiry,
  getCounter,
  setCounter,
  CacheKeys,
  CACHE_TTL,
} from './cache/redis';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  limit: number;
  abuseDetected?: boolean;
  abuseReason?: string;
}

export interface RateLimitConfig {
  tenantLimit?: number;
  campaignLimit?: number;
  whatsappApiLimit?: number;
  windowSeconds?: number;
  abuseThreshold?: number; // Number of violations before flagging as abuse
  abuseBanDuration?: number; // Duration of abuse ban in seconds
}

const DEFAULT_CONFIG: Required<RateLimitConfig> = {
  tenantLimit: 1000, // 1000 requests per tenant per window
  campaignLimit: 100, // 100 requests per campaign per window
  whatsappApiLimit: 50, // 50 requests per WhatsApp API per window
  windowSeconds: 60, // 1 minute window
  abuseThreshold: 5, // Flag as abuse after 5 violations
  abuseBanDuration: 3600, // 1 hour ban
};

/**
 * Check if a tenant is currently banned for abuse
 */
export async function isAbuseBanned(tenantId: string): Promise<boolean> {
  const banKey = `abuse:ban:${tenantId}`;
  const banInfo = await getCounter(banKey);
  return banInfo > 0;
}

/**
 * Record a rate limit violation for abuse detection
 */
export async function recordRateLimitViolation(
  tenantId: string,
  scope: 'tenant' | 'campaign' | 'whatsapp'
): Promise<void> {
  const violationKey = `abuse:violations:${tenantId}:${scope}`;
  const currentViolations = await incrementCounterWithExpiry(violationKey, 3600); // 1 hour window

  const opts = DEFAULT_CONFIG;

  // Check if threshold exceeded
  if (currentViolations >= opts.abuseThreshold) {
    // Ban the tenant
    const banKey = `abuse:ban:${tenantId}`;
    await setCounter(banKey, 1);
    await incrementCounterWithExpiry(banKey, opts.abuseBanDuration);

    console.error(`[ABUSE_DETECTION] Tenant ${tenantId} banned for ${opts.abuseBanDuration}s due to ${currentViolations} violations`);
  }
}

/**
 * Get abuse status for a tenant
 */
export async function getAbuseStatus(tenantId: string): Promise<{
  isBanned: boolean;
  violations: {
    tenant: number;
    campaign: number;
    whatsapp: number;
  };
}> {
  const isBanned = await isAbuseBanned(tenantId);

  const tenantViolations = await getCounter(`abuse:violations:${tenantId}:tenant`);
  const campaignViolations = await getCounter(`abuse:violations:${tenantId}:campaign`);
  const whatsappViolations = await getCounter(`abuse:violations:${tenantId}:whatsapp`);

  return {
    isBanned,
    violations: {
      tenant: tenantViolations,
      campaign: campaignViolations,
      whatsapp: whatsappViolations,
    },
  };
}

/**
 * Check rate limit for a specific scope with abuse detection
 */
export async function checkRateLimit(
  scope: 'tenant' | 'campaign' | 'whatsapp' | 'campaign_create' | 'campaign_update',
  identifier: string,
  config: RateLimitConfig = {}
): Promise<RateLimitResult> {
  const opts = { ...DEFAULT_CONFIG, ...config };

  let key: string;
  let limit: number;

  switch (scope) {
    case 'tenant':
      key = CacheKeys.rateLimitTenant(identifier);
      limit = opts.tenantLimit;
      break;
    case 'campaign':
      key = CacheKeys.rateLimitCampaign(identifier);
      limit = opts.campaignLimit;
      break;
    case 'campaign_create':
      key = CacheKeys.rateLimitCampaignCreate(identifier);
      limit = opts.tenantLimit;
      break;
    case 'campaign_update':
      key = CacheKeys.rateLimitCampaignUpdate(identifier);
      limit = opts.tenantLimit;
      break;
    case 'whatsapp':
      key = CacheKeys.rateLimitWhatsApp();
      limit = opts.whatsappApiLimit;
      break;
    default:
      throw new Error(`Invalid rate limit scope: ${scope}`);
  }

  // Check for abuse ban if this is a tenant scope
  if (scope === 'tenant') {
    const banned = await isAbuseBanned(identifier);
    if (banned) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + opts.abuseBanDuration * 1000,
        limit,
        abuseDetected: true,
        abuseReason: 'Tenant banned due to abuse',
      };
    }
  }

  // Increment counter with expiry
  const currentCount = await incrementCounterWithExpiry(key, opts.windowSeconds);

  const remaining = Math.max(0, limit - currentCount);
  const allowed = currentCount <= limit;
  const resetTime = Date.now() + opts.windowSeconds * 1000;

  // Record violation if limit exceeded
  if (!allowed && scope === 'tenant') {
    await recordRateLimitViolation(identifier, scope);
  }

  return {
    allowed,
    remaining,
    resetTime,
    limit,
    abuseDetected: !allowed && scope === 'tenant',
    abuseReason: !allowed ? 'Rate limit exceeded' : undefined,
  };
}

/**
 * Check multiple rate limits (tenant, campaign, WhatsApp API) with abuse detection
 */
export async function checkMultipleRateLimits(
  tenantId: string,
  campaignId?: string,
  config: RateLimitConfig = {}
): Promise<{
  tenant: RateLimitResult;
  campaign?: RateLimitResult;
  whatsapp: RateLimitResult;
  allowed: boolean;
  abuseDetected: boolean;
}> {
  const opts = { ...DEFAULT_CONFIG, ...config };

  const tenantResult = await checkRateLimit('tenant', tenantId, opts);
  const whatsappResult = await checkRateLimit('whatsapp', '', opts);

  let campaignResult: RateLimitResult | undefined;
  if (campaignId) {
    campaignResult = await checkRateLimit('campaign', campaignId, opts);
  }

  const allowed =
    tenantResult.allowed &&
    whatsappResult.allowed &&
    (!campaignResult || campaignResult.allowed);

  const abuseDetected =
    tenantResult.abuseDetected ||
    whatsappResult.abuseDetected ||
    (campaignResult?.abuseDetected ?? false);

  return {
    tenant: tenantResult,
    campaign: campaignResult,
    whatsapp: whatsappResult,
    allowed,
    abuseDetected,
  };
}

/**
 * Get current rate limit status without incrementing
 */
export async function getRateLimitStatus(
  scope: 'tenant' | 'campaign' | 'whatsapp',
  identifier: string,
  config: RateLimitConfig = {}
): Promise<RateLimitResult> {
  const opts = { ...DEFAULT_CONFIG, ...config };

  let key: string;
  let limit: number;

  switch (scope) {
    case 'tenant':
      key = CacheKeys.rateLimitTenant(identifier);
      limit = opts.tenantLimit;
      break;
    case 'campaign':
      key = CacheKeys.rateLimitCampaign(identifier);
      limit = opts.campaignLimit;
      break;
    case 'whatsapp':
      key = CacheKeys.rateLimitWhatsApp();
      limit = opts.whatsappApiLimit;
      break;
    default:
      throw new Error(`Invalid rate limit scope: ${scope}`);
  }

  const currentCount = await getCounter(key);
  const remaining = Math.max(0, limit - currentCount);
  const allowed = currentCount < limit;
  const resetTime = Date.now() + opts.windowSeconds * 1000;

  return {
    allowed,
    remaining,
    resetTime,
    limit,
  };
}

/**
 * Reset rate limit counter (for testing or manual reset)
 */
export async function resetRateLimit(
  scope: 'tenant' | 'campaign' | 'whatsapp',
  identifier: string
): Promise<void> {
  let key: string;
  switch (scope) {
    case 'tenant':
      key = CacheKeys.rateLimitTenant(identifier);
      break;
    case 'campaign':
      key = CacheKeys.rateLimitCampaign(identifier);
      break;
    case 'whatsapp':
      key = CacheKeys.rateLimitWhatsApp();
      break;
    default:
      throw new Error(`Invalid rate limit scope: ${scope}`);
  }

  await setCounter(key, 0);
}

/**
 * Lift abuse ban for a tenant (admin function)
 */
export async function liftAbuseBan(tenantId: string): Promise<void> {
  const banKey = `abuse:ban:${tenantId}`;
  await setCounter(banKey, 0);

  // Also clear violations
  await setCounter(`abuse:violations:${tenantId}:tenant`, 0);
  await setCounter(`abuse:violations:${tenantId}:campaign`, 0);
  await setCounter(`abuse:violations:${tenantId}:whatsapp`, 0);

  console.log(`[ABUSE_DETECTION] Ban lifted for tenant ${tenantId}`);
}
