/**
 * Test Campaign Progress Stream
 * Simulates live campaign progress tracking via SSE
 * Demonstrates the real-time campaign progress tracking functionality
 */

import { sendCampaignProgress } from '../lib/websocket/analytics-stream';

// Simulate a campaign progress stream
async function simulateCampaignProgressStream() {
  const tenantId = 'test-tenant-id';
  const whatsappAccountId = 'test-waba-id';
  const campaignId = 'test-campaign-id';
  const totalRecipients = 100;

  console.log('[CAMPAIGN_PROGRESS_STREAM] Starting simulation...');
  console.log(`[CAMPAIGN_PROGRESS_STREAM] Tenant: ${tenantId}`);
  console.log(`[CAMPAIGN_PROGRESS_STREAM] Campaign: ${campaignId}`);
  console.log(`[CAMPAIGN_PROGRESS_STREAM] Total Recipients: ${totalRecipients}`);

  let sent = 0;
  let delivered = 0;
  let read = 0;
  let failed = 0;

  // Simulate campaign progress over time
  for (let i = 0; i <= 10; i++) {
    sent = Math.floor((i / 10) * totalRecipients);
    delivered = Math.floor(sent * 0.9);
    read = Math.floor(delivered * 0.7);
    failed = sent - delivered;
    const percentage = (sent / totalRecipients) * 100;

    const status = i === 0 ? 'PENDING' : i === 10 ? 'COMPLETED' : 'RUNNING';

    sendCampaignProgress(tenantId, whatsappAccountId, campaignId, {
      total: totalRecipients,
      sent,
      delivered,
      read,
      failed,
      percentage,
      status: status as 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PAUSED',
    });

    console.log(`[CAMPAIGN_PROGRESS_STREAM] Progress: ${percentage.toFixed(1)}% | Sent: ${sent} | Delivered: ${delivered} | Read: ${read} | Failed: ${failed} | Status: ${status}`);

    // Wait 2 seconds between updates
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log('[CAMPAIGN_PROGRESS_STREAM] Simulation complete!');
}

// Run the simulation
simulateCampaignProgressStream().catch(console.error);
