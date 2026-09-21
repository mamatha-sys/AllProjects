-- Accounts: invoice register depth and office bill depth.
--
-- Hand-written as plain ALTER TABLE ... ADD COLUMN. Prisma implements any
-- column *change* on SQLite by rebuilding the table (create new_X, copy a
-- fixed column list, drop, rename), which silently drops columns added by
-- migrations it did not know about. That has already bitten the Invoice
-- table in this repo once, so nothing here rebuilds anything.

-- Invoice: the register's "Sent" and "TDS certificate" columns, plus the
-- GST / TDS rate actually applied to this one invoice.
ALTER TABLE "Invoice" ADD COLUMN "sentVia" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "sentDate" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "tdsCertReceived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Invoice" ADD COLUMN "tdsCertRef" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "tdsCertDate" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "gstPercent" REAL;
ALTER TABLE "Invoice" ADD COLUMN "tdsPercent" REAL;

-- OfficeExpense: vendor TDS, the amortisation window, the vendor GSTIN and
-- how the bill was paid.
ALTER TABLE "OfficeExpense" ADD COLUMN "tdsAmount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "OfficeExpense" ADD COLUMN "frequency" TEXT DEFAULT 'Monthly';
ALTER TABLE "OfficeExpense" ADD COLUMN "monthsCovered" INTEGER;
ALTER TABLE "OfficeExpense" ADD COLUMN "vendorGstin" TEXT;
ALTER TABLE "OfficeExpense" ADD COLUMN "paymentMode" TEXT DEFAULT 'Bank Transfer';
ALTER TABLE "OfficeExpense" ADD COLUMN "description" TEXT;
