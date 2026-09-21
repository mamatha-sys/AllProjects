-- Columns the prototype's Performance & Development screens need on the shared
-- EmployeeRecord table (Targets, Recognition, KT, Disciplinary, Weekly Ideas).
-- Plain ADD COLUMNs, hand-written: Prisma would rebuild the table from a fixed
-- column list and silently drop columns added by migrations it did not generate.

ALTER TABLE "EmployeeRecord" ADD COLUMN "achieved" REAL;
ALTER TABLE "EmployeeRecord" ADD COLUMN "unit" TEXT;
ALTER TABLE "EmployeeRecord" ADD COLUMN "fromName" TEXT;
ALTER TABLE "EmployeeRecord" ADD COLUMN "toName" TEXT;
ALTER TABLE "EmployeeRecord" ADD COLUMN "raisedBy" TEXT;
ALTER TABLE "EmployeeRecord" ADD COLUMN "points" INTEGER;
ALTER TABLE "EmployeeRecord" ADD COLUMN "aiNote" TEXT;
