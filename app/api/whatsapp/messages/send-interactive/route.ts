import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { DatabaseUnavailableError } from '@/lib/auth/session';
import { decrypt } from '@/lib/security/encryption';

export const dynamic = 'force-dynamic';
import { sendInteractiveMessage } from '@/lib/whatsapp/client';
import { z } from 'zod';

// Zod schema for interactive message validation
const interactiveButtonSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(20, 'Button title must be at most 20 characters'),
});

const interactiveMessageSchema = z.object({
  chatSessionId: z.string().min(1),
  type: z.enum(['button', 'list']),
  bodyText: z.string().min(1).max(1024),
  buttonsJson: z.object({
    buttons: z.array(interactiveButtonSchema).max(3, 'Maximum 3 buttons allowed').optional(),
    button: z.string().max(20).optional(),
    sections: z.array(z.any()).optional(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Validate request body
    const validationResult = interactiveMessageSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { chatSessionId, type, bodyText, buttonsJson } = validationResult.data;

    // Fetch chat session and verify tenant ownership
    const chatSession = await prisma.chatSession.findFirst({
      where: {
        id: chatSessionId,
        tenantId: session.tenant.id,
      },
      include: {
        whatsappAccount: {
          select: {
            id: true,
            phoneNumberId: true,
            encryptedAccessToken: true,
            graphApiVersion: true,
          },
        },
      },
    });

    if (!chatSession) {
      return NextResponse.json(
        { error: 'Chat session not found' },
        { status: 404 }
      );
    }

    if (!chatSession.whatsappAccount) {
      return NextResponse.json(
        { error: 'WhatsApp account not found for this chat session' },
        { status: 400 }
      );
    }

    // Decrypt access token
    const accessToken = await decrypt(chatSession.whatsappAccount.encryptedAccessToken);

    // Send interactive message via Meta API
    const metaMessageId = await sendInteractiveMessage(
      chatSession.whatsappAccount.phoneNumberId,
      chatSession.customerPhoneNumber,
      type,
      bodyText,
      buttonsJson,
      accessToken,
      chatSession.whatsappAccount.graphApiVersion
    );

    // Save message to database
    const message = await prisma.message.create({
      data: {
        tenantId: session.tenant.id,
        whatsappAccountId: chatSession.whatsappAccount.id,
        chatSessionId: chatSessionId,
        direction: 'OUTBOUND',
        content: bodyText,
        messageType: 'INTERACTIVE',
        status: 'SENT',
        metaMessageId: metaMessageId,
        metadata: {
          type,
          buttonsJson,
        },
      },
    });

    // Update chat session last message info
    await prisma.chatSession.update({
      where: { id: chatSessionId },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: bodyText.substring(0, 100),
      },
    });

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        metaMessageId: metaMessageId,
        content: bodyText,
        type: type,
      },
    });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json(
        { error: 'Database temporarily unavailable. Please retry.' },
        { status: 503 }
      );
    }

    console.error('[SEND_INTERACTIVE] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
