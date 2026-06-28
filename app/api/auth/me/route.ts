import { NextResponse } from 'next/server';
import { getSession, DatabaseUnavailableError } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      {
        user: session.user,
        tenant: session.tenant,
        role: session.role,
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
    
    console.error('Get current user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
