import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Get allowed origins from environment
const getAllowedOrigins = () => {
  const productionDomain = process.env.NEXT_PUBLIC_APP_URL;
  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];

  if (productionDomain) {
    allowedOrigins.push(productionDomain);
  }

  // Add Meta's webhook IPs for webhook endpoints
  // Meta's webhook IPs: https://developers.facebook.com/docs/graph-api/webhooks/setup#allowed-ips
  return allowedOrigins;
};

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const origin = request.headers.get('origin');
  const allowedOrigins = getAllowedOrigins();

  // Add CORS headers for API routes
  if (path.startsWith('/api')) {
    const response = NextResponse.next();

    // Allow Meta webhooks without origin check (they don't send Origin header)
    if (path.startsWith('/api/webhooks')) {
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Hub-Signature');
      return response;
    }

    // For other API routes, check origin
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    }
    // Note: Same-origin requests (no Origin header) are handled by browser CORS policy
    // We do not set '*' for non-webhook API routes for security

    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 200, headers: response.headers });
    }

    return response;
  }

  // Allow public routes
  if (path === '/' || path === '/api/health' || path === '/login' || path === '/signup' || path === '/forgot-password' || path === '/reset-password' || path === '/verify-email') {
    return NextResponse.next();
  }

  // Protect dashboard route
  if (path.startsWith('/dashboard')) {
    const sessionCookie = request.cookies.get('session');

    if (!sessionCookie) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Session cookie exists - allow access
    // Full auth validation and trial check happens in app/dashboard/layout.tsx (Node.js runtime)
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
