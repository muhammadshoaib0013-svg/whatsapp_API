# Production Deployment Guide

This guide provides step-by-step instructions for deploying the WhatsApp Automation SaaS to production on Vercel, configuring the database, setting up Meta App Review, and configuring Stripe webhooks.

## Table of Contents

1. [Local Production Testing](#local-production-testing)
2. [Vercel Deployment](#vercel-deployment)
3. [Database Migration](#database-migration)
4. [Meta App Review Checklist](#meta-app-review-checklist)
5. [Stripe Webhook Setup](#stripe-webhook-setup)

---

## 1. Local Production Testing

Before deploying to Vercel, test the production build locally to ensure everything works correctly.

### Step 1: Set Environment Variables

Create a `.env.local` file with all production environment variables:

```bash
DATABASE_URL=postgresql://user:password@host:port/database
SESSION_SECRET=your-random-32-byte-string
TOKEN_ENCRYPTION_KEY=your-random-32-byte-string
META_APP_SECRET=your-meta-app-secret
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_GROWTH=price_...
STRIPE_PRICE_AGENCY=price_...
WHATSAPP_VERIFY_TOKEN=your-verify-token
NEXT_PUBLIC_APP_URL=http://localhost:3000
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

### Step 2: Run Production Build

```bash
npm run build
```

This will:
- Compile all Next.js pages and API routes
- Optimize assets for production
- Generate static pages where applicable
- Verify TypeScript and ESLint errors

**Expected output**: "Compiled successfully" with no errors.

### Step 3: Start Production Server

```bash
npm start
```

This starts the production server on port 3000 (or the port specified in `PORT` environment variable).

### Step 4: Verify Functionality

Test the following locally:
- Visit `http://localhost:3000` - Landing page loads
- Visit `http://localhost:3000/login` - Login page loads
- Visit `http://localhost:3000/privacy-policy` - Privacy policy loads
- Visit `http://localhost:3000/data-deletion` - Data deletion page loads
- Visit `http://localhost:3000/terms-of-service` - Terms of service loads

---

## 2. Vercel Deployment

### Prerequisites

- Vercel account
- GitHub repository connected to Vercel
- Supabase PostgreSQL database
- Meta for Developers account
- Stripe account

### Step 1: Configure Environment Variables in Vercel

Go to your Vercel project → Settings → Environment Variables and add the following:

#### Required Variables

```
DATABASE_URL=postgresql://user:password@host:port/database
SESSION_SECRET=your-random-32-byte-string
TOKEN_ENCRYPTION_KEY=your-random-32-byte-string
META_APP_SECRET=your-meta-app-secret
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_live_...
```

#### Optional Variables (for Rate Limiting)

```
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

#### Stripe Configuration

```
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_GROWTH=price_...
STRIPE_PRICE_AGENCY=price_...
```

#### WhatsApp Configuration

```
WHATSAPP_VERIFY_TOKEN=your-verify-token
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Step 2: Build Settings

Vercel automatically detects Next.js and uses the following build settings:

- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

No manual configuration needed.

### Step 3: Serverless Functions Limits

Vercel has the following limits for serverless functions:

- **Execution Timeout**: 60 seconds (Hobby), 900 seconds (Pro)
- **Memory**: 1024 MB (Hobby), 4096 MB (Pro)
- **Concurrent Executions**: 1 (Hobby), unlimited (Pro)

**Recommendation**: Upgrade to Vercel Pro for production to handle webhook processing and long-running operations.

### Step 4: Deploy

1. Push your code to GitHub
2. Vercel will automatically deploy
3. Verify the deployment in Vercel dashboard

---

## 2. Database Migration

### Prerequisites

- PostgreSQL database (Supabase recommended)
- Prisma CLI installed locally

### Step 1: Generate Prisma Client

```bash
npx prisma generate
```

### Step 2: Push Schema to Production Database

For initial deployment or schema changes:

```bash
npx prisma db push
```

This will sync your Prisma schema with the production database.

### Step 3: Create Migration (Alternative)

If you prefer using migrations:

```bash
npx prisma migrate dev --name init
npx prisma migrate deploy
```

### Step 4: Verify Database Connection

After deployment, check your application logs to ensure the database connection is successful.

---

## 3. Meta App Review Checklist

To get your WhatsApp Business API approved for production, you must complete the Meta App Review process.

### Prerequisites

- Meta for Developers account
- Business Manager account
- WhatsApp Business account

### Step 1: Privacy Policy URL

**Required**: You must have a publicly accessible privacy policy.

Your application already includes a privacy policy page at:
- **URL**: `https://yourdomain.com/privacy-policy`
- **File**: `app/privacy-policy/page.tsx`

The privacy policy includes:
- Data collection (phone numbers, message content, user information)
- Data usage (WhatsApp messaging, campaign management, analytics)
- Data retention policies
- User rights (data deletion, access, modification)
- Contact information for privacy inquiries

**For Meta App Review**: Use the URL `https://yourdomain.com/privacy-policy` when submitting your app.

### Step 2: Data Deletion Instructions

**Required**: You must provide instructions for users to request data deletion.

Your application already includes a data deletion page at:
- **URL**: `https://yourdomain.com/data-deletion`
- **File**: `app/data-deletion/page.tsx`

The data deletion page includes:
- How users can request data deletion via email
- Email address for deletion requests
- Timeline for deletion (30 days)
- Confirmation process
- Data deletion for Meta/WhatsApp specifically

**For Meta App Review**: Use the URL `https://yourdomain.com/data-deletion` when submitting your app.

### Step 3: App Permissions

Request the following permissions in your Meta App:

#### Required Permissions

1. **whatsapp_business_messaging**
   - Purpose: Send and receive WhatsApp messages
   - Justification: "Our platform enables businesses to manage customer conversations via WhatsApp Business API"

2. **whatsapp_business_management**
   - Purpose: Manage WhatsApp Business accounts
   - Justification: "Our platform allows businesses to connect and manage their WhatsApp Business accounts"

### Step 4: App Review Submission

1. Go to Meta App Dashboard → App Review
2. Add the permissions listed above
3. Provide the privacy policy URL
4. Provide data deletion instructions URL
5. Add a demo video showing the app functionality
6. Submit for review

**Review Timeline**: Typically 3-5 business days

### Step 5: Webhook Configuration

After approval, configure your webhook:

- **Webhook URL**: `https://yourdomain.com/api/webhooks/whatsapp`
- **Verify Token**: Use the value from `WHATSAPP_VERIFY_TOKEN` environment variable
- **Subscribe to events**:
  - `messages`
  - `message_status`

---

## 4. Stripe Webhook Setup

### Prerequisites

- Stripe account in production mode
- Products and prices created in Stripe Dashboard

### Step 1: Create Products and Prices

1. Go to Stripe Dashboard → Products
2. Create 3 products:
   - **Starter** - $29/month
   - **Growth** - $79/month
   - **Agency** - $199/month
3. For each product, create a recurring price
4. Copy the Price IDs (format: `price_...`)

### Step 2: Configure Webhook Endpoint

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. **Endpoint URL**: `https://yourdomain.com/api/webhooks/stripe`
4. **Events to listen for**:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Click "Add endpoint"
6. Copy the **Webhook Signing Secret** (starts with `whsec_...`)

### Step 3: Add Webhook Secret to Environment Variables

Add the webhook secret to your Vercel environment variables:

```
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Step 4: Test Webhook

1. Create a test checkout session
2. Complete the payment flow
3. Verify the webhook is received in your Stripe Dashboard
4. Check your application logs for webhook processing

---

## Post-Deployment Checklist

- [ ] All environment variables configured in Vercel
- [ ] Database schema synced with production
- [ ] Privacy policy page created and accessible
- [ ] Data deletion instructions page created and accessible
- [ ] Meta App Review submitted
- [ ] Stripe webhook configured and tested
- [ ] WhatsApp webhook configured and tested
- [ ] Rate limiting configured (Upstash Redis)
- [ ] SSL certificate active (automatic with Vercel)
- [ ] Custom domain configured
- [ ] Monitoring and error tracking set up (Sentry recommended)

---

## Troubleshooting

### Database Connection Issues

- Verify `DATABASE_URL` is correct
- Check Supabase connection pooling settings
- Ensure IP whitelist allows Vercel's IP ranges

### Webhook Verification Failures

- Verify `META_APP_SECRET` matches exactly
- Check webhook signature verification logic
- Ensure webhook URL is publicly accessible

### Stripe Webhook Failures

- Verify webhook secret is correct
- Check Stripe Dashboard webhook delivery logs
- Ensure endpoint returns 200 OK

### Rate Limiting Issues

- Verify Upstash Redis credentials
- Check Redis connection in logs
- Ensure fail-open logic is working

---

## Security Best Practices

1. **Never commit `.env` files** to version control
2. **Rotate secrets regularly** (API keys, webhooks secrets)
3. **Enable 2FA** on all accounts (Vercel, Stripe, Meta)
4. **Monitor logs** for suspicious activity
5. **Keep dependencies updated** with `npm audit fix`
6. **Use HTTPS only** (automatic with Vercel)
7. **Implement IP whitelisting** for database access
8. **Regular backups** of database (Supabase provides this)

---

## Support

For issues related to:
- **Vercel Deployment**: https://vercel.com/docs
- **Database**: https://supabase.com/docs
- **Meta/WhatsApp**: https://developers.facebook.com/docs
- **Stripe**: https://stripe.com/docs
