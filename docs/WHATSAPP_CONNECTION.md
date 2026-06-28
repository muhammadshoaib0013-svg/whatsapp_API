# WhatsApp Business API Connection Documentation

## Overview

This document explains how to manually connect your official WhatsApp Business API to the WhatsApp Automation SaaS platform. This feature allows each tenant to securely store and manage their WhatsApp Business API credentials.

## Manual Setup Instructions

### Prerequisites

Before connecting your WhatsApp Business API, you must have:

1. A Meta for Developers account (developers.facebook.com)
2. A Meta app with WhatsApp product enabled
3. A WhatsApp Business Account (WABA)
4. A phone number connected to your WABA
5. A permanent access token with required permissions

### Required Meta Values

You will need the following values from Meta for Developers:

1. **WABA ID (WhatsApp Business Account ID)**
   - Found in your WhatsApp Business Account settings
   - Format: Numeric string (e.g., "123456789012345")

2. **Phone Number ID**
   - Found in WhatsApp > Configuration > Phone numbers
   - Format: Numeric string (e.g., "123456789012345")

3. **Business Phone Number**
   - The actual phone number connected to your WABA
   - Format: International format with + (e.g., "+1234567890")

4. **Graph API Version**
   - The version of the Meta Graph API to use
   - Format: v followed by number (e.g., "v19.0")

5. **Access Token**
   - A permanent access token with required permissions
   - Format: Long alphanumeric string
   - **Security Note:** This token is encrypted before storage and never shown again

### Step-by-Step Setup

1. **Go to Meta for Developers**
   - Visit: https://developers.facebook.com/apps
   - Select or create your app

2. **Enable WhatsApp Product**
   - In your app dashboard, click "Add Product"
   - Select "WhatsApp"
   - Complete the setup wizard

3. **Get Your WABA ID**
   - Go to WhatsApp > Configuration
   - Your WABA ID is displayed at the top

4. **Get Your Phone Number ID**
   - In WhatsApp > Configuration > Phone numbers
   - Find your phone number and copy the Phone Number ID

5. **Generate a Permanent Access Token**
   - In WhatsApp > Configuration
   - Click "Add a phone number" if needed
   - Under "Access Token", click "Generate"
   - Select "Permanent" token type
   - Grant required permissions:
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`
   - Copy the generated token (you won't see it again)

6. **Connect in the Platform**
   - Log in to your WhatsApp Automation SaaS account
   - Navigate to Dashboard > Connect WhatsApp
   - Fill in all required fields
   - Click "Connect Account"
   - Test the connection using the "Test Connection" button

## Security Rules

### Token Encryption

- **Encryption Method:** AES-256-GCM (Authenticated Encryption)
- **Key Derivation:** PBKDF2 with 100,000 iterations
- **Storage:** Only encrypted tokens are stored in the database
- **Display:** Only the last 4 characters are shown (e.g., "••••1234")
- **Never Exposed:** Raw tokens are never returned to the frontend or logged

### Tenant Isolation

- Each tenant can only access their own WhatsApp account
- Backend enforces tenant ownership on all API requests
- Cross-tenant access is blocked with 403 Forbidden
- Database queries are scoped to the authenticated tenant

### Audit Logging

All WhatsApp account actions are logged for security and compliance:

- `WHATSAPP_ACCOUNT_CREATED` - New account connected
- `WHATSAPP_ACCOUNT_UPDATED` - Account details updated
- `WHATSAPP_ACCOUNT_TESTED` - Connection test performed
- `WHATSAPP_ACCOUNT_DELETED` - Account removed

Audit logs include:
- User ID and tenant ID
- Action performed
- Metadata (account ID, display name, etc.)
- IP address and user agent
- Timestamp

## What is Encrypted

### Encrypted Fields

- **Access Token:** Always encrypted before database storage
- **Encryption Key:** Derived from `TOKEN_ENCRYPTION_KEY` environment variable
- **Algorithm:** AES-256-GCM with random salt and IV per encryption

### Non-Encrypted Fields

The following fields are stored in plain text (safe to store):

- Display Name
- WABA ID
- Phone Number ID
- Business Phone Number
- Graph API Version
- Token Last 4 (for display purposes only)
- Connection Status
- Last Tested At
- Last Error

## How to Test Connection

### Manual Test

1. After connecting your account, click "Test Connection"
2. The system will:
   - Decrypt your access token server-side
   - Call the Meta Graph API to verify credentials
   - Fetch phone number details from Meta
   - Update connection status

### Expected Results

**Success:**
- Connection status changes to "CONNECTED"
- Phone number and account name are displayed
- Last tested timestamp is updated

**Failure:**
- Connection status changes to "FAILED"
- Error message is displayed (without exposing secrets)
- Last error field is updated with safe error details

### Common Errors

1. **Invalid Access Token**
   - Token has expired or been revoked
   - Solution: Generate a new token and update your account

2. **Insufficient Permissions**
   - Token lacks required permissions
   - Solution: Regenerate token with correct permissions

3. **Phone Number Not Found**
   - Phone Number ID is incorrect
   - Solution: Verify the Phone Number ID in Meta for Developers

4. **API Version Mismatch**
   - Graph API version is outdated
   - Solution: Update to the latest supported version

## Known Limitations

### Current Limitations (Phase 2)

1. **Single Account Per Tenant**
   - Each tenant can only connect one WhatsApp account
   - Future phases may support multiple accounts

2. **Manual Connection Only**
   - No OAuth flow or automatic connection
   - Users must manually enter credentials from Meta

3. **No Webhook Configuration**
   - Webhooks for receiving messages are not configured in this phase
   - Will be added in a future phase

4. **No Message Sending**
   - Message sending functionality is not implemented
   - Will be added in a future phase

5. **No Template Management**
   - WhatsApp message templates cannot be managed
   - Will be added in a future phase

### Security Considerations

1. **Token Rotation**
   - Tokens should be rotated periodically for security
   - Users can update tokens by entering a new one

2. **Token Expiration**
   - Permanent tokens can still be revoked by Meta
   - Connection tests will detect revoked tokens

3. **Access Control**
   - Only users with appropriate roles can manage WhatsApp accounts
   - Role-based access control is enforced

## API Endpoints

### POST /api/whatsapp/accounts

Creates or updates a WhatsApp account for the authenticated tenant.

**Request Body:**
```json
{
  "displayName": "My Business WhatsApp",
  "wabaId": "123456789012345",
  "phoneNumberId": "123456789012345",
  "businessPhoneNumber": "+1234567890",
  "graphApiVersion": "v19.0",
  "accessToken": "your_access_token_here"
}
```

**Response:**
```json
{
  "message": "WhatsApp account created successfully",
  "account": {
    "id": "cmq85iw5r0000tuawmmqtsuqw",
    "displayName": "My Business WhatsApp",
    "wabaId": "123456789012345",
    "phoneNumberId": "123456789012345",
    "businessPhoneNumber": "+1234567890",
    "graphApiVersion": "v19.0",
    "tokenLastFour": "1234",
    "connectionStatus": "NOT_CONNECTED",
    "lastTestedAt": null,
    "lastError": null,
    "createdAt": "2024-06-10T15:30:27.000Z",
    "updatedAt": "2024-06-10T15:30:27.000Z"
  }
}
```

### GET /api/whatsapp/accounts

Retrieves the authenticated tenant's WhatsApp account.

**Response:**
```json
{
  "account": {
    "id": "cmq85iw5r0000tuawmmqtsuqw",
    "displayName": "My Business WhatsApp",
    "wabaId": "123456789012345",
    "phoneNumberId": "123456789012345",
    "businessPhoneNumber": "+1234567890",
    "graphApiVersion": "v19.0",
    "tokenLastFour": "1234",
    "connectionStatus": "CONNECTED",
    "lastTestedAt": "2024-06-10T16:00:00.000Z",
    "lastError": null,
    "createdAt": "2024-06-10T15:30:27.000Z",
    "updatedAt": "2024-06-10T16:00:00.000Z"
  }
}
```

### POST /api/whatsapp/accounts/test

Tests the connection to Meta Graph API using stored credentials.

**Response (Success):**
```json
{
  "message": "Connection test successful",
  "connectionStatus": "CONNECTED",
  "phoneNumber": "+1234567890",
  "accountName": "My Business",
  "qualityRating": "GREEN",
  "lastTestedAt": "2024-06-10T16:00:00.000Z"
}
```

**Response (Failure):**
```json
{
  "error": "Connection test failed",
  "message": "Invalid OAuth access token",
  "connectionStatus": "FAILED"
}
```

### DELETE /api/whatsapp/accounts/[id]

Deletes the authenticated tenant's WhatsApp account.

**Response:**
```json
{
  "message": "WhatsApp account deleted successfully"
}
```

## Troubleshooting

### Connection Test Fails

1. **Verify Token:** Ensure the access token is valid and not expired
2. **Check Permissions:** Confirm token has required permissions
3. **Verify IDs:** Double-check WABA ID and Phone Number ID
4. **API Version:** Ensure Graph API version is supported

### Token Not Saving

1. **Check Encryption Key:** Ensure `TOKEN_ENCRYPTION_KEY` is set in .env
2. **Key Length:** Key must be exactly 32 characters
3. **Database Connection:** Verify database is accessible

### Account Not Showing

1. **Check Tenant:** Ensure you're logged in to the correct tenant
2. **Refresh Page:** Try refreshing the connection page
3. **Check Logs:** Review audit logs for any errors

## Best Practices

1. **Use Permanent Tokens:** Avoid temporary tokens that expire quickly
2. **Rotate Tokens:** Update tokens periodically for security
3. **Test Connection:** Always test after connecting or updating
4. **Monitor Status:** Check connection status regularly
5. **Secure Storage:** Never share access tokens or store them insecurely
6. **Use Least Privilege:** Grant only necessary permissions to tokens

## Support

For issues with WhatsApp Business API connection:

1. Check this documentation first
2. Review Meta for Developers documentation
3. Check the connection status and error messages
4. Contact support if issues persist

---

**Phase 2 Status:** Manual WhatsApp Business API connection with encrypted token storage - IMPLEMENTED
