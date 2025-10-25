# 🚨 Migration Required: Create process_timeline_entries Table

## Problem
The `process_timeline_entries` table doesn't exist in the database:

```
ERROR:  42P01: relation "public.process_timeline_entries" does not exist
```

This table is required for timeline functionality and must be created with the proper `TimelineSource` enum type.

## Solution
Execute the SQL migration to create the table with all constraints and indexes.

### Option 1: Via Supabase SQL Editor (Recommended for Production) ⭐
1. Go to **Supabase Dashboard → SQL Editor**
2. Create a **new query**
3. Copy ALL the SQL from: `prisma/migrations/20251025_create_timeline_with_enum/migration.sql`
4. Click **"Run"** (or Ctrl+Enter)
5. You should see: `Query executed successfully`

### Option 2: Via Prisma CLI (Local/Development)
```bash
npx prisma migrate deploy
```

## What This Migration Does
1. ✓ Creates `TimelineSource` enum with 5 values
2. ✓ Drops old malformed table (if exists)
3. ✓ Creates `process_timeline_entries` table with proper schema
4. ✓ Creates 4 indexes for performance
5. ✓ Creates trigger for `updated_at` auto-update
6. ✓ Adds documentation comments

## Verification
After running the migration:

❌ These errors should **disappear**:
```
ERROR: 42P01: relation "public.process_timeline_entries" does not exist
type "public.TimelineSource" does not exist
```

✅ You should see in logs:
```
✓ [JUDIT Webhook] Timeline atualizada: { case_id: '...', new_entries: X }
✓ [JUDIT Webhook] Anexos processados: { total: 11, downloaded: 11, processed: 11, failed: 0 }
```

## Files Changed
- `prisma/migrations/20251025_create_timeline_with_enum/migration.sql` - Main migration file
- Deleted: `prisma/migrations/20251025_fix_timeline_source_enum/` (old broken migration)

## Timeline of Fixes
1. ✅ Fixed: `Argument 'source' is missing` (added source field in webhook)
2. ⏳ **ACTION REQUIRED**: Execute this migration to create table
3. ✅ Affects: Timeline processing, attachment processing, all webhook operations

---
**Created**: 2025-10-25
**Updated**: 2025-10-25 (Found actual problem: missing table)
**Priority**: 🔴 CRITICAL - Blocks all webhook processing
