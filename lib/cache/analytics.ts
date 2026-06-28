/**
 * Analytics caching layer using Redis
 * Provides real-time counter updates and cached analytics retrieval
 */

import {
  incrementCounter,
  getCounter,
  setCounter,
  getCache,
  setCache,
  CacheKeys,
  CACHE_TTL,
} from './redis';

export interface CampaignAnalytics {
  campaignId: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  successRate: number;
  deliveryRate: number;
  readRate: number;
  totalRecipients: number;
  pending: number;
}

export interface GlobalAnalytics {
  totalCampaigns: number;
  totalMessagesSent: number;
  totalMessagesDelivered: number;
  totalMessagesRead: number;
  totalMessagesFailed: number;
  activeCampaigns: number;
}

export interface TenantAnalytics {
  tenantId: string;
  totalCampaigns: number;
  totalMessagesSent: number;
  totalMessagesDelivered: number;
  totalMessagesRead: number;
  totalMessagesFailed: number;
  activeCampaigns: number;
}

/**
 * Increment campaign analytics counters
 */
export async function incrementCampaignAnalytics(
  campaignId: string,
  status: 'sent' | 'delivered' | 'read' | 'failed'
): Promise<void> {
  const key = CacheKeys.analyticsCampaign(campaignId);
  
  try {
    // Increment specific counter
    await incrementCounter(`${key}:${status}`);
  } catch (error) {
    console.error('Failed to increment campaign analytics:', error);
  }
}

/**
 * Get campaign analytics from cache
 */
export async function getCampaignAnalytics(
  campaignId: string,
  totalRecipients: number
): Promise<CampaignAnalytics | null> {
  const key = CacheKeys.analyticsCampaign(campaignId);
  
  try {
    const cached = await getCache<CampaignAnalytics>(key);
    if (cached) {
      return cached;
    }

    // If not in cache, build from counters
    const sent = await getCounter(`${key}:sent`);
    const delivered = await getCounter(`${key}:delivered`);
    const read = await getCounter(`${key}:read`);
    const failed = await getCounter(`${key}:failed`);

    const analytics: CampaignAnalytics = {
      campaignId,
      sent,
      delivered,
      read,
      failed,
      totalRecipients,
      pending: totalRecipients - sent,
      successRate: totalRecipients > 0 ? ((delivered + read) / totalRecipients) * 100 : 0,
      deliveryRate: totalRecipients > 0 ? (delivered / totalRecipients) * 100 : 0,
      readRate: totalRecipients > 0 ? (read / totalRecipients) * 100 : 0,
    };

    // Cache the result
    await setCache(key, analytics, CACHE_TTL.ANALYTICS);

    return analytics;
  } catch (error) {
    console.error('Failed to get campaign analytics:', error);
    return null;
  }
}

/**
 * Invalidate campaign analytics cache
 */
export async function invalidateCampaignAnalytics(campaignId: string): Promise<void> {
  const key = CacheKeys.analyticsCampaign(campaignId);
  try {
    await incrementCounter(`${key}:invalidated`);
  } catch (error) {
    console.error('Failed to invalidate campaign analytics:', error);
  }
}

/**
 * Increment global analytics counters
 */
export async function incrementGlobalAnalytics(
  metric: 'totalCampaigns' | 'totalMessagesSent' | 'totalMessagesDelivered' | 'totalMessagesRead' | 'totalMessagesFailed'
): Promise<void> {
  const key = CacheKeys.analyticsGlobal();
  
  try {
    await incrementCounter(`${key}:${metric}`);
  } catch (error) {
    console.error('Failed to increment global analytics:', error);
  }
}

/**
 * Get global analytics from cache
 */
export async function getGlobalAnalytics(): Promise<GlobalAnalytics | null> {
  const key = CacheKeys.analyticsGlobal();
  
  try {
    const cached = await getCache<GlobalAnalytics>(key);
    if (cached) {
      return cached;
    }

    // If not in cache, build from counters
    const totalCampaigns = await getCounter(`${key}:totalCampaigns`);
    const totalMessagesSent = await getCounter(`${key}:totalMessagesSent`);
    const totalMessagesDelivered = await getCounter(`${key}:totalMessagesDelivered`);
    const totalMessagesRead = await getCounter(`${key}:totalMessagesRead`);
    const totalMessagesFailed = await getCounter(`${key}:totalMessagesFailed`);

    const analytics: GlobalAnalytics = {
      totalCampaigns,
      totalMessagesSent,
      totalMessagesDelivered,
      totalMessagesRead,
      totalMessagesFailed,
      activeCampaigns: 0, // This needs to be calculated from DB
    };

    // Cache the result
    await setCache(key, analytics, CACHE_TTL.ANALYTICS);

    return analytics;
  } catch (error) {
    console.error('Failed to get global analytics:', error);
    return null;
  }
}

/**
 * Increment tenant analytics counters
 */
export async function incrementTenantAnalytics(
  tenantId: string,
  metric: 'totalCampaigns' | 'totalMessagesSent' | 'totalMessagesDelivered' | 'totalMessagesRead' | 'totalMessagesFailed'
): Promise<void> {
  const key = CacheKeys.analyticsTenant(tenantId);
  
  try {
    await incrementCounter(`${key}:${metric}`);
  } catch (error) {
    console.error('Failed to increment tenant analytics:', error);
  }
}

/**
 * Get tenant analytics from cache
 */
export async function getTenantAnalytics(tenantId: string): Promise<TenantAnalytics | null> {
  const key = CacheKeys.analyticsTenant(tenantId);
  
  try {
    const cached = await getCache<TenantAnalytics>(key);
    if (cached) {
      return cached;
    }

    // If not in cache, build from counters
    const totalCampaigns = await getCounter(`${key}:totalCampaigns`);
    const totalMessagesSent = await getCounter(`${key}:totalMessagesSent`);
    const totalMessagesDelivered = await getCounter(`${key}:totalMessagesDelivered`);
    const totalMessagesRead = await getCounter(`${key}:totalMessagesRead`);
    const totalMessagesFailed = await getCounter(`${key}:totalMessagesFailed`);

    const analytics: TenantAnalytics = {
      tenantId,
      totalCampaigns,
      totalMessagesSent,
      totalMessagesDelivered,
      totalMessagesRead,
      totalMessagesFailed,
      activeCampaigns: 0, // This needs to be calculated from DB
    };

    // Cache the result
    await setCache(key, analytics, CACHE_TTL.ANALYTICS);

    return analytics;
  } catch (error) {
    console.error('Failed to get tenant analytics:', error);
    return null;
  }
}

/**
 * Reset campaign analytics counters (for testing or manual correction)
 */
export async function resetCampaignAnalytics(campaignId: string): Promise<void> {
  const key = CacheKeys.analyticsCampaign(campaignId);
  
  try {
    await setCounter(`${key}:sent`, 0);
    await setCounter(`${key}:delivered`, 0);
    await setCounter(`${key}:read`, 0);
    await setCounter(`${key}:failed`, 0);
  } catch (error) {
    console.error('Failed to reset campaign analytics:', error);
  }
}
