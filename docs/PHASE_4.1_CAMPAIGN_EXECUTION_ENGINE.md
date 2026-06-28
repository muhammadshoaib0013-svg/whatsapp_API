# Phase 4.1 - Campaign Execution Engine

## Overview
Phase 4.1 implements the Campaign Execution Engine, which enables the actual sending of WhatsApp messages to campaign recipients. This phase adds campaign lifecycle management (start, pause, resume, cancel), a recipient queue architecture with detailed status tracking, a batch sender service, delivery tracking via webhook updates, campaign metrics calculation, and dashboard UI updates with campaign controls and progress indicators.

## Features Implemented

### 1. Campaign Lifecycle APIs
- **POST /api/campaigns/[id]/start** - Starts a DRAFT campaign, changes status to SENDING, sets startedAt timestamp, and queues all valid recipients with PENDING status
- **POST /api/campaigns/[id]/pause** - Pauses a SENDING campaign, changes status to PAUSED, sets pausedAt timestamp
- **POST /api/campaigns/[id]/resume** - Resumes a PAUSED campaign, changes status to SENDING, sets resumedAt timestamp
- **POST /api/campaigns/[id]/cancel** - Cancels a SENDING or PAUSED campaign, changes status to CANCELLED, sets cancelledAt timestamp
- **GET /api/campaigns/[id]/progress** - Returns campaign progress metrics including recipient counts by status and calculated rates

### 2. Database Schema Changes

#### Campaign Model Updates
Added new timestamp fields to track campaign lifecycle:
- `startedAt: DateTime?` - When the campaign was started
- `pausedAt: DateTime?` - When the campaign was paused
- `resumedAt: DateTime?` - When the campaign was resumed
- `cancelledAt: DateTime?` - When the campaign was cancelled

#### CampaignRecipient Model Updates
Added fields to track individual recipient status and delivery:
- `status: CampaignRecipientStatus` - Current status of the recipient (PENDING, PROCESSING, SENT, DELIVERED, READ, FAILED)
- `metaMessageId: String?` - Meta message ID for linking to webhook updates
- `sentAt: DateTime?` - When the message was sent
- `deliveredAt: DateTime?` - When the message was delivered
- `readAt: DateTime?` - When the message was read
- `errorMessage: String?` - Error message if sending failed

#### New Enum
- `CampaignRecipientStatus` - Enum with values: PENDING, PROCESSING, SENT, DELIVERED, READ, FAILED

### 3. Batch Sender Service
Created `lib/campaign-executor.ts` with the following capabilities:
- Processes pending recipients in batches (configurable batch size: 10)
- Sends WhatsApp template messages using existing WhatsApp sender
- Updates recipient status through the lifecycle (PENDING → PROCESSING → SENT)
- Logs messages to WhatsAppMessageLog for tracking
- Automatically marks campaign as COMPLETED when all recipients are processed
- Respects tenant isolation throughout the process

### 4. Delivery Tracking via Webhooks
Updated webhook handler in `app/api/webhooks/whatsapp/route.ts`:
- Links webhook updates to CampaignRecipient by metaMessageId
- Automatically updates recipient status when webhook events are received (SENT, DELIVERED, READ, FAILED)
- Sets appropriate timestamps (deliveredAt, readAt) based on webhook status
- Stores error messages from webhook failures

### 5. Campaign Metrics Calculation
The progress API calculates the following metrics:
- `totalRecipients` - Total valid recipients
- `pending` - Count of recipients with PENDING status
- `sent` - Count of recipients with SENT status
- `delivered` - Count of recipients with DELIVERED status
- `read` - Count of recipients with READ status
- `failed` - Count of recipients with FAILED status
- `successRate` - Percentage of (delivered + read) / totalRecipients
- `deliveryRate` - Percentage of delivered / totalRecipients
- `readRate` - Percentage of read / totalRecipients

### 6. Dashboard UI Updates
Updated campaign detail page (`app/dashboard/campaigns/[id]/page.tsx`):
- Added Start button for DRAFT campaigns
- Added Pause button for SENDING campaigns
- Added Resume button for PAUSED campaigns
- Added Cancel button for SENDING and PAUSED campaigns
- Added progress section with metrics cards showing recipient counts
- Added progress bar for SENDING campaigns
- Added real-time progress polling (every 5 seconds) for SENDING campaigns
- Added status-specific messaging for each campaign state

## Security & Tenant Isolation

All new APIs enforce tenant isolation:
- Every API route verifies campaign ownership using `tenantId: session.tenant.id`
- The campaign executor service requires tenantId parameter and filters all queries by tenant
- Webhook updates link to recipients by metaMessageId (which is tenant-scoped through the campaign)
- Cross-tenant access is prevented at the database query level

## Files Changed

### Database
- `prisma/schema.prisma` - Added CampaignRecipientStatus enum, new fields to Campaign and CampaignRecipient models
- `prisma/migrations/20260616134352_add_campaign_execution_fields/` - Migration for schema changes

### Backend APIs
- `app/api/campaigns/[id]/start/route.ts` - New route for starting campaigns
- `app/api/campaigns/[id]/pause/route.ts` - New route for pausing campaigns
- `app/api/campaigns/[id]/resume/route.ts` - New route for resuming campaigns
- `app/api/campaigns/[id]/cancel/route.ts` - New route for cancelling campaigns
- `app/api/campaigns/[id]/progress/route.ts` - New route for getting campaign progress

### Services
- `lib/campaign-executor.ts` - New batch sender service for processing campaign recipients

### Webhook
- `app/api/webhooks/whatsapp/route.ts` - Updated to link webhook updates to CampaignRecipient

### Frontend
- `app/dashboard/campaigns/[id]/page.tsx` - Updated with campaign controls and progress section

## Campaign Status Flow

```
DRAFT → SENDING → PAUSED → SENDING → COMPLETED
   ↓         ↓         ↓
CANCELLED  CANCELLED  CANCELLED
```

- **DRAFT**: Campaign is being edited, not yet started
- **SENDING**: Campaign is actively sending messages
- **PAUSED**: Campaign is paused, can be resumed
- **COMPLETED**: All recipients have been processed
- **CANCELLED**: Campaign was cancelled by user

## Recipient Status Flow

```
PENDING → PROCESSING → SENT → DELIVERED → READ
   ↓                          ↓
FAILED                    FAILED
```

- **PENDING**: Recipient is queued for sending
- **PROCESSING**: Message is being sent
- **SENT**: Message sent successfully
- **DELIVERED**: Message delivered to recipient
- **READ**: Message read by recipient
- **FAILED**: Message sending failed

## Usage Example

### Starting a Campaign
```bash
POST /api/campaigns/[id]/start
```

Response:
```json
{
  "campaign": {
    "id": "cm1234567890",
    "status": "SENDING",
    "startedAt": "2026-06-16T13:43:52.000Z"
  }
}
```

### Getting Campaign Progress
```bash
GET /api/campaigns/[id]/progress
```

Response:
```json
{
  "campaignId": "cm1234567890",
  "status": "SENDING",
  "totalRecipients": 100,
  "pending": 50,
  "sent": 45,
  "delivered": 40,
  "read": 35,
  "failed": 5,
  "successRate": 75.0,
  "deliveryRate": 40.0,
  "readRate": 35.0
}
```

## Integration with Existing Systems

- Reuses existing WhatsApp sender from `lib/whatsapp/cloud-api.ts`
- Reuses existing webhook architecture from `app/api/webhooks/whatsapp/route.ts`
- Reuses existing message logging in WhatsAppMessageLog
- Integrates with existing tenant isolation patterns
- Preserves all existing Phase 4.0 functionality

## Next Steps

The campaign execution engine is now ready for use. To actually send messages, the `processCampaignRecipients` function from `lib/campaign-executor.ts` needs to be called (e.g., via a background job, cron job, or manual trigger). This could be implemented in a future phase with a job queue system like BullMQ or a similar solution.
