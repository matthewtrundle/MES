-- P4: Add severity field to NCR for aging/severity analytics

-- AlterTable
ALTER TABLE "nonconformance_records" ADD COLUMN     "severity" TEXT NOT NULL DEFAULT 'minor';
