# TODO Tracker - JustoAI V2

**Last Updated:** 2025-11-03 (Live Sync + Sprint Planning)
**Total Items:** 40 (16 Critical/High - 5 Medium - 19 Low)
**Status:** ✅ LIVE IN PRODUCTION + Ready for Next Sprint

---

## 📊 Quick Summary

| Priority | Count | Status | Details |
|----------|-------|--------|---------|
| 🔴 CRÍTICO | 4 | Blocking | Security + monitoring |
| 🟠 ALTO | 12 | Important | Core features |
| 🟡 MÉDIO | 5 | Should do | Enhancements |
| 🟢 BAIXO | 19 | Nice-to-have | Polish |

---

## ✅ Completed (Nov 2-3, 2025)

✅ Report Scheduling CRUD (all endpoints)
✅ Report Delivery Notifications (Email + Slack)
✅ JUDIT Webhook Movement Alerts (real-time)
✅ Server-Sent Events (SSE) dashboard updates
✅ PDF Text Extraction with OCR (Tesseract.js)
✅ Process Monitoring & Observability
✅ Webhook Delivery Service (retry logic)
✅ Job Logger singleton
✅ System Health Metrics (5-component checks)
✅ Git pull + Prisma sync (3 new tables)

---

## 🔴 CRÍTICO (4 items - This Sprint)

### 1. Enable Real Sentry Integration
- **Status:** Ready but mocked
- **Impact:** Production errors not tracked
- **Effort:** 2-4 hours
- **Action:** Activate Sentry SDK + configure alerts

### 2. Payment Webhook Signature Verification
- **Status:** Placeholder only
- **Impact:** Security vulnerability - unverified payments
- **Effort:** 4-6 hours
- **Providers:** Stripe, Square, PayPal, Pix
- **Action:** Implement per-provider signature validation

### 3. Admin Permission Validation
- **Status:** Incomplete on some endpoints
- **Impact:** Non-admin users could access restricted ops
- **Effort:** 2-3 hours
- **Action:** Add workspace role middleware check

### 4. Bull Board Access Control
- **Status:** No access restrictions
- **Impact:** Any authenticated user can view queues
- **Effort:** 1-2 hours
- **Action:** Implement RBAC for admin access

---

## 🟠 ALTO (12 items - Next 2 weeks)

### Core Features
1. **Telemetry & Monitoring** - Real cost tracking (not mocked)
   - Effort: 1 week | Status: Disabled

2. **Database Caching** - Admin dashboard cache layer
   - Effort: 2-3 days | Status: Not persisted

3. **Document Management APIs** - Update/delete endpoints
   - Effort: 1 week | Status: Incomplete

4. **Case Notes Implementation** - Schema dependent
   - Effort: 1 week | Status: Blocked

5. **Import Rollback/Restart** - Failed import recovery
   - Effort: 3-5 days | Status: Not implemented

6. **Excel Upload Validation** - Error CSV generation
   - Effort: 2-3 days | Status: Not implemented

### Integration
7. **Process Webhook Handling** - Complete pipeline
   - Effort: 1-2 weeks | Status: Partial

8. **JUDIT Attachment Validation** - Credit checks before fetch
   - Effort: 3-5 days | Status: Not implemented

### Analysis
9. **Analysis Version Endpoints** - Dynamic versioning
   - Effort: 3-5 days | Status: Needs refactor

10. **Stream Response Refactoring** - Controller pattern + cleanup
    - Effort: 1 week | Status: Technical debt

11. **Alert System Integration** - Sentry, webhooks, aggregation
    - Effort: 2-3 weeks | Status: Partial

12. **External Logging Service** - LogRocket or similar
    - Effort: 3-5 days | Status: Not integrated

---

## 🟡 MÉDIO (5 items - Next 3-4 weeks)

1. **Real Credit System** - Stop mocking (currently returns 999)
   - Effort: 2-3 weeks | Status: Mocked

2. **Process Notes Auth Context** - Get current user
   - Effort: 1 day | Status: Hardcoded

3. **Dashboard Real API Calls** - Replace mock data
   - Effort: 1-2 weeks | Status: Using mock

4. **Usage Tracking Integration** - WorkspaceCredits model
   - Effort: 1 week | Status: Partial

5. **Sync Worker Statistics** - Persistence to DB
   - Effort: 2-3 days | Status: Lost on restart

---

## 🟢 BAIXO (19 items - Backlog/Polish)

**Document/UI Features:**
- PDF export feature (1 week)
- Contact form integration (2-3 days)
- Document tags/notes UI (1 week)
- Dashboard sidebar alert calculations (3-5 days)

**Admin & Performance:**
- Admin authorization check (1 day)
- JUDIT consumption caching (2-3 days)
- Timeline refactoring (2-3 days)
- Redis cache statistics (1 day)

**Monitoring & Infrastructure:**
- Main dashboard plan integration (3-5 days)
- Analysis processing time measurement (1 day)
- Service document processing (3-5 days)
- Bull Board real token verification (2-3 days)

**Code Quality:**
- Stream handler refactoring (1 week)
- Analysis version dynamic routing (3-5 days)
- Telemetry models (1 week)
- PDF text extraction improvement (3-5 days)

---

## 🚫 BACKLOG (Payment/Credits)

**Decision:** Deferred to future sprint pending business model finalization

- Credit system real implementation (swap mock)
- Payment signature verification (per provider)
- Credit transaction audit trail
- Credit expiration & rollover logic

---

## 📊 Effort Distribution

| Time | Count | Items |
|------|-------|-------|
| 1 day | 4 | Quick fixes |
| 2-3 days | 8 | Standard tasks |
| 1 week | 12 | Medium features |
| 2-3 weeks | 3 | Large features |
| 1+ month | 13 | Backlog/Polish |

---

## 🎯 Recommended Sprint Plan

### Sprint 1 (This Week)
- [ ] Enable Sentry integration
- [ ] Implement payment signature verification
- [ ] Add admin permission validation
- [ ] Implement Bull Board access control

### Sprint 2 (Week 2-3)
- [ ] Complete webhook handling pipeline
- [ ] JUDIT attachment validation
- [ ] Real telemetry implementation
- [ ] Database caching for admin

### Sprint 3 (Week 3-4)
- [ ] Document management APIs
- [ ] Case notes implementation
- [ ] Excel validation errors export
- [ ] Alert system completion

---

## 📚 Related Documentation

- [resumo_projeto_atual.md](./resumo_projeto_atual.md) - Project overview
- [TODO.md](./TODO.md) - Consolidated 42-item list
- [README.md](./README.md) - Technical docs

---

**For detailed breakdown:** See `resumo_projeto_atual.md` for critical issues & priority analysis

**Maintainer:** Development Team
**Last Review:** 2025-11-03
