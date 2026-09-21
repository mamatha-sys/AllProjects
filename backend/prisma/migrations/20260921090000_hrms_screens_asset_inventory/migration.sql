-- HRMS screens: the rest of the prototype's payroll-attendance policy switches,
-- the approval escalation order, and the company asset inventory.
-- Hand-written as plain ADD COLUMNs plus one CREATE TABLE: Prisma implements a
-- SQLite column change by rebuilding the table from a fixed column list, which
-- silently drops columns added by migrations it did not generate.

ALTER TABLE "HrConfig" ADD COLUMN "payByHours" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HrConfig" ADD COLUMN "halfDayBySession" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HrConfig" ADD COLUMN "sessionSplit" TEXT NOT NULL DEFAULT '13:00';
ALTER TABLE "HrConfig" ADD COLUMN "escalationOrder" TEXT NOT NULL DEFAULT 'Recruiter,TL,Manager,Admin,Super Admin';

CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Laptop',
    "status" TEXT NOT NULL DEFAULT 'Available',
    "assignedToId" TEXT,
    "purchaseDate" TEXT,
    "warrantyUntil" TEXT,
    "history" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Asset_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Asset_assetCode_key" ON "Asset"("assetCode");
