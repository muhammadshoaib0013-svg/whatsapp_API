/**
 * Analytics Query Benchmark Script
 * Tests performance of analytics aggregation queries
 * Target: <150ms for dashboard queries
 */

import { PrismaClient } from '@prisma/client';
import { getAnalyticsSummary } from '../lib/services/analytics-service';
import { getQuickMetrics } from '../lib/services/analytics-service';

const prisma = new PrismaClient();

async function benchmarkAnalyticsQueries() {
  console.log('=== Analytics Query Benchmark ===\n');

  // Get a test tenant ID (you may need to adjust this)
  const testTenantId = 'cmq8xn6yd0001tu78ou83zddy'; // Replace with actual tenant ID

  try {
    // Benchmark 1: Quick Metrics
    console.log('Benchmark 1: Quick Metrics');
    const start1 = Date.now();
    const quickMetrics = await getQuickMetrics(testTenantId);
    const end1 = Date.now();
    const duration1 = end1 - start1;
    console.log(`Duration: ${duration1}ms`);
    console.log(`Result:`, quickMetrics);
    console.log(`Status: ${duration1 < 150 ? '✅ PASS' : '❌ FAIL'} (<150ms)\n`);

    // Benchmark 2: Full Analytics Summary
    console.log('Benchmark 2: Full Analytics Summary (30 days)');
    const start2 = Date.now();
    const analyticsSummary = await getAnalyticsSummary({
      tenantId: testTenantId,
    });
    const end2 = Date.now();
    const duration2 = end2 - start2;
    console.log(`Duration: ${duration2}ms`);
    console.log(`Metrics:`, analyticsSummary.metrics);
    console.log(`Time Series Points:`, analyticsSummary.timeSeries.length);
    console.log(`Template Performance:`, analyticsSummary.templatePerformance.length);
    console.log(`Status: ${duration2 < 150 ? '✅ PASS' : '❌ FAIL'} (<150ms)\n`);

    // Benchmark 3: Analytics Summary with Date Filter
    console.log('Benchmark 3: Analytics Summary (7 days)');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const start3 = Date.now();
    const analyticsSummary7Days = await getAnalyticsSummary({
      tenantId: testTenantId,
      startDate,
    });
    const end3 = Date.now();
    const duration3 = end3 - start3;
    console.log(`Duration: ${duration3}ms`);
    console.log(`Status: ${duration3 < 150 ? '✅ PASS' : '❌ FAIL'} (<150ms)\n`);

    // Summary
    console.log('=== Benchmark Summary ===');
    console.log(`Quick Metrics: ${duration1}ms ${duration1 < 150 ? '✅' : '❌'}`);
    console.log(`Full Summary (30d): ${duration2}ms ${duration2 < 150 ? '✅' : '❌'}`);
    console.log(`Full Summary (7d): ${duration3}ms ${duration3 < 150 ? '✅' : '❌'}`);
    console.log(`Average: ${((duration1 + duration2 + duration3) / 3).toFixed(2)}ms`);

  } catch (error) {
    console.error('Benchmark failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

benchmarkAnalyticsQueries();
