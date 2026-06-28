interface SessionData {
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
  };
  role: string;
}

/**
 * Check if the current session belongs to a SUPER_ADMIN
 * @param session - The session data object
 * @returns true if the user is a SUPER_ADMIN, false otherwise
 */
export function isSuperAdmin(session: SessionData | null): boolean {
  if (!session) {
    return false;
  }
  return session.role === 'SUPER_ADMIN';
}

/**
 * Require SUPER_ADMIN access
 * Throws an error if the user is not a SUPER_ADMIN
 * @param session - The session data object
 * @throws Error if the user is not a SUPER_ADMIN
 */
export function requireSuperAdmin(session: SessionData | null): void {
  if (!session) {
    throw new Error('Unauthorized: No session found');
  }

  if (session.role !== 'SUPER_ADMIN') {
    throw new Error('Forbidden: SUPER_ADMIN access required');
  }
}

/**
 * Get a redirect response for unauthorized access to admin routes
 * @returns NextResponse with redirect to dashboard
 */
export function getAdminRedirectResponse() {
  return new Response(
    JSON.stringify({ error: 'Forbidden: SUPER_ADMIN access required' }),
    {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
