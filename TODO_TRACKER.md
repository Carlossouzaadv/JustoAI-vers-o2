# TODO Tracker - JustoAI V2

**Last Updated:** 2025-11-02
**Total TODOs:** 56
**Status:** Organized by Priority & Category

---

## 📋 Quick Summary

| Priority | Count | Status |
|----------|-------|--------|
| 🔴 CRÍTICO | 8 | Blocking key features |
| 🟠 ALTO | 18 | Important functionality |
| 🟡 MÉDIO | 20 | Should implement soon |
| 🟢 BAIXO | 10 | Nice-to-have improvements |

---

## 🔴 CRÍTICO - Blocking Key Features

### 1. Report Generation (PDF/DOCX)
**Impact:** Users cannot export reports
**Files:**
- `src/lib/report-generator.ts:557` - `generatePDF()` currently mocked
- `src/lib/report-generator.ts:578` - `generateDOCX()` currently mocked

**Details:**
- PDF generation needs real implementation (puppeteer, jsPDF, or PDFKit)
- DOCX generation needs real implementation (docx library or officegen)
- Both methods currently return mock data

**Suggested Libraries:** puppeteer, jsPDF, docx, PDFKit

---

### 2. Notification System (Email/Slack)
**Impact:** Critical alerts not being sent to users
**Files:**
- `src/jobs/scheduler.ts:59` - Success notifications
- `src/jobs/scheduler.ts:64` - Critical error alerts
- `src/jobs/dailyJuditCheck.ts:455` - Email/Slack alerts for failed processes
- `src/jobs/dailyJuditCheck.ts:460` - Summary emails for movements
- `src/jobs/dailyJuditCheck.ts:467` - Critical error alerts
- `src/lib/observability/alerting.ts:173` - Email integration (SendGrid, AWS SES, etc.)

**Details:**
- Currently no actual email/Slack notifications being sent
- Only logging to console
- Critical for system reliability and user engagement

**Suggested Services:** Resend, SendGrid, Twilio, Slack webhooks

---

### 3. File Storage (S3/Permanent)
**Impact:** Uploaded files are temporary, not persistent
**Files:**
- `src/app/api/process/upload/route.ts:287` - Upload strategy selection
- `src/app/api/process/upload/route.ts:298` - Replace temp paths with S3 URLs

**Details:**
- Currently files stored in temporary location
- Need S3 or alternative permanent storage
- Affects document persistence across sessions

**Suggested Solution:** AWS S3, Google Cloud Storage, or Supabase Storage

---

### 4. PDF Text Extraction
**Impact:** PDF parsing may fail on complex documents
**Files:**
- `lib/deep-analysis-service.ts:250` - Real PDF extraction implementation
- `lib/pdf-processor.ts:125` - OCR fallback strategy (tesseract.js)

**Details:**
- Deep analysis service has mock extraction
- PDF processor lacks OCR for image-heavy documents
- Needed for reliable document processing

**Suggested Libraries:** pdf-parse, pdfjs, tesseract.js

---

### 5. External Logging Integration
**Impact:** No centralized error tracking for production
**Files:**
- `lib/alerts/ops-alerts.ts:474` - Sentry SDK integration (simulated)
- `lib/cors.ts:115` - External logging integration (Sentry, LogRocket)

**Details:**
- Currently only local logging
- Sentry integration is mocked
- Critical for production monitoring

**Suggested Services:** Sentry, LogRocket, DataDog

---

### 6. Payment Signature Verification
**Impact:** Security vulnerability in payment processing
**Files:**
- `lib/payment-webhook-handler.ts:459` - Real signature verification per provider

**Details:**
- Payment webhooks not properly validated
- Only mock verification implemented
- Critical security issue

**Note:** See [Payment/Credits Section](#-payment--credits-todos-backlog) for full context

---

### 7. Webhook Generic Implementation
**Impact:** External system integration incomplete
**Files:**
- `lib/alerts/ops-alerts.ts:488` - Generic webhook implementation

**Details:**
- Alert webhooks not functional
- Blocking external system integrations

---

### 8. Server-Sent Events (SSE)
**Impact:** Real-time updates not working
**Files:**
- `lib/websocket-manager.ts:183` - SSE implementation for real-time updates

**Details:**
- Real-time notifications not functional
- Critical for live dashboard updates

---

## 🟠 ALTO - Important Functionality

### 1. Admin Permission Validation
**Files:**
- `src/app/api/ai/analyze/route.ts:226` - Check if user is admin of workspace

**Impact:** Security - non-admins could access restricted operations

---

### 2. Report Scheduling CRUD
**Files:**
- `src/app/api/reports/schedule/[id]/route.ts:34` - GET schedule by ID
- `src/app/api/reports/schedule/[id]/route.ts:98` - Update schedule in DB
- `src/app/api/reports/schedule/[id]/route.ts:150` - DELETE schedule
- `src/app/api/reports/schedule/[id]/route.ts:187` - Immediate report generation
- `src/app/api/reports/schedule/[id]/route.ts:200` - Pause schedule
- `src/app/api/reports/schedule/[id]/route.ts:210` - Resume schedule
- `src/app/api/reports/schedule/[id]/route.ts:220` - Test delivery

**Impact:** Report scheduling feature completely non-functional

---

### 3. Process Monitoring & Tracking
**Files:**
- `workers/process-monitor-worker.ts:550` - Add remoteTrackingId to schema
- `workers/process-monitor-worker.ts:560` - Implement remote tracking
- `workers/process-monitor-worker.ts:597` - Fetch pending webhooks
- `workers/process-monitor-worker.ts:603` - Process webhooks
- `workers/process-monitor-worker.ts:608` - Update process with Judit data
- `workers/process-monitor-worker.ts:623` - Check workspace attachment policy
- `workers/process-monitor-worker.ts:629` - Implement attachment processing
- `workers/process-monitor-worker.ts:668` - Save session to DB for audit trail

**Impact:** Background process monitoring not fully functional

---

### 4. JUDIT Webhook Movement Alerts
**Files:**
- `src/app/api/webhooks/judit/tracking/route.ts:560` - Movement alerts logic
- `src/app/api/webhooks/judit/tracking/route.ts:567` - Attachment alerts logic
- `src/app/api/webhooks/judit/tracking/route.ts:572` - Status change alerts logic

**Impact:** Real-time case updates not alerting users

---

### 5. JUDIT Attachment Credit Validation
**Files:**
- `lib/judit-api-client.ts:864` - Permission/credit verification for attachments

**Impact:** Cannot properly track attachment credit usage

---

### 6. Document Management APIs
**Files:**
- `src/app/api/documents/[id]/analyze/route.ts:168` - Real time measurement
- `src/app/api/documents/upload/route.ts:681` - Include merge result in response
- `src/app/api/documents/upload/route.ts:747` - Attach pre-processed files to cases
- `src/app/api/documents/[id]/analyze/route.ts:179` - Document update API
- `src/app/api/documents/[id]/analyze/route.ts:211` - Document deletion API

**Impact:** Document management features incomplete

---

### 7. Case Notes Implementation
**Files:**
- `src/app/api/cases/[id]/notes/route.ts:32` - Create notes (wait for CaseEvent support)
- `src/app/api/cases/[id]/notes/route.ts:68` - Update notes (wait for CaseEvent support)

**Impact:** Case notes feature non-functional until schema updated

---

### 8. Alert Acknowledgment System
**Files:**
- `lib/alerts/ops-alerts.ts:635` - Alert acknowledgment tracking
- `lib/alerts/ops-alerts.ts:639` - Active alerts query

**Impact:** Cannot track which alerts have been acknowledged

---

### 9. Report Delivery Notifications
**Files:**
- `lib/report-scheduler.ts:409` - Report delivery notifications
- `workers/individual-reports-worker.ts:373` - Email/SMS report delivery

**Impact:** Users not notified when reports are ready

---

### 10. Excel Batch Operations
**Files:**
- `src/app/api/upload/excel/route.ts:121` - Save file persistence
- `src/app/api/upload/excel/route.ts:188` - Template generation
- `src/app/api/upload/excel/validate/route.ts:147` - Error report generation

**Impact:** Batch import features incomplete

---

### 11. Process Import/Export
**Files:**
- `src/app/api/systems/import/[id]/route.ts:360` - Rollback imported data
- `src/app/api/systems/import/[id]/route.ts:515` - Restart import in background

**Impact:** Data import workflows incomplete

---

### 12. Stream Response Refactoring
**Files:**
- `src/app/api/upload/batch/[id]/stream/route.ts:44` - Use controller instead of Response
- `src/app/api/upload/batch/[id]/stream/route.ts:64` - Cleanup listeners after stream

**Impact:** Potential memory leaks from improper stream handling

---

### 13. Admin Dashboard Caching
**Files:**
- `src/app/api/admin/judit-consumption/route.ts:290` - Save to DB for caching

**Impact:** Admin dashboard recalculates data on every request

---

### 14. Bull Board Authentication
**Files:**
- `lib/bull-board.ts:86` - Real token and permission verification

**Impact:** Any authenticated user can access job queue dashboard

---

### 15. Analysis Version Endpoints
**Files:**
- `src/app/api/process/[id]/analysis/versions/route.ts:222` - Dynamic versioning endpoint

**Impact:** Cannot retrieve specific analysis versions

---

## 🟡 MÉDIO - Should Implement Soon

### 1. Alert Aggregation System
**Files:**
- `lib/alerts/ops-alerts.ts:603` - Aggregated alerts (e.g., global cost totals)

**Impact:** Cannot generate aggregate alerts for multiple processes

---

### 2. Alert Scheduling/Retry System
**Files:**
- `lib/alerts/ops-alerts.ts:674` - Bull/cron integration for alert scheduling

**Impact:** Failed alerts not automatically retried

---

### 3. External Webhook Integration
**Files:**
- `lib/process-alerts.ts:294` - External system webhooks

**Impact:** Cannot integrate with third-party systems

---

### 4. Alert Rate Limiting
**Files:**
- `lib/process-alerts.ts:295` - Rate limiting to prevent spam

**Impact:** Could send duplicate alerts to users

---

### 5. Judit Service Document Processing
**Files:**
- `src/lib/services/juditService.ts:479` - Document processing workflow

**Impact:** Document processing in Judit service incomplete

---

### 6. Frontend Dashboard Components
**Files:**
- `src/components/dashboard/dashboard-sidebar.tsx:68` - Calculate attention required from case alerts
- `src/app/dashboard/page.tsx:105` - Get user plan and usage from context

**Impact:** Dashboard metrics not calculated properly

---

### 7. Frontend PDF Export
**Files:**
- `src/components/dashboard/ExportButton.tsx:96` - PDF export functionality

**Impact:** Export feature non-functional

---

### 8. Contact Form Integration
**Files:**
- `src/app/contato-suporte/page.tsx:20` - Form submission (Portuguese version)
- `src/app/contact/page.tsx:19` - Form submission (English version)

**Impact:** Support contact form non-functional

---

### 9. Process Notes Frontend
**Files:**
- `src/components/process/process-notes.tsx:106` - Get author from auth context

**Impact:** Notes show undefined author

---

### 10. Process Documents UI
**Files:**
- `src/components/process/process-documents.tsx:501` - Notes/Tags feature (commented placeholder)

**Impact:** Cannot tag or add notes to documents

---

### 11. Telemetry Models
**Files:**
- `src/lib/monitoring-telemetry.ts:118` - Telemetry model implementation
- `src/lib/monitoring-telemetry.ts:131` - Cost model implementation

**Impact:** Telemetry not properly tracked

---

### 12. Usage Tracking
**Files:**
- `src/lib/telemetry/usage-tracker.ts:418` - Use WorkspaceCredits model for balances
- `src/lib/telemetry/usage-tracker.ts:462` - Monthly report snapshots

**Impact:** Usage statistics not accurate

---

### 13. Sync Worker Statistics
**Files:**
- `workers/sync-worker.ts:474` - Save statistics to DB

**Impact:** Sync statistics lost between restarts

---

### 14. Report API Integration
**Files:**
- `src/app/dashboard/reports/page.tsx:77` - Real API calls
- `src/app/dashboard/reports/page.tsx:109` - Real report generation API

**Impact:** Reports page all mock data

---

---

## 🟢 BAIXO - Nice-to-Have Improvements

### 1. Response Time Measurement
- `src/app/api/documents/[id]/analyze/route.ts:168` - Measure real processing time

### 2. Statistics Persistence
- `workers/sync-worker.ts:474` - Save worker statistics

### 3. Cache Statistics
- `src/lib/ai-cache-manager.ts:434` - Implement cache stats with Redis

### 4. Document Notes/Tags
- `src/components/process/process-documents.tsx:501` - Notes/Tags UI feature

---

## 🚫 PAYMENT & CREDITS - Backlog (Not Implementing Yet)

**Decision:** All payment and credit-related TODOs are deferred to a future sprint. These will be implemented when the business model is finalized.

**Affected Files:**

### 1. Credit Service Implementation
**File:** `src/lib/services/creditService.ts`

**Lines & TODOs:**
- Line 60: `// TODO: Quando implementar de verdade:` - Real credit calculation logic
- Line 99: `// TODO: Quando implementar de verdade:` - Real debit/charge logic
- Line 149: `// TODO: Quando implementar de verdade:` - Real balance query from DB

**Current Status:** Mock system returns 999 credits for all operations

**What Needs to Be Done Later:**
- Replace mock responses with real Prisma queries to `WorkspaceCredits` table
- Implement actual credit debit logic when users perform paid operations
- Track credit transactions with audit trail
- Handle insufficient credit scenarios
- Implement credit rollover logic with caps
- Add credit expiration handling

---

### 2. Payment Webhook Handler
**File:** `lib/payment-webhook-handler.ts`

**Lines & TODOs:**
- Line 459: `// TODO: Implementar verificação real de assinatura para cada provider`

**Current Status:** Mock signature verification (always accepts)

**What Needs to Be Done Later:**
- Implement real webhook signature verification for Stripe
- Implement real webhook signature verification for Square
- Implement real webhook signature verification for PayPal
- Add request validation and logging
- Handle payment disputes and chargebacks
- Implement webhook retry logic for failed operations

**Affected Providers:** Stripe, Square, PayPal, Pix

---

## 📊 Statistics by Category

| Category | Count | Priority |
|----------|-------|----------|
| Notifications/Alerts | 13 | 🔴 CRÍTICO/🟠 ALTO |
| Storage/File Management | 6 | 🔴 CRÍTICO/🟠 ALTO |
| Report Generation | 8 | 🔴 CRÍTICO/🟠 ALTO |
| Payment/Credits | 5 | 🚫 BACKLOG |
| Monitoring/Tracking | 8 | 🟠 ALTO/🟡 MÉDIO |
| API Endpoints | 7 | 🟠 ALTO/🟡 MÉDIO |
| Frontend Components | 5 | 🟡 MÉDIO/🟢 BAIXO |
| Workers/Background Jobs | 3 | 🟠 ALTO/🟡 MÉDIO |
| Security/Admin | 2 | 🟠 ALTO |

---

## 🔄 How to Update This Tracker

1. **When adding a new TODO:** Add it to the appropriate section based on priority
2. **When completing a TODO:**
   - Mark it as ✅ DONE with date: `- ✅ DONE (2025-11-02): Description`
   - Move to "Completed" section at the bottom
3. **When changing priority:** Move the item to appropriate section
4. **Commit format:** `docs(tracker): update TODO status - [task name]`

---

## ✅ Completed TODOs

*No items completed yet - this project is early stage*

---

## 🎯 Next Steps (Recommended)

### Phase 1 - Critical Path (Week 1-2)
1. Implement Email/Slack notification system
2. Implement real PDF/DOCX report generation
3. Implement permanent file storage (S3)

### Phase 2 - Core Features (Week 2-3)
1. Complete report scheduling CRUD
2. Implement process monitoring and tracking
3. Implement JUDIT webhook alerts

### Phase 3 - Polish (Week 3-4)
1. Alert acknowledgment system
2. Admin dashboard optimization
3. Frontend component fixes

### Phase 4 - Future (After MVP)
1. Payment and credit system
2. Advanced analytics
3. External integrations

---

**Generated:** 2025-11-02
**Maintainer:** Development Team
**Last Review:** Initial scan from Explore agent
