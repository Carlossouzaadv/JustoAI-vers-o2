# JustoAI v2 - TODO List

**Last Updated:** 2025-10-28
**Total Items:** 42 items across 8 priority categories

---

## 🚨 CRITICAL - Production Blockers

### 1. PDF/DOCX Report Generation
- **File:** `lib/report-generator.ts` (lines 557, 578)
- **Status:** Not Implemented
- **Description:** Actual PDF and DOCX generation not implemented; only returning mock data
- **Impact:** Core feature completely unimplemented
- **Estimated Effort:** 2-3 weeks
- **Dependencies:** Sharp, puppeteer, docx libraries

### 2. Payment Webhook Signature Verification
- **File:** `lib/payment-webhook-handler.ts` (line 459)
- **Status:** Placeholder
- **Description:** Webhook authenticity verification is not implemented for any provider (Stripe, MercadoPago, PagSeguro)
- **Impact:** Security vulnerability - accepting unverified webhooks
- **Estimated Effort:** 3-5 days
- **Dependencies:** Provider-specific webhook verification libraries

### 3. Remote Process Tracking Schema
- **File:** `workers/process-monitor-worker.ts` (lines 551, 561)
- **Status:** Blocked
- **Description:** Need to add `remoteTrackingId` field to MonitoredProcess schema and implement remote tracking logic
- **Impact:** Process monitoring incomplete
- **Estimated Effort:** 1 week
- **Dependencies:** Prisma schema migration

### 4. Report Scheduling - Database Operations
- **File:** `src/app/api/reports/schedule/[id]/route.ts` (lines 34, 98, 104, 150, 187, 200, 210, 220)
- **Status:** Not Implemented
- **Description:** All CRUD operations for report scheduling (create, read, update, delete, execute, pause, resume, test) are missing
- **Impact:** Scheduling feature completely unusable
- **Estimated Effort:** 2-3 weeks
- **Dependencies:** Database schema, BullQueue integration

### 5. S3 File Storage Implementation
- **Files:**
  - `src/app/api/process/upload/route.ts` (lines 287, 298)
  - `src/app/api/upload/excel/route.ts` (lines 121, 188)
- **Status:** Using Temporary Storage
- **Description:** File uploads using temporary paths instead of permanent S3 storage
- **Impact:** Data loss risk; files not persisted
- **Estimated Effort:** 1 week
- **Dependencies:** AWS SDK, S3 bucket configuration

### 6. Email/SMS Notifications System
- **Files:**
  - `workers/individual-reports-worker.ts` (line 373)
  - `src/jobs/dailyJuditCheck.ts` (lines 455, 460, 467)
  - `src/jobs/scheduler.ts` (lines 59, 64)
- **Status:** Not Implemented
- **Description:** Notification delivery via email and SMS for job completions and alerts
- **Impact:** Users unaware of job status
- **Estimated Effort:** 1-2 weeks
- **Dependencies:** SendGrid/AWS SES, Twilio/vonage

### 7. Judit API Attachment Permissions/Credits
- **File:** `lib/judit-api-client.ts` (lines 615, 864)
- **Status:** Not Implemented
- **Description:** No verification of permission/credits before requesting attachments from Judit
- **Impact:** Potential for cost overruns
- **Estimated Effort:** 3-5 days
- **Dependencies:** Credit validation system, Judit API integration

### 8. Process Tracking Webhooks - Alert Logic
- **File:** `src/app/api/webhooks/judit/tracking/route.ts` (lines 560, 567, 572)
- **Status:** Not Implemented
- **Description:** Alert generation for movements, attachments, and status changes incomplete
- **Impact:** Alert system non-functional
- **Estimated Effort:** 1 week
- **Dependencies:** Alert system architecture

---

## 🔴 HIGH PRIORITY - Core Features

### 9. Process Webhook Handling Pipeline
- **File:** `workers/process-monitor-worker.ts` (lines 597, 603, 608)
- **Status:** Not Implemented
- **Description:** Complete webhook handling pipeline for pending webhooks and process data updates
- **Impact:** External system integration incomplete
- **Estimated Effort:** 1-2 weeks

### 10. Document Attachment Processing
- **File:** `workers/process-monitor-worker.ts` (lines 623, 629)
- **Status:** Not Implemented
- **Description:** Attachment download validation and processing
- **Impact:** Document retrieval incomplete
- **Estimated Effort:** 1 week

### 11. System Import Rollback
- **File:** `src/app/api/systems/import/[id]/route.ts` (line 360)
- **Status:** Not Implemented
- **Description:** Rollback mechanism for failed imports
- **Impact:** No way to undo failed bulk operations
- **Estimated Effort:** 3-5 days

### 12. Import Restart Logic
- **File:** `src/app/api/systems/import/[id]/route.ts` (line 515)
- **Status:** Not Implemented
- **Description:** Restart mechanism for failed imports
- **Impact:** Failed imports cannot be recovered
- **Estimated Effort:** 3-5 days

### 13. Attachment to Existing Process
- **File:** `src/app/api/documents/upload/route.ts` (line 747)
- **Status:** Not Implemented
- **Description:** Logic to attach already-processed documents to existing processes
- **Impact:** Document reuse feature missing
- **Estimated Effort:** 3-5 days

### 14. Excel Upload Error CSV Generation
- **File:** `src/app/api/upload/excel/validate/route.ts` (line 147)
- **Status:** Not Implemented
- **Description:** Generate CSV file with validation errors for download
- **Impact:** Users cannot see detailed error reports
- **Estimated Effort:** 2-3 days

### 15. Alert System Integration
- **File:** `lib/alerts/ops-alerts.ts` (lines 474, 488, 610, 642, 646, 681)
- **Status:** Partial Implementation
- **Description:** Sentry integration, generic webhooks, aggregated alerts, acknowledgment system
- **Impact:** Alert system incomplete
- **Estimated Effort:** 2-3 weeks
- **Dependencies:** Sentry SDK, Alert database schema

### 16. Telemetry & Cost Tracking Models
- **File:** `lib/monitoring-telemetry.ts` (lines 118, 131)
- **Status:** Blocked
- **Description:** Telemetry and cost tracking models need to be created in database schema
- **Impact:** Observability incomplete
- **Estimated Effort:** 1 week
- **Dependencies:** Prisma schema, database design

### 17. External Error Logging Service
- **File:** `lib/cors.ts` (line 115)
- **Status:** Not Integrated
- **Description:** Integrate with Sentry, LogRocket, or similar for centralized error tracking
- **Impact:** Production errors not tracked
- **Estimated Effort:** 3-5 days
- **Dependencies:** Third-party service account

### 18. Email Alerting Service
- **File:** `src/lib/observability/alerting.ts` (line 173)
- **Status:** Not Implemented
- **Description:** Email delivery integration for alerts
- **Impact:** Alert notifications not delivered
- **Estimated Effort:** 3-5 days
- **Dependencies:** SendGrid/AWS SES, email templates

### 19. PDF Text Extraction
- **File:** `lib/deep-analysis-service.ts` (line 250)
- **Status:** Using Fallback
- **Description:** Implement real PDF text extraction with pdf-parse or similar
- **Impact:** PDF analysis may be incomplete
- **Estimated Effort:** 3-5 days
- **Dependencies:** pdf-parse or similar library

---

## 🟡 MEDIUM PRIORITY - Important Features

### 20. Credit System Implementation
- **File:** `src/lib/services/creditService.ts` (lines 60, 99, 149)
- **Status:** Mocked
- **Description:** Real credit system implementation (currently uses mocked data)
- **Impact:** Payment system non-functional
- **Estimated Effort:** 2-3 weeks
- **Dependencies:** Database schema, payment integration

### 21. Document Management API
- **File:** `src/components/process/process-documents.tsx` (lines 179, 211)
- **Status:** Missing API Endpoints
- **Description:** API endpoints for updating and deleting documents
- **Impact:** Document management UI non-functional
- **Estimated Effort:** 1 week

### 22. Case Notes API
- **File:** `src/app/api/cases/[id]/notes/route.ts` (lines 32, 68)
- **Status:** Blocked
- **Description:** Case notes implementation depends on CaseEvent schema update
- **Impact:** Notes feature incomplete
- **Estimated Effort:** 1 week
- **Dependencies:** CaseEvent schema update

### 23. Process Notes Auth Context
- **File:** `src/components/process/process-notes.tsx` (line 106)
- **Status:** Hardcoded
- **Description:** Get current user from authentication context instead of hardcoding
- **Impact:** Author information incorrect
- **Estimated Effort:** 1 day

### 24. Dashboard Reports - Real API Calls
- **File:** `src/app/dashboard/reports/page.tsx` (lines 77, 109, 521)
- **Status:** Using Mock Data
- **Description:** Replace all mock data with real API calls
- **Impact:** Dashboard non-functional
- **Estimated Effort:** 1-2 weeks

### 25. Main Dashboard - User Plan Integration
- **File:** `src/app/dashboard/page.tsx` (line 105)
- **Status:** Not Integrated
- **Description:** Get user plan and usage from auth context
- **Impact:** Dashboard plan/usage display incorrect
- **Estimated Effort:** 3-5 days

### 26. Dashboard Sidebar - Alert Calculations
- **File:** `src/components/dashboard/dashboard-sidebar.tsx` (line 68)
- **Status:** Hardcoded
- **Description:** Calculate attention required from case alerts
- **Impact:** Alert count display incorrect
- **Estimated Effort:** 3-5 days

### 27. Usage Tracking Integration
- **File:** `src/lib/telemetry/usage-tracker.ts` (lines 418, 462)
- **Status:** Not Using Real Models
- **Description:** Use WorkspaceCredits model for credit tracking and implement monthly snapshots
- **Impact:** Credit tracking incomplete
- **Estimated Effort:** 1 week

### 28. Streaming Upload Route Refactoring
- **File:** `src/app/api/upload/batch/[id]/stream/route.ts` (lines 44, 64)
- **Status:** Needs Refactoring
- **Description:** Adapt streaming handler to use controller pattern and proper cleanup listeners
- **Impact:** Code quality issue; potential resource leaks
- **Estimated Effort:** 1 week

### 29. Analysis Version Management
- **File:** `src/app/api/process/[id]/analysis/versions/route.ts` (line 222)
- **Status:** Needs Refactoring
- **Description:** Implement with proper dynamic route: `/process/[id]/analysis/versions/[versionId]/route.ts`
- **Impact:** Route architecture needs improvement
- **Estimated Effort:** 3-5 days

### 30. Bull Board Security
- **File:** `lib/bull-board.ts` (lines 86, 101)
- **Status:** Placeholder
- **Description:** Implement real token and permission verification for Bull Board access
- **Impact:** Queue dashboard accessible without proper auth
- **Estimated Effort:** 2-3 days

---

## 🟠 LOW PRIORITY - Enhancement & Polish

### 31. PDF Export Feature
- **File:** `src/components/dashboard/ExportButton.tsx` (line 96)
- **Status:** Not Implemented
- **Description:** PDF export functionality for dashboard/reports
- **Impact:** Export feature incomplete
- **Estimated Effort:** 1 week

### 32. Contact & Support Forms
- **Files:**
  - `src/app/contact/page.tsx` (line 19)
  - `src/app/contato-suporte/page.tsx` (line 20)
- **Status:** Not Integrated
- **Description:** Wire form submissions to backend
- **Impact:** Contact forms non-functional
- **Estimated Effort:** 2-3 days

### 33. Document Tags/Notes UI
- **File:** `src/components/process/process-documents.tsx` (line 501)
- **Status:** Placeholder
- **Description:** UI for document tags and notes
- **Impact:** Missing document metadata features
- **Estimated Effort:** 1 week

### 34. Admin Authorization Check
- **File:** `src/app/api/ai/analyze/route.ts` (line 226)
- **Status:** Not Checked
- **Description:** Verify user is admin of workspace before allowing analysis
- **Impact:** Authorization incomplete
- **Estimated Effort:** 1 day

### 35. Judit Consumption Caching
- **File:** `src/app/api/admin/judit-consumption/route.ts` (line 290)
- **Status:** Not Persisted
- **Description:** Save consumption data to database for future caching
- **Impact:** Performance optimization missing
- **Estimated Effort:** 2-3 days

### 36. AI Analysis Processing Time Measurement
- **File:** `src/app/api/documents/[id]/analyze/route.ts` (line 168)
- **Status:** Not Measured
- **Description:** Measure actual processing time instead of using timestamp
- **Impact:** Metrics incomplete
- **Estimated Effort:** 1 day

### 37. Service Document Processing
- **File:** `src/lib/services/juditService.ts` (line 479)
- **Status:** Not Implemented
- **Description:** Document processing in service layer
- **Impact:** Service layer incomplete
- **Estimated Effort:** 3-5 days

### 38. Timeline Refactoring
- **File:** `src/lib/timeline-merge.ts` (line 8)
- **Status:** Technical Debt
- **Description:** Refactor with proper Prisma types
- **Impact:** Type safety issue
- **Estimated Effort:** 2-3 days

### 39. Redis Cache Statistics
- **File:** `lib/ai-cache-manager.ts` (line 439)
- **Status:** Not Implemented
- **Description:** Implement cache statistics when Redis is active
- **Impact:** Cache monitoring incomplete
- **Estimated Effort:** 1 day

### 40. OCR Strategy (Tesseract.js)
- **File:** `lib/pdf-processor.ts` (line 125)
- **Status:** Not Implemented
- **Description:** OCR fallback for scanned documents using tesseract.js
- **Impact:** Scanned PDF handling incomplete
- **Estimated Effort:** 1 week
- **Dependencies:** tesseract.js library

### 41. Unified Timeline Refactoring
- **File:** `src/app/api/cases/[id]/unified-timeline/route.ts` (line 296)
- **Status:** Needs Documentation
- **Description:** Timeline merging logic documentation/refactoring
- **Impact:** Code clarity issue
- **Estimated Effort:** 2-3 days

### 42. Email/Slack Notifications for Jobs
- **File:** Multiple job files
- **Status:** Not Implemented
- **Description:** Send notifications to teams on job completion/failure
- **Impact:** Team awareness incomplete
- **Estimated Effort:** 1 week

---

## 📊 Statistics

### By Priority
- **Critical (Production Blockers):** 8 items
- **High Priority (Core Features):** 11 items
- **Medium Priority (Important):** 13 items
- **Low Priority (Enhancement):** 10 items

### By Category
- **Feature/Core Functionality:** 25 items
- **API Integration:** 15 items
- **Operations/Monitoring:** 18 items
- **Frontend/UI:** 12 items
- **Storage/Infrastructure:** 5 items
- **Database Schema:** 8 items
- **Security:** 8 items
- **Refactoring/Code Quality:** 8 items
- **Other:** 5 items

### By Effort Estimation
- **1 Day:** 8 items
- **2-3 Days:** 15 items
- **1 Week:** 12 items
- **2-3 Weeks:** 4 items
- **Blocked/Dependent:** 3 items

---

## 🎯 Recommended Action Plan

### This Sprint (High Impact)
- [ ] Implement PDF/DOCX generation
- [ ] Fix payment webhook signature verification
- [ ] Implement S3 file storage
- [ ] Complete report scheduling CRUD

### Next Sprint
- [ ] Implement notification systems (email, SMS)
- [ ] Complete webhook handling
- [ ] Add remote tracking schema field
- [ ] Implement real credit system

### Backlog (When Time Permits)
- [ ] Dashboard implementation
- [ ] API endpoint completions
- [ ] Alerting system
- [ ] Technical debt cleanup

---

## 🔍 How to Use This Document

1. **For Sprint Planning:** Sort items by priority and effort
2. **For Code Review:** Reference specific lines and descriptions
3. **For New Developers:** Understand what's incomplete/needs work
4. **For Release Planning:** Identify blockers vs enhancements
5. **Keep Updated:** Update this file whenever new TODOs are added to code

---

**Last Scanned:** 2025-10-28
**Next Scan Recommended:** After major feature implementation or monthly
