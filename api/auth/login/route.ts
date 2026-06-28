import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { loginSchema } from '@/lib/validation/schemas';
import { AuditAction } from '@prisma/client';
import { setSessionCookie } from '@/lib/auth/session';
import { authRateLimiter, checkRateLimit, getRateLimitIdentifier } from '@/lib/security/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const identifier = getRateLimitIdentifier(request);
    const rateLimitResult = await checkRateLimit(authRateLimiter, identifier);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: 'Too many login attempts. Please try again later.',
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
    const validatedData = loginSchema.parse(body);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
      include: {
        teamMembers: {
          include: {
            tenant: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify password hash
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const passwordMatch = await bcrypt.compare(validatedData.password, user.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Get the first team member (user can belong to multiple tenants)
    const teamMember = user.teamMembers[0];
    if (!teamMember) {
      return NextResponse.json(
        { error: 'No tenant found for this user' },
        { status: 401 }
      );
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        tenantId: teamMember.tenantId,
        action: 'LOGIN',
        metadata: {
          email: validatedData.email,
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    // Determine redirect URL based on role
    const redirectUrl = teamMember.role === 'SUPER_ADMIN' ? '/admin/dashboard' : '/dashboard';

    // Create response and set cookie
    const response = NextResponse.json(
      {
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        tenant: {
          id: teamMember.tenant.id,
          slug: teamMember.tenant.slug,
          name: teamMember.tenant.name,
          status: teamMember.tenant.status,
        },
        role: teamMember.role,
        redirectUrl,
      },
      { status: 200 }
    );

    // Set session cookie using the helper
    await setSessionCookie(response, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      tenant: {
        id: teamMember.tenant.id,
        slug: teamMember.tenant.slug,
        name: teamMember.tenant.name,
        status: teamMember.tenant.status,
        trialEndsAt: teamMember.tenant.trialEndsAt || undefined,
        subscriptionStatus: teamMember.tenant.subscriptionStatus,
      },
      role: teamMember.role,
    });

    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid input data' },
        { status: 400 }
      );
    }

    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
