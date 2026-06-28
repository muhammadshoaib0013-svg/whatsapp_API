import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Get authenticated session
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const accountId = params.id;

    // Get the WhatsApp account
    const account = await prisma.whatsappAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'WhatsApp account not found' },
        { status: 404 }
      );
    }

    // Verify tenant ownership
    if (account.tenantId !== session.tenant.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Delete the account
    await prisma.whatsappAccount.delete({
      where: { id: accountId },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.tenant.id,
        action: 'WHATSAPP_ACCOUNT_DELETED',
        metadata: {
          whatsappAccountId: accountId,
          displayName: account.displayName,
        },
      },
    });

    return NextResponse.json(
      { message: 'WhatsApp account deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Delete WhatsApp account error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
