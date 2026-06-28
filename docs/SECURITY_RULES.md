# Security Rules

## Overview

This document outlines the critical security rules that MUST be followed throughout the development of the WhatsApp Automation SaaS platform. Violation of these rules is unacceptable and poses serious security risks.

---

## 1. Secrets Management

### ❌ FORBIDDEN
- Hardcoding any secrets in source code
- Committing secrets to version control
- Storing secrets in frontend code
- Sharing secrets via chat, email, or unencrypted channels

### ✅ REQUIRED
- All secrets must be in environment variables
- Use `.env.example` as a template only (never with real values)
- Add `.env` and `.env.local` to `.gitignore`
- Use different secrets for development, staging, and production
- Rotate secrets periodically

### Secrets That Must Never Be Hardcoded
- Database passwords
- API keys (Meta, Stripe, etc.)
- Access tokens (WhatsApp, OAuth)
- App secrets
- Webhook secrets
- Encryption keys
- NextAuth secrets
- Any third-party service credentials

---

## 2. Token Security

### ❌ FORBIDDEN
- Exposing WhatsApp/Meta access tokens to the frontend
- Sending tokens in API responses to clients
- Storing tokens in plain text in the database
- Logging tokens in any format
- Including tokens in error messages

### ✅ REQUIRED
- All WhatsApp access tokens must be encrypted at rest (AES-256)
- Tokens must only be used server-side
- Decrypt tokens only when needed for API calls
- Never include tokens in logs or error messages
- Implement token rotation strategy
- Use short-lived tokens when possible

### Token Storage Architecture
```
Database: Encrypted token (AES-256)
    ↓ (decrypt only when needed)
Server-side API call to WhatsApp
    ↓ (use token in memory only)
Response from WhatsApp
    ↓ (clear from memory)
```

---

## 3. Tenant Isolation

### ❌ FORBIDDEN
- Cross-tenant data access
- Sharing data between organizations
- Using global queries without tenant filtering
- Exposing one tenant's data to another

### ✅ REQUIRED
- Every database query MUST include tenant filtering
- Implement row-level security (RLS) in database
- Add middleware to enforce tenant context
- Validate tenant ownership on every API request
- Log all cross-tenant access attempts (should never happen)

### Implementation Pattern
```typescript
// ❌ WRONG - No tenant filtering
const messages = await prisma.message.findMany();

// ✅ CORRECT - Always filter by tenant
const messages = await prisma.message.findMany({
  where: {
    organizationId: currentOrganizationId,
  },
});
```

---

## 4. WhatsApp API Security

### ❌ FORBIDDEN
- Using unofficial WhatsApp Web QR automation
- Using unofficial WhatsApp libraries
- Bypassing Meta's rate limits
- Sending messages without opt-in consent
- Implementing spam tools

### ✅ REQUIRED
- Use ONLY the official Meta Graph API for WhatsApp Business
- Follow WhatsApp Business API policies
- Implement rate limiting
- Require opt-in consent for marketing messages
- Respect message quality ratings
- Implement proper error handling for API failures

### Webhook Security
- Verify webhook signatures from Meta
- Use a secure, random verify token
- Validate all incoming webhook data
- Rate limit webhook endpoints
- Log webhook processing for audit

---

## 5. Authentication & Authorization

### ❌ FORBIDDEN
- Storing passwords in plain text
- Using weak password hashing
- Skipping authentication on sensitive endpoints
- Elevating privileges without proper checks

### ✅ REQUIRED
- Use strong password hashing (bcrypt, argon2)
- Implement secure session management
- Use HTTPS in production
- Implement CSRF protection
- Add rate limiting to authentication endpoints
- Implement proper logout and session invalidation
- Use role-based access control (RBAC)

---

## 6. Input Validation

### ❌ FORBIDDEN
- Trusting client-side input
- Skipping validation on API endpoints
- Using unvalidated data in database queries
- Displaying unescaped user input

### ✅ REQUIRED
- Validate all input using Zod schemas
- Sanitize all user input
- Use parameterized queries (Prisma handles this)
- Escape all output to prevent XSS
- Validate file uploads (type, size, content)
- Implement rate limiting on all endpoints

---

## 7. API Security

### ❌ FORBIDDEN
- Exposing internal API structure
- Returning detailed error messages to clients
- Skipping CORS configuration
- Exposing API keys in frontend code

### ✅ REQUIRED
- Implement proper CORS configuration
- Use API rate limiting
- Return generic error messages to clients
- Log detailed errors server-side only
- Implement API versioning
- Use authentication on all API endpoints (except public ones)

---

## 8. Database Security

### ❌ FORBIDDEN
- Using database credentials with excessive privileges
- Storing sensitive data in plain text
- Skipping database backups
- Exposing database to public internet

### ✅ REQUIRED
- Use least-privilege database users
- Encrypt sensitive data at rest
- Implement regular database backups
- Use database connection pooling
- Enable database query logging
- Implement database migration versioning

---

## 9. Logging & Monitoring

### ❌ FORBIDDEN
- Logging sensitive data (tokens, passwords, PII)
- Storing logs indefinitely without rotation
- Exposing logs to unauthorized users

### ✅ REQUIRED
- Log all security-relevant events
- Implement log rotation
- Monitor for suspicious activity
- Set up alerts for security events
- Regularly review logs for anomalies
- Never log secrets or sensitive PII

### Events to Log
- Failed authentication attempts
- Unauthorized access attempts
- Token decryption/encryption operations
- Cross-tenant access attempts (should never happen)
- API errors and failures
- Webhook processing

---

## 10. Compliance & Legal

### ❌ FORBIDDEN
- Violating WhatsApp Business API policies
- Sending messages without consent
- Ignoring data protection laws (GDPR, CCPA)
- Storing data longer than necessary

### ✅ REQUIRED
- Follow WhatsApp Business API terms of service
- Implement opt-in consent tracking
- Provide data export/deletion capabilities (GDPR)
- Implement data retention policies
- Comply with regional data protection laws
- Maintain privacy policy and terms of service

---

## Security Checklist

Before deploying any code, verify:

- [ ] No secrets hardcoded in source
- [ ] All environment variables documented in `.env.example`
- [ ] Tokens encrypted at rest
- [ ] Tenant isolation enforced on all queries
- [ ] Input validation on all endpoints
- [ ] Authentication required on sensitive endpoints
- [ ] Rate limiting implemented
- [ ] HTTPS enforced in production
- [ ] CORS properly configured
- [ ] No sensitive data in logs
- [ ] Database backups configured
- [ ] Monitoring and alerting set up

---

## Incident Response

If a security incident is discovered:

1. Immediately stop the affected service
2. Rotate all exposed secrets
3. Investigate the scope of the breach
4. Notify affected users if required
5. Document the incident and response
6. Implement preventive measures
7. Review and update security procedures

---

## References

- [Meta Security Best Practices](https://developers.facebook.com/docs/security/)
- [WhatsApp Business API Policy](https://developers.facebook.com/docs/whatsapp/policy)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [GDPR Compliance](https://gdpr.eu/)
