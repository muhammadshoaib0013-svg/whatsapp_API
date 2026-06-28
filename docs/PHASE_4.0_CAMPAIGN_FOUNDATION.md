# Phase 4.0: Campaign Management Foundation

## Overview

Phase 4.0 implements the foundational infrastructure for campaign management in the WhatsApp Automation SaaS platform. This phase focuses on creating the database models, API routes, and frontend UI for managing bulk messaging campaigns, with strict emphasis on tenant isolation, recipient validation, and compliance confirmation.

## Scope

**Included:**
- Database models for campaigns and recipient lists
- API routes for CRUD operations on campaigns (DRAFT status only)
- Frontend UI pages for campaign management
- Recipient validation in E.164 format
- Compliance opt-in confirmation
- Tenant isolation on all data and API queries
- Phone number masking for security

**Explicitly Excluded:**
- Bulk sending of WhatsApp messages
- Campaign scheduling
- Campaign status transitions beyond DRAFT
- Send/start/schedule endpoints
- Background jobs for message delivery
- Chatbot functionality
- Inbox management
- AI replies

## Database Models

### CampaignStatus Enum
```prisma
enum CampaignStatus {
  DRAFT
  READY
  SCHEDULED
  SENDING
  PAUSED
  COMPLETED
  FAILED
  CANCELLED
}
```

### Campaign Model
```prisma
model Campaign {
  id                    String           @id @default(cuid())
  tenantId              String
  whatsappAccountId     String
  templateId            String
  name                  String
  status                CampaignStatus   @default(DRAFT)
  complianceConfirmed   Boolean          @default(false)
  recipientCount         Int              @default(0)
  validRecipientCount    Int              @default(0)
  invalidRecipientCount  Int              @default(0)
  createdByUserId        String
  createdAt             DateTime         @default(now())
  updatedAt             DateTime         @updatedAt
  recipients            CampaignRecipient[]
  tenant                Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  account               WhatsappAccount  @relation(fields: [whatsappAccountId], references: [id], onDelete: Cascade)
  template              WhatsAppTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  createdBy             User             @relation(fields: [createdByUserId], references: [id])

  @@index([tenantId])
  @@index([whatsappAccountId])
  @@index([templateId])
  @@index([createdByUserId])
  @@index([status])
  @@index([createdAt])
}
```

### CampaignRecipient Model
```prisma
model CampaignRecipient {
  id              String   @id @default(cuid())
  campaignId      String
  tenantId        String
  phoneNumber     String
  isValid         Boolean  @default(false)
  validationError String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  campaign        Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@index([campaignId])
  @@index([tenantId])
  @@index([phoneNumber])
  @@index([isValid])
}
```

## API Routes

### GET /api/campaigns
- **Authentication:** Required
- **Tenant Isolation:** Enforced
- **Description:** Fetches all campaigns for the current tenant
- **Response:** Array of campaigns with template, account, and recipient count details

### POST /api/campaigns
- **Authentication:** Required
- **Tenant Isolation:** Enforced
- **Description:** Creates a new campaign in DRAFT status
- **Validation:**
  - Campaign name required
  - WhatsApp account must be connected and belong to tenant
  - Template must be approved and belong to tenant
  - Recipients must be in E.164 format
  - At least one valid recipient required
  - Compliance confirmation required
- **Response:** Created campaign with validation summary

### GET /api/campaigns/[id]
- **Authentication:** Required
- **Tenant Isolation:** Enforced
- **Description:** Fetches a specific campaign by ID
- **Security:** Phone numbers masked in response
- **Response:** Campaign details with recipients (masked phone numbers)

### PUT /api/campaigns/[id]
- **Authentication:** Required
- **Tenant Isolation:** Enforced
- **Description:** Updates an existing campaign
- **Restriction:** Only DRAFT campaigns can be edited
- **Validation:** Same as POST
- **Response:** Updated campaign

### DELETE /api/campaigns/[id]
- **Authentication:** Required
- **Tenant Isolation:** Enforced
- **Description:** Deletes a campaign
- **Restriction:** Only DRAFT campaigns can be deleted
- **Cascade:** Recipients are deleted automatically
- **Response:** Success confirmation

## Frontend Pages

### /dashboard/campaigns
- Campaign list view
- Displays campaign name, template, status, recipient counts
- Status badges with color coding
- Link to create new campaign
- Link to view campaign details

### /dashboard/campaigns/new
- Campaign creation form
- Fields: Campaign name, WhatsApp account, template, recipients (textarea)
- Real-time recipient validation
- Validation results display (valid/invalid/duplicate counts)
- Invalid numbers list with error messages
- Compliance notice and checkbox
- Submit button disabled until valid

### /dashboard/campaigns/[id]
- Campaign detail view
- Campaign information display
- Recipient summary cards (valid/invalid/total)
- Recipient list with phone numbers
- Valid/Invalid status badges
- Edit Draft button (only for DRAFT status)
- Delete Draft button (only for DRAFT status)
- Campaign sending notice (disabled in this phase)

### /dashboard/campaigns/[id]/edit
- Campaign edit form
- Pre-populated with existing data
- Same validation as creation
- Only accessible for DRAFT campaigns
- Compliance confirmation required

## Recipient Validation

### E.164 Format Validation
- Pattern: `^\+[1-9]\d{6,14}$`
- Examples: `+923001234567`, `+14155552671`
- Validation performed on each line of input
- Empty lines skipped
- Duplicates removed and counted

### Validation Results
- Valid count
- Invalid count with error messages
- Duplicate count
- Total unique count

### Phone Number Masking
- Format: First 4 digits + masked middle + last 3 digits
- Example: `+9230******567`
- Applied in API responses for security

## Security Considerations

### Tenant Isolation
- All database queries filtered by tenantId
- API routes verify tenant ownership
- Foreign key relationships enforce tenant boundaries

### Authentication
- All API routes require valid session
- 401 response for unauthorized access
- 503 response for database unavailability

### Data Protection
- Phone numbers masked in API responses
- No raw tokens/secrets exposed
- Safe error handling without sensitive data

### Compliance
- Explicit opt-in confirmation required
- Compliance notice displayed prominently
- Campaigns cannot be created without confirmation

## Audit Actions

Added to AuditAction enum:
- `CAMPAIGN_CREATED`
- `CAMPAIGN_UPDATED`
- `CAMPAIGN_DELETED`

## Migration

Migration `20260615182314_add_campaign_models`:
- Created CampaignStatus enum
- Created Campaign model
- Created CampaignRecipient model
- Updated User, Tenant, WhatsappAccount, WhatsAppTemplate models with campaign relationships
- No data reset - existing data preserved

## Files Created

### Database
- `prisma/migrations/20260615182314_add_campaign_models/migration.sql`

### Library
- `lib/campaigns/validation.ts` - Recipient validation helper

### API Routes
- `app/api/campaigns/route.ts` - GET, POST
- `app/api/campaigns/[id]/route.ts` - GET, PUT, DELETE

### Frontend Pages
- `app/dashboard/campaigns/page.tsx` - Campaign list
- `app/dashboard/campaigns/new/page.tsx` - Create campaign
- `app/dashboard/campaigns/[id]/page.tsx` - Campaign details
- `app/dashboard/campaigns/[id]/edit/page.tsx` - Edit campaign

### Modified Files
- `prisma/schema.prisma` - Added campaign models and relationships
- `app/dashboard/page.tsx` - Added Campaigns link to dashboard

## Verification Results

### Command Verification
- `npx prisma validate`: ✅ PASS - Schema is valid
- `npx prisma generate`: ✅ PASS - Prisma Client generated
- `npx prisma migrate status`: ✅ PASS - Migration applied
- `npm run type-check`: ✅ PASS - No TypeScript errors
- `npm run lint`: ✅ PASS - No ESLint errors
- `npm run build`: ✅ PASS - Build successful

### Database Verification
- `npx prisma db pull`: ✅ PASS - 12 models introspected successfully
- Campaign tables created with correct schema
- Relationships established correctly
- Indexes created for performance

### Browser Verification
- Dev server started successfully on localhost:3000
- Dashboard displays Campaigns link
- Campaign management pages accessible
- UI components render correctly

## Next Steps

Phase 4.0 successfully implements the campaign management foundation. The platform now has:

1. Database infrastructure for campaigns and recipients
2. API routes for campaign CRUD operations
3. Frontend UI for campaign management
4. Recipient validation and compliance confirmation
5. Tenant isolation and security measures

**Recommended Next Phase:**
- Phase 4.1: Campaign Sending Implementation
  - Implement bulk sending logic
  - Add campaign status transitions
  - Implement rate limiting and queueing
  - Add delivery tracking for campaigns
  - Implement retry logic for failed messages

**Security Note:** No actual WhatsApp messages are sent in Phase 4.0. All campaigns remain in DRAFT status and cannot be sent until safety checks and sending infrastructure are implemented in a later phase.
