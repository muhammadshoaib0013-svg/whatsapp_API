import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { incrementCampaignAnalytics } from '@/lib/cache/analytics';
import { invalidateAnalyticsCache } from '@/lib/cache/analytics-cache';
import { sendAnalyticsUpdate, sendCampaignProgress } from '@/lib/websocket/analytics-stream';

export const dynamic = 'force-dynamic';
import {
  verifyWebhookSignature,
  generateWebhookRequestId,
  isWebhookProcessed,
  logWebhookVerification,
  extractWebhookMetadata,
  validateWebhookPayload,
  sanitizeWebhookPayload,
} from '@/lib/security/webhook-verification';
import { resolveTenantByWebhook } from '@/lib/services/webhook-tenant-resolver';
import { processChatbotRules } from '@/lib/services/chatbot-engine';
import { handleMessage } from '@/lib/services/messageHandler';
import { inboxStreamManager } from '@/lib/websocket/inbox-stream';
import { waitUntil } from '@vercel/functions';

// TypeScript interfaces for webhook payload
export interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppWebhookEntry[];
}

export interface WhatsAppWebhookEntry {
  id: string;
  changes: WhatsAppWebhookChange[];
}

export interface WhatsAppWebhookChange {
  field: string;
  value: WhatsAppMessageValue | WhatsAppStatusValue;
}

export interface WhatsAppMessageValue {
  messaging_product: string;
  metadata: {
    phone_number_id: string;
    display_phone_number?: string;
  };
  messages?: WhatsAppMessage[];
  contacts?: WhatsAppContact[];
}

export interface WhatsAppStatusValue {
  messaging_product: string;
  metadata: {
    phone_number_id: string;
    display_phone_number?: string;
  };
  statuses?: WhatsAppStatus[];
}

export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  text?: { body: string };
  image?: { caption?: string };
  document?: { filename?: string };
  audio?: {};
  video?: {};
  location?: { latitude: number; longitude: number };
  contacts?: any[];
  type?: string;
}

export interface WhatsAppStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ message: string }>;
}

export interface WhatsAppContact {
  wa_id: string;
  profile?: { name: string };
}

export interface TenantInfo {
  tenantId: string;
  whatsappAccountId: string;
  businessPhoneNumber: string;
}

// WhatsApp Cloud API webhook verification and status updates
// GET: Meta webhook verification (hub.mode, hub.verify_token, hub.challenge)
// POST: Meta webhook events (message status updates)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!verifyToken) {
    console.error('WHATSAPP_VERIFY_TOKEN not configured');
    return NextResponse.json(
      { error: 'Verify token not configured' },
      { status: 500 }
    );
  }

  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  console.error('Webhook verification failed', { mode, token: token ? 'provided' : 'missing' });
  return NextResponse.json(
    { error: 'Verification failed' },
    { status: 403 }
  );
}

export async function POST(request: NextRequest) {
  const requestId = generateWebhookRequestId();
  const metadata = extractWebhookMetadata(request);


  try {
    const appSecret = process.env.META_APP_SECRET;
    const signature = request.headers.get('x-hub-signature-256');

    // Get raw body for signature verification
    const body = await request.text();

    // Verify webhook signature (mandatory in production)
    if (!appSecret) {
      logWebhookVerification(requestId, false, 'App secret not configured');
      return NextResponse.json(
        { error: 'App secret not configured' },
        { status: 500 }
      );
    }

    const signatureVerification = verifyWebhookSignature(signature, body, appSecret);
    if (!signatureVerification.valid) {
      logWebhookVerification(requestId, false, signatureVerification.error);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 403 }
      );
    }

    // Check for replay attacks
    const isProcessed = await isWebhookProcessed(requestId);
    if (isProcessed) {
      logWebhookVerification(requestId, false, 'Replay attack detected');
      return NextResponse.json(
        { error: 'Request already processed' },
        { status: 409 }
      );
    }

    // Parse payload
    const payload = JSON.parse(body);

    // Validate payload structure
    const payloadValidation = validateWebhookPayload(payload);
    if (!payloadValidation.valid) {
      logWebhookVerification(requestId, false, payloadValidation.error);
      return NextResponse.json(
        { error: 'Invalid payload structure' },
        { status: 400 }
      );
    }

    logWebhookVerification(requestId, true);

    // Return 200 OK immediately to avoid webhook timeout
    // Process payload asynchronously in the background
    const response = NextResponse.json({ success: true, requestId }, { status: 200 });

    // Process WhatsApp message events (status updates and inbound messages) asynchronously
    // Use waitUntil to ensure Vercel keeps the function alive until DB writes finish
    waitUntil(
      processWebhookPayloadAsync(payload, requestId).catch((error: Error) => {
        console.error('[WEBHOOK_ASYNC_ERROR] Error in async processing:', error);
      })
    );


    return response;
  } catch (error) {
    console.error('='.repeat(80));
    console.error('[WEBHOOK_ERROR] ===========================================');
    console.error('[WEBHOOK_ERROR] Webhook processing failed');
    console.error('[WEBHOOK_ERROR] Request ID:', requestId);
    console.error('[WEBHOOK_ERROR] Error:', error instanceof Error ? error.message : String(error));
    console.error('[WEBHOOK_ERROR] Stack:', error instanceof Error ? error.stack : 'No stack available');
    console.error('='.repeat(80));
    logWebhookVerification(requestId, false, 'Internal server error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function processWebhookPayloadAsync(payload: WhatsAppWebhookPayload, requestId: string) {
  try {
    // Process WhatsApp message events (status updates and inbound messages)
    if (payload.entry && payload.entry.length > 0) {
      for (const entry of payload.entry) {
        if (entry.changes && entry.changes.length > 0) {
          for (const change of entry.changes) {
            if (change.field === 'messages' && change.value) {
              // Check if this is a status update or an inbound message
              if ('statuses' in change.value && change.value.statuses) {
                await processMessageStatus(change.value as WhatsAppStatusValue, requestId);
              } else if ('messages' in change.value && change.value.messages) {
                await processInboundMessage(change.value as WhatsAppMessageValue, requestId);
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('[WEBHOOK_ASYNC_ERROR] Error in async payload processing:', error instanceof Error ? error.stack : error);
  }
}

async function processMessageStatus(value: WhatsAppStatusValue, requestId: string) {
  const statuses = value.statuses;

  if (!statuses || !Array.isArray(statuses)) {
    return;
  }

  for (const status of statuses) {
    const metaMessageId = status.id;
    const statusType = status.status; // sent, delivered, read, failed
    const timestamp = status.timestamp;
    const errors = status.errors;

    if (!metaMessageId) {
      continue;
    }

    // Find message log by Meta message ID
    const messageLog = await prisma.whatsAppMessageLog.findFirst({
      where: { metaMessageId },
    });

    if (!messageLog) {
      continue;
    }

    // Map Meta status to our MessageStatus enum
    let newStatus: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
    let errorMessage: string | null = null;

    switch (statusType) {
      case 'sent':
        newStatus = 'SENT';
        break;
      case 'delivered':
        newStatus = 'DELIVERED';
        break;
      case 'read':
        newStatus = 'READ';
        break;
      case 'failed':
        newStatus = 'FAILED';
        if (errors && errors.length > 0) {
          errorMessage = errors[0].message || 'Message delivery failed';
        }
        break;
      default:
        continue;
    }

    // Only update if status has changed
    if (messageLog.status !== newStatus) {
      const existingResponseJson = messageLog.responseJson as Record<string, any> | null;
      await prisma.whatsAppMessageLog.update({
        where: { id: messageLog.id },
        data: {
          status: newStatus,
          errorMessage: errorMessage || messageLog.errorMessage,
          responseJson: {
            ...(existingResponseJson || {}),
            webhookStatus: statusType,
            webhookTimestamp: timestamp,
          },
        },
      });

      // Invalidate analytics cache for this tenant to ensure real-time updates
      await invalidateAnalyticsCache(messageLog.tenantId, messageLog.whatsappAccountId);

      // Send real-time analytics update via SSE
      sendAnalyticsUpdate(messageLog.tenantId, messageLog.whatsappAccountId, {
        messageId: metaMessageId,
        status: newStatus,
        errorMessage,
      });

      // Also update campaign recipient status if linked
      const campaignRecipient = await prisma.campaignRecipient.findFirst({
        where: { metaMessageId },
      });

      if (campaignRecipient) {
        const updateData: any = {
          status: newStatus,
        };

        if (statusType === 'delivered') {
          updateData.deliveredAt = new Date();
        } else if (statusType === 'read') {
          updateData.readAt = new Date();
        }

        if (errorMessage) {
          updateData.errorMessage = errorMessage;
        }

        await prisma.campaignRecipient.update({
          where: { id: campaignRecipient.id },
          data: updateData,
        });

        // Increment Redis analytics counter for delivered/read
        const campaignId = messageLog.campaignId || '';

        if (statusType === 'delivered') {
          await incrementCampaignAnalytics(campaignId, 'delivered');
        } else if (statusType === 'read') {
          await incrementCampaignAnalytics(campaignId, 'read');
        }

        // Send real-time campaign progress update via SSE
        if (campaignId) {
          const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            select: {
              id: true,
              status: true,
              recipients: {
                select: {
                  id: true,
                  status: true,
                },
              },
            },
          });

          if (campaign) {
            const total = campaign.recipients.length;
            const sent = campaign.recipients.filter((r) => r.status !== 'PENDING').length;
            const delivered = campaign.recipients.filter((r) => r.status === 'DELIVERED' || r.status === 'READ').length;
            const read = campaign.recipients.filter((r) => r.status === 'READ').length;
            const failed = campaign.recipients.filter((r) => r.status === 'FAILED').length;
            const percentage = total > 0 ? (sent / total) * 100 : 0;

            sendCampaignProgress(
              messageLog.tenantId,
              messageLog.whatsappAccountId,
              campaignId,
              {
                total,
                sent,
                delivered,
                read,
                failed,
                percentage,
                status: campaign.status as 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PAUSED',
              }
            );
          }
        }
      }
    }
  }
}

async function processInboundMessage(value: WhatsAppMessageValue, requestId: string) {
  const messages = value.messages;
  const phoneNumberId = value.metadata?.phone_number_id;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return;
  }

  if (!phoneNumberId) {
    console.error('[WEBHOOK_INBOUND] phoneNumberId missing from metadata');
    return;
  }

  try {
    // Resolve tenant by phoneNumberId (security check)
    let tenantInfo;
    try {
      tenantInfo = await resolveTenantByWebhook(phoneNumberId);
    } catch (tenantError) {
      console.error('[WEBHOOK_INBOUND] Error resolving tenant:', tenantError instanceof Error ? tenantError.message : String(tenantError));
      throw tenantError;
    }
    const { tenantId, whatsappAccountId, businessPhoneNumber } = tenantInfo;

    for (const message of messages) {
      const from = message.from;
      const messageId = message.id;
      const timestamp = message.timestamp;
      const messageContent = extractMessageContent(message);

      if (!from || !messageContent) {
        continue;
      }

      // Find or create chat session
      let chatSession;
      try {
        chatSession = await prisma.chatSession.findUnique({
          where: {
            tenantId_customerPhoneNumber: {
              tenantId,
              customerPhoneNumber: from,
            },
          },
        });
      } catch (dbError) {
        console.error('[WEBHOOK_INBOUND] Database error during chat session lookup:', dbError instanceof Error ? dbError.message : String(dbError));
        throw dbError;
      }

      if (!chatSession) {
        // Create new chat session
        try {
          chatSession = await prisma.chatSession.create({
            data: {
              tenantId,
              whatsappAccountId,
              customerPhoneNumber: from,
              status: 'ACTIVE',
              lastMessageAt: new Date(),
              lastMessagePreview: messageContent.content.substring(0, 100),
              unreadCount: 1,
            },
          });
        } catch (dbError) {
          console.error('[WEBHOOK_INBOUND] Database error creating chat session:', dbError instanceof Error ? dbError.message : String(dbError));
          throw dbError;
        }
      } else {
        // Update existing chat session
        try {
          chatSession = await prisma.chatSession.update({
            where: { id: chatSession.id },
            data: {
              lastMessageAt: new Date(),
              lastMessagePreview: messageContent.content.substring(0, 100),
              unreadCount: { increment: 1 },
            },
          });
        } catch (dbError) {
          console.error('[WEBHOOK_INBOUND] Database error updating chat session:', dbError instanceof Error ? dbError.message : String(dbError));
          throw dbError;
        }
      }

      // Create message record
      let newMessage;
      try {
        newMessage = await prisma.message.create({
          data: {
            tenantId,
            whatsappAccountId,
            chatSessionId: chatSession.id,
            direction: 'INBOUND',
            content: messageContent.content,
            messageType: (messageContent.type || 'TEXT') as 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'VIDEO' | 'LOCATION' | 'CONTACT' | 'TEMPLATE',
            status: 'SENT',
            metaMessageId: messageId,
            sentAt: new Date(parseInt(timestamp) * 1000),
          },
        });
      } catch (dbError) {
        console.error('[WEBHOOK_INBOUND] Database error while creating message:', dbError instanceof Error ? dbError.message : String(dbError));
        throw dbError;
      }

      // Send real-time inbox update via SSE
      inboxStreamManager.broadcastNewMessage(tenantId, {
        id: newMessage.id,
        chatSessionId: chatSession.id,
        direction: 'INBOUND',
        content: messageContent.content,
        messageType: messageContent.type || 'TEXT',
        sentAt: newMessage.sentAt,
        customerPhoneNumber: from,
      });

      // Send session update via SSE
      inboxStreamManager.broadcastSessionUpdate(tenantId, {
        id: chatSession.id,
        customerPhoneNumber: from,
        customerName: chatSession.customerName,
        lastMessageAt: chatSession.lastMessageAt,
        lastMessagePreview: chatSession.lastMessagePreview,
        unreadCount: chatSession.unreadCount,
      });

      // Phase 10: Basic Chatbot Logic - Handle simple commands first
      const tenantInfo = { tenantId, whatsappAccountId, businessPhoneNumber: '' };
      const messageHandlerResult = await handleMessage(value, tenantInfo, chatSession.id);

      // If basic command handler didn't trigger, fall back to database-driven chatbot rules
      if (!messageHandlerResult.triggered) {
        const chatbotResult = await processChatbotRules(
          tenantId,
          whatsappAccountId,
          chatSession.id,
          messageContent.content
        );

        if (chatbotResult.triggered) {
          // Send bot message via SSE
          inboxStreamManager.broadcastNewMessage(tenantId, {
            id: chatbotResult.messageId,
            chatSessionId: chatSession.id,
            direction: 'OUTBOUND',
            content: chatbotResult.response,
            messageType: 'TEXT',
            sentAt: new Date().toISOString(),
          });
        }
      }
    }
  } catch (error) {
    console.error('[WEBHOOK_INBOUND] Error in processInboundMessage:', error instanceof Error ? error.stack : error);
  }
}

function extractMessageContent(message: WhatsAppMessage): { type: string; content: string } {
  // Extract text message
  if (message.text?.body) {
    return { type: 'TEXT', content: message.text.body };
  }

  // Extract image message
  if (message.image) {
    return { type: 'IMAGE', content: '[Image]' };
  }

  // Extract document message
  if (message.document) {
    return { type: 'DOCUMENT', content: message.document.filename || '[Document]' };
  }

  // Extract audio message
  if (message.audio) {
    return { type: 'AUDIO', content: '[Audio]' };
  }

  // Extract video message
  if (message.video) {
    return { type: 'VIDEO', content: '[Video]' };
  }

  // Extract location message
  if (message.location) {
    return { type: 'LOCATION', content: `[Location: ${message.location.latitude}, ${message.location.longitude}]` };
  }

  // Extract contact message
  if (message.contacts) {
    return { type: 'CONTACT', content: '[Contact]' };
  }

  // Default fallback
  return { type: 'TEXT', content: '[Unsupported message type]' };
}
