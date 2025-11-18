-- Migration: Convert DAILY report schedules to WEEKLY
-- Date: 2025-11-18
-- Purpose: Remove support for DAILY report frequency, migrate existing DAILY schedules to WEEKLY

-- Update all ReportSchedule entries with frequency='DAILY' to frequency='WEEKLY'
UPDATE "ReportSchedule"
SET frequency = 'WEEKLY'
WHERE frequency = 'DAILY';

-- Log the migration
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
  '20251118_migrate_daily_to_weekly',
  'checksum_placeholder',
  NOW(),
  'migrate_daily_to_weekly',
  'Migrated all DAILY report schedules to WEEKLY',
  NULL,
  NOW(),
  1
) ON CONFLICT DO NOTHING;
