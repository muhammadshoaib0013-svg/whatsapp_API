import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import Redis from 'ioredis';

// Force dynamic route to avoid static generation issues
export const dynamic = 'force-dynamic';

/**
 * Health Check API
 * Comprehensive system diagnostics for production monitoring
 * Checks database connectivity, Redis pool availability, and system status
 */
export async function GET() {
  const healthChecks = {
    database: 'unknown',
    redis: 'unknown',
    timestamp: new Date().toISOString(),
  };

  // Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    healthChecks.database = 'healthy';
  } catch (error) {
    healthChecks.database = 'unhealthy';
    console.error('[HEALTH_CHECK] Database connectivity failed:', error);
  }

  // Check Redis connectivity
  try {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      const redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });
      await redis.ping();
      await redis.quit();
      healthChecks.redis = 'healthy';
    } else {
      healthChecks.redis = 'skipped';
    }
  } catch (error) {
    healthChecks.redis = 'unhealthy';
    console.error('[HEALTH_CHECK] Redis connectivity failed:', error);
  }

  // Determine overall health status
  const isHealthy = healthChecks.database === 'healthy' && (healthChecks.redis === 'healthy' || healthChecks.redis === 'skipped');

  return NextResponse.json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    service: 'WhatsApp Automation SaaS',
    version: '0.0.1',
    phase: 'Phase 10.0 - Production Launch Optimization',
    checks: healthChecks,
  }, {
    status: isHealthy ? 200 : 503,
  });
}
