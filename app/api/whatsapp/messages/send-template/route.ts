import { NextResponse } from 'next/server';
import { getSession, DatabaseUnavailableError } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import {
  getWhatsAppAccountForTenant,
  decryptWhatsAppTokenSafely,
  sendTemplateMessage,
  normalizeMetaError,
} from '@/lib/whatsapp/cloud-api';
import { whatsappRateLimiter, checkRateLimit, getRateLimitIdentifier } from '@/lib/security/rate-limiter';
import { enforceUsageLimit } from '@/lib/billing/check-usage';

export const dynamic = 'force-dynamic';

const sendMessageSchema = z.object({
  templateId: z.string().min(1, 'Template ID is required'),
  toPhoneNumber: z
    .string()
    .min(1, 'Phone number is required')
    .regex(/^\+[1-9]\d{1,14}$/, 'Invalid phone number format. Use E.164 format, for example +923001234567'),
  language: z.string().optional(),
  variables: z.record(z.string()).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Apply rate limiting
    const identifier = getRateLimitIdentifier(request);
    const rateLimitResult = await checkRateLimit(whatsappRateLimiter, identifier);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: 'Too many message send attempts. Please try again later.',
          retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000),
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '30',
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.reset).toISOString(),
            'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    const body = await request.json();
    const validationResult = sendMessageSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { templateId, toPhoneNumber, language, variables } = validationResult.data;

    // Check usage limit before sending message
    try {
      await enforceUsageLimit(session.tenant.id);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Message limit exceeded for your plan' },
        { status: 402 }
      );
    }

    const account = await getWhatsAppAccountForTenant(session.tenant.id);

    const template = await prisma.whatsAppTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found by database id.' },
        { status: 404 }
      );
    }

    if (template.tenantId !== session.tenant.id) {
      return NextResponse.json(
        { error: 'Template does not belong to current tenant.' },
        { status: 403 }
      );
    }

    if (template.whatsappAccountId !== account.id) {
      return NextResponse.json(
        { error: 'Template does not belong to the connected WhatsApp account.' },
        { status: 403 }
      );
    }

    const normalizedStatus = String(template.status).trim().toUpperCase();

    if (normalizedStatus !== 'APPROVED') {
      return NextResponse.json(
        { error: `Template is not approved. Current status: ${template.status}` },
        { status: 400 }
      );
    }

    let accessToken: string;

    try {
      accessToken = await decryptWhatsAppTokenSafely(account.encryptedAccessToken);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to decrypt access token' },
        { status: 500 }
      );
    }

    // For hello_world with no variables, send empty components array
    // Meta API requires specific component structure with parameters array for variables
    // If no variables are provided, don't send components to avoid structure errors
    const hasVariables = variables && Object.keys(variables).length > 0;
    const components: any[] = hasVariables ? [] : [];
    
    if (hasVariables) {
      // Build proper Meta API component structure with parameters
      const bodyParams = Object.entries(variables).map(([key, value]) => ({
        type: 'text',
        text: value as string,
      }));
      
      components.push({
        type: 'body',
        parameters: bodyParams,
      });
    }

    const messageLog = await prisma.whatsAppMessageLog.create({
      data: {
        tenantId: session.tenant.id,
        whatsappAccountId: account.id,
        templateId: template.id,
        toPhoneNumber,
        messageType: 'template',
        status: 'PENDING',
        requestJson: {
          templateName: template.name,
          language: language || template.language,
          components,
          to: toPhoneNumber,
        },
      },
    });

    let metaMessageId: string;
    try {
      metaMessageId = await sendTemplateMessage(
        account.phoneNumberId,
        toPhoneNumber,
        template.name,
        language || template.language,
        components,
        accessToken,
        account.graphApiVersion
      );
    } catch (error) {
      const safeError = normalizeMetaError(error);
      
      await prisma.whatsAppMessageLog.update({
        where: { id: messageLog.id },
        data: {
          status: 'FAILED',
          errorMessage: safeError,
          responseJson: { error: safeError },
        },
      });

      return NextResponse.json(
        { error: safeError },
        { status: 400 }
      );
    }

    await prisma.whatsAppMessageLog.update({
      where: { id: messageLog.id },
      data: {
        status: 'SENT',
        metaMessageId,
        sentAt: new Date(),
        responseJson: { success: true, messageId: metaMessageId },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.tenant.id,
        action: 'MESSAGE_SENT',
        whatsappAccountId: account.id,
        metadata: {
          templateId: template.id,
          templateName: template.name,
          toPhoneNumber,
          metaMessageId,
        },
      },
    });

    return NextResponse.json(
      {
        message: 'Template message sent successfully',
        metaMessageId,
        templateName: template.name,
        toPhoneNumber,
        sentAt: new Date(),
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json(
        { error: 'Database temporarily unavailable. Please retry.' },
        { status: 503 }
      );
    }
    
    console.error('Send template route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}