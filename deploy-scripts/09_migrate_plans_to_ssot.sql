-- ================================================================
-- MIGRATION: Plan Names and Configuration Update to SSOT
-- ================================================================
--
-- This migration maps old plan names to new plan names as defined in
-- the Single Source of Truth (SSOT): src/config/plans.ts
--
-- MAPPING:
--   'starter' / 'STARTER'         → 'gestao'
--   'professional' / 'PROFESSIONAL' → 'performance'
--   'enterprise' / 'ENTERPRISE'     → 'enterprise' (no change)
--
-- NOTE: This migration is idempotent and safe to run multiple times.
--

-- ================================================================
-- STEP 1: Verify existing plan values before migration
-- ================================================================
-- Run this SELECT to see current plan distribution:
-- SELECT plan, COUNT(*) as count FROM "Workspace" GROUP BY plan;

-- ================================================================
-- STEP 2: Create backup of current data (optional but recommended)
-- ================================================================
-- CREATE TABLE "Workspace_backup_plans_20250118" AS
-- SELECT * FROM "Workspace"
-- WHERE plan IN ('starter', 'STARTER', 'professional', 'PROFESSIONAL');

-- ================================================================
-- STEP 3: Migrate plan names (main operation)
-- ================================================================

-- Migrate 'starter' and 'STARTER' to 'gestao'
UPDATE "Workspace"
SET plan = 'gestao', "updatedAt" = NOW()
WHERE plan IN ('starter', 'STARTER')
AND plan != 'gestao'; -- Prevent double-migration

-- Migrate 'professional' and 'PROFESSIONAL' to 'performance'
UPDATE "Workspace"
SET plan = 'performance', "updatedAt" = NOW()
WHERE plan IN ('professional', 'PROFESSIONAL')
AND plan != 'performance'; -- Prevent double-migration

-- Enterprise stays as 'enterprise' (no change needed)
-- But we standardize the case if needed:
UPDATE "Workspace"
SET plan = 'enterprise', "updatedAt" = NOW()
WHERE LOWER(plan) = 'enterprise'
AND plan != 'enterprise';

-- ================================================================
-- STEP 4: Verify migration results
-- ================================================================
-- Run this SELECT to verify the migration:
-- SELECT plan, COUNT(*) as count FROM "Workspace" GROUP BY plan;
--
-- Expected result:
--   gestao        → (count of old 'starter' workspaces)
--   performance   → (count of old 'professional' workspaces)
--   enterprise    → (count of old 'enterprise' workspaces)

-- ================================================================
-- STEP 5: Validate data integrity
-- ================================================================
-- Run this query to check for any invalid plan values:
-- SELECT DISTINCT plan FROM "Workspace"
-- WHERE plan NOT IN ('gestao', 'performance', 'enterprise');
--
-- If this returns any rows, there are unexpected plan values.
-- Contact development team to investigate.

-- ================================================================
-- STEP 6: Update documentation (manual step)
-- ================================================================
-- After running this migration:
-- 1. Update API documentation to reflect new plan names
-- 2. Update frontend constants if any are hardcoded
-- 3. Communicate plan name changes to support team
-- 4. Monitor error logs for any references to old plan names

-- ================================================================
-- NOTES FOR DEVELOPERS
-- ================================================================
--
-- 1. This migration is IDEMPOTENT:
--    - It can be safely run multiple times
--    - It will not re-migrate already migrated workspaces
--
-- 2. BACKWARDS COMPATIBILITY:
--    - Old plan names are deprecated but not removed from code
--    - Legacy code paths check for both old and new names
--    - See src/lib/credit-system.ts and src/lib/subscription-limits.ts
--
-- 3. NEW SSOT LOCATION:
--    - src/config/plans.ts - Plan definitions and credit rates
--    - src/lib/services/planService.ts - Service layer for plan operations
--
-- 4. CREDIT SYSTEM CHANGES:
--    - Old system: Separate "reportCredits" and "fullCredits"
--    - New system: Unified "credits" (1 credit per ~50 processes or 1 full analysis)
--    - Database tables remain compatible with both systems during transition
--
-- 5. TIMELINE:
--    - Phase 1: Migrate plan names (THIS SCRIPT)
--    - Phase 2: Update credit allocation logic
--    - Phase 3: Deprecate old credit tracking fields
--
-- ================================================================
