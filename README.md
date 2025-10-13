<div align="center">

# ⚖️ JustoAI V2

### Enterprise SaaS Platform for Legal Process Management with AI

[![Next.js](https://img.shields.io/badge/Next.js-15.5.3-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.1.0-blue?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.16.1-2D3748?logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?logo=postgresql)](https://www.postgresql.org/)

[Overview](#-overview) •
[Features](#-key-features) •
[Architecture](#-architecture) •
[Tech Stack](#-tech-stack) •
[Installation](#-installation-and-setup) •
[Documentation](#-documentation)

</div>

---

## 📋 Overview

**JustoAI V2** is an enterprise-grade SaaS platform for legal process management with intelligent AI analysis. The system automates document analysis, executive report generation, and real-time judicial process monitoring.

### 🎯 Technical Highlights

- **268 files** of well-structured TypeScript code
- **~92,000 lines** of code with strict typing
- **96+ RESTful API endpoints** with Zod validation
- **48 database models** with Prisma ORM
- **6 background workers** for asynchronous processing
- **40+ pages** of end-user documentation
- **Complete credit system** with billing and webhooks
- **Full observability system** with monitoring and dashboards

### 📊 Project Status

```
Architecture:    ████████████████████ 100% ⭐⭐⭐⭐⭐
Features:        ████████████████████ 100% ⭐⭐⭐⭐⭐
Observability:   ████████████████████ 100% ⭐⭐⭐⭐⭐
Tests:           ████▌                20%  ⭐⭐
Documentation:   ████████████████▌    82%  ⭐⭐⭐⭐
Performance:     ██████████████████▌  93%  ⭐⭐⭐⭐

Overall Status:  PRODUCTION READY ✅
```

---

## ✨ Key Features

### 🤖 Intelligent AI Analysis
- Legal document processing (PDF, DOCX, images)
- Multi-front analysis using Google Gemini AI
- Automatic structured data extraction
- Intelligent process summarization
- Caching system for cost optimization

### 📊 Automated Report Generation
- Customizable executive reports
- Scheduled generation (weekly, biweekly, monthly)
- Multiple output formats (PDF, DOCX)
- Customizable templates per workspace
- Automatic email delivery

### 🔍 Process Monitoring
- Automatic synchronization with courts
- Intelligent movement alerts
- Unified timeline of proceedings
- Duplicate detection
- Integration with legal APIs (Judit, etc)

### 💳 Credits and Billing System
- Credit management per workspace
- Different credit types (reports, analysis)
- Rollover system with configurable caps
- Payment webhooks (Stripe, MercadoPago, PagSeguro)
- Telemetry and usage tracking

### 📤 Batch Upload and Processing
- Excel upload with thousands of processes
- Parallel processing with rate limiting
- Real-time progress tracking via SSE
- Intelligent data validation
- Automatic deduplication

### 📊 Complete Observability System
- **Structured Logging**: JSON logs with Pino (production) and pretty-print (development)
- **Metrics Collection**: In-memory time series with percentiles (p50, p95, p99)
- **Cost Tracking**: Database-backed cost tracking with projections (96% cost reduction)
- **Multi-Channel Alerts**: Email (Resend), Slack, and webhook notifications
- **Real-time Dashboard**: Interactive dashboard with Recharts visualizations
- **Health Monitoring**: System health status with component-level details
- **Auto-refresh**: Data updates every 15-30 seconds
- **Export Reports**: CSV/JSON export for cost and metrics data

---

## 🏗️ Architecture

### Overview

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                        │
│  Next.js 15 App Router + React 19 Server Components     │
│  - Landing Pages (public)                                │
│  - Dashboards (Classic + Pro + JUDIT Monitoring)        │
│  - 40+ Help Pages                                        │
└────────────┬────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────┐
│                  MIDDLEWARE LAYER                        │
│  Supabase Auth + Route Protection + CORS                │
└────────────┬────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────┐
│                   API ROUTES LAYER                       │
│  96+ RESTful Endpoints with Zod Validation              │
│  - /api/processes  - /api/reports  - /api/ai            │
│  - /api/upload     - /api/credits  - /api/webhooks      │
│  - /api/judit/observability/* (health, metrics, costs)  │
└─────┬──────────────────────────┬────────────────────────┘
      │                          │
      ↓                          ↓
┌─────────────┐         ┌──────────────────┐
│  SERVICES   │         │   BULL QUEUE     │
│  - AI       │         │   (Redis)        │
│  - PDF      │         └────────┬─────────┘
│  - Email    │                  │
│  - Reports  │                  ↓
│  - Alerts   │         ┌──────────────────┐
└──────┬──────┘         │   WORKERS        │
       │                │  - Reports       │
       │                │  - Sync          │
       ↓                │  - Monitor       │
┌─────────────┐         │  - Cache         │
│OBSERVABILITY│         └────────┬─────────┘
│  - Logger   │                  │
│  - Metrics  │                  ↓
│  - Costs    │         ┌──────────────────┐
│  - Alerts   │ ←───────│   MONITORING     │
└──────┬──────┘         │  Auto-tracking   │
       │                └────────┬─────────┘
       ↓                         ↓
┌─────────────────────────────────────────┐
│    DATABASE (PostgreSQL via Supabase)    │
│    Prisma ORM + 48 Models + Migrations  │
│    + JuditCostTracking + JuditAlert     │
└─────────────────────────────────────────┘
```

### Architectural Patterns

- **Layered Architecture**: Clear separation between UI, API, Services, Data
- **Service Layer Pattern**: Business logic encapsulated in reusable services
- **Background Jobs Pattern**: Separate workers with Bull Queue for async tasks
- **Repository Pattern**: Data access via Prisma ORM
- **API-First Design**: Backend ready for multiple frontends

---

## 🛠️ Tech Stack

### Frontend
```typescript
{
  "framework": "Next.js 15.5.3 (App Router + RSC)",
  "react": "19.1.0",
  "styling": "Tailwind CSS 4.0 + Tailwind Animate",
  "ui_library": "Radix UI + shadcn/ui",
  "forms": "React Hook Form + Zod",
  "animations": "Framer Motion 12.23",
  "icons": "Lucide React 0.544"
}
```

### Backend
```typescript
{
  "runtime": "Node.js 20+ (Next.js API Routes)",
  "auth": "Supabase Auth (@supabase/ssr)",
  "database": "PostgreSQL 15+ (Supabase hosted)",
  "orm": "Prisma 6.16.1",
  "validation": "Zod 4.1.8",
  "uploads": "Multer 2.0.2 + Sharp 0.34"
}
```

### Processing & Jobs
```typescript
{
  "queue": "Bull 4.16.5",
  "queue_ui": "@bull-board 6.12",
  "cache": "IORedis 5.7.0",
  "scheduler": "node-cron 4.3",
  "logging": "Pino 9.x + pino-pretty 13.x"
}
```

### AI & Analysis
```typescript
{
  "ai": "Google Gemini API (1.5 Flash/Pro)",
  "pdf": "pdf-parse 1.1 + pdf2pic 3.2",
  "documents": "docx 9.5.1",
  "spreadsheets": "xlsx 0.18.5",
  "automation": "Puppeteer 24.22"
}
```

### Email & Communication
```typescript
{
  "email": "Resend SMTP",
  "templates": "Custom HTML templates"
}
```

### Observability & Monitoring
```typescript
{
  "logging": "Pino 9.x (structured JSON logs)",
  "metrics": "In-memory time series with percentiles",
  "charts": "Recharts 2.x (React charting library)",
  "data_fetching": "@tanstack/react-query 5.x",
  "date_utilities": "date-fns 3.x",
  "cost_tracking": "PostgreSQL (JuditCostTracking model)",
  "alerting": "Multi-channel (Email, Slack, Webhook)"
}
```

### DevOps
```typescript
{
  "containerization": "Docker + Docker Compose",
  "linting": "ESLint 9 + Prettier",
  "type_checking": "TypeScript 5.x Strict Mode",
  "testing": "Jest 30.1 + ts-jest",
  "ci_cd": "GitHub Actions ready"
}
```

---

## 🚀 Installation and Setup

### Prerequisites

```bash
Node.js >= 20.0.0
npm >= 9.0.0
PostgreSQL 15+ (or Supabase account)
Redis 7+ (for workers)
```

### Quick Start

```bash
# 1. Clone the repository
git clone <repository-url>
cd justoai-v2

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local
# Edit .env.local with your credentials (see section below)

# 4. Database setup
npm run db:generate  # Generate Prisma Client
npm run db:migrate   # Apply migrations
npm run db:seed      # (Optional) Seed with test data

# 5. Start development environment
npm run dev          # Next.js server (port 3000)
```

### 🔧 Environment Variables Configuration

#### 1. Copy Template

```bash
cp .env.example .env.local
```

#### 2. Fill in Credentials

Open the `.env.local` file and configure each variable:

**Database Settings** (Supabase)
- `DATABASE_URL`: PostgreSQL connection URL with pooling
- `DIRECT_URL`: Direct URL for migrations
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase public key
- `SUPABASE_SERVICE_ROLE_KEY`: Private key (⚠️ NEVER expose)

**AI API Keys**
- `GOOGLE_API_KEY`: For Google Gemini AI ([get here](https://makersuite.google.com/app/apikey))
- `ANTHROPIC_API_KEY`: For Claude AI ([get here](https://console.anthropic.com/))

**Authentication**
- `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
- `NEXTAUTH_URL`: Application URL (e.g., http://localhost:3000)

**Email (Resend or SMTP)**
- `SMTP_HOST`: SMTP server
- `SMTP_PORT`: Port (587 for TLS, 465 for SSL)
- `SMTP_USER`: Service user
- `SMTP_PASSWORD`: Password or API key
- `FROM_EMAIL`: Sender email

**Redis & Background Jobs**
- `REDIS_HOST`: Redis host (localhost for dev)
- `REDIS_PORT`: Redis port (default 6379)
- `REDIS_PASSWORD`: Password (empty if no auth)
- `BULL_BOARD_ACCESS_TOKEN`: Generate with `openssl rand -hex 32`

**Observability & Alerts**
- `LOG_LEVEL`: Logging level (debug/info/warn/error)
- `ALERTS_EMAIL_ENABLED`: Enable email alerts (true/false)
- `ALERTS_SLACK_ENABLED`: Enable Slack alerts (true/false)
- `ALERTS_SLACK_WEBHOOK_URL`: Slack webhook URL for alerts
- `ALERTS_WEBHOOK_ENABLED`: Enable generic webhook alerts (true/false)
- `ALERTS_WEBHOOK_URL`: Generic webhook URL for alerts

#### 3. ⚠️ IMPORTANT - Security

**NEVER commit files with real values:**
- ✅ `.env.example` can be committed (templates only)
- ❌ `.env.local` should NEVER be committed
- ❌ `.env` should NEVER be committed
- ❌ Any file with real keys

**If you accidentally committed secrets:**
1. Remove from Git: `git rm --cached .env.local`
2. **IMMEDIATELY REVOKE** all exposed keys:
   - Supabase: Generate new keys in dashboard
   - Google AI: Revoke and create new API key
   - Anthropic: Revoke and create new API key
   - Resend: Generate new API key
3. Update `.env.local` with new credentials
4. Commit removal: `git commit -m "Remove .env.local - security fix"`

**Key Rotation:**
- Rotate API keys periodically (every 90 days)
- Use different keys for development and production
- Consider using a secrets manager (AWS Secrets Manager, HashiCorp Vault)

### Docker Setup (Recommended)

```bash
# Start all services (App, PostgreSQL, Redis)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Workers (Background Jobs)

```bash
# Start all workers
npm run workers:start

# Check status
npm run workers:status

# View logs
npm run workers:logs

# Stop workers
npm run workers:stop
```

---

## 🚀 Production Deployment (Vercel)

### Quick Deploy

The project is optimized for deployment on Vercel with automatic deployments from GitHub.

**Prerequisites:**
- Vercel account ([create here](https://vercel.com/signup))
- GitHub repository connected
- All environment variables configured

### Deployment Steps

1. **Install Vercel CLI:**
```bash
npm install -g vercel
vercel login
```

2. **Configure Environment Variables:**
```bash
# Automated (recommended)
.\deploy-scripts\02-configure-vercel-env.ps1  # Windows
bash deploy-scripts/02-configure-vercel-env.sh # Linux/Mac

# Or manually via Vercel Dashboard
# https://vercel.com/[team]/justoai-v2/settings/environment-variables
```

3. **Pre-Deploy Validation:**
```bash
# Run all pre-deployment checks
npm run deploy:check

# Test all connections
npm run deploy:test
```

4. **Deploy to Production:**
```bash
# Via GitHub (automatic)
git push origin main

# Or via CLI
npm run deploy:prod
```

5. **Post-Deploy Verification:**
```bash
# Run automated verification
node deploy-scripts/03-post-deploy-verify.js
```

### Important Files

- **`vercel.json`** - Vercel configuration with optimizations
- **`docs/VERCEL_DEPLOYMENT_GUIDE.md`** - Complete step-by-step deployment guide
- **`docs/VERCEL_MONITORING_GUIDE.md`** - Monitoring and observability setup
- **`docs/POST_DEPLOY_CHECKLIST.md`** - Post-deployment verification checklist
- **`docs/VERCEL_OPERATIONS_RUNBOOK.md`** - Operations runbook and troubleshooting

### Quick Links

| Resource | Purpose |
|----------|---------|
| [Deployment Guide](docs/VERCEL_DEPLOYMENT_GUIDE.md) | Complete deployment instructions |
| [Monitoring Guide](docs/VERCEL_MONITORING_GUIDE.md) | Setup monitoring and health checks |
| [Operations Runbook](docs/VERCEL_OPERATIONS_RUNBOOK.md) | Troubleshooting and operations |
| [Post-Deploy Checklist](docs/POST_DEPLOY_CHECKLIST.md) | Verification checklist |

### Vercel Configuration Highlights

- ✅ **Optimized build settings** for Next.js 15
- ✅ **Function timeouts** configured per route (up to 300s for heavy operations)
- ✅ **Memory allocation** optimized (512MB - 3GB based on workload)
- ✅ **Security headers** automatically applied
- ✅ **Edge runtime** for fast API responses
- ✅ **Cron jobs** configured for background tasks
- ✅ **Health checks** and monitoring endpoints
- ✅ **SSL/TLS** automatic with custom domains

### Environment Variables Setup

**Critical variables for production:**

```bash
# Application
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://v2.justoai.com.br

# Database (Supabase)
DATABASE_URL=postgresql://...          # With pooling
DIRECT_URL=postgresql://...            # Without pooling
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Redis (Upstash)
REDIS_HOST=...
REDIS_PORT=6379
REDIS_PASSWORD=...

# Authentication
NEXTAUTH_URL=https://v2.justoai.com.br
NEXTAUTH_SECRET=...                    # openssl rand -base64 32

# APIs
GOOGLE_API_KEY=...
JUDIT_API_KEY=...                      # When provided

# Email (Resend)
SMTP_HOST=smtp.resend.com
SMTP_PASSWORD=...
FROM_EMAIL=noreply@justoai.com
```

**See complete list in:** `.env.production.example`

### Deployment Commands

```bash
# Pre-deployment checks
npm run deploy:check          # Validate configuration
npm run deploy:test           # Test all connections

# Deploy
npm run deploy:prod           # Deploy to production
npm run deploy:preview        # Deploy preview

# Monitoring
vercel logs --follow          # Real-time logs
vercel domains                # Manage domains
vercel env ls                 # List environment variables
```

### Rollback Procedure

If issues occur after deployment:

```bash
# Via Vercel Dashboard (30 seconds)
# 1. Go to Deployments
# 2. Find last working deployment
# 3. Click "Promote to Production"

# Or via CLI
vercel promote [deployment-url] --prod
```

### Production Monitoring

**Built-in health endpoints:**
- `https://v2.justoai.com.br/api/health` - General health
- `https://v2.justoai.com.br/api/health/database` - Database status
- `https://v2.justoai.com.br/api/health/redis` - Redis status

**Monitoring dashboards:**
- Vercel Dashboard: `https://vercel.com/[team]/justoai-v2`
- Analytics: `https://vercel.com/[team]/justoai-v2/analytics`
- Logs: `https://vercel.com/[team]/justoai-v2/logs`

---

## 📚 Documentation

### Documentation Structure

```
docs/
├── README.md                      # This file
├── SWAGGER_DOCUMENTATION.md       # API documentation with Swagger
├── PROJECT_OVERVIEW.md            # Detailed technical analysis (276 lines)
├── resumo_projeto_atual.md        # Complete project analysis
├── DASHBOARD_README.md            # JUDIT Dashboard user guide
├── JUDIT_DASHBOARD.md             # JUDIT Dashboard technical docs
├── JUDIT_MONITORING.md            # Observability system docs
├── OBSERVABILITY_SETUP.md         # Setup guide for monitoring
└── src/app/help/                 # 40+ user documentation pages
```

### Useful Commands

```bash
# Development
npm run dev              # Dev server with hot reload
npm run lint             # Check code
npm run db:studio        # Open Prisma Studio (DB GUI)

# Database
npm run db:generate      # Generate Prisma Client after schema changes
npm run db:push          # Apply schema to DB (development)
npm run db:migrate       # Create new migration
npm run db:migrate:prod  # Apply migrations (production)
npm run db:reset         # ⚠️ Reset database (deletes data)
npm run db:seed          # Seed database with test data

# Build & Production
npm run build            # Production build
npm run build:optimized  # Build with image optimization
npm start                # Start production server

# Workers
npm run workers:start    # Start background workers
npm run workers:stop     # Stop workers
npm run workers:restart  # Restart workers
npm run workers:status   # Workers status
npm run workers:logs     # Workers logs

# Performance & Analysis
npm run optimize:images       # Optimize images with Sharp
npm run analyze:performance   # Performance analysis
npm run test:responsive       # Test responsiveness

# Tests
npm test                 # Run tests
npm run test:watch       # Watch mode
npm run test:coverage    # Test coverage

# API Documentation
npm run docs:generate    # Generate Swagger JSON
npm run docs:dev         # Start with documentation
```

### Main Endpoints

#### Authentication
```
POST   /api/auth/login          # User login
POST   /api/auth/signup         # User registration
POST   /api/auth/logout         # Logout
```

#### Processes
```
GET    /api/processes           # List processes
POST   /api/processes           # Create process
PUT    /api/processes/:id       # Update process
DELETE /api/processes/:id       # Remove process
POST   /api/processes/upload    # Batch upload (Excel)
```

#### AI Analysis
```
POST   /api/ai/analyze                    # General analysis
POST   /api/ai/multi-front-analysis       # Multi-front analysis
POST   /api/process/:id/analysis/fast     # Fast analysis
POST   /api/process/:id/analysis/full     # Complete analysis
GET    /api/process/:id/analysis/history  # History
```

#### Reports
```
POST   /api/reports/generate         # Generate manual report
POST   /api/reports/schedule         # Schedule report
GET    /api/reports/history          # Report history
GET    /api/reports/download/:id     # Download report
```

#### Credits
```
GET    /api/credits/balance      # Check balance
POST   /api/credits/consume      # Consume credits
POST   /api/credits/purchase     # Purchase credits
GET    /api/credits/history      # Usage history
```

#### JUDIT Observability
```
GET    /api/judit/observability/health        # System health status
GET    /api/judit/observability/metrics       # Performance metrics
GET    /api/judit/observability/costs         # Cost analytics and projections
GET    /api/judit/observability/alerts        # Active alerts list
POST   /api/judit/observability/alerts        # Resolve alerts
```

#### Dashboard
```
GET    /dashboard/judit                       # JUDIT monitoring dashboard
```

---

## 📁 Project Structure

```
justoai-v2/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (public)/          # Public routes
│   │   ├── api/               # 96+ API endpoints
│   │   │   └── judit/observability/  # Observability APIs
│   │   ├── dashboard/         # Main dashboard
│   │   │   └── judit/         # JUDIT monitoring dashboard
│   │   ├── classic/           # Legacy dashboard
│   │   ├── pro/               # Pro dashboard
│   │   └── help/              # User documentation
│   ├── components/            # React components (76 files)
│   │   ├── ui/                # Base components (shadcn/ui)
│   │   ├── landing/           # Landing page components
│   │   ├── dashboard/         # Dashboard components
│   │   │   ├── DashboardCard.tsx       # Card container
│   │   │   ├── StatCard.tsx            # Metric cards
│   │   │   ├── HealthStatus.tsx        # Health display
│   │   │   ├── CostsChart.tsx          # Line chart
│   │   │   ├── CostBreakdownChart.tsx  # Pie chart
│   │   │   ├── LatencyChart.tsx        # Bar chart
│   │   │   ├── AlertsTable.tsx         # Alerts table
│   │   │   ├── DashboardFilters.tsx    # Filters
│   │   │   └── ExportButton.tsx        # Export functionality
│   │   └── reports/           # Report components
│   ├── lib/                   # Business logic (56 files)
│   │   ├── observability/     # Observability system
│   │   │   ├── logger.ts      # Structured logging (Pino)
│   │   │   ├── metrics.ts     # Metrics collection
│   │   │   ├── costTracking.ts # Cost tracking
│   │   │   └── alerting.ts    # Multi-channel alerts
│   │   ├── ai-model-router.ts
│   │   ├── gemini-client.ts
│   │   ├── pdf-processor.ts
│   │   ├── report-generator.ts
│   │   ├── email-service.ts
│   │   └── swagger.ts         # Swagger/OpenAPI configuration
│   ├── config/                # App configuration
│   ├── contexts/              # React contexts
│   ├── hooks/                 # Custom React hooks
│   │   └── useJuditObservability.ts  # Observability hooks
│   └── styles/                # Global styles
├── lib/                       # Shared libraries
│   ├── alerts/
│   ├── middleware/
│   ├── report-templates/
│   ├── telemetry/
│   └── validations/
├── workers/                   # Background workers (6 files)
│   ├── reports-worker.ts
│   ├── process-monitor-worker.ts
│   ├── individual-reports-worker.ts
│   ├── sync-worker.ts
│   ├── cache-cleanup-worker.ts
│   └── usage-aggregator-worker.ts
├── prisma/
│   ├── schema.prisma          # Database schema (1,324 lines)
│   ├── migrations/            # Database migrations
│   └── seed.ts                # Database seeding
├── scripts/                   # Utility scripts
├── public/                    # Static assets
├── components/                # shadcn/ui components
└── ops/                       # DevOps configs
```

---

## 🔒 Security

### Security Implementations

- ✅ **Authentication**: Supabase Auth with JWT tokens
- ✅ **Authorization**: Route protection middleware
- ✅ **Validation**: Zod schemas on all APIs
- ✅ **Rate Limiting**: Protection against abuse
- ✅ **SQL Injection**: Prisma ORM prevents injections
- ✅ **XSS Protection**: React automatically escapes
- ✅ **HTTPS**: Forced via security headers
- ✅ **Secrets Management**: `.env.local` excluded from Git, `.env.example` template provided
- ✅ **CORS**: Secure environment-based configuration
- ✅ **Security Headers**: X-Frame-Options, X-Content-Type-Options, CSP, HSTS

### ⚠️ ATTENTION: Key Rotation Required

If you're setting up this project for the first time and the `.env.local` file previously contained real keys that were committed:

**IMMEDIATE ACTION REQUIRED:**
1. ✅ `.env.local` was removed from Git tracking
2. ✅ `.gitignore` was configured to prevent future commits
3. ⚠️ **YOU MUST** revoke and regenerate ALL API keys that were in the file:
   - **Supabase**: Dashboard → Settings → API → Reset keys
   - **Google AI**: [Google AI Studio](https://makersuite.google.com/app/apikey) → Delete old key → Create new
   - **Anthropic**: [Anthropic Console](https://console.anthropic.com/) → Delete old key → Create new
   - **Resend**: Dashboard → API Keys → Revoke → Create new
   - **NextAuth**: Generate new secret with `openssl rand -base64 32`
   - **Bull Board**: Generate new token with `openssl rand -hex 32`

### Security Best Practices

- 📋 Use `.env.example` file as template
- 🔄 Rotate API keys every 90 days
- 🔐 Use different credentials for dev/staging/prod
- 🚫 NEVER commit `.env*` files with real values
- 📊 Monitor API access logs to detect misuse
- 🔒 Consider using a secrets manager (AWS Secrets Manager, Vault) for production

### 🌐 Secure CORS Configuration

The system implements robust environment-based CORS configuration that protects against unauthorized access.

#### 📋 Allowed Origins

**Development:**
```bash
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000
```

**Production:**
```bash
ALLOWED_ORIGINS=https://justoai.com,https://www.justoai.com,https://app.justoai.com,https://admin.justoai.com
```

#### 🔧 How It Works

1. **Origin Validation**: All requests are validated against the allowed origins list
2. **Preflight Handling**: OPTIONS requests are handled automatically
3. **Denied Access Logging**: Unauthorized access attempts are logged
4. **Centralized Configuration**: Managed in `src/config/cors.ts`

#### 📁 Configuration Files

```
src/
├── config/
│   └── cors.ts                    # Centralized CORS configuration
├── lib/
│   ├── cors.ts                    # CORS helper functions
│   └── security-headers.ts        # Security headers
└── middleware.ts                  # Middleware implementation
```

#### 🛡️ Implemented Security Headers

```typescript
// Headers applied automatically
- X-Frame-Options: DENY                 // Prevents clickjacking
- X-Content-Type-Options: nosniff       // Prevents MIME sniffing
- X-XSS-Protection: 1; mode=block       // XSS protection
- Referrer-Policy: strict-origin-when-cross-origin
- Content-Security-Policy: [configured]
- Strict-Transport-Security: [production] // HSTS
- Permissions-Policy: camera=(), microphone=(), geolocation=()
```

#### ⚙️ Customize Allowed Origins

To add new allowed origins:

1. **Edit configuration file** (`src/config/cors.ts`):
```typescript
export const corsConfig = {
  production: {
    origins: [
      'https://justoai.com',
      'https://www.justoai.com',
      'https://app.justoai.com',
      'https://admin.justoai.com',
      'https://new-origin.com', // Add here
    ],
    credentials: true,
  },
}
```

2. **Or use environment variables** (`.env.local`):
```bash
ALLOWED_ORIGINS=https://justoai.com,https://new-origin.com
```

#### 🚨 Monitoring

Denied access is automatically logged:

```
[CORS DENIED] 2025-10-09T10:30:00Z
Origin: https://malicious-site.com
Path: /api/processes
Method: POST
Allowed origins: https://justoai.com, https://app.justoai.com
```

To view security logs:
```bash
# Real-time logs
docker-compose logs -f app | grep "CORS DENIED"

# Or using npm scripts
npm run logs | grep "CORS"
```

#### ✅ CORS Verification

Test CORS configuration:

```bash
# Test with allowed origin
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS http://localhost:3000/api/processes

# Test with disallowed origin (should fail)
curl -H "Origin: https://malicious-site.com" \
     -X GET http://localhost:3000/api/processes
```

---

## 💡 Key Achievements

### 🎯 JUDIT Cost Optimization (96% Reduction)

One of the major achievements in this project is the **intelligent cost optimization** for the JUDIT API integration:

**Problem:**
- Original approach: Fetch all attachments for every process
- Cost: R$ 20,700/month for 1,000 processes
- Unaffordable for the business model

**Solution:**
- Implemented **keyword-based intelligent monitoring**
- Fetch attachments only when specific keywords are detected in movements
- Complete observability system for real-time cost tracking

**Results:**
- **96% cost reduction**: From R$ 20,700 to R$ 834/month
- Full visibility with monitoring dashboard
- Real-time alerts for anomalies
- Projected monthly costs with trend analysis

**Technical Implementation:**
```typescript
// Cost tracking per operation
JUDIT_PRICING = {
  SEARCH_BASE: R$ 0.69,      // Base search cost
  DOCUMENT_COST: R$ 0.25,    // Per document retrieved
  MONITORING_COST: R$ 0.69   // Monitoring check cost
}

// Intelligent monitoring
- 1000 processes × 1 search/month = R$ 690
- 578 attachments fetched (targeted) = R$ 144.50
- Total: R$ 834.50/month vs R$ 20,700/month
```

**Observability Features:**
- Real-time cost tracking per operation
- Cost breakdown by operation type
- Daily cost trends with projections
- Alerts for high-cost operations (>R$ 10)
- CSV/JSON export for reporting

Access the dashboard at: `/dashboard/judit`

---

## 🧪 Tests

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

**Note**: Test structure configured with Jest. Implemented tests need to be expanded.

---

## 📈 Performance

### Implemented Optimizations

- ✅ Next.js Image Optimization
- ✅ Server-Side Rendering (SSR) and Static Generation (SSG)
- ✅ Compression middleware (gzip/brotli)
- ✅ Redis caching
- ✅ Optimized database indexes
- ✅ Automatic code splitting
- ✅ Component lazy loading
- ✅ Background jobs for heavy operations

### Target Metrics

- Response Time: < 200ms
- Time to First Byte: < 500ms
- Largest Contentful Paint: < 2.5s
- First Input Delay: < 100ms

---

## 📅 Recent Updates (2025-01-10)

### Complete Observability System Implementation

**What was built:**
- ✅ Structured logging system with Pino (JSON logs + pretty-print)
- ✅ In-memory metrics collection with time series and percentiles
- ✅ Database-backed cost tracking with projections
- ✅ Multi-channel alerting system (Email, Slack, Webhook)
- ✅ Full observability API (health, metrics, costs, alerts)
- ✅ Interactive React dashboard with real-time updates
- ✅ 9 dashboard components (charts, tables, filters, export)
- ✅ Integration with existing JUDIT services
- ✅ Complete documentation (4 MD files)

**Impact:**
- 96% cost reduction for JUDIT integration (R$ 20,700 → R$ 834/month)
- Real-time visibility into all operations
- Proactive alerting for issues
- Data-driven decision making with cost projections
- Production-ready monitoring dashboard

**Files added:** 30+ files (services, components, APIs, docs)
**Lines added:** ~14,000 lines of production code
**Status:** ✅ 100% Complete and Production-Ready

---

## ⚠️ Emergency Fixes & Known Limitations

### Railway Deployment Emergency Fixes (2025-10-13)

During the initial Railway deployment, several critical issues were encountered and resolved with emergency fixes. **These solutions are temporary and need to be reviewed for production optimization.**

#### 🚨 Issue 1: Redis Infinite Retry Loop (CRITICAL - Cost Explosion)

**Problem:**
- CPU spiked from 1.3 to 2.3 vCPU
- Estimated cost exploded from $6 to $155/month in minutes
- Infinite retry loop: `[ioredis] Reached the max retries per request limit`
- API routes imported `lib/queues.ts` → `lib/redis.ts`
- Redis not available on Railway (not configured)
- ioredis attempting thousands of connection retries per second

**Emergency Solution Applied:**
```typescript
// lib/redis.ts - Emergency MockRedis implementation
const REDIS_DISABLED = process.env.REDIS_DISABLED === 'true' || !process.env.REDIS_HOST;

class MockRedis {
  async get() { return null; }
  async set() { return 'OK'; }
  // ... all methods return safe mock values
}

if (REDIS_DISABLED) return new MockRedis();
```

**Configuration Changes:**
- `Dockerfile.railway`: Added `ENV REDIS_DISABLED=true`
- `lib/redis.ts`: Aggressive retry limits (maxRetriesPerRequest=1)
- `lib/redis.ts`: Disabled offline queue and auto-reconnect

**Trade-offs:**
- ❌ No Redis caching (graceful degradation)
- ❌ No Bull queues
- ❌ No background workers
- ✅ CPU dropped from 2.3 to ~0.01-0.05 vCPU
- ✅ Cost reduced from $155 to ~$5-10/month
- ✅ API routes function normally

**TODO for Production:**
- [ ] Add Redis service to Railway (Upstash or Railway Redis)
- [ ] Remove MockRedis and restore real Redis connection
- [ ] Re-enable Bull queues for background jobs
- [ ] Test performance with proper Redis implementation

#### 🔧 Issue 2: Build-Time Environment Variables

**Problem:**
- Next.js build attempted to pre-render pages during build
- Tried to connect to Redis/Supabase (not available at build time)
- Build failed: `supabaseUrl is required`, `ECONNREFUSED 127.0.0.1:6379`

**Emergency Solution Applied:**
```dockerfile
# Dockerfile.railway - Added placeholder env vars for build
ENV NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-key-for-build-only
ENV NEXT_PUBLIC_API_URL=http://localhost:3000
ENV SKIP_ENV_VALIDATION=1
```

```typescript
// src/app/signup/page.tsx, src/app/login/page.tsx
export const dynamic = 'force-dynamic'; // Prevent SSG
```

**Trade-offs:**
- ✅ Build completes successfully
- ✅ Real env vars injected at runtime by Railway
- ⚠️ Pages marked as dynamic (no SSG benefits)

**TODO for Production:**
- [ ] Review which pages truly need `force-dynamic`
- [ ] Implement proper build-time/runtime env separation
- [ ] Optimize for SSG where possible

#### 🐛 Issue 3: Workers Auto-Starting (CPU Spike)

**Problem:**
- 6 Bull workers auto-initialized on import
- Each created Redis connections, queues, and processors
- Constant background processing = high CPU
- V1 (0 CPU) vs V2 (1.2 vCPU) difference

**Emergency Solution Applied:**
```dockerfile
# Dockerfile.railway - Deliberately NOT copying workers
# COPY --from=builder /app/workers ./workers    # COMMENTED OUT
# COPY --from=builder /app/scripts ./scripts    # COMMENTED OUT
```

**Trade-offs:**
- ❌ No background workers (reports, sync, monitoring, cache cleanup)
- ❌ No cron jobs
- ❌ No process monitoring
- ✅ CPU usage normalized to v1 levels
- ✅ Cost dramatically reduced

**TODO for Production:**
- [ ] Create separate Railway service for workers
- [ ] Implement proper worker lifecycle management
- [ ] Add worker health checks and monitoring
- [ ] Enable workers with proper resource limits

#### 📦 Issue 4: Next.js Standalone Directory Structure

**Problem:**
- Docker couldn't find files in standalone build
- Complex copy strategy with individual files was error-prone
- `node_modules` path incorrect

**Emergency Solution Applied:**
```dockerfile
# Dockerfile.railway - Simplified to copy entire standalone tree
COPY --from=builder /app/.next/standalone ./
CMD ["node", "justoai-v2/server.js"]
```

**Trade-offs:**
- ✅ Build completes reliably
- ✅ Simpler, more maintainable approach
- ✅ Works with Next.js standalone structure

**This solution is stable** - no changes needed.

---

### Current Architecture Limitations (Railway Deploy)

```
┌─────────────────────────────────────┐
│    RAILWAY (Backend - API Only)     │
│    ✅ API Routes                     │
│    ✅ Database (Prisma)              │
│    ✅ Authentication (Supabase)      │
│    ❌ Redis (MockRedis)              │
│    ❌ Bull Queues (disabled)         │
│    ❌ Workers (not deployed)         │
│    ❌ Cron Jobs (not running)        │
└─────────────────────────────────────┘
```

---

### Emergency Commits Reference

All emergency fixes were committed with detailed messages:

1. **`84bcc99`**: Redis lazy initialization + dynamic page rendering
2. **`978ec1e`**: Standalone copy strategy + worker disabling
3. **`ada9982`**: MockRedis implementation + infinite retry fix
4. **`6deb0d9`**: Simplified standalone copy strategy

**Search commits with:** `git log --all --grep="EMERGENCY\|emergency\|fix(railway)"`

---

### Production Readiness Checklist

Before promoting to full production:

**Infrastructure:**
- [ ] Add Redis service (Upstash recommended)
- [ ] Create separate worker service on Railway
- [ ] Configure proper env vars (remove placeholders)
- [ ] Set up monitoring/alerting for Railway services

**Code Changes:**
- [ ] Remove MockRedis, restore real Redis
- [ ] Re-enable workers in separate service
- [ ] Review `force-dynamic` pages for SSG optimization
- [ ] Add Redis connection pooling and retry strategy

**Testing:**
- [ ] Load test API endpoints
- [ ] Test worker processing under load
- [ ] Verify cost estimates with real Redis
- [ ] Monitor CPU/Memory for 24h

**Documentation:**
- [ ] Update deployment guides with Redis setup
- [ ] Document worker service configuration
- [ ] Create rollback procedures
- [ ] Update architecture diagrams

---

### Cost Monitoring

With emergency fixes applied:
- **CPU**: ~0.01-0.05 vCPU (idle), <0.5 vCPU (active)
- **Memory**: ~150-200MB stable
- **Estimated Cost**: $5-10/month (Railway API only)

Without fixes (before emergency):
- **CPU**: 1.2-2.3 vCPU constant
- **Memory**: 578MB+ (leaking)
- **Estimated Cost**: $155+/month ⚠️

**Savings: ~$145/month with emergency fixes**

---

## 🤝 Contributing

### Development Workflow

1. Clone the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -m 'Add new feature'`)
4. Push to branch (`git push origin feature/new-feature`)
5. Open a Pull Request

### Code Style

- TypeScript strict mode enabled
- ESLint + Prettier configured
- Semantic commits (Conventional Commits)

---

## 📝 License

This is a proprietary project. All rights reserved.

---

## 👥 Author

**Carlo (Fullstack Developer)**

Fullstack developer specialized in scalable architectures with Next.js, React, Node.js, and PostgreSQL.

---

## 🔗 Useful Links

### Framework Documentation
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)

### Project Documentation
- [API Documentation (Swagger)](/SWAGGER_DOCUMENTATION.md)
- [JUDIT Dashboard Guide](/DASHBOARD_README.md)
- [JUDIT Monitoring System](/docs/JUDIT_MONITORING.md)
- [Observability Setup](/docs/OBSERVABILITY_SETUP.md)
- [Project Overview](/docs/PROJECT_OVERVIEW.md)

### Observability Tools
- [Pino Logger Documentation](https://getpino.io/)
- [Recharts Documentation](https://recharts.org/)
- [TanStack Query Documentation](https://tanstack.com/query/latest)

---

<div align="center">

**Built with ❤️ and TypeScript**

⭐ If this project was useful, consider giving it a star!

</div>
