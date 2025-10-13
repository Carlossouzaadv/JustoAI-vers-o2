-- ================================================================
-- Criar ENUMs para Sistema de Créditos
-- ================================================================
-- Execute ANTES da migração 03_credit_system_FINAL.sql

-- CreditAllocationType
DO $$ BEGIN
    CREATE TYPE "CreditAllocationType" AS ENUM ('MONTHLY', 'BONUS', 'PACK');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreditTransactionType
DO $$ BEGIN
    CREATE TYPE "CreditTransactionType" AS ENUM ('DEBIT', 'CREDIT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreditCategory
DO $$ BEGIN
    CREATE TYPE "CreditCategory" AS ENUM ('REPORT', 'FULL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- UsageStatus
DO $$ BEGIN
    CREATE TYPE "UsageStatus" AS ENUM ('COMPLETED', 'FAILED', 'INSUFFICIENT_CREDITS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- UploadBatchStatus
DO $$ BEGIN
    CREATE TYPE "UploadBatchStatus" AS ENUM ('PROCESSING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- UploadRowStatus
DO $$ BEGIN
    CREATE TYPE "UploadRowStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'SKIPPED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- JobStatus
DO $$ BEGIN
    CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AudienceType
DO $$ BEGIN
    CREATE TYPE "AudienceType" AS ENUM ('CLIENTE', 'DIRETORIA', 'USO_INTERNO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- OutputFormat
DO $$ BEGIN
    CREATE TYPE "OutputFormat" AS ENUM ('PDF', 'DOCX');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Verificar ENUMs criados
SELECT
    t.typname as enum_name,
    string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
AND t.typname IN (
    'CreditAllocationType',
    'CreditTransactionType',
    'CreditCategory',
    'UsageStatus',
    'UploadBatchStatus',
    'UploadRowStatus',
    'JobStatus',
    'AudienceType',
    'OutputFormat'
)
GROUP BY t.typname
ORDER BY t.typname;
