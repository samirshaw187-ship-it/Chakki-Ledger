-- Migration: 20260913_transaction_correction_reversal_audit
-- Supports non-destructive transaction corrections, reversals, and detailed audit trail

-- 1. Extend AuditAction ENUM
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LOGIN';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LOGOUT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'USER_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TRANSACTION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TRANSACTION_CORRECTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TRANSACTION_REVERSED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CORRECTION_COMPENSATING_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REVERSAL_COMPENSATING_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'RATE_OVERRIDE_USED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CUSTOMER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CUSTOMER_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CUSTOMER_STATUS_CHANGED';

-- 2. Drop UNIQUE constraint on isCorrectionOfId to allow multiple corrections per transaction
DROP INDEX IF EXISTS "transactions_isCorrectionOfId_key";

-- 3. Add audit and dispute tracking columns to transactions table
ALTER TABLE "transactions" 
  ADD COLUMN IF NOT EXISTS "correctionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "correctionCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "correctedById" TEXT,
  ADD COLUMN IF NOT EXISTS "correctedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reversalReason" TEXT,
  ADD COLUMN IF NOT EXISTS "reversalTxnId" TEXT,
  ADD COLUMN IF NOT EXISTS "reversalDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reversedById" TEXT,
  ADD COLUMN IF NOT EXISTS "netCorrectionDiff" TEXT;

-- 4. Create performance indexes
CREATE INDEX IF NOT EXISTS "transactions_isCorrectionOfId_idx" ON "transactions"("isCorrectionOfId");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX IF NOT EXISTS "audit_logs_performedById_idx" ON "audit_logs"("performedById");

