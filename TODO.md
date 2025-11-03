# JustoAI v2 - Consolidated TODO List

**Last Updated:** 2025-11-03
**Total Items:** 40 (organized by priority & category)
**Status:** ✅ LIVE - Ready for Next Sprint

---

## 📊 Overview

| Priority | Count | Effort | Timeline |
|----------|-------|--------|----------|
| 🔴 CRÍTICO | 4 | 9-15h | This week |
| 🟠 ALTO | 12 | 2-3 weeks | Next 2 weeks |
| 🟡 MÉDIO | 5 | 2-3 weeks | Weeks 3-4 |
| 🟢 BAIXO | 19 | 2+ months | Backlog |

---

## 🔴 CRITICAL (Blocking - This Sprint)

### 1. Enable Real Sentry Integration
- **File:** `lib/alerts/ops-alerts.ts:474`
- **Status:** SDK ready but mocked
- **Impact:** CRITICAL - Production errors not tracked
- **Effort:** 2-4 hours
- **Checklist:**
  - [ ] Activate Sentry SDK
  - [ ] Configure error alerts
  - [ ] Test error capture
  - [ ] Deploy to production

### 2. Payment Webhook Signature Verification
- **File:** `lib/payment-webhook-handler.ts:459`
- **Status:** Placeholder only (always accepts)
- **Impact:** CRITICAL - Security vulnerability
- **Effort:** 4-6 hours
- **Providers:** Stripe, Square, PayPal, Pix
- **Checklist:**
  - [ ] Stripe signature verification (HMAC-SHA256)
  - [ ] Square verification
  - [ ] PayPal verification
  - [ ] Pix verification
  - [ ] Test each provider

### 3. Admin Permission Validation (Incomplete)
- **File:** `src/app/api/ai/analyze/route.ts:226`
- **Status:** Missing on some endpoints
- **Impact:** HIGH - Non-admins could access restricted ops
- **Effort:** 2-3 hours
- **Checklist:**
  - [ ] Add workspace role middleware
  - [ ] Check all admin endpoints
  - [ ] Write permission tests
  - [ ] Deploy

### 4. Bull Board Access Control
- **File:** `lib/bull-board.ts:86`
- **Status:** No restrictions
- **Impact:** HIGH - Information disclosure
- **Effort:** 1-2 hours
- **Checklist:**
  - [ ] Implement RBAC
  - [ ] Token verification
  - [ ] Admin-only access
  - [ ] Test restricted access

---

## 🟠 HIGH PRIORITY (Core Features - 2 weeks)

### Analytics & Monitoring (3 items)
1. **Real Telemetry** - Cost tracking (currently mocked)
   - Effort: 1 week | Status: Disabled in Prisma

2. **Database Caching** - Admin dashboard cache layer
   - Effort: 2-3 days | Status: Recalculates every request

3. **Alert System** - Sentry + webhooks + aggregation
   - Effort: 2-3 weeks | Status: Partial implementation

### Core Functionality (4 items)
4. **Document Management APIs** - Update/delete endpoints
   - Effort: 1 week | Status: Incomplete

5. **Case Notes Implementation** - Blocked by schema
   - Effort: 1 week | Status: Waiting for CaseEvent update

6. **Import Rollback** - Recover failed bulk imports
   - Effort: 3-5 days | Status: Not implemented

7. **Excel Upload Validation** - Error CSV export
   - Effort: 2-3 days | Status: Not implemented

### Integration (3 items)
8. **Process Webhook Handling** - Complete pipeline
   - Effort: 1-2 weeks | Status: Partial

9. **JUDIT Attachment Validation** - Check credits before fetch
   - Effort: 3-5 days | Status: Missing

10. **External Logging** - LogRocket or DataDog integration
    - Effort: 3-5 days | Status: Not integrated

### Technical (2 items)
11. **Analysis Version Endpoints** - Dynamic versioning
    - Effort: 3-5 days | Status: Needs refactor

12. **Stream Response Refactoring** - Proper cleanup
    - Effort: 1 week | Status: Potential memory leaks

---

## 🟡 MEDIUM PRIORITY (Enhancements - 3-4 weeks)

1. **Real Credit System** - Stop mocking (returns 999)
   - Effort: 2-3 weeks | Status: Fully mocked

2. **Process Notes Auth** - Get current user from context
   - Effort: 1 day | Status: Hardcoded

3. **Dashboard Real APIs** - Replace all mock data
   - Effort: 1-2 weeks | Status: Using fixtures

4. **Usage Tracking** - Use WorkspaceCredits model
   - Effort: 1 week | Status: Partial

5. **Worker Statistics** - Persist to database
   - Effort: 2-3 days | Status: Lost on restart

---

## 🟢 LOW PRIORITY (Polish & Backlog)

### UI/Frontend (4 items)
- PDF export feature (1 week)
- Contact form integration (2-3 days)
- Document tags/notes UI (1 week)
- Dashboard sidebar alerts (3-5 days)

### Admin & Security (4 items)
- Admin authorization check (1 day)
- JUDIT consumption caching (2-3 days)
- Dashboard plan integration (3-5 days)
- Bull Board token verification (2-3 days)

### Monitoring & Performance (4 items)
- Analysis processing time measurement (1 day)
- Redis cache statistics (1 day)
- Service document processing (3-5 days)
- Timeline refactoring (2-3 days)

### Code Quality (3 items)
- Stream handler refactoring (1 week)
- Analysis version routing (3-5 days)
- PDF text extraction improvement (3-5 days)

---

## 📋 By Category

### Feature Development (15 items)
- Report features: 2
- Document management: 3
- Case management: 2
- Alert system: 3
- Integration: 2
- Analytics: 2
- Other: 1

### Bug Fixes / Security (10 items)
- Payment security: 1
- Auth/permissions: 2
- Error tracking: 1
- Access control: 1
- Validation: 2
- Cost tracking: 2
- Technical debt: 1

### Infrastructure (8 items)
- Database: 2
- Caching: 2
- Logging: 2
- Performance: 2

### Polish (7 items)
- UI components: 3
- Forms: 1
- Metrics: 2
- Documentation: 1

---

## 🎯 Recommended Action Plan

### Week 1 (CRÍTICO)
- [ ] Enable Sentry
- [ ] Payment signature verification
- [ ] Admin permissions
- [ ] Bull Board access control

### Week 2-3 (ALTO - Priority)
- [ ] Real telemetry implementation
- [ ] Webhook handling pipeline
- [ ] Database caching
- [ ] JUDIT attachment validation

### Week 4+ (MÉDIO + BAIXO)
- [ ] Real credit system
- [ ] Document APIs
- [ ] Case notes
- [ ] Dashboard real data
- [ ] Polish & UI improvements

---

## 🔄 How to Use This List

1. **For Sprint Planning:** Sort by priority and effort
2. **For Code Review:** Reference specific files and line numbers
3. **For Status Tracking:** Update status field when items are completed
4. **For Estimation:** Use effort field for planning
5. **For Prioritization:** CRÍTICO → ALTO → MÉDIO → BAIXO

---

## 📚 Supporting Docs

- [resumo_projeto_atual.md](./resumo_projeto_atual.md) - Project overview & critical analysis
- [TODO_TRACKER.md](./TODO_TRACKER.md) - Sprint-focused tracker
- [README.md](./README.md) - Technical documentation

---

## ✅ Completion Criteria

- All CRÍTICO items: ✅ Required before next production release
- All ALTO items: 🔄 Planned for next 2 weeks
- MÉDIO items: 📅 Scheduled for weeks 3-4
- BAIXO items: 📋 Backlog (nice-to-have)

---

**Generated by:** Automated analysis
**Last Sync:** 2025-11-03
**Next Review:** After completing CRÍTICO items
