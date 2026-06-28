import { NextRequest, NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/security/api-auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schema for sending a message
const sendMessageSchema = z.object({
  to: z.string().min(1, 'Phone number is required'),
  templateName: z.string().min(1, 'Template name is required'),
  variables: z.record(z.string()).optional(),
});

/**
 * POST /api/v1/messages/send
 * Send a WhatsApp template message using API key authentication
 * STRICT: Only accepts API Key auth (Bearer token), NOT session cookies
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate using API key (NOT session)
    const { tenantId } = await requireApiKey(request);

    // Validate request body
    const body = await request.json();
    const validationResult = sendMessageSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { to, templateName, variables } = validationResult.data;

    // Get the tenant's WhatsApp account
    const whatsappAccount = await prisma.whatsappAccount.findFirst({
      where: {
        tenantId,
        isActive: true,
      },
    });

    if (!whatsappAccount) {
      return NextResponse.json(
        { error: 'No active WhatsApp account found for this tenant' },
        { status: 400 }
      );
    }

    // Find the template
    const template = await prisma.whatsAppTemplate.findFirst({
      where: {
        tenantId,
        name: templateName,
        status: 'APPROVED',
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found or not approved' },
        { status: 404 }
      );
    }

    // Create the message log entry
    const messageLog = await prisma.whatsAppMessageLog.create({
      data: {
        tenantId,
        whatsappAccountId: whatsappAccount.id,
        toPhoneNumber: to,
        messageType: 'TEMPLATE',
        templateId: template.id,
        status: 'SENT',
        requestJson: {
          to,
          templateName,
          variables: variables || {},
        },
      },
    });

    // In a real implementation, you would send the actual message to WhatsApp API here
    // For now, we'll just return success

    return NextResponse.json({
      success: true,
      messageId: messageLog.id,
      status: 'sent',
      to,
      templateName,
    });
  } catch (error) {
    console.error('[API_V1_SEND] Error:', error);

    if (error instanceof Error && error.message === 'Invalid or missing API key') {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
