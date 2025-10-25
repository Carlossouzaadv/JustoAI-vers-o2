# 🚨 Migration Required: TimelineSource Enum

## Problem
The `process_timeline_entries.source` column was created as `VARCHAR(50)` in the database, but the Prisma schema defines it as an enum type `TimelineSource`. This causes:

```
type "public.TimelineSource" does not exist
```

## Solution
Execute the migration to convert the column to use the enum type properly.

### Option 1: Via Supabase SQL Editor (Recommended for Production)
1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the SQL from `prisma/migrations/20251025_fix_timeline_source_enum/migration.sql`
3. Click "Run"

### Option 2: Via Prisma CLI (Local/Development)
```bash
npx prisma migrate deploy
```

## SQL to Execute
```sql
-- 1. Create the enum type
CREATE TYPE "public"."TimelineSource" AS ENUM (
    'DOCUMENT_UPLOAD',
    'API_JUDIT',
    'MANUAL_ENTRY',
    'SYSTEM_IMPORT',
    'AI_EXTRACTION'
);

-- 2. Alter column to use the enum
ALTER TABLE "public"."process_timeline_entries"
    ALTER COLUMN "source" TYPE "public"."TimelineSource"
    USING "source"::"public"."TimelineSource";
```

## Verification
After running the migration, these errors should disappear from the logs:
```
type "public.TimelineSource" does not exist
```

And you should see successful logs like:
```
✓ [JUDIT Webhook] Timeline atualizada: { case_id: '...', new_entries: X }
```

## Timeline of Fixes
1. ✓ Fixed: `Argument 'source' is missing` (added source field)
2. ⏳ **Action Required**: Execute this migration to fix enum type error
3. ✓ Will Fix: Remaining timeline issues once enum is in place

---
**Created**: 2025-10-25
**Priority**: HIGH - Blocks timeline processing
