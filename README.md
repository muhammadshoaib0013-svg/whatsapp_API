# WhatsApp Automation SaaS

Official WhatsApp Business API automation platform for businesses.

## Project Purpose

This is a production-grade SaaS platform that allows businesses to connect their own official WhatsApp Business API credentials to:
- Manage conversations in a unified inbox
- Send and receive messages programmatically
- Build basic chatbot automations
- Manage contacts and templates
- Run campaigns with compliance controls
- Track usage and analytics
- Manage billing and subscriptions
- Admin monitoring and oversight

**IMPORTANT**: This platform uses ONLY the official WhatsApp Business API from Meta. It does NOT use unofficial WhatsApp Web QR automation, and it is NOT an API key resale marketplace.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Validation**: Zod
- **Authentication**: Auth.js/NextAuth (to be added in Phase 1)
- **API**: Official Meta Graph API for WhatsApp Business

## Local Setup

### Prerequisites

- Node.js 18+ installed
- PostgreSQL database (local or cloud)
- npm or yarn package manager

### Installation

1. Clone or navigate to the project directory:
```bash
cd "e:\Projects\Whatsapp API"
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env
```

4. Update `.env` with your actual values:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `NEXTAUTH_SECRET`: Generate a secure random string
   - `NEXTAUTH_URL`: http://localhost:3000 (for local dev)
   - `META_APP_ID`: Your Meta App ID from Meta Developer Portal
   - `META_APP_SECRET`: Your Meta App Secret from Meta Developer Portal
   - `WHATSAPP_VERIFY_TOKEN`: A random string for webhook verification
   - `TOKEN_ENCRYPTION_KEY`: A 32-byte encryption key for token storage

5. Run database migrations (when Prisma is configured in Phase 1):
```bash
npx prisma migrate dev
```

6. Start the development server:
```bash
npm run dev
```

7. Open http://localhost:3000 in your browser

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Safety Rules

### ⚠️ CRITICAL SECURITY RULES

1. **NEVER hardcode secrets** in the codebase
   - No API keys, tokens, passwords, or secrets in source files
   - All sensitive data must be in environment variables
   - Use `.env.example` as a template only

2. **NEVER expose WhatsApp/Meta tokens to the frontend**
   - All WhatsApp API calls must go through backend API routes
   - Tokens must be encrypted at rest in the database
   - Never send access tokens to client-side JavaScript

3. **NO unofficial WhatsApp automation**
   - This platform uses ONLY the official WhatsApp Business API
   - No WhatsApp Web QR code automation
   - No unofficial libraries or workarounds

4. **NO spam tools without compliance**
   - All bulk messaging must have opt-in consent
   - Implement rate limiting and message quotas
   - Follow WhatsApp Business API policies and compliance requirements

5. **Tenant isolation**
   - Each tenant's data must be strictly isolated
   - No cross-tenant data access
   - Implement proper row-level security in database queries

6. **Secure token storage**
   - Encrypt all WhatsApp access tokens at rest
   - Use strong encryption (AES-256)
   - Rotate tokens periodically

## Project Structure

```
whatsapp-automation-saas/
├── app/                      # Next.js App Router
│   ├── api/                 # API routes
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home page
│   └── globals.css         # Global styles
├── components/              # React components
│   └── ui/                 # UI components
├── lib/                    # Utility libraries
│   ├── config/            # Configuration constants
│   ├── security/          # Security utilities (encryption)
│   ├── validation/        # Zod validation schemas
│   └── whatsapp/         # WhatsApp API client
├── prisma/                # Database schema and migrations
│   └── schema.prisma      # Prisma schema
├── docs/                  # Documentation
│   ├── PROJECT_ROADMAP.md
│   ├── SECURITY_RULES.md
│   └── ACCEPTANCE_CRITERIA.md
├── scripts/               # Utility scripts
├── .env.example          # Environment variables template
├── .gitignore           # Git ignore rules
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript configuration
├── tailwind.config.ts   # Tailwind configuration
└── next.config.js       # Next.js configuration
```

## Development Phases

See `docs/PROJECT_ROADMAP.md` for the complete development roadmap.

## Current Phase

**Phase 0 - Scaffold**: Project structure and basic setup complete.

## Support

For questions or issues, refer to the documentation in the `docs/` folder.
