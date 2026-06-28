# Phase 3.3 — WhatsApp Webhook Setup, Delivery Status Tracking, and Message Log Updates

## Overview

Phase 3.3 implements WhatsApp Cloud API webhook integration for real-time delivery status tracking. This phase enables the system to receive status updates from Meta (Facebook) when messages are delivered to and read by recipients, automatically updating the message logs in the database.

## Features Implemented

### 1. Webhook Verification Endpoint
**Endpoint:** `GET /api/webhooks/whatsapp`

**Purpose:** Meta uses this endpoint to verify the webhook URL during setup.

**Parameters:**
- `hub.mode` — Must be `subscribe`
- `hub.verify_token` — Must match `WHATSAPP_VERIFY_TOKEN` from environment
- `hub.challenge` — Returned as-is if verification succeeds

**Response:**
- `200` with challenge string if verification succeeds
- `403` if verification fails
- `500` if `WHATSAPP_VERIFY_TOKEN` is not configured

### 2. Webhook Event Endpoint
**Endpoint:** `POST /api/webhooks/whatsapp`

**Purpose:** Meta sends message status updates to this endpoint.

**Security:**
- Optional signature verification using `META_APP_SECRET`
- Verifies `x-hub-signature-256` header if app secret is configured
- Returns `403` if signature verification fails

**Payload Processing:**
- Parses Meta webhook payload structure
- Extracts message status updates from `entry[].changes[].value.statuses[]`
- Matches incoming Meta message ID with `WhatsAppMessageLog.metaMessageId`
- Updates message status based on Meta status

**Status Mapping:**
- Meta `sent` → Database `SENT`
- Meta `delivered` → Database `DELIVERED`
- Meta `read` → Database `READ`
- Meta `failed` → Database `FAILED` (with error message)

**Safe Logging:**
- Logs webhook receipt confirmation
- Logs message ID found/not found
- Logs status updates
- Does NOT log raw webhook payloads containing customer data
- Does NOT log sensitive information

### 3. Database Updates

**WhatsAppMessageLog Model:**
The existing model already supports all necessary fields:
- `metaMessageId` — Stores Meta's message ID for webhook matching
- `status` — MessageStatus enum (PENDING, SENT, DELIVERED, READ, FAILED)
- `errorMessage` — Stores error reason if delivery fails
- `responseJson` — Stores webhook status and timestamp

**Update Logic:**
- Finds message log by `metaMessageId`
- Updates status only if it has changed
- Preserves existing error messages
- Appends webhook status and timestamp to `responseJson`

### 4. Environment Configuration

**New Environment Variables:**
```env
# Required for webhook verification
WHATSAPP_VERIFY_TOKEN="YOUR_VERIFY_TOKEN_HERE"

# Optional but recommended for webhook signature verification
META_APP_SECRET="YOUR_META_APP_SECRET_HERE_OPTIONAL_FOR_SIGNATURE_VERIFICATION"
```

**Configuration Notes:**
- `WHATSAPP_VERIFY_TOKEN` is required for Meta webhook setup
- `META_APP_SECRET` is optional but recommended for security
- Both values should be kept secret and not committed to version control

## Webhook Setup Instructions

### 1. Configure Environment Variables

Add the following to your `.env` file:
```env
WHATSAPP_VERIFY_TOKEN="your_secure_random_token_here"
META_APP_SECRET="your_meta_app_secret_here"
```

**Generate a secure verify token:**
```bash
# Using PowerShell
[System.Convert]::ToHexString((New-Object byte[] 32 | ForEach-Object { (Get-Random -Maximum 256) }))
```

### 2. Configure Meta Webhook

1. Go to Meta for Developers: https://developers.facebook.com/
2. Navigate to your WhatsApp Business App
3. Go to WhatsApp > Configuration
4. Under "Webhooks", click "Add webhook"
5. Enter your webhook URL: `https://your-domain.com/api/webhooks/whatsapp`
6. Enter your verify token (must match `WHATSAPP_VERIFY_TOKEN`)
7. Click "Verify and Save"

### 3. Subscribe to Webhook Fields

After webhook verification, subscribe to the following fields:
- `messages` — Required for status updates

### 4. Test Webhook

1. Send a test template message from your application
2. Check the message logs page (`/dashboard/messages`)
3. Wait for status updates (usually within seconds)
4. Verify status changes from SENT → DELIVERED → READ

## Security Considerations

### Webhook Signature Verification
- Implemented using HMAC-SHA256
- Only active if `META_APP_SECRET` is configured
- Prevents webhook spoofing attacks
- Recommended for production deployments

### Public Endpoint
- Webhook endpoint is public (no authentication required)
- This is necessary for Meta to send updates
- Secured via verify token and optional signature verification
- Rate limiting is handled by Meta

### Data Privacy
- No raw webhook payloads logged
- No customer phone numbers logged
- No message content logged
- Only safe status information logged

### Tenant Isolation
- Webhook updates use `metaMessageId` to find messages
- No tenant context required for webhook processing
- UI/API reads still enforce tenant isolation
- Cross-tenant data access prevented

## Error Handling

### Webhook Verification Errors
- Missing verify token → 500 error
- Invalid verify token → 403 error
- Invalid hub.mode → 403 error

### Webhook Processing Errors
- Invalid signature → 403 error
- Invalid payload → 500 error
- Message ID not found → Logged, continues processing
- Unknown status type → Logged, continues processing

### Database Errors
- Message not found → Logged, continues processing
- Update failure → Logged, returns 500 error

## Status Update Flow

```
1. User sends template message
   → Message log created with status PENDING
   → Message sent to Meta API
   → Status updated to SENT
   → Meta message ID stored

2. Meta receives message
   → Meta sends webhook with status "sent"
   → Webhook finds message by Meta message ID
   → Status updated to SENT (if not already)

3. Message delivered to recipient
   → Meta sends webhook with status "delivered"
   → Webhook finds message by Meta message ID
   → Status updated to DELIVERED

4. Recipient reads message
   → Meta sends webhook with status "read"
   → Webhook finds message by Meta message ID
   → Status updated to READ

5. Delivery fails
   → Meta sends webhook with status "failed"
   → Webhook finds message by Meta message ID
   → Status updated to FAILED
   → Error message stored
```

## Testing

### Manual Testing Without Meta Setup
If you don't have Meta webhook configured, you can test the webhook endpoint manually:

**Test Webhook Verification:**
```bash
curl "https://your-domain.com/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test_challenge"
```

Expected response: `test_challenge`

**Test Webhook Event:**
```bash
curl -X POST https://your-domain.com/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [
      {
        "id": "123456789",
        "changes": [
          {
            "value": {
              "statuses": [
                {
                  "id": "wamid.HBgLMzMyMTIzNDU2Nzg5FQIAERgSMzMyMTIzNDU2Nzg5BQ==",
                  "status": "delivered",
                  "timestamp": 1704067200
                }
              ]
            },
            "field": "messages"
          }
        ]
      }
    ]
  }'
```

### Testing With Meta Setup
1. Configure webhook in Meta developer console
2. Send a test template message
3. Monitor server logs for webhook receipts
4. Check message logs page for status updates
5. Verify status progression: SENT → DELIVERED → READ

## Troubleshooting

### Webhook Verification Fails
- Verify `WHATSAPP_VERIFY_TOKEN` is set in `.env`
- Verify verify token matches in Meta console
- Check server logs for verification errors

### Webhook Not Receiving Updates
- Verify webhook is subscribed to `messages` field
- Verify webhook URL is publicly accessible
- Check server logs for webhook processing errors
- Verify Meta message ID is stored in database

### Status Not Updating
- Verify `metaMessageId` is stored in message log
- Check server logs for "Message ID not found" errors
- Verify status mapping is correct
- Check database connection

### Signature Verification Fails
- Verify `META_APP_SECRET` is set in `.env`
- Verify app secret matches Meta console
- Check signature calculation logic
- Verify header name is `x-hub-signature-256`

## Files Changed

### New Files
- `app/api/webhooks/whatsapp/route.ts` — Webhook verification and event processing

### Modified Files
- `.env.example` — Added WHATSAPP_VERIFY_TOKEN and META_APP_SECRET with comments

### Unchanged Files
- `prisma/schema.prisma` — No schema changes needed
- `app/dashboard/messages/page.tsx` — Already displays all status types
- All existing authentication, tenant isolation, and WhatsApp features

## Future Enhancements

### Webhook Retry Logic
- Implement retry queue for failed webhook processing
- Store failed webhooks for manual retry
- Add webhook delivery status tracking

### Advanced Status Tracking
- Track intermediate statuses (queued, sending, etc.)
- Add delivery time metrics
- Track delivery success rates

### Webhook Dashboard
- Display webhook health status
- Show webhook delivery statistics
- Manual webhook retry interface

## Production Deployment Notes

### Environment Variables
Ensure the following are set in production:
- `WHATSAPP_VERIFY_TOKEN` — Required
- `META_APP_SECRET` — Recommended

### HTTPS Requirement
Meta requires webhook URLs to use HTTPS with valid SSL certificates.

### Public Accessibility
Webhook endpoint must be publicly accessible from Meta's servers.

### Monitoring
- Monitor webhook endpoint health
- Track webhook processing success rate
- Alert on webhook failures
- Monitor database update performance

### Rate Limiting
Meta handles rate limiting on their end. No additional rate limiting needed.

## Rollback Plan

If issues arise after deployment:
1. Disable webhook in Meta console
2. Delete `/api/webhooks/whatsapp` route
3. Revert `.env.example` changes
4. No database rollback needed (no schema changes)

## Conclusion

Phase 3.3 successfully implements WhatsApp webhook integration for real-time delivery status tracking. The implementation maintains all existing functionality while adding valuable delivery visibility through Meta webhook integration.
