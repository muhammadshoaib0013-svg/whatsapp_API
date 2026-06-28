# WhatsApp Templates and Messages Documentation

## Overview

This document explains how to manage WhatsApp message templates and send single test messages using the official Meta WhatsApp Business Cloud API. This feature allows each tenant to sync their approved message templates from Meta and send test messages to verify functionality.

## Prerequisites

Before using templates and messages, you must have:

1. A connected WhatsApp Business API account (see [WHATSAPP_CONNECTION.md](./WHATSAPP_CONNECTION.md))
2. Approved message templates in your Meta for Developers account
3. Valid access token with required permissions
4. User opt-in compliance for message recipients

## Template Sync

### How Template Sync Works

1. **Authentication:** User must be logged in with a valid session
2. **Tenant Isolation:** Templates are fetched only for the authenticated tenant's WhatsApp account
3. **Token Decryption:** Access token is decrypted server-side only
4. **Meta API Call:** System calls Meta Graph API to fetch message templates
5. **Database Sync:** Templates are upserted to the database with metadata
6. **Audit Logging:** Sync action is logged for compliance

### Required Meta Permissions

Your access token must have the following permissions:
- `whatsapp_business_messaging` - Required for sending messages
- `whatsapp_business_management` - Required for managing templates

### Sync Endpoint

**POST /api/whatsapp/templates/sync**

**Request:**
```json
{}
```

**Response (Success):**
```json
{
  "message": "Templates synced successfully",
  "templatesSynced": 5,
  "templates": [
    {
      "id": "cmq85iw5r0000tuawmmqtsuqw",
      "metaTemplateId": "123456789012345",
      "name": "welcome_message",
      "language": "en",
      "category": "MARKETING",
      "status": "APPROVED",
      "lastSyncedAt": "2024-06-12T15:30:27.000Z"
    }
  ]
}
```

**Response (Error):**
```json
{
  "error": "Invalid or expired access token. Please update your WhatsApp credentials."
}
```

### Template Status

Templates can have the following statuses:
- **APPROVED** - Template is approved by Meta and can be used
- **PENDING** - Template is pending review by Meta
- **REJECTED** - Template was rejected by Meta
- **DISABLED** - Template is disabled by Meta
- **PAUSED** - Template is paused by Meta

Only templates with status **APPROVED** can be used to send messages.

## Single Test Message Sending

### Compliance Warning

**IMPORTANT:** Only message users who have explicitly opted in to receive WhatsApp messages from your business. Sending messages to users who have not opted in violates WhatsApp's Terms of Service and may result in your number being banned.

### How Message Sending Works

1. **Authentication:** User must be logged in with a valid session
2. **Template Selection:** User selects an approved template from their synced templates
3. **Phone Number Validation:** Recipient phone number is validated in E.164 format
4. **Variable Injection:** Optional variables are injected into template components
5. **Tenant Ownership:** System verifies template belongs to current tenant
6. **Token Decryption:** Access token is decrypted server-side only
7. **Meta API Call:** System calls Meta Graph API to send the message
8. **Message Logging:** Send attempt is logged with request/response metadata
9. **Audit Logging:** Message sent action is logged for compliance

### Send Message Endpoint

**POST /api/whatsapp/messages/send-template**

**Request:**
```json
{
  "templateId": "cmq85iw5r0000tuawmmqtsuqw",
  "toPhoneNumber": "+1234567890",
  "language": "en",
  "variables": {
    "1": "John",
    "2": "your company"
  }
}
```

**Response (Success):**
```json
{
  "message": "Template message sent successfully",
  "metaMessageId": "wamid.H8KMWAAB...",
  "toPhoneNumber": "+1234567890",
  "templateName": "welcome_message",
  "sentAt": "2024-06-12T16:00:00.000Z"
}
```

**Response (Error):**
```json
{
  "error": "Template is not approved. Current status: PENDING"
}
```

### Phone Number Format

Phone numbers must be in E.164 format:
- Start with `+`
- Followed by country code
- Followed by phone number
- Example: `+923001234567`

### Variables

Variables are used to personalize template messages. They are numbered sequentially:
- `{{1}}` - First variable
- `{{2}}` - Second variable
- etc.

Variables are provided as a JSON object:
```json
{
  "1": "John",
  "2": "your company"
}
```

## Known Limitations

### Current Limitations (Phase 3)

1. **Single Message Only**
   - Only one message can be sent at a time
   - No bulk sending or campaign functionality
   - No message scheduling

2. **Template-Only Messages**
   - Only approved templates can be used
   - No free-form text messages
   - No media messages (images, documents, etc.)

3. **No Webhook Support**
   - Message delivery status updates not received
   - Message read receipts not received
   - Incoming messages not handled

4. **No Message History**
   - No conversation history tracking
   - No message thread management
   - No reply functionality

5. **Basic Variable Support**
   - Simple variable injection only
   - No complex template component handling
   - No media component support

### Security Considerations

1. **Token Security**
   - Access tokens are encrypted at rest
   - Tokens are decrypted server-side only
   - Tokens are never exposed to the frontend

2. **Tenant Isolation**
   - Templates are scoped to tenant
   - Messages are scoped to tenant
   - Cross-tenant access is blocked

3. **Audit Logging**
   - All template syncs are logged
   - All message sends are logged
   - Logs include user, tenant, and metadata

4. **Compliance**
   - Only approved templates can be used
   - Opt-in compliance notice displayed
   - Phone number validation enforced

## Troubleshooting

### Template Sync Fails

1. **Check Connection:** Ensure WhatsApp account is connected and tested
2. **Verify Token:** Ensure access token is valid and not expired
3. **Check Permissions:** Confirm token has required permissions
4. **API Version:** Ensure Graph API version is supported

### Message Send Fails

1. **Template Status:** Ensure template is approved
2. **Phone Number:** Verify phone number is in E.164 format
3. **Opt-in Compliance:** Ensure recipient has opted in
4. **Rate Limits:** Check if rate limits have been exceeded
5. **Token Validity:** Ensure access token is valid

### Template Not Showing

1. **Sync Required:** Click "Sync Templates" to fetch from Meta
2. **Approval Status:** Only approved templates can be used
3. **Tenant Check:** Ensure you're logged in to correct tenant

## API Endpoints

### GET /api/whatsapp/templates

Retrieves the authenticated tenant's synced templates.

**Response:**
```json
{
  "templates": [
    {
      "id": "cmq85iw5r0000tuawmmqtsuqw",
      "metaTemplateId": "123456789012345",
      "name": "welcome_message",
      "language": "en",
      "category": "MARKETING",
      "status": "APPROVED",
      "lastSyncedAt": "2024-06-12T15:30:27.000Z",
      "createdAt": "2024-06-12T15:30:27.000Z",
      "updatedAt": "2024-06-12T15:30:27.000Z"
    }
  ]
}
```

### POST /api/whatsapp/templates/sync

Syncs templates from Meta Graph API to the database.

**Response:** See "Sync Endpoint" section above.

### POST /api/whatsapp/messages/send-template

Sends a single template message.

**Response:** See "Send Message Endpoint" section above.

## Database Models

### WhatsAppTemplate

Stores synced message templates from Meta.

**Fields:**
- `id` - Unique identifier
- `tenantId` - Tenant that owns this template
- `whatsappAccountId` - Associated WhatsApp account
- `metaTemplateId` - Template ID from Meta
- `name` - Template name
- `language` - Template language code
- `category` - Template category (MARKETING, UTILITY, etc.)
- `status` - Template status (APPROVED, PENDING, etc.)
- `componentsJson` - Template components structure
- `lastSyncedAt` - Last sync timestamp
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

**Indexes:**
- Unique on (tenantId, metaTemplateId)
- Index on tenantId
- Index on whatsappAccountId
- Index on metaTemplateId

### WhatsAppMessageLog

Logs message sending attempts for compliance and debugging.

**Fields:**
- `id` - Unique identifier
- `tenantId` - Tenant that sent this message
- `whatsappAccountId` - Associated WhatsApp account
- `templateId` - Template used (optional)
- `toPhoneNumber` - Recipient phone number
- `messageType` - Type of message (template, etc.)
- `status` - Message status (PENDING, SENT, DELIVERED, READ, FAILED)
- `metaMessageId` - Message ID from Meta
- `requestJson` - Request payload sent to Meta
- `responseJson` - Response from Meta
- `errorMessage` - Error message if failed
- `sentAt` - Timestamp when message was sent
- `createdAt` - Creation timestamp

**Indexes:**
- Index on tenantId
- Index on whatsappAccountId
- Index on templateId
- Index on toPhoneNumber
- Index on createdAt

## Best Practices

1. **Template Management**
   - Sync templates regularly to stay updated
   - Use only approved templates
   - Test templates before production use

2. **Message Sending**
   - Always verify recipient opt-in
   - Use E.164 phone number format
   - Test with a single message first
   - Monitor message logs for errors

3. **Security**
   - Never expose access tokens
   - Rotate tokens periodically
   - Monitor audit logs
   - Enforce tenant isolation

4. **Compliance**
   - Follow WhatsApp's Terms of Service
   - Respect opt-in preferences
   - Provide clear opt-out options
   - Keep message logs for audit

## Support

For issues with templates and messages:

1. Check this documentation first
2. Review Meta for Developers documentation
3. Check template status in Meta dashboard
4. Review message logs for errors
5. Contact support if issues persist

---

**Phase 3 Status:** WhatsApp template management and single test message sending - IMPLEMENTED
