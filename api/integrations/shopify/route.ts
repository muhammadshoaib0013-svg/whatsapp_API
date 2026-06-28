import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/security/encryption';
import { sendTemplateMessage } from '@/lib/whatsapp/cloud-api';
import crypto from 'crypto';

const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;

interface ShopifyOrderPayload {
  id: number;
  order_number: string;
  customer: {
    phone?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
  };
  financial_status: string;
  fulfillment_status?: string;
  created_at: string;
}

/**
 * Verify Shopify webhook signature using HMAC SHA256
 */
function verifyShopifyWebhook(rawBody: string, shopifyHmac: string): boolean {
  if (!SHOPIFY_API_SECRET) {
    console.warn('[SHOPIFY_WEBHOOK] SHOPIFY_API_SECRET not configured');
    return false;
  }

  const hmac = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(rawBody, 'utf8')
    .digest('base64');

  const calculatedHmac = Buffer.from(hmac, 'utf8').toString('base64');
  const providedHmac = Buffer.from(shopifyHmac, 'utf8').toString('base64');

  return crypto.timingSafeEqual(
    Buffer.from(calculatedHmac),
    Buffer.from(providedHmac)
  );
}

/**
 * Extract phone number from Shopify customer data
 * Handles various formats (with/without country code, spaces, dashes)
 */
function extractPhoneNumber(phone: string | undefined): string | null {
  if (!phone) return null;

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // Ensure it's a valid phone number (at least 10 digits)
  if (cleaned.length < 10) return null;

  // Add country code if missing (assuming +1 for US/Canada as default)
  if (cleaned.length === 10) {
    return `1${cleaned}`;
  }

  return cleaned;
}

/**
 * Shopify Webhook Handler
 * Handles order_created and order_fulfilled events
 */
export async function POST(request: NextRequest) {
  try {
    const shopifyTopic = request.headers.get('x-shopify-topic');
    const shopifyHmac = request.headers.get('x-shopify-hmac-sha256');
    const shopifyShop = request.headers.get('x-shopify-shop-domain');

    if (!shopifyTopic || !shopifyHmac) {
      console.error('[SHOPIFY_WEBHOOK] Missing required headers');
      return NextResponse.json(
        { error: 'Missing required headers' },
        { status: 400 }
      );
    }

    // Get raw body for signature verification
    const rawBody = await request.text();

    // Verify webhook signature
    if (!verifyShopifyWebhook(rawBody, shopifyHmac)) {
      console.error('[SHOPIFY_WEBHOOK] Invalid signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse payload
    const payload: ShopifyOrderPayload = JSON.parse(rawBody);

    // Extract phone number
    const phoneNumber = extractPhoneNumber(payload.customer.phone);
    if (!phoneNumber) {
      console.warn('[SHOPIFY_WEBHOOK] No valid phone number found');
      return NextResponse.json({ success: true, message: 'No phone number' });
    }

    // Find tenant by Shopify shop domain (simplified - using tenant name/slug for now)
    // In production, you'd want to add a dedicated shopifyShopDomain field to Tenant model
    const tenant = await prisma.tenant.findFirst({
      where: {
        slug: shopifyShop?.replace('.myshopify.com', ''), // Use shop name as tenant slug
      },
    });

    if (!tenant) {
      console.warn('[SHOPIFY_WEBHOOK] No tenant found for shop:', shopifyShop);
      return NextResponse.json({ success: true, message: 'Tenant not found' });
    }

    // Get WhatsApp account for tenant
    const whatsappAccount = await prisma.whatsappAccount.findFirst({
      where: {
        tenantId: tenant.id,
      },
    });

    if (!whatsappAccount) {
      console.warn('[SHOPIFY_WEBHOOK] No WhatsApp account for tenant');
      return NextResponse.json({ success: true, message: 'No WhatsApp account' });
    }

    // Determine template based on event type
    let templateName = '';
    let templateVariables: Record<string, string> = {};

    if (shopifyTopic === 'orders/create') {
      templateName = 'order_confirmed';
      templateVariables = {
        order_name: payload.order_number,
        customer_name: payload.customer.first_name || 'Customer',
      };
    } else if (shopifyTopic === 'orders/fulfilled') {
      templateName = 'order_shipped';
      templateVariables = {
        order_name: payload.order_number,
        customer_name: payload.customer.first_name || 'Customer',
      };
    } else {
      return NextResponse.json({ success: true, message: 'Unsupported topic' });
    }

    // Find template by name
    const template = await prisma.whatsAppTemplate.findFirst({
      where: {
        tenantId: tenant.id,
        name: templateName,
        status: 'APPROVED',
      },
    });

    if (!template) {
      console.warn('[SHOPIFY_WEBHOOK] Template not found:', templateName);
      return NextResponse.json({ success: true, message: 'Template not found' });
    }

    // Decrypt access token
    const accessToken = await decrypt(whatsappAccount.encryptedAccessToken);

    // Send template message
    const metaMessageId = await sendTemplateMessage(
      whatsappAccount.phoneNumberId,
      phoneNumber,
      template.name,
      template.language,
      [], // No components for simple templates
      accessToken,
      whatsappAccount.graphApiVersion
    );

    // Log message to database
    await prisma.message.create({
      data: {
        tenantId: tenant.id,
        whatsappAccountId: whatsappAccount.id,
        chatSessionId: '', // No chat session for one-time notifications
        direction: 'OUTBOUND',
        content: `Template: ${template.name}`,
        messageType: 'TEMPLATE',
        status: 'SENT',
        metaMessageId: metaMessageId,
        sentAt: new Date(),
        metadata: {
          source: 'shopify_webhook',
          shopifyTopic: shopifyTopic,
          orderId: payload.id.toString(),
          orderNumber: payload.order_number,
        },
      },
    });

    return NextResponse.json({ success: true, metaMessageId });
  } catch (error) {
    console.error('[SHOPIFY_WEBHOOK] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
