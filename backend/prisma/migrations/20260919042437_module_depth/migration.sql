-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN "postedBy" TEXT;

-- AlterTable
ALTER TABLE "EmployeeRecord" ADD COLUMN "category" TEXT;
ALTER TABLE "EmployeeRecord" ADD COLUMN "location" TEXT;
ALTER TABLE "EmployeeRecord" ADD COLUMN "priority" TEXT;
ALTER TABLE "EmployeeRecord" ADD COLUMN "progressPct" INTEGER;

-- AlterTable
ALTER TABLE "PolicyDocument" ADD COLUMN "uploadedBy" TEXT;

-- CreateTable
CREATE TABLE "ShiftPattern" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
