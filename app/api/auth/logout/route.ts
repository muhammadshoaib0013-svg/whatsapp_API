import { NextResponse } from 'next/server';
import { getSession, clearSessionCookie } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { AuditAction } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    
    // If we had a session, log the logout
    if (session) {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          tenantId: session.tenant.id,
          action: 'LOGOUT',
          metadata: {
            email: session.user.email,
          },
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      });
    }
    
    // Clear the cookie using the helper
    const response = NextResponse.json(
      { message: 'Logout successful' },
      { status: 200 }
    );
    
    clearSessionCookie(response);
    
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
