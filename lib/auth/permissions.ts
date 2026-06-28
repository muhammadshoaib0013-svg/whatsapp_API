import { UserRole } from '@prisma/client';
import { getSession } from './session';

/**
 * Role hierarchy for permission checking
 * Higher roles can do everything lower roles can do
 */
const ROLE_HIERARCHY: Record<string, number> = {
  SUPER_ADMIN: 4,
  OWNER: 3,
  ADMIN: 2,
  AGENT: 1,
};

/**
 * Check if a user has the required role or higher
 * @param userRole The user's current role
 * @param requiredRoles Array of roles that are allowed
 * @returns true if user has permission, false otherwise
 */
export function hasPermission(userRole: string, requiredRoles: string[]): boolean {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  
  // Check if user's role level is >= any of the required role levels
  return requiredRoles.some(requiredRole => {
    const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
    return userLevel >= requiredLevel;
  });
}

/**
 * Check if a user has a specific role (exact match)
 * @param userRole The user's current role
 * @param requiredRole The required role
 * @returns true if user has the exact role, false otherwise
 */
export function hasExactRole(userRole: string, requiredRole: string): boolean {
  return userRole === requiredRole;
}

/**
 * Middleware helper to check permissions in API routes
 * Throws an error if user doesn't have permission
 * @param requiredRoles Array of roles that are allowed
 * @throws Error with 403 status if permission denied
 */
export async function requirePermission(requiredRoles: string[]): Promise<void> {
  const session = await getSession();
  
  if (!session) {
    throw new Error('Unauthorized');
  }
  
  const userRole = session.role;
  
  if (!hasPermission(userRole, requiredRoles)) {
    throw new Error('Forbidden: Insufficient permissions');
  }
}

/**
 * Helper to check if user is OWNER or ADMIN
 * Common use case for settings/billing access
 */
export async function requireOwnerOrAdmin(): Promise<void> {
  await requirePermission(['OWNER', 'ADMIN']);
}

/**
 * Helper to check if user is OWNER only
 * Common use case for critical operations
 */
export async function requireOwnerOnly(): Promise<void> {
  await requirePermission(['OWNER']);
}

/**
 * Get user-friendly role name
 */
export function getRoleName(role: string): string {
  const roleNames: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    OWNER: 'Owner',
    ADMIN: 'Admin',
    AGENT: 'Agent',
  };
  return roleNames[role] || role;
}

/**
 * Check if role can manage team members
 * Only OWNER and ADMIN can invite/manage other team members
 */
export function canManageTeamMembers(role: string): boolean {
  return hasPermission(role, ['OWNER', 'ADMIN']);
}

/**
 * Check if role can access billing
 * Only OWNER and ADMIN can access billing
 */
export function canAccessBilling(role: string): boolean {
  return hasPermission(role, ['OWNER', 'ADMIN']);
}

/**
 * Check if role can access settings
 * Only OWNER and ADMIN can access settings
 */
export function canAccessSettings(role: string): boolean {
  return hasPermission(role, ['OWNER', 'ADMIN']);
}
