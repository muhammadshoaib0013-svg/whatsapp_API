import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { signupSchema } from '@/lib/validation/schemas';
import { authRateLimiter, checkRateLimit, getRateLimitIdentifier } from '@/lib/security/rate-limiter';
import { sendVerificationEmail } from '@/lib/email/client';

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const identifier = getRateLimitIdentifier(request);
    const rateLimitResult = await checkRateLimit(authRateLimiter, identifier);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: 'Too many signup attempts. Please try again later.',
          retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000),
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.reset).toISOString(),
            'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    const body = await request.json();
    const validatedData = signupSchema.parse(body);

    // Step 1: Check if User exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    let user: any;

    if (existingUser) {
      // If YES and emailVerified is NOT null -> Return 400 "User already exists"
      if (existingUser.emailVerified !== null) {
        return NextResponse.json(
          { error: 'User already exists' },
          { status: 400 }
        );
      }
      // If YES and emailVerified IS null -> Update their passwordHash with the new one
      const passwordHash = await bcrypt.hash(validatedData.password, 10);
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: { 
          passwordHash: passwordHash,
          name: validatedData.name,
        },
      });
    } else {
      // If NO -> Create the User with emailVerified: null
      const passwordHash = await bcrypt.hash(validatedData.password, 10);
      user = await prisma.user.create({
        data: {
          email: validatedData.email,
          name: validatedData.name,
          passwordHash: passwordHash,
          emailVerified: null,
        },
      });
    }

    // Step 2: Generate a 6-digit OTP string
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Step 3: Delete any old VerificationToken for this email, then create a new one
    await prisma.verificationToken.deleteMany({
      where: { identifier: validatedData.email },
    });

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutes expiry

    await prisma.verificationToken.create({
      data: {
        identifier: validatedData.email,
        token: otpCode,
        expires: expiresAt,
        userId: user.id,
      },
    });

    // Step 4: Use Resend to send the email
    try {
      await sendVerificationEmail(validatedData.email, otpCode);
    } catch (error) {
      console.error('[RESEND_ERROR]', error);
      return NextResponse.json(
        { error: 'Failed to send verification email' },
        { status: 500 }
      );
    }

    // Step 5: Return 200 "Verification code sent". DO NOT CREATE A SESSION COOKIE.
    return NextResponse.json(
      {
        message: 'Verification code sent',
        redirectUrl: `/verify-email?email=${encodeURIComponent(validatedData.email)}`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('--- SIGNUP CRASH ERROR ---');
    console.error(error);
    return NextResponse.json({ error: 'Server crash: ' + (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 });
  }
}
