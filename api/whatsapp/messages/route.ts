import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

// Force dynamic route to avoid static generation issues
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (limit > 100) {
      return NextResponse.json(
        { error: 'Limit cannot exceed 100' },
        { status: 400 }
      );
    }

    const messageLogs = await prisma.whatsAppMessageLog.findMany({
      where: { tenantId: session.tenant.id },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            language: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.whatsAppMessageLog.count({
      where: { tenantId: session.tenant.id },
    });

    return NextResponse.json(
      {
        messages: messageLogs.map((log) => ({
          id: log.id,
          templateName: log.template?.name || 'Unknown',
          templateLanguage: log.template?.language || 'en',
          toPhoneNumber: log.toPhoneNumber,
          messageType: log.messageType,
          status: log.status,
          metaMessageId: log.metaMessageId,
          errorMessage: log.errorMessage,
          createdAt: log.createdAt,
          sentAt: log.sentAt,
        })),
        total,
        limit,
        offset,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get message logs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
