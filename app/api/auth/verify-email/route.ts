import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { setSessionCookie } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code } = body;

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and code are required' },
        { status: 400 }
      );
    }

    // Step 1: Find the VerificationToken by email and token
    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: email,
        token: code,
      },
      include: {
        user: true,
      },
    });

    // Step 2: If not found, or expired, return 401 "Invalid or expired code"
    if (!verificationToken || !verificationToken.user) {
      return NextResponse.json(
        { error: 'Invalid or expired code' },
        { status: 401 }
      );
    }

    // Check if expired
    if (verificationToken.expires < new Date()) {
      return NextResponse.json(
        { error: 'Invalid or expired code' },
        { status: 401 }
      );
    }

    // Step 3: If valid, find the User and update emailVerified = new Date()
    await prisma.user.update({
      where: { id: verificationToken.user.id },
      data: { emailVerified: new Date() },
    });

    // Step 4: Delete the VerificationToken (so it can't be reused)
    await prisma.verificationToken.delete({
      where: { id: verificationToken.id },
    });

    // Step 5: Create the session cookie (log them in)
    const response = NextResponse.json(
      {
        message: 'Email verified successfully',
        redirectUrl: '/dashboard/billing?new=true',
      },
      { status: 200 }
    );

    await setSessionCookie(response, {
      user: {
        id: verificationToken.user.id,
        email: verificationToken.user.email,
        name: verificationToken.user.name,
      },
      tenant: {
        id: '',
        slug: '',
        name: '',
        status: 'PENDING',
        trialEndsAt: undefined,
        subscriptionStatus: 'PENDING',
      },
      role: 'OWNER',
    });

    // Step 6: Return 200 with redirect URL /dashboard/billing?new=true
    return response;
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
