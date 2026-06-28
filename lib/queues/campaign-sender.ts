import { Client } from '@upstash/qstash';

const QSTASH_URL = process.env.QSTASH_URL || '';
const QSTASH_TOKEN = process.env.QSTASH_TOKEN || '';

/**
 * Enqueue a campaign batch for processing via QStash
 * This allows the campaign to be processed in the background without hitting Vercel timeouts
 */
export async function enqueueCampaignBatch(campaignId: string, tenantId: string): Promise<void> {
  if (!QSTASH_URL || !QSTASH_TOKEN) {
    throw new Error('QStash credentials not configured');
  }

  const client = new Client({
    baseUrl: QSTASH_URL,
    token: QSTASH_TOKEN,
  });

  const workerUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/queues/campaign-worker`;

  console.log('[QSTASH_ENQUEUE] Enqueueing campaign batch:', campaignId);
  console.log('[QSTASH_ENQUEUE] Worker URL:', workerUrl);

  await client.publishJSON({
    url: workerUrl,
    body: {
      campaignId,
      tenantId,
    },
    headers: {
      'Content-Type': 'application/json',
    },
  });

  console.log('[QSTASH_ENQUEUE] Campaign batch enqueued successfully');
}

/**
 * Check if QStash is configured
 */
export function isQStashConfigured(): boolean {
  return !!(QSTASH_URL && QSTASH_TOKEN);
}
