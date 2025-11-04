# MVP Implementation - Quick Start Reference

**Launch Date:** December 1, 2025 (27 days away)
**Status:** 4/4 Security Blockers COMPLETE ✅
**Team Capacity:** Ready to build

---

## The 6 Remaining Features at a Glance

### 🟢 START IMMEDIATELY - Week 1 (20-29 hours)

#### FEATURE 2: Document PATCH/DELETE (5-7 hours)
```
Priority: HIGH | Difficulty: LOW | Dependencies: NONE
📍 File: src/app/api/documents/[id]/route.ts
✅ What exists: Upload (900+ lines), download (140 lines)
❌ What's missing: PATCH for metadata, DELETE for cleanup

Quick wins:
- PATCH: Update name, tags, summary (2-3h)
- DELETE: Remove from Supabase + cascade cleanup (3-4h)
```

#### FEATURE 3: Case Notes CRUD (7-10 hours)
```
Priority: HIGH | Difficulty: LOW | Dependencies: NONE
📍 Files: src/app/api/cases/[id]/notes/route.ts + [noteId]/route.ts
✅ What exists: CaseEvent model with NOTE type, stubs
❌ What's missing: Real GET/POST/PATCH/DELETE handlers

Quick wins:
- GET: Query CaseEvent type='NOTE' with pagination (2h)
- POST: Create note as CaseEvent (2-3h)
- PATCH: Update by author/admin (2h)
- DELETE: Delete by author/admin (1.5h)
```

#### FEATURE 5: Excel Retry & Error Handling (8-12 hours)
```
Priority: MEDIUM | Difficulty: MEDIUM | Dependencies: NONE
📍 Files: src/lib/excel-validation.ts + 3 new API endpoints
✅ What exists: Upload works, batch tracking, error storage
❌ What's missing: Row validation, error export, retry logic

Quick wins:
- Validation: Zod schemas for each field (2-3h)
- Error Export: CSV download of failed rows (2-3h)
- Retry Logic: Reprocess failed rows with limits (3-4h)
- Status: Enhance endpoint with error summary (1-2h)
```

**Week 1 Total: 20-29 hours** ✨ Can be done in parallel!

---

### 🟠 NEXT - Week 2-3 (20-25 hours)

#### FEATURE 4: Real Telemetry (20-25 hours) ⚠️ CRITICAL
```
Priority: CRITICAL | Difficulty: HIGH | Dependencies: BLOCKS F6
📍 Files: src/lib/judit-api-wrapper.ts + 2 endpoints + 1 job
✅ What exists: Models (JuditCostTracking, JuditAlert, JuditTelemetry)
❌ What's missing: Real data collection & aggregation

Phase breakdown:
1. JUDIT API Wrapper (3-5h) - Track every call with cost/duration
2. Real Endpoints (4-6h) - /api/telemetry/monthly-usage + active-alerts
3. Integration Points (3-4h) - Hook into onboarding, analysis, reports, uploads
4. Daily Job (4-5h) - Aggregation + alert triggers

Why critical? Dashboard (F6) depends on this data!
```

**Week 2-3 Total: 20-25 hours**

---

### 🔵 FINAL - Week 3-4 (12-15 hours)

#### FEATURE 6: Dashboard Real Data (12-15 hours)
```
Priority: MEDIUM | Difficulty: MEDIUM | Dependencies: Feature 4
📍 Files: src/lib/services/dashboardDataService.ts + 1 API + components
✅ What exists: Layout, components, mock data
❌ What's missing: Real data fetching & integration

Tasks:
1. Dashboard Service (2-3h) - Aggregate stats from DB
2. API Endpoint (2h) - GET /api/dashboard/overview
3. Frontend (3-4h) - Replace mocks with real data
4. Caching (2h) - Redis invalidation strategy

Cannot start until F4 complete (needs telemetry endpoints)
```

**Week 3-4 Total: 12-15 hours**

---

## Timeline Visualization

```
Week 1 (Nov 4-10):     F2 + F3 + F5 (parallel)
                       ████████████████████
                       20-29 hours

Week 2-3 (Nov 10-24):  F4 (sequential)
                       ████████████████
                       20-25 hours

Week 3-4 (Nov 17-Dec1):F6 (after F4)
                       ████████████
                       12-15 hours

          |____________|____________|____________|____________|
          Nov 4        Nov 10       Nov 17       Nov 24       Dec 1
          START        Check-in     Feature4     Final QA     LAUNCH
                                    Complete
```

---

## Database Status ✅

**NO MIGRATIONS NEEDED!** All tables exist and ready:

| Model | Status | Fields Needed |
|-------|--------|---------------|
| CaseDocument | ✅ Ready | name, tags, metadata (update support) |
| CaseEvent | ✅ Ready | type='NOTE', metadata for tags/priority |
| UploadBatchRow | ✅ Ready | errorMessage, retryCount |
| JuditCostTracking | ✅ Ready | Track cost, duration, action |
| JuditAlert | ✅ Ready | Store resolved/unresolved alerts |
| WorkspaceCredits | ✅ Ready | Balance tracking |

Just need to USE them, not change them!

---

## Code Patterns Reference

### Pattern 1: Auth + Workspace Validation
```typescript
const user = await getAuthenticatedUser(request);
if (!user) return unauthorizedResponse();

const workspace = await prisma.workspace.findUnique({
  where: { id: workspaceId },
  include: { members: { where: { userId: user.id } } },
});

if (!workspace?.members.length) return unauthorizedResponse();
```

**Used in:** All features ✅ Already proven in existing endpoints

### Pattern 2: Sentry Error Capture
```typescript
import { captureApiError, setSentryUserContext } from '@/lib/sentry-error-handler';

setSentryUserContext(user.id);

try {
  // your code
} catch (error) {
  captureApiError(error, {
    endpoint: '/api/...',
    userId: user.id,
  });
}
```

**Used in:** All features ✅ Already implemented globally

### Pattern 3: Pagination
```typescript
const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

const [items, total] = await Promise.all([
  prisma.model.findMany({
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { createdAt: 'desc' },
  }),
  prisma.model.count({ where }),
]);

return NextResponse.json({
  items,
  pagination: { page, limit, total, hasMore: page * limit < total },
});
```

**Used in:** F3 (notes), F4 (telemetry) ✅

### Pattern 4: Soft Updates (Don't lose data)
```typescript
const existing = await prisma.model.findUnique({ where: { id } });

await prisma.model.update({
  where: { id },
  data: {
    field: validatedData.field || existing.field, // Keep if not provided
  },
});
```

**Used in:** F3 (PATCH), F5 (retry) ✅

### Pattern 5: Audit Events
```typescript
// After any meaningful action
await prisma.caseEvent.create({
  data: {
    caseId,
    type: 'ACTION_TYPE', // DOCUMENT_UPDATED, NOTE_CREATED, etc
    userId: user.id,
    description: 'what happened',
    metadata: { /* context */ },
  },
});
```

**Used in:** F2, F3, F5 ✅

### Pattern 6: Cache Invalidation
```typescript
import { redis } from '@/lib/redis';

// Invalidate when data changes
await redis.del(`cache:key:${id}`);
```

**Used in:** F6 (dashboard) ✅

---

## Start Here - Feature 2 (Document PATCH/DELETE)

### File Structure
```
src/app/api/documents/[id]/
├─ route.ts          ← EXISTING (GET, POST for upload)
│  ├─ GET [id]       ✅ EXISTS (download)
│  ├─ POST           ✅ EXISTS (upload)
│  ├─ PATCH [id]     ❌ ADD THIS
│  └─ DELETE [id]    ❌ ADD THIS
└─ download/
   └─ route.ts       ✅ EXISTS

Total new code: ~150 lines
```

### Quick Implementation
```typescript
// 1. Add to existing route.ts

export async function PATCH(request, { params }) {
  // 2 hours max
  // - Auth check (copy from DELETE in documents/upload)
  // - Parse request (name, tags, summary)
  // - Update database
  // - Create audit event
  // - Return updated doc
}

export async function DELETE(request, { params }) {
  // 3-4 hours max
  // - Auth check
  // - Delete from Supabase Storage
  // - Delete DB record
  // - Handle cascades (TimelineEntry references)
  // - Create audit event
  // - Return success
}
```

**Estimated effort: 5-7 hours for one person**

---

## Daily Standup Questions

Use these every day to track progress:

### Week 1
- [ ] How many features are 100% complete?
- [ ] What blockers exist?
- [ ] Are F2, F3, F5 on track for end of week?

### Week 2
- [ ] Is F4 Phase 1 (JUDIT wrapper) done?
- [ ] Are integration points (Phase 3) identified?
- [ ] Ready to start F4 Phase 2 (endpoints)?

### Week 3
- [ ] Is F4 fully complete and tested?
- [ ] Can F6 frontend start integrating?
- [ ] Any QA issues found?

### Week 4
- [ ] Is F6 complete?
- [ ] All integration tests passing?
- [ ] Ready for production deployment?

---

## Critical Paths (Don't Block These)

```
F4 Telemetry → F6 Dashboard
        ↓          ↓
    Can't start F6 until F4 done!

F2, F3, F5 are independent (do parallel!)
```

**Strategy:** Run F2+F3+F5 in parallel on Week 1 while one person preps F4 architecture.

---

## Testing Priorities

### Week 1 QA
```
✅ Unit tests for each endpoint
✅ Manual API testing (Postman)
✅ Error cases (invalid input, auth failures)
✅ Database state verification
```

### Week 2 QA
```
✅ Cost tracking accuracy (F4)
✅ API response time (< 500ms)
✅ Sentry event capture
✅ Alert triggering on thresholds
```

### Week 3 QA
```
✅ Dashboard data accuracy vs database
✅ Cache invalidation working
✅ Frontend component rendering
✅ E2E flows (create note → see in dashboard)
```

### Week 4 QA
```
✅ Full integration tests
✅ Performance under load
✅ Production readiness checklist
✅ Security audit final pass
```

---

## Success Indicators

### By End of Week 1
- [x] F2 PATCH/DELETE working
- [x] F3 Full CRUD working
- [x] F5 Validation + retry logic working
- [x] All endpoints have Sentry integration
- [x] All endpoints have unit tests

### By End of Week 3
- [x] All F4 phases complete
- [x] /api/telemetry endpoints returning real data
- [x] Cost calculations verified

### By Launch (Dec 1)
- [x] F6 dashboard showing real data
- [x] All features integrated
- [x] No critical bugs in QA
- [x] Security audit passed
- [x] Performance benchmarks met

---

## File Checklist (Copy/Paste)

### Week 1 Files to Create/Modify
```
NEW FILES:
- [ ] src/lib/excel-validation.ts
- [ ] src/app/api/upload/batch/[id]/errors/download/route.ts
- [ ] src/app/api/upload/batch/[id]/retry/route.ts
- [ ] src/app/api/cases/[id]/notes/[noteId]/route.ts

MODIFY:
- [ ] src/app/api/documents/[id]/route.ts (add PATCH+DELETE)
- [ ] src/app/api/cases/[id]/notes/route.ts (replace stubs)
- [ ] src/app/api/upload/batch/[id]/status/route.ts (enhance)
```

### Week 2-3 Files to Create
```
NEW FILES:
- [ ] src/lib/judit-api-wrapper.ts
- [ ] src/jobs/telemetry-aggregation.ts
- [ ] src/app/api/telemetry/monthly-usage/route.ts (replace mock)
- [ ] src/app/api/telemetry/active-alerts/route.ts (replace mock)
```

### Week 3-4 Files to Create/Modify
```
NEW FILES:
- [ ] src/lib/services/dashboardDataService.ts
- [ ] src/app/api/dashboard/overview/route.ts

MODIFY:
- [ ] src/app/dashboard/* (all components)
- [ ] src/app/api/documents/[id]/route.ts (invalidate cache)
- [ ] src/app/api/cases/[id]/[noteId]/route.ts (invalidate cache)
- [ ] src/app/api/reports/generate/route.ts (invalidate cache)
```

---

## Next Steps (TODAY)

1. **Read** `MVP_FEATURES_IMPLEMENTATION_GUIDE.md` (this document is the tactical guide)
2. **Assign** F2 to engineer A, F3 to engineer B, F5 to engineer C (parallel!)
3. **Review** existing patterns in:
   - `/api/documents/upload` (auth, Supabase)
   - `/api/cases/[id]/events` (CaseEvent queries)
   - `/api/upload/excel` (validation patterns)
4. **Start** coding Feature 2 - document API PATCH/DELETE
5. **Daily** standup using checklist above

---

## Support Resources

**All existing patterns in the codebase:**
- Auth: `src/lib/auth-helper.ts` ✅ Proven
- Database: `prisma/schema.prisma` ✅ Complete
- Sentry: `src/lib/sentry-error-handler.ts` ✅ New!
- Email: `src/lib/email-service.ts` ✅ Working
- Storage: `src/lib/sdk-storage.ts` ✅ Production ready
- Redis: `src/lib/redis.ts` ✅ Configured

**Example endpoints to study:**
- Document upload: 900 lines, shows all patterns
- Case events: Simple queries, pagination
- Reports: Complex aggregations
- Credits: Real business logic

---

## Timeline to Go-Live

```
Today (Nov 4)
  └─ Features 2-5 assigned (Week 1)
     └─ Code reviews every day
        └─ By Nov 11: F2,F3,F5 DONE ✅
           └─ Feature 4 planning complete
              └─ By Nov 24: F4 DONE ✅
                 └─ Feature 6 integration starts
                    └─ By Dec 1: F6 DONE ✅
                       └─ LAUNCH READY 🚀
```

---

**Document:** MVP_QUICK_START.md
**Last Updated:** November 4, 2025
**Status:** Ready for implementation
**Target Launch:** December 1, 2025

For detailed implementation specs, see: `MVP_FEATURES_IMPLEMENTATION_GUIDE.md`
