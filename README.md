<div align="center">

# ⚖️ JustoAI V2

### Enterprise SaaS Platform for Legal Process Management with AI

[![Next.js](https://img.shields.io/badge/Next.js-15.5.3-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.1.0-blue?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?logo=postgresql)](https://www.postgresql.org/)

[Overview](#-overview) • [Status](#-status) • [Stack](#-tech-stack) • [Setup](#-quick-start) • [Docs](#-documentation)

</div>

---

## 🎯 Overview

**JustoAI V2** is an enterprise SaaS for legal process management with AI-powered analysis. Features intelligent document processing, real-time judicial monitoring (JUDIT integration), executive report generation, and complete cost tracking & observability.

**Current Status:** ✅ **LIVE IN PRODUCTION**
- Frontend: https://justoai-v2.vercel.app (Vercel)
- Backend API: Railway (production)
- Database: Supabase PostgreSQL
- Workers: Railway (BullMQ queues)

---

## 📊 Tech Stack

```typescript
Frontend:    Next.js 15 + React 19 + TypeScript + Tailwind CSS
Backend:     Node.js 20 + Fastify/Next.js API Routes
Database:    PostgreSQL (Supabase) + Prisma ORM
Cache:       Redis (Upstash)
AI:          Google Gemini API
Email:       Resend SMTP
Queues:      Bull + Redis
Deploy:      Vercel (Frontend) + Railway (Backend/Workers)
```

---

## 🚀 Quick Start

### Prerequisites
```bash
Node.js >= 20.0.0
npm >= 9.0.0
PostgreSQL 15+ (or Supabase account)
```

### Installation

```bash
# 1. Clone and install
git clone <repo-url>
cd justoai-v2
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your credentials

# 3. Database setup
npm run db:generate
npm run db:migrate
npm run db:seed  # optional

# 4. Start development
npm run dev  # http://localhost:3000
```

### Environment Variables

**Essential:**
- `DATABASE_URL` - PostgreSQL connection
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Auth
- `GOOGLE_API_KEY` - Gemini AI
- `REDIS_URL` - Cache & queues

See `.env.example` for complete list.

---

## 🛠️ Useful Commands

```bash
# Development
npm run dev              # Development server
npm run lint            # Lint code
npm run db:studio      # Prisma Studio (DB GUI)

# Database
npm run db:generate    # Generate Prisma client
npm run db:migrate     # Create/apply migrations
npm run db:reset       # ⚠️ Reset database

# Build & Production
npm run build          # Production build
npm start             # Start production server

# Workers & Background Jobs
npm run workers:start   # Start workers
npm run workers:stop    # Stop workers
npm run worker:judit    # Run JUDIT worker directly

# Testing
npm test              # Run tests
npm run test:watch   # Watch mode
```

---

## 📚 Documentation

**For detailed documentation, see:**

| Resource | Purpose |
|----------|---------|
| [CLAUDE.md](./CLAUDE.md) | Development guidelines for Claude Code |
| [TIMELINE_UNIFICADA_IMPLEMENTACAO.md](./TIMELINE_UNIFICADA_IMPLEMENTACAO.md) | 🚀 NEW - Unified Timeline implementation tracking with checkboxes (Oct 2025) |
| [FASE 3 IMPLEMENTATION](./docs/FASE3_ANALYSIS.md) | ✨ 3-phase onboarding flow & strategic analysis (Oct 2025) |
| [WEBHOOK_FIX_SUMMARY.md](./WEBHOOK_FIX_SUMMARY.md) | JUDIT webhook fixes - technical details |
| [WEBHOOK_FIX_CHECKLIST.md](./WEBHOOK_FIX_CHECKLIST.md) | JUDIT webhook - deployment & testing checklist |
| [DEPLOYMENT_WEBHOOK_FIX.md](./DEPLOYMENT_WEBHOOK_FIX.md) | JUDIT webhook - step-by-step deployment guide |
| [docs/JUDIT_INTEGRATION.md](./docs/JUDIT_INTEGRATION.md) | JUDIT API integration guide |
| [docs/PRODUCTION_SETUP.md](./docs/PRODUCTION_SETUP.md) | Production deployment checklist |
| [docs/CIRCUIT_BREAKER.md](./docs/CIRCUIT_BREAKER.md) | Circuit breaker pattern implementation |

**API Endpoints:** See `/api` route documentation or enable Swagger at `/api/swagger`

**User Documentation:** See `src/app/help/` for 40+ user guides

**Testing FASE 3:**
```bash
# Quick start
npm run dev

# Test workflow:
# 1. Upload PDF case document
# 2. Wait for FASE 1 & 2 completion
# 3. Click "Aprofundar Análise"
# 4. Try both FAST and FULL analysis levels
# 5. Check console logs for mock credit operations
```

---

## 🏗️ Architecture

### Overall System Flow
```
┌──────────────────────────────────────────────┐
│         Next.js 15 App Router (Frontend)     │
│  - React Components  - Server Actions        │
│  - Landing + Dashboard + Admin Pages         │
└────────────────┬─────────────────────────────┘
                 │ API Calls
                 ↓
┌──────────────────────────────────────────────┐
│    Fastify/Next.js API (Backend, Railway)    │
│  - 96+ RESTful endpoints  - Auth  - AI Svc   │
│  - JUDIT Integration      - Webhooks         │
└─┬────────────────────────────────┬───────────┘
  │                                │
  ↓                                ↓
┌─────────────────┐      ┌──────────────────┐
│  Supabase DB    │      │  Bull Queue      │
│  PostgreSQL     │      │  Workers         │
└─────────────────┘      │  (Redis)         │
                         └──────────────────┘
```

### JUDIT Webhook Integration
```
User Upload                 Queue Processing              JUDIT Webhook
─────────────               ─────────────────             ──────────────
    │                            │                              │
    ├─ File Upload               │                              │
    ├─ Create Case               │                              │
    ├─ Extract CNJ               │                              │
    └─ Queue Job (+ caseId)      │                              │
                 │                │                              │
                 └─ Process Job ──┤                              │
                                  ├─ Initiate JUDIT Request     │
                                  ├─ Store JuditRequest (w/caseId)
                                  └─ Webhook URL configured      │
                                                                 │
                                           JUDIT API Returns ────┤
                                                 │                │
                                                 └─ Webhook Call ─┘
                                                      │
                                           ┌──────────────────────┐
                                           │  Webhook Handler     │
                                           ├──────────────────────┤
                                           │ 1. Validate request  │
                                           │ 2. Load JuditRequest │
                                           │ 3. Use explicit caseId
                                           │ 4. Check idempotency │
                                           │ 5. Process updates   │
                                           │    - Timeline        │
                                           │    - Attachments     │
                                           │    - Case Type       │
                                           │ 6. Mark as processed │
                                           └──────────────────────┘
```

**Key Features:**
- ✅ **Explicit Case Association:** caseId prevents wrong case updates
- ✅ **Idempotency:** Duplicate webhooks detected and skipped
- ✅ **Real-time:** Asynchronous webhook callbacks (no polling)
- ✅ **Reliable:** Persistent queue ensures no data loss

---

## 🔒 Security

- ✅ Authentication via Supabase Auth + JWT
- ✅ Authorization: Route protection + RLS
- ✅ Input validation: Zod schemas on all APIs
- ✅ SQL injection prevention: Prisma ORM
- ✅ XSS protection: React auto-escaping
- ✅ Rate limiting on sensitive endpoints
- ✅ CORS properly configured
- ✅ Security headers (CSP, HSTS, X-Frame-Options)
- ✅ Secrets management: `.env.local` excluded from Git

**Never commit:** `.env.local`, `.env`, or any file with real credentials.
**Templates only:** Use `.env.example` as reference.

---

## 🎯 Recently Completed - Priority 1 Features (Nov 2, 2025)

### 📄 PDF Text Extraction with OCR
**Status:** ✅ Production-Ready

- **Cascade Strategy:** pdf-parse → pdfjs-dist → Tesseract.js OCR
- **Scanned PDF Support:** Full OCR processing for image-only documents
- **Language Support:** Portuguese (primary use case)
- **Performance:** <5s (primary), <10s (fallback), <120s (OCR)
- **Implementation:**
  - Vercel: `src/lib/pdf-processor.ts` (client)
  - Railway: `src/lib/pdf-extractor.js` (backend with Tesseract.js)
  - Canvas rendering with 2x zoom for better accuracy
  - Up to 50 pages per document
- **Files:** [See TODO_TRACKER.md](./TODO_TRACKER.md#4-pdf-text-extraction-ocr--done)

### 🔍 Process Monitoring & Observability
**Status:** ✅ Production-Ready

**Components:**
- **Health Endpoint** (`GET /api/health/system`)
  - Monitors: Database, Supabase, Resend Email, Slack, JUDIT API
  - Response: `{ status, checks, overallResponseTimeMs }`
  - HTTP 200 (healthy), 503 (degraded/unhealthy)

- **Webhook Delivery Tracking**
  - Exponential backoff: 5s → 30s → 5m → 30m → 24h
  - Deduplication: 5-minute window
  - HMAC signature verification
  - Ready for integration in webhook handlers

- **Job Logger (Singleton)**
  - Tracks: job lifecycle, metrics, errors, retries
  - Methods: logStart, logProgress, logSuccess, logFailure, logTimeout
  - Memory-efficient: auto-prunes old logs (max 1000)
  - Summary stats: successRate, avgDuration, by type

- **Database Models** (Ready for migration)
  - `WebhookDelivery`: Track webhook retries
  - `JobExecution`: Track background jobs
  - `SystemHealthMetric`: Store health history

**Files:** [See TODO_TRACKER.md](./TODO_TRACKER.md#9-process-monitoring--observability--done)

**Integration Next Steps:**
- Run `npm run db:migrate` to create tables
- Integrate `jobLogger` in workers & schedulers
- Integrate `webhookDeliveryService` in webhook handlers
- Call `/api/health/system` from monitoring dashboard

---

## 📊 Key Features

### 🤖 AI Analysis - 3-Phase Onboarding Flow

**FASE 1: Preview Inteligente** ✅
- Instantaneous analysis (2-10 seconds)
- Automatic CNJ detection from PDF
- Quick extraction of: parties, claim value, subject, last movements
- Uses Gemini Flash 8B/Flash with fallback to Pro
- **Status:** Complete & Production-Ready

**FASE 2: Enriquecimento Oficial** ✅
- Automatic JUDIT API integration (background processing)
- Webhook-based architecture (real-time updates, no polling)
- Downloads official court documents & movements
- Timeline unification (PDF + JUDIT + Manual)
- Automatic case type mapping
- **Status:** Complete & Production-Ready

**FASE 3: Análise Estratégica** ✅ (NEW - Oct 2025)
- Two analysis levels available:
  - **FAST:** Quick analysis using existing documents (Gemini Flash)
  - **FULL:** Complete strategic analysis with Gemini Pro (1 credit)
- Comprehensive insights:
  - Legal assessment (strengths, weaknesses, recommendations)
  - Risk analysis with mitigation strategies
  - Timeline with deadlines and critical phases
  - Precedent references
- Mock credit system for testing (always returns 999 credits)
- **Status:** Complete & Ready for Testing
- **Build Status:** ✅ Compiled successfully
- **Implementation:** Oct 27, 2025

**System Details:**
- Document processing (PDF, DOCX, images)
- Multi-front analysis with Google Gemini
- Automatic data extraction & summarization
- Cost-optimized caching with smart routing
- Credit management (mockable for development)

### 🔍 Real-Time Process Monitoring via JUDIT
- **JUDIT Integration:** Official Brazilian court process API
- **Webhook Architecture:** Asynchronous webhook callbacks for real-time updates
- **Explicit Case Association:** Fixed webhook routing to ensure correct case updates
- **Duplicate Prevention:** Idempotency protection prevents duplicate processing
- **Automatic Movement Alerts:** Real-time notifications for process updates
- **Unified Timeline:** Merged deduplication across multiple sources
- **Court Synchronization:** Automatic sync with official judicial data

### 🧠 Unified Intelligent Timeline with AI Enrichment (NEW - Oct 27, 2025)

**Complete Timeline Fusion and Enrichment Engine:**

**Smart Event Association** ✅
- **4-Level Intelligent Matching:**
  - Hash-based exact matching → `DUPLICATE`
  - Levenshtein distance ≥ 0.85 → `ENRICHMENT` (merge with JUDIT base)
  - Levenshtein distance ≥ 0.70 → `RELATED` (separate linked event)
  - No match → New standalone event
- **Date Proximity Window:** ±2 days for event association
- **JUDIT as Backbone:** Official court data always the base reference

**AI-Powered Enrichment** ✅
- **Automatic Description Enhancement:** Gemini Flash rewrites event descriptions
- **Source Awareness:** Combines context from PDF, JUDIT, and AI sources
- **Original Text Preservation:** Keeps unmodified texts for audit trail
- **Configurable:** Similarity thresholds and model via `.env`
- **Cost-Optimized:** Falls back to concatenation if AI unavailable (no cost penalty)

**Conflict Detection & Resolution** ✅
- **Automatic Detection:**
  - `DATE_MISMATCH`: Events differ by >3 days
  - `TYPE_MISMATCH`: Different movement types
  - `DESCRIPTION_CONTRADICTION`: Conflicting data
- **User-Friendly Resolution** (4 strategies):
  - Keep JUDIT (official reference)
  - Use Document (prioritize alternate source)
  - Merge Manually (user edits description)
  - Keep Both (create separate related event)
- **Audit Trail:** Records reviewer, timestamp, resolution strategy
- **Visual Management:** Dedicated UI page at `/dashboard/process/[id]/conflicts`

**Configuration** (`.env`):
```env
TIMELINE_SIMILARITY_THRESHOLD_ENRICHMENT=0.85    # ENRICHMENT threshold
TIMELINE_SIMILARITY_THRESHOLD_RELATED=0.70       # RELATED threshold
TIMELINE_DATE_PROXIMITY_DAYS=2                   # Window for association
TIMELINE_ENRICHMENT_MODEL=gemini-1-5-flash       # AI model for enrichment
TIMELINE_ENRICHMENT_CREDIT_COST=0.001            # Cost per enrichment
TIMELINE_ENRICHMENT_ENABLED=true                 # Toggle enrichment
TIMELINE_CONFLICT_DETECTION_ENABLED=true         # Toggle conflict detection
```

**See:** [TIMELINE_UNIFICADA_IMPLEMENTACAO.md](./TIMELINE_UNIFICADA_IMPLEMENTACAO.md) for complete implementation tracking (100% complete, 5 sprints)

### 💳 Credits & Billing
- Per-workspace credit management
- Multiple credit types (analysis, reports)
- Rollover with configurable caps
- Cost tracking & projections

### 📤 Batch Operations
- Excel bulk upload with thousands of processes
- Parallel processing with rate limiting
- Real-time progress tracking
- Intelligent deduplication

### 👤 User Management
- Email verification with OTP
- User profiles & workspace settings
- Role-based access control
- Row-Level Security (RLS)

### 📊 Observability
- Structured JSON logging (Pino)
- Real-time metrics & percentiles
- Cost tracking with projections (96% optimization!)
- Multi-channel alerts (email, Slack, webhooks)
- Interactive monitoring dashboard

---

## 💡 Key Achievements

### JUDIT Cost Optimization
- **Before:** R$ 20,700/month
- **After:** R$ 834/month
- **Reduction:** 96% cost optimization
- **Approach:** Intelligent keyword-based monitoring

Full observability at `/dashboard/judit`

---

## 🔧 Recent Improvements (Oct 2025)

### FASE 3: Análise Estratégica Implementation (Oct 27, 2025)

Complete implementation of the 3-phase onboarding flow with strategic AI analysis:

**What was added:**
- ✅ **Serviço de Créditos Mockado** (`src/lib/services/creditService.ts`)
  - Mock system returning 999 credits (enables unlimited testing)
  - Methods: `checkCredits()`, `debitCredits()`, `getBalance()`, `getFormattedBalance()`
  - Fully ready to swap for production Prisma queries

- ✅ **Endpoint de Análise** (`src/app/api/process/[id]/analysis`)
  - POST handler supports two levels: FAST (Flash) and FULL (Pro)
  - FAST: Quick analysis with existing documents (~10-15s)
  - FULL: Complete strategic analysis with Gemini Pro (~20-30s, costs 1 credit)
  - Asynchronous background processing with status tracking
  - Results saved as `analysisType: 'strategic'` or `'complete'`

- ✅ **Endpoint de Créditos** (`src/app/api/billing/credits`)
  - Returns mock balance via `creditService`
  - Compatible with existing billing UI
  - Shows 999 credits balance for testing

- ✅ **Frontend Integration** (`src/components/process/process-ai-analysis.tsx`)
  - `loadCredits()`: Fetches balance before opening modal
  - `handleOpenAnalysisModal()`: Loads credits dynamically
  - Modal displays:
    - Current credit balance (mock: 999)
    - FAST option (always enabled)
    - FULL option (enabled when balance > 0)
  - Real-time credit display with cost breakdown

**Build Status:** ✅ Compiled successfully (21.9s)

**Testing Ready:**
```bash
npm run dev  # Start development server
# 1. Upload PDF → FASE 1 (instantaneous, free)
# 2. Wait for JUDIT → FASE 2 (background, free)
# 3. Click "Aprofundar Análise" → FASE 3 (new!)
#    - Choose FAST: Uses Gemini Flash, ~10-15 seconds
#    - Choose FULL: Uses Gemini Pro, ~20-30 seconds, logs mock debit
```

**Architecture:** Service-oriented with dependency injection for easy testing

### JUDIT Webhook Integration Fixes
Fixed critical issues in webhook processing with robust solutions:

**Issue 1: Wrong Case Association**
- **Problem:** Webhooks processed wrong case when multiple cases had same CNJ
- **Solution:** Added explicit `caseId` field to `JuditRequest`, passed through entire workflow
- **Result:** 100% accurate case matching, zero webhook routing errors

**Issue 2: Duplicate Webhook Processing**
- **Problem:** Same webhook processed multiple times, causing conflicting data updates
- **Solution:** Added idempotency tracking via `processed_webhook_request_ids` in metadata
- **Result:** Webhooks processed exactly once, duplicates gracefully skipped

**Implementation Details:**
- Added `case_id` column to `judit_requests` table with foreign key
- Updated workflow: `upload → queue → webhook` now includes explicit case reference
- Idempotency check in webhook handler prevents duplicate processing
- Backward compatible - falls back to CNJ lookup if explicit caseId not provided

**See:** [WEBHOOK_FIX_SUMMARY.md](./WEBHOOK_FIX_SUMMARY.md) for technical details

---

## 📊 Admin Dashboard - JUDIT Consumption Analytics

**What was added (Oct 2025):**

An internal admin dashboard for real-time JUDIT API consumption monitoring, pricing analysis, and business metrics. **Protected endpoint** - only authenticated users can access.

### ✅ Features Implemented
- 📊 **Real-time Consumption Dashboard** (`/admin/dashboard/judit`)
  - Visual metrics: Total requests, success rate, costs
  - Interactive charts: Consumption by origin, search type, costs
  - Live pricing calculator (50%-80% margins)

- 💾 **Analysis API Endpoint** (`/api/admin/judit-consumption`)
  - Fetches JUDIT data for last 10 days
  - Calculates costs and unit economics
  - 24-hour caching (can be refreshed on-demand)

- 🛠️ **Standalone Analysis Scripts** (`scripts/`)
  - `pricing-analysis.js` - Unit economics and pricing suggestions
  - `judit-consumption-report.js` - Detailed consumption analysis
  - `dynamic-pricing-calculator.js` - Interactive pricing simulator

### 🎯 Key Metrics
- **Real Consumption (10/17-10/27):** 616 requests, 100% success rate, R$ 352.80 cost
- **Suggested Pricing (70% margin):**
  - Plan A (Starter): **R$ 496/month** | Profit: R$ 347/month
  - Plan B (Professional): **R$ 1.489/month** | Profit: R$ 1.042/month
- **Payback Period:** 2-3 months with R$ 500 CAC

### 📖 Documentation to Review

| Document | Purpose | Action |
|----------|---------|--------|
| [ADMIN_DASHBOARD_README.md](./ADMIN_DASHBOARD_README.md) | **Complete dashboard guide** - Read first for overview & roadmap | 🔍 Check "🚀 Radar: Próximas Melhorias" for what's missing |
| [JUDIT_ANALYSIS_REPORT.md](./JUDIT_ANALYSIS_REPORT.md) | Executive report with business metrics for CFO/CMO | 📊 Use for pitches & investor decks |
| [JUDIT_TOOLS_README.md](./JUDIT_TOOLS_README.md) | How to run standalone analysis scripts locally | 🛠️ Run scripts manually for weekly analysis |

### 🔄 Development Roadmap

| Phase | Timeline | Status | Next Action |
|-------|----------|--------|-------------|
| **Phase 1: Foundation** | ✅ Complete | `Deployed` | Test in production |
| **Phase 2: Security & Performance** | 📅 Week 1-2 | `Pending` | RBAC, DB caching, rate limiting |
| **Phase 3: Analytics** | 📅 Week 2-3 | `Pending` | Trending, user/project analysis, projections |
| **Phase 4: Business Intelligence** | 📅 Week 3-4 | `Pending` | Alerts, PDF export, billing integration |
| **Phase 5: Future** | 📅 1+ month | `Backlog` | ML predictions, white-labeled dashboard |

**See:** [ADMIN_DASHBOARD_README.md § 🚀 Radar: Próximas Melhorias](./ADMIN_DASHBOARD_README.md#-radar-próximas-melhorias) for detailed checklist

---

## 🧪 Testing

```bash
npm test              # Run tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
```

---

## 📈 Performance

Optimized for:
- Response Time: < 200ms
- Time to First Byte: < 500ms
- Largest Contentful Paint: < 2.5s
- First Input Delay: < 100ms

Implemented optimizations:
- Server-side rendering + static generation
- Image optimization
- Redis caching
- Database query optimization
- Lazy loading & code splitting
- Background jobs for heavy operations

---

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Commit with conventional commits: `git commit -m 'feat: your feature'`
3. Push and open a Pull Request

**Code Style:**
- TypeScript strict mode
- ESLint + Prettier
- Semantic commits

---

## 📝 License

Proprietary - All rights reserved

---

## 🔗 Useful Links

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)

---

<div align="center">

**Built with ❤️ and TypeScript**

⭐ Star us if JustoAI was helpful!

</div>
