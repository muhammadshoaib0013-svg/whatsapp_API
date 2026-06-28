# Authentication and Multi-Tenancy Documentation

## Overview

This document explains the authentication strategy, tenant model, role-based access control (RBAC), route protection, and tenant isolation rules implemented in Phase 1 of the WhatsApp Automation SaaS project.

## Auth Strategy

### Choice: Custom Credentials Auth with Future NextAuth.js Integration

**Rationale for Custom Auth in Phase 1:**
- Simpler implementation for initial multi-tenant setup
- Full control over user/tenant creation flow
- Direct integration with custom tenant model
- Easier to understand and debug during development
- NextAuth.js dependencies installed for future migration

**Future Enhancement:**
- NextAuth.js (Auth.js) with Prisma adapter will be integrated in a later phase
- This will provide production-grade session management, OAuth providers, and enhanced security
- The current custom implementation is designed to be easily migrated to NextAuth.js

### Current Implementation (Phase 1.1)

**Authentication Flow:**
1. **Signup**: Users create account with email, password, name, and tenant details
2. **Password Hashing**: Passwords are hashed with bcryptjs (10 rounds) and stored in database
3. **Tenant Creation**: During signup, a new tenant is automatically created with OWNER role
4. **Login**: Users authenticate with email/password using bcrypt.compare for verification
5. **Session**: Secure httpOnly cookie stores session data (user, tenant, role)
6. **Logout**: Clears session cookie and redirects to login

**Security Notes:**
- Passwords are hashed with bcryptjs (10 rounds) and stored as passwordHash
- Session management uses secure httpOnly cookies (httpOnly, secure, sameSite: lax)
- Session cookie expires after 7 days
- Password verification uses bcrypt.compare to reject wrong passwords
- IP address and user agent are logged for audit trail
- No localStorage usage for authentication data
- Server-side middleware protection for dashboard route

## Tenant Model

### Tenant Structure

The tenant model represents a business/organization in the multi-tenant SaaS:

```prisma
model Tenant {
  id        String       @id @default(cuid())
  slug      String       @unique
  name      String
  status    TenantStatus @default(TRIAL)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  teamMembers TeamMember[]
  auditLogs   AuditLog[]
}
```

### Tenant Status

- **TRIAL**: New tenant in trial period (default)
- **ACTIVE**: Paid/active tenant
- **SUSPENDED**: Tenant suspended for violations or non-payment

### Tenant Slug

- Unique identifier for the tenant (URL-friendly)
- Used for tenant identification in URLs and subdomains
- Format: lowercase letters, numbers, and hyphens only
- Example: `acme-inc`, `tech-startup-2024`

## Role Model (RBAC)

### User Roles

```prisma
enum UserRole {
  OWNER
  ADMIN
  AGENT
}
```

### Role Permissions

| Role | Permissions |
|------|-------------|
| **OWNER** | Full access to all tenant resources, can manage team members, billing, and settings |
| **ADMIN** | Can manage most tenant resources except billing and critical settings |
| **AGENT** | Can access assigned resources (conversations, contacts, campaigns) but cannot manage team or settings |

### Team Member Model

```prisma
model TeamMember {
  id        String   @id @default(cuid())
  userId    String
  tenantId  String
  role      UserRole @default(AGENT)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([userId, tenantId])
  @@index([userId])
  @@index([tenantId])
}
```

**Key Features:**
- One user can belong to multiple tenants
- Each user-tenant pair has a specific role
- Cascade delete ensures data consistency
- Unique constraint prevents duplicate memberships

## Route Protection

### Middleware Implementation (Phase 1.1)

```typescript
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Allow public routes
  if (path === '/' || path === '/api/health' || path === '/login' || path === '/signup') {
    return NextResponse.next();
  }

  // Protect dashboard route
  if (path.startsWith('/dashboard')) {
    const sessionCookie = request.cookies.get('session');
    
    if (!sessionCookie) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    
    // The dashboard page will verify the session with the API
    // This middleware just ensures a session cookie exists
    return NextResponse.next();
  }

  // Allow API routes (they handle their own auth)
  if (path.startsWith('/api')) {
    return NextResponse.next();
  }

  return NextResponse.next();
}
```

### Server-Side Protection

**Dashboard Page Protection:**
- Middleware checks for session cookie existence
- Dashboard page fetches session from `/api/auth/me` for verification
- Redirects to `/login` if no session or invalid session
- Displays loading state during authentication check

**API Route Protection:**
- `/api/auth/me` requires valid session cookie
- `/api/auth/logout` clears session cookie
- Other auth endpoints handle their own validation

## Tenant Isolation Rules

### Database-Level Isolation

**Every tenant-owned table includes `tenantId`:**
- TeamMember (links users to tenants)
- AuditLog (tracks actions per tenant)
- Future tables: WhatsAppAccount, Conversation, Message, Contact, Template, Campaign, etc.

**Query Isolation:**
- All queries must filter by `tenantId`
- Backend API routes enforce tenant context
- Prisma queries include tenant filtering

### Backend Authorization

**API Route Protection Pattern:**
```typescript
// Example pattern for future implementation
const session = await getSession();
const teamMember = await prisma.teamMember.findUnique({
  where: {
    userId_tenantId: {
      userId: session.user.id,
      tenantId: session.tenant.id
    }
  }
});

if (!teamMember) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### Frontend Isolation

**UI Hiding vs Backend Enforcement:**
- Frontend UI hides features based on user role
- Backend API enforces actual permissions
- Never rely solely on frontend hiding for security

### Audit Logging

**Audit Actions Tracked:**
- SIGNUP: User registration
- LOGIN: User authentication
- LOGOUT: User logout
- TENANT_CREATED: New tenant creation
- USER_INVITED: Team member invitation
- ROLE_CHANGED: Role modifications

**Audit Log Structure:**
```prisma
model AuditLog {
  id        String     @id @default(cuid())
  userId    String
  tenantId  String
  action    AuditAction
  metadata  Json?
  ipAddress String?
  userAgent String?
  createdAt DateTime   @default(now())

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([tenantId])
  @@index([createdAt])
}
```

## Security Considerations

### Current Implementation (Phase 1.1)

**Strengths:**
- Password hashing with bcryptjs (10 rounds)
- Password verification with bcrypt.compare
- Secure httpOnly cookie session management
- Input validation with Zod schemas
- Audit logging for security events
- Tenant isolation at database schema level
- Role-based access control foundation
- Server-side middleware protection for dashboard
- No localStorage usage for authentication
- Logout endpoint to clear session
- Current user endpoint (/api/auth/me)

**Limitations (to be addressed in future phases):**
- Session signing not implemented (uses simple JSON encoding)
- No CSRF protection
- No rate limiting on auth endpoints
- No email verification
- No password reset flow
- Session data stored in cookie (should use token + database storage in production)

### Future Security Enhancements

1. **NextAuth.js Integration:**
   - Secure session management with httpOnly cookies
   - Built-in CSRF protection
   - OAuth provider support (Google, GitHub, etc.)
   - Email verification flow

2. **Enhanced Password Security:**
   - Password strength requirements
   - Password reset with email tokens
   - Account lockout after failed attempts
   - Two-factor authentication (2FA)

3. **API Security:**
   - Rate limiting on auth endpoints
   - Request signing for sensitive operations
   - API key authentication for programmatic access

4. **Tenant Security:**
   - Tenant context validation on all API routes
   - Data encryption at rest for sensitive tenant data
   - Regular security audits per tenant

## Database Schema Summary

### Core Models

1. **User**: Individual users in the system (includes passwordHash field)
2. **Tenant**: Business/organization entities
3. **TeamMember**: Links users to tenants with roles
4. **Account**: NextAuth.js account model (for future integration)
5. **Session**: NextAuth.js session model (for future integration)
6. **VerificationToken**: NextAuth.js email verification (for future integration)
7. **AuditLog**: Security and compliance tracking

### Relationships

- User → TeamMember (one-to-many)
- Tenant → TeamMember (one-to-many)
- User → Account (one-to-many)
- User → Session (one-to-many)
- User → AuditLog (one-to-many)
- Tenant → AuditLog (one-to-many)

## API Endpoints

### Auth Endpoints

- `POST /api/auth/signup` - Create new user and tenant
- `POST /api/auth/login` - Authenticate user and set session cookie
- `POST /api/auth/logout` - Clear session cookie
- `GET /api/auth/me` - Get current authenticated user info
- `GET /api/health` - Health check (public)

### Future Endpoints

- `POST /api/auth/reset-password` - Password reset
- `POST /api/auth/invite` - Invite team member

## Migration Notes

### Phase 1.1 Migration

**Migration Name:** `init_auth_tenancy`

**Status:** BLOCKED - Requires real PostgreSQL database connection

**What it creates:**
- All tables with proper indexes and constraints
- User model with passwordHash field
- Enum types for UserRole, TenantStatus, AuditAction
- Foreign key relationships with cascade deletes
- Unique constraints for email and tenant slug

**To run migration (when database is available):**
```bash
npx prisma migrate dev --name init_auth_tenancy
```

## Testing Notes

### Manual Testing (Phase 1.1)

**UI Routes Tested:**
- `/` - Home page (working)
- `/api/health` - Health API (working)
- `/login` - Login page (UI working, uses httpOnly cookie session)
- `/signup` - Signup page (UI working, stores password hash)
- `/dashboard` - Dashboard page (UI working, server-side middleware protection)

**Database-Dependent Tests (BLOCKED - require real DB):**
- Full signup flow with database record creation
- Full login flow with password verification
- Dashboard with real user/tenant data
- Audit log creation
- Session cookie verification

### Automated Tests (Future)

Future phases should include:
- Unit tests for auth utilities
- Integration tests for API routes
- E2E tests for auth flows
- Tenant isolation tests
- RBAC permission tests

## Conclusion

Phase 1.1 establishes a secure foundation for authentication and multi-tenancy in the WhatsApp Automation SaaS. The implementation provides:

- Complete database schema for users, tenants, and roles (with passwordHash field)
- Secure auth API endpoints with password hashing and verification
- UI pages for signup, login, and dashboard
- Secure httpOnly cookie session management
- Server-side middleware protection for dashboard
- Tenant isolation at the database level
- RBAC foundation with role definitions
- Audit logging for security tracking
- Logout and current user endpoints
- No localStorage usage for authentication

**Phase 1.1 Status:** Code implementation complete.

**Phase 1.2 Status:** Database migration and full verification COMPLETE - ACCEPTED.

Phase 1.2 successfully completed:
- Database migration applied (init_auth_tenancy)
- All Prisma commands passed (validate, generate, migrate status)
- All quality checks passed (type-check, build, lint)
- Full API endpoint verification (signup, login, logout, /api/auth/me)
- Password hashing and verification verified
- Wrong password rejection verified (401 status)
- httpOnly cookie session management verified
- Server-side middleware protection verified
- No localStorage usage for authentication verified

**Phase 1.3 Status:** Secure signed session fix and browser verification COMPLETE - ACCEPTED.

Phase 1.3 successfully completed:
- Implemented HMAC-SHA256 signed session cookies with timing-safe comparison
- Added SESSION_SECRET environment variable
- Session tampering detection and rejection verified
- Database-backed session validation (role/tenant fetched from database, not trusted from cookie)
- All Prisma commands passed (validate, generate, migrate status)
- All quality checks passed (type-check, build, lint)
- API verification tests passed (signup, login, logout, /api/auth/me, tampered cookie rejection)
- Browser preview available for manual verification
- Console and network error checks passed
- Secret safety verified (SESSION_SECRET not exposed)

**Phase 1 Complete:** Authentication and Multi-Tenancy Foundation is fully locked with secure signed sessions.

The next phase will focus on WhatsApp Business API integration.
