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
| [WEBHOOK_FIX_SUMMARY.md](./WEBHOOK_FIX_SUMMARY.md) | JUDIT webhook fixes - technical details |
| [WEBHOOK_FIX_CHECKLIST.md](./WEBHOOK_FIX_CHECKLIST.md) | JUDIT webhook - deployment & testing checklist |
| [DEPLOYMENT_WEBHOOK_FIX.md](./DEPLOYMENT_WEBHOOK_FIX.md) | JUDIT webhook - step-by-step deployment guide |
| [docs/JUDIT_INTEGRATION.md](./docs/JUDIT_INTEGRATION.md) | JUDIT API integration guide |
| [docs/PRODUCTION_SETUP.md](./docs/PRODUCTION_SETUP.md) | Production deployment checklist |
| [docs/CIRCUIT_BREAKER.md](./docs/CIRCUIT_BREAKER.md) | Circuit breaker pattern implementation |

**API Endpoints:** See `/api` route documentation or enable Swagger at `/api/swagger`

**User Documentation:** See `src/app/help/` for 40+ user guides

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

## 📊 Key Features

### 🤖 AI Analysis
- Document processing (PDF, DOCX, images)
- Multi-front analysis with Google Gemini
- Automatic data extraction & summarization
- Preview intelligent with confidence scoring
- Cost-optimized caching

### 🔍 Real-Time Process Monitoring via JUDIT
- **JUDIT Integration:** Official Brazilian court process API
- **Webhook Architecture:** Asynchronous webhook callbacks for real-time updates
- **Explicit Case Association:** Fixed webhook routing to ensure correct case updates
- **Duplicate Prevention:** Idempotency protection prevents duplicate processing
- **Automatic Movement Alerts:** Real-time notifications for process updates
- **Unified Timeline:** Merged deduplication across multiple sources
- **Court Synchronization:** Automatic sync with official judicial data

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
