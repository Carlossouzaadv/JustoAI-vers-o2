# Webhook Fix - Deployment Guide

## Summary of Changes

Fixed two critical issues in the JUDIT webhook integration:

### Problem 1: Wrong Case Association ✅
**Issue:** Webhook processed data for wrong case when multiple cases shared same CNJ
- User uploaded file to case A but webhook merged to case B

**Solution:**
- Added explicit `caseId` field to `JuditRequest` table
- Pass `caseId` through entire flow: upload → queue → webhook
- Webhook uses explicit `caseId` instead of searching by CNJ (eliminates ambiguity)

### Problem 2: Duplicate Webhook Processing ✅
**Issue:** JUDIT sends multiple webhooks for same requestId
- Each processed independently, causing case type to change multiple times

**Solution:**
- Added idempotency tracking via `processed_webhook_request_ids` in case metadata
- Duplicate webhooks detected and gracefully skipped
- First webhook processes, subsequent duplicates return success but skip processing

---

## Files Modified

### 1. Prisma Schema & Migration
- **File:** `prisma/schema.prisma`
  - Added `caseId?: String?` field to `JuditRequest`
  - Added relationship `juditRequests[]` to `Case`
  - Added indexes: `(caseId)`, `(requestId, caseId)`

- **File:** `prisma/migrations/20251025_add_caseId_to_judit_requests.sql`
  - Migration to add column, foreign key, and indexes

### 2. Service Layer
- **File:** `src/lib/services/juditOnboardingService.ts`
  - Added `caseId?` parameter to `performFullProcessRequest()`
  - Added `explicitCaseId?` parameter to `initiateRequest()`
  - Store `caseId` in `JuditRequest.create()`

### 3. Queue
- **File:** `src/lib/queue/juditQueue.ts`
  - Added `caseId?` to `JuditOnboardingJobData` interface
  - Updated `addOnboardingJob()` to accept and pass `caseId`

### 4. Upload Route
- **File:** `src/app/api/documents/upload/route.ts`
  - Pass explicit `caseId` when calling `addOnboardingJob()`

### 5. Webhook Callback (Most Critical)
- **File:** `src/app/api/webhook/judit/callback/route.ts`
  - Use explicit `caseId` from `JuditRequest` for case lookup (preferred method)
  - Fall back to CNJ-based lookup only if no explicit `caseId`
  - Added idempotency check using `processed_webhook_request_ids`
  - Duplicate webhooks detected and gracefully skipped

---

## Deployment Steps

### Step 1: Code Deployment
```bash
# Already done - code is ready in git
git add -A
git commit -m "fix(webhook): use explicit caseId and add idempotency"
git push origin main
```

### Step 2: Database Migration (IMPORTANT - Run from environment with DB access)

**Option A: Vercel Deployment (Recommended)**
```bash
# After pushing to main, migrations auto-run on Vercel
# Monitor: https://vercel.com/dashboard
```

**Option B: Manual from Server/CI
```bash
cd /path/to/project
npx prisma migrate deploy
```

**Option C: Manual from Local (requires VPN/tunnel to DB)**
```bash
# If using Supabase with connection pooling:
DATABASE_URL="postgresql://user:pass@pooler.supabase.com:5432/postgres" \
DIRECT_URL="postgresql://user:pass@aws-region.supabase.com:5432/postgres" \
npx prisma migrate deploy
```

### Step 3: Verify Deployment
```bash
# Check if migration applied successfully
npx prisma db execute --stdin < /dev/null

# Or query the database to verify new column exists
psql $DATABASE_URL -c "\d judit_requests"
```

---

## Testing the Fix

### Test Case 1: Multiple Cases with Same CNJ
```
1. Create Case A with CNJ 5012723-65.2023.4.02.0000
2. Create Case B with CNJ 5012723-65.2023.4.02.0000
3. Upload file to Case A
4. Verify webhook processes Case A (not Case B)
✓ Check URL after upload: /dashboard/process/[Case A ID]?tab=analysis
```

### Test Case 2: Duplicate Webhooks
```
1. Upload file to trigger JUDIT onboarding
2. Simulate duplicate webhook (same requestId, different response)
3. Verify:
   - First webhook: processes normally, sets type=OTHER
   - Second webhook: detected as duplicate, skipped
   - Case type remains OTHER (not overwritten)
   - Logs show: "Webhook duplicado detectado...Ignorando"
```

### Test Case 3: End-to-End Flow
```
1. Upload PDF to new case
2. Monitor logs for:
   - "Enfileirando JUDIT para [CNJ] (Case: [ID])"
   - "Usando case ID explícito: [ID]"
   - "[JUDIT Webhook] ✅ VÁLIDO"
   - "Caso [ID] marcado como 'enriched'"
3. Verify case details page shows correct data
```

---

## Rollback Plan (if needed)

```bash
# Rollback migration
npx prisma migrate resolve --rolled-back 20251025_add_caseId_to_judit_requests

# Or manually remove the column
psql $DATABASE_URL -c "ALTER TABLE judit_requests DROP COLUMN case_id;"
```

---

## Monitoring

After deployment, monitor these logs for errors:

```
[JUDIT Webhook] Case não encontrado com ID explícito
  → Indicates explicit caseId lookup failed (check DB)

[JUDIT Webhook] Webhook duplicado detectado
  → Normal - duplicate webhook was skipped correctly

✓ [JUDIT Webhook] Usando case ID explícito
  → Normal - explicit caseId lookup succeeded
```

---

## Backward Compatibility

✅ Changes are **fully backward compatible**:
- `caseId` field is optional (nullable)
- If no explicit `caseId`, system falls back to CNJ-based lookup
- Existing webhooks without `caseId` will still process (fallback path)
- New uploads will always have explicit `caseId` (preferred path)

---

## Performance Impact

✅ **No negative impact** - Actually improves performance:
- Explicit case lookup: 1 query by ID (very fast)
- Legacy CNF lookup: potentially multiple queries
- Indexed lookups: `(caseId)` and `(requestId, caseId)` added

---

## Database Schema Change

### Before
```sql
ALTER TABLE judit_requests
DROP COLUMN case_id; -- If rolling back
```

### After
```sql
ALTER TABLE judit_requests
ADD COLUMN case_id TEXT REFERENCES cases(id) ON DELETE SET NULL;
CREATE INDEX judit_requests_case_id_idx ON judit_requests(case_id);
CREATE INDEX judit_requests_request_id_case_id_idx ON judit_requests(request_id, case_id);
```

---

## Questions?

If migration fails or you need assistance, check:
1. Database is accessible and credentials are correct
2. Prisma can connect: `npx prisma db check`
3. Check migration history: `npx prisma migrate status`
4. Review error logs carefully - they indicate the root cause
