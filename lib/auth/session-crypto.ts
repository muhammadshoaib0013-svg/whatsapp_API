// Crypto-only session verification for Edge Runtime (middleware)
// This file does NOT import Prisma or any database-related code

export interface SessionData {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  tenant: {
    id: string;
    slug: string;
    name: string;
    status: string;
    trialEndsAt?: Date;
    subscriptionStatus: string;
  };
  role: string;
}

// Get SESSION_SECRET from environment
const SESSION_SECRET = process.env.SESSION_SECRET || '';

if (!SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is required');
}

// Safe Base64URL encoding/decoding helpers
function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

// HMAC signing for session security using Web Crypto API
async function signSession(data: string): Promise<string> {
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
