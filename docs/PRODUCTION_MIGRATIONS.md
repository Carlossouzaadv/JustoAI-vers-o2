# Production Database Migrations Guide

## Quick Start

The production database still needs the missing columns added. There are two ways to apply migrations:

### Option 1: Using Vercel Build Command (Recommended)

Add this to your `vercel.json` build configuration:

```json
{
  "buildCommand": "npm run build && npx tsx scripts/run-migrations.ts",
  "devCommand": "npm run dev",
  "installCommand": "npm install"
}
```

**How it works**:
1. Build completes
2. Migrations are applied automatically
3. New build is ready to deploy

**Advantages**:
- ✅ Automatic during every deploy
- ✅ No manual steps needed
- ✅ Safe - uses Prisma to check if columns exist first

### Option 2: Manual Execution via CLI

If you need to run migrations manually:

```bash
# Set environment variables
export DATABASE_URL="postgresql://user:pass@...pooler.supabase.com:6543/postgres?pgbouncer=true"
export DIRECT_URL="postgresql://user:pass@db....supabase.co:5432/postgres"

# Run migrations
npx tsx scripts/run-migrations.ts
```

**Output**:
```
🔧 Running database migrations...

⏳ Running: Add processoId to cases
✅ Success: Add processoId to cases

⏳ Running: Add textSha to case_documents
✅ Success: Add textSha to case_documents

⏳ Running: Create index on textSha
✅ Success: Create index on textSha

==================================================
📊 Migration Summary
==================================================
✅ Add processoId to cases: Applied successfully
✅ Add textSha to case_documents: Applied successfully
✅ Create index on textSha: Applied successfully
==================================================
Total: 3 successful, 0 failed

✅ All migrations completed successfully!
```

---

## What Each Migration Does

### Migration 1: Add `processoId` to `cases` table

```sql
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "processoId" TEXT;
```

**Purpose**: Link legal cases to JUDIT process monitoring
**Impact**: Enables process tracking and monitoring features
**Safe**: Uses `IF NOT EXISTS`, idempotent

### Migration 2: Add `textSha` to `case_documents` table

```sql
ALTER TABLE "case_documents" ADD COLUMN IF NOT EXISTS "textSha" TEXT;
```

**Purpose**: Store SHA256 hash of document content for deduplication
**Impact**: Prevents duplicate document uploads
**Safe**: Uses `IF NOT EXISTS`, idempotent

### Migration 3: Create index on `textSha`

```sql
CREATE INDEX IF NOT EXISTS "case_documents_textSha_idx" ON "case_documents"("textSha");
```

**Purpose**: Speed up deduplication checks
**Impact**: Faster document processing
**Safe**: Uses `IF NOT EXISTS`, doesn't affect existing data

---

## Current Production Status

### Before Migrations
```
❌ /api/cases - 500 error: "The column `cases.processoId` does not exist"
❌ /api/documents/upload - 400 error: "The column `case_documents.textSha` does not exist"
```

### After Migrations (What Will Happen)
```
✅ /api/cases - Returns cases successfully
✅ /api/documents/upload - Processes PDFs with deduplication
```

---

## Verification

To verify migrations were applied:

```bash
# Check columns exist
psql $DATABASE_URL -c "
  SELECT column_name
  FROM information_schema.columns
  WHERE table_name = 'cases' AND column_name = 'processoId';
"

psql $DATABASE_URL -c "
  SELECT column_name
  FROM information_schema.columns
  WHERE table_name = 'case_documents' AND column_name = 'textSha';
"

# Check index exists
psql $DATABASE_URL -c "
  SELECT indexname
  FROM pg_indexes
  WHERE indexname = 'case_documents_textSha_idx';
"
```

---

## Troubleshooting

### Error: "connect ECONNREFUSED"

This means the migration script can't connect to the database. **Verify**:

1. `DATABASE_URL` is set correctly
2. `DIRECT_URL` is set correctly
3. Network access allows connection (check Supabase firewall)
4. Credentials are valid

### Error: "relation 'cases' does not exist"

This shouldn't happen unless there's a serious database issue. **Check**:

1. Database is accessible
2. Schema is properly initialized
3. Contact Supabase support if issue persists

### Migrations Run But APIs Still Fail

**Possible causes**:

1. **Build cache issue** - Vercel might be using cached Next.js build
   - Solution: Re-run build or clear cache in Vercel dashboard

2. **Environment variables not updated** - Changes might not be reflected
   - Solution: Redeploy with new variables

3. **Prisma Client needs regeneration**
   - Solution: Run `npx prisma generate` locally and commit

---

## Next Steps

1. **Apply Migrations**:
   - Option 1: Add command to `vercel.json` (automatic)
   - Option 2: Run `npx tsx scripts/run-migrations.ts` manually

2. **Verify**:
   - Check `/api/cases` returns data (200 OK)
   - Try uploading a PDF to `/api/documents/upload`
   - Monitor logs for errors

3. **Monitor Production**:
   - Watch for "column does not exist" errors
   - Should see 0 errors related to missing columns

---

## Migration Script Details

**File**: `scripts/run-migrations.ts`

**Features**:
- ✅ Type-safe (written in TypeScript)
- ✅ Graceful error handling
- ✅ Idempotent (safe to run multiple times)
- ✅ Clear success/failure reporting
- ✅ Automatic Prisma disconnection

**How it works**:
1. Connects to database using Prisma
2. Runs each migration SQL statement
3. Catches "already exists" errors and skips
4. Reports results
5. Exits with code 0 (success) or 1 (failure)

---

## Important Notes

⚠️ **WARNING**: Do NOT modify these migrations unless you know what you're doing

- Migrations are additive (adding columns) - safe
- No data is deleted
- Operations are idempotent (can run multiple times)
- All migrations use `IF NOT EXISTS` for safety

---

## Related Documentation

- `docs/SUPABASE_PGBOUNCER_FIX.md` - Connection pooling explanation
- `docs/PRODUCTION_ERRORS_FIXED.md` - All errors and fixes
- `prisma/schema.prisma` - Full schema definition
- `prisma/migrations/fix_missing_columns.sql` - SQL migration file

---

**Last Updated**: 2025-10-18
**Status**: Ready to apply
**Safety Level**: ✅ Very High (idempotent, additive only)
