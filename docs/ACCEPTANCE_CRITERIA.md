# Acceptance Criteria

This document defines the acceptance criteria for each phase of the WhatsApp Automation SaaS project. Each phase must meet all criteria before moving to the next phase.

---

## Phase 0: Project Scaffold & Architecture Setup

### Required Proof

1. **Project Structure**
   - [ ] All required folders exist: `app/`, `components/`, `components/ui/`, `lib/`, `lib/config/`, `lib/security/`, `lib/validation/`, `lib/whatsapp/`, `prisma/`, `docs/`, `scripts/`
   - [ ] Folder structure matches the specification

2. **Configuration Files**
   - [ ] `package.json` exists with correct dependencies
   - [ ] `tsconfig.json` exists with strict mode enabled
   - [ ] `tailwind.config.ts` exists and configured
   - [ ] `postcss.config.js` exists
   - [ ] `next.config.js` exists
   - [ ] `.eslintrc.json` exists

3. **Environment Variables**
   - [ ] `.env.example` exists with safe placeholders only
   - [ ] No real secrets in `.env.example`
   - [ ] All required environment variables documented

4. **Documentation**
   - [ ] `README.md` exists with project purpose, stack, setup instructions
   - [ ] `docs/PROJECT_ROADMAP.md` exists with phase-wise roadmap
   - [ ] `docs/SECURITY_RULES.md` exists with security guidelines
   - [ ] `docs/ACCEPTANCE_CRITERIA.md` exists

5. **Application Files**
   - [ ] `app/layout.tsx` exists with proper metadata
   - [ ] `app/globals.css` exists with Tailwind directives
   - [ ] `app/page.tsx` exists with professional SaaS landing page
   - [ ] Landing page is mobile responsive
   - [ ] Landing page has "Coming Soon" notice for Phase 0
   - [ ] `app/api/health/route.ts` exists and returns health status

6. **Library Files**
   - [ ] `lib/config/constants.ts` exists with app constants
   - [ ] `lib/security/encryption.ts` exists with placeholder
   - [ ] `lib/validation/schemas.ts` exists with Zod schema
   - [ ] `lib/whatsapp/client.ts` exists with placeholder

7. **Database**
   - [ ] `prisma/schema.prisma` exists with placeholder structure
   - [ ] Database provider set to PostgreSQL

8. **Build & Run**
   - [ ] `npm install` completes successfully
   - [ ] `npm run build` completes successfully
   - [ ] `npm run lint` completes with no errors (or only expected ones)
   - [ ] `npm run type-check` completes with no errors
   - [ ] `npm run dev` starts successfully
   - [ ] Application loads at http://localhost:3000
   - [ ] No console errors in browser
   - [ ] Health check endpoint returns correct JSON

9. **Git Configuration**
   - [ ] `.gitignore` exists and excludes sensitive files
   - [ ] `.env` and `.env.local` in `.gitignore`
   - [ ] `node_modules` in `.gitignore`

### Verification Commands
```bash
npm install
npm run build
npm run lint
npm run type-check
npm run dev
# Then test in browser:
# - http://localhost:3000
# - http://localhost:3000/api/health
```

---

## Phase 1: Authentication & Multi-Tenancy

### Required Proof

1. **Authentication**
   - [ ] NextAuth.js configured and working
   - [ ] User can register with email/password
   - [ ] User can log in with email/password
   - [ ] Session management works correctly
   - [ ] Logout functionality works
   - [ ] Password hashing implemented (bcrypt)

2. **Multi-Tenancy**
   - [ ] Organization model exists in Prisma schema
   - [ ] User can create organization
   - [ ] User can join organization
   - [ ] Tenant context enforced in middleware
   - [ ] All API routes filter by tenant ID

3. **Database Models**
   - [ ] User model with required fields
   - [ ] Organization model with required fields
   - [ ] UserOrganization relationship model
   - [ ] Role field for permissions
   - [ ] Database migrations run successfully

4. **UI Components**
   - [ ] Registration page exists and works
   - [ ] Login page exists and works
   - [ ] Dashboard page exists (protected)
   - [ ] Organization management page exists
   - [ ] All pages are mobile responsive

5. **Security**
   - [ ] Passwords never stored in plain text
   - [ ] Sessions are secure
   - [ ] CSRF protection enabled
   - [ ] Rate limiting on auth endpoints
   - [ ] No tenant data leakage between organizations

6. **Testing**
   - [ ] Can register multiple users
   - [ ] Can create multiple organizations
   - [ ] Users belong to correct organizations
   - [ ] Cannot access other tenants' data
   - [ ] Admin role has elevated permissions

---

## Phase 2: WhatsApp Business API Integration

### Required Proof

1. **API Integration**
   - [ ] WhatsApp API client can connect to Meta Graph API
   - [ ] Can send text messages successfully
   - [ ] Can receive messages via webhook
   - [ ] Webhook verification works
   - [ ] Error handling implemented

2. **Token Security**
   - [ ] Access tokens encrypted at rest (AES-256)
   - [ ] Tokens decrypted only when needed
   - [ ] Tokens never exposed to frontend
   - [ ] Token rotation strategy documented

3. **Credential Storage**
   - [ ] WhatsAppAccount model exists in Prisma
   - [ ] Can store encrypted credentials
   - [ ] Can retrieve and decrypt credentials
   - [ ] Credentials associated with correct tenant

4. **Webhook Handling**
   - [ ] Webhook endpoint receives messages
   - [ ] Webhook signature verified
   - [ ] Messages processed and stored
   - [ ] Webhook errors logged
   - [ ] Rate limiting on webhook endpoint

5. **Message Sending**
   - [ ] API endpoint to send messages
   - [ ] Message queue implemented (if needed)
   - [ ] Message status tracking
   - [ ] Error handling for failed sends
   - [ ] Retry logic for transient failures

6. **Security**
   - [ ] No tokens in frontend code
   - [ ] No tokens in API responses
   - [ ] No tokens in logs
   - [ ] Webhook verify token is secure
   - [ ] All WhatsApp calls server-side only

---

## Phase 3: Conversation Management

### Required Proof

1. **Conversation UI**
   - [ ] Conversation list displays all conversations
   - [ ] Unread count accurate
   - [ ] Can open individual conversation
   - [ ] Message history displays correctly
   - [ ] Can send messages from UI
   - [ ] Real-time message updates work

2. **Message Features**
   - [ ] Message status indicators (sent, delivered, read)
   - [ ] Can mark conversations as read/unread
   - [ ] Can archive conversations
   - [ ] Can delete conversations
   - [ ] Can search conversations

3. **Real-time Updates**
   - [ ] New messages appear without refresh
   - [ ] Message status updates in real-time
   - [ ] Unread counts update automatically
   - [ ] WebSocket or polling implemented correctly

4. **Database**
   - [ ] Conversation model exists
   - [ ] Message model exists
   - [ ] Relationships correct
   - [ ] Indexes for performance
   - [ ] Tenant filtering on all queries

5. **Security**
   - [ ] Can only view own conversations
   - [ ] Cannot access other tenants' conversations
   - [ ] Message content encrypted if sensitive
   - [ ] Audit logging for message access

---

## Phase 4: Contact Management

### Required Proof

1. **Contact CRUD**
   - [ ] Can create contacts
   - [ ] Can edit contacts
   - [ ] Can delete contacts
   - [ ] Can view contact list
   - [ ] Can view contact details

2. **Import/Export**
   - [ ] Can import contacts from CSV
   - [ ] CSV validation works
   - [ ] Can export contacts to CSV
   - [ ] Duplicate detection works
   - [ ] Import error handling

3. **Segmentation**
   - [ ] Can add tags to contacts
   - [ ] Can filter by tags
   - [ ] Can create segments
   - [ ] Segments update automatically

4. **Contact Profiles**
   - [ ] Custom fields supported
   - [ ] Contact history displays
   - [ ] Profile pictures supported
   - [ ] Contact notes feature

5. **Security**
   - [ ] Tenant isolation enforced
   - [ ] PII handled correctly
   - [ ] Data export for GDPR compliance
   - [ ] Data deletion for GDPR compliance

---

## Phase 5: Template Management

### Required Proof

1. **Template Sync**
   - [ ] Templates sync from WhatsApp
   - [ ] Template status updates
   - [ ] Template categories display
   - [ ] Template language support

2. **Template Creation**
   - [ ] Can create message templates
   - [ ] Can add template variables
   - [ ] Can preview templates
   - [ ] Can submit for approval
   - [ ] Approval status tracked

3. **Template Usage**
   - [ ] Can use templates in messages
   - [ ] Variables populate correctly
   - [ ] Template analytics tracked
   - [ ] Template version history

4. **UI Components**
   - [ ] Template list page
   - [ ] Template editor
   - [ ] Template preview
   - [ ] Template analytics

5. **Compliance**
   - [ ] Only approved templates used
   - [ ] Template policy compliance
   - [ ] Template rejection handling

---

## Phase 6: Chatbot Automation

### Required Proof

1. **Bot Builder**
   - [ ] Can create chatbot flows
   - [ ] Can add decision nodes
   - [ ] Can add response nodes
   - [ ] Can test bot flows
   - [ ] Can deploy bots

2. **Triggers**
   - [ ] Keyword triggers work
   - [ ] Welcome message trigger
   - [ ] Default fallback trigger
   - [ ] Custom trigger conditions

3. **Bot Features**
   - [ ] Bot responds to messages
   - [ ] Variables in bot responses
   - [ ] Handoff to human agent
   - [ ] Bot analytics dashboard

4. **Testing**
   - [ ] Can test bot before deployment
   - [ ] Bot preview works
   - [ ] Bot versioning
   - [ ] A/B testing support

---

## Phase 7: Campaign Management

### Required Proof

1. **Campaign Creation**
   - [ ] Can create campaigns
   - [ ] Can select target audience
   - [ ] Can schedule campaigns
   - [ ] Can set campaign limits

2. **Compliance**
   - [ ] Opt-in consent required
   - [ ] Consent tracking works
   - [ ] Rate limiting enforced
   - [ ] Message quotas enforced
   - [ ] Unsubscribe option included

3. **Campaign Execution**
   - [ ] Campaigns send at scheduled time
   - [ ] Message queue processing
   - [ ] Error handling for failed sends
   - [ ] Campaign status updates

4. **Analytics**
   - [ ] Campaign analytics dashboard
   - [ ] Open rates tracked
   - [ ] Click rates tracked
   - [ ] Conversion tracking
   - [ ] ROI calculation

---

## Phase 8: Usage Analytics & Billing

### Required Proof

1. **Usage Tracking**
   - [ ] Messages sent tracked
   - [ ] API calls tracked
   - [ ] Storage usage tracked
   - [ ] Active users tracked

2. **Analytics Dashboard**
   - [ ] Usage charts display
   - [ ] Trends over time
   - [ ] Comparative analytics
   - [ ] Export reports

3. **Billing Integration**
   - [ ] Stripe integration works
   - [ ] Subscription tiers work
   - [ ] Invoice generation
   - [ ] Payment processing
   - [ ] Refund handling

4. **Subscription Management**
   - [ ] Can upgrade/downgrade
   - [ ] Usage alerts
   - [ ] Overage handling
   - [ ] Trial periods

---

## Phase 9: Admin Monitoring & Oversight

### Required Proof

1. **Admin Dashboard**
   - [ ] System overview displays
   - [ ] Tenant list displays
   - [ ] User list displays
   - [ ] System health metrics

2. **Tenant Management**
   - [ ] Can view all tenants
   - [ ] Can suspend tenants
   - [ ] Can delete tenants
   - [ ] Can view tenant usage

3. **Audit Logging**
   - [ ] All actions logged
   - [ ] Audit log viewer
   - [ ] Log search/filter
   - [ ] Log export

4. **Monitoring**
   - [ ] System health monitoring
   - [ ] Error tracking
   - [ ] Performance metrics
   - [ ] Alert system

---

## Phase 10: Production Readiness

### Required Proof

1. **Performance**
   - [ ] Page load times < 2s
   - [ ] API response times < 500ms
   - [ ] Database queries optimized
   - [ ] Caching implemented
   - [ ] CDN configured

2. **Security**
   - [ ] Security audit passed
   - [ ] Penetration testing completed
   - [ ] Vulnerabilities addressed
   - [ ] SSL/TLS configured
   - [ ] DDoS protection

3. **Testing**
   - [ ] Unit tests > 80% coverage
   - [ ] Integration tests pass
   - [ ] E2E tests pass
   - [ ] Load testing completed
   - [ ] Security testing completed

4. **Deployment**
   - [ ] CI/CD pipeline functional
   - [ ] Deployment documentation complete
   - [ ] Rollback procedure documented
   - [ ] Monitoring configured
   - [ ] Backup system configured
   - [ ] Disaster recovery plan

5. **Documentation**
   - [ ] API documentation complete
   - [ ] User documentation complete
   - [ ] Admin documentation complete
   - [ ] Deployment documentation complete
   - [ ] Troubleshooting guide

---

## General Acceptance Criteria (All Phases)

### Security
- [ ] No hardcoded secrets
- [ ] No tokens exposed to frontend
- [ ] Tenant isolation enforced
- [ ] Input validation on all endpoints
- [ ] Authentication required on sensitive routes
- [ ] Rate limiting implemented
- [ ] No sensitive data in logs

### Quality
- [ ] Code follows TypeScript best practices
- [ ] ESLint passes with no errors
- [ ] TypeScript compilation succeeds
- [ ] No console errors in browser
- [ ] Mobile responsive design
- [ ] Accessible (WCAG 2.1 AA)

### Documentation
- [ ] Code comments where complex
- [ ] README updated for phase
- [ ] API documentation updated
- [ ] Database schema documented
- [ ] Environment variables documented

### Testing
- [ ] Manual testing completed
- [ ] Edge cases tested
- [ ] Error handling tested
- [ ] Performance acceptable
- [ ] Security reviewed

---

## Sign-off Process

Each phase requires:

1. Developer self-review against criteria
2. Automated tests pass
3. Manual testing completed
4. Security review completed
5. Documentation updated
6. Demo/walkthrough for stakeholders
7. Formal sign-off before proceeding to next phase
