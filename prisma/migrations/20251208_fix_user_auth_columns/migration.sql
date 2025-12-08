-- Add missing auth columns to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerificationToken" VARCHAR(256);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerificationTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetToken" VARCHAR(256);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetTokenExpiresAt" TIMESTAMP(3);
