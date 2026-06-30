import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

// Custom error for database unavailability
export class DatabaseUnavailableError extends Error {
  constructor(message: string = 'Database temporarily unavailable') {
    super(message);
    this.name = 'DatabaseUnavailableError';
  }
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
}

export interface SessionTenant {
  id: string;
  slug: string;
  name: string;
  status: string;
  trialEndsAt?: Date;
  subscriptionStatus: string;
}

export interface SessionData {
  user: SessionUser;
  tenant: SessionTenant;
  role: string;
}

const SESSION_COOKIE_NAME = 'session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// Get SESSION_SECRET from environment (checked at runtime, not build time)
const SESSION_SECRET = process.env.SESSION_SECRET || '';

// Safe Base64URL encoding/decoding helpers
function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

// HMAC signing for session security using Web Crypto API
async function signSession(data: string): Promise<string> {
  if (!SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is required');
  }
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  );
  // Convert ArrayBuffer to hex string
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifySignature(data: string, signature: string): Promise<boolean> {
  const expectedSignature = await signSession(data);
  
  // timingSafeEqual equivalent for strings
  if (signature.length !== expectedSignature.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  return result === 0;
}

// Create a signed session value using Base64URL encoding
// Format: base64url(payload).signature
export async function createSignedSessionValue(data: SessionData): Promise<string> {
  const payload = JSON.stringify(data);
  const base64urlPayload = base64UrlEncode(payload);
  const signature = await signSession(base64urlPayload);
  return `${base64urlPayload}.${signature}`;
}

// Verify and decode a signed session value
// Returns null if invalid or tampered
export async function verifySignedSessionValue(cookieValue: string): Promise<SessionData | null> {
  const parts = cookieValue.split('.');
  if (parts.length !== 2) {
    return null;
  }
  
  const [payload, signature] = parts;
  
  // Verify the signature to detect tampering
  const isValid = await verifySignature(payload, signature);
  if (!isValid) {
    return null;
  }
  
  try {
    const decoded = base64UrlDecode(payload);
    const data = JSON.parse(decoded) as SessionData;
    return data;
  } catch {
    return null;
  }
}

// Set session cookie on a NextResponse object
export async function setSessionCookie(response: NextResponse, data: SessionData): Promise<void> {
  const signedSession = await createSignedSessionValue(data);
  response.cookies.set(SESSION_COOKIE_NAME, signedSession, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
}

// Clear session cookie on a NextResponse object
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}

// Legacy function for backward compatibility (deprecated)
export async function createSession(data: SessionData): Promise<void> {
  const cookieStore = await cookies();
  const signedSession = await createSignedSessionValue(data);
  cookieStore.set(SESSION_COOKIE_NAME, signedSession, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  
  if (!sessionCookie) {
    return null;
  }
  
  try {
    // Verify and decode the signed session value
    const data = await verifySignedSessionValue(sessionCookie.value);
    
    if (!data) {
      cookieStore.delete(SESSION_COOKIE_NAME);
      return null;
    }
    
    // Verify the user still exists in the database
    const user = await prisma.user.findUnique({
      where: { id: data.user.id },
      include: {
        teamMembers: {
          include: {
            tenant: true,
          },
        },
      },
    });
    
    if (!user) {
      cookieStore.delete(SESSION_COOKIE_NAME);
      return null;
    }
    
    // Verify the tenant still exists and user has access
    const teamMember = user.teamMembers.find(
      (tm) => tm.tenantId === data.tenant.id
    );
    
    if (!teamMember) {
      cookieStore.delete(SESSION_COOKIE_NAME);
      return null;
    }
    
    // Return fresh data from database, not from cookie
    // This ensures role/tenant cannot be tampered with
    return {
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
        trialEndsAt: teamMember.tenant.trialEndsAt ?? undefined,
        subscriptionStatus: teamMember.tenant.subscriptionStatus,
      },
      role: teamMember.role,
    };
  } catch (error) {
    // Detect database connection errors (pool timeout, connection refused, etc.)
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isDatabaseError = 
      errorMessage.includes('timeout') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('pool') ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('Timed out fetching a new connection');
    
    if (isDatabaseError) {
      throw new DatabaseUnavailableError('Database temporarily unavailable. Please retry.');
    }
    
    // Invalid session data or signature verification failed
    cookieStore.delete(SESSION_COOKIE_NAME);
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function requireAuth(): Promise<SessionData> {
  const session = await getSession();
  
  if (!session) {
    throw new Error('Unauthorized');
  }
  
  return session;
}
