-- The "Bill no" column on the Office & Accounts bills table — the vendor's own
-- invoice number, which is what a GST return is reconciled against.
--
-- Plain ADD COLUMN, hand-written: a Prisma-generated column *change* on SQLite
-- rebuilds the table and silently drops columns it does not know about.
ALTER TABLE "OfficeExpense" ADD COLUMN "billNumber" TEXT;
