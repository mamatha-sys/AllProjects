-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "aadhaarNumber" TEXT;
ALTER TABLE "Employee" ADD COLUMN "addressLine1" TEXT;
ALTER TABLE "Employee" ADD COLUMN "addressLine2" TEXT;
ALTER TABLE "Employee" ADD COLUMN "addressType" TEXT;
ALTER TABLE "Employee" ADD COLUMN "bankAccountNumber" TEXT;
ALTER TABLE "Employee" ADD COLUMN "bankName" TEXT;
ALTER TABLE "Employee" ADD COLUMN "bloodGroup" TEXT;
ALTER TABLE "Employee" ADD COLUMN "branch" TEXT;
ALTER TABLE "Employee" ADD COLUMN "city" TEXT;
ALTER TABLE "Employee" ADD COLUMN "country" TEXT;
ALTER TABLE "Employee" ADD COLUMN "district" TEXT;
ALTER TABLE "Employee" ADD COLUMN "educationDetails" TEXT;
ALTER TABLE "Employee" ADD COLUMN "emergencyContactRelation" TEXT;
ALTER TABLE "Employee" ADD COLUMN "employmentExperience" TEXT DEFAULT 'Fresher';
ALTER TABLE "Employee" ADD COLUMN "esiNumber" TEXT;
ALTER TABLE "Employee" ADD COLUMN "ifscCode" TEXT;
ALTER TABLE "Employee" ADD COLUMN "panNumber" TEXT;
ALTER TABLE "Employee" ADD COLUMN "pfNumber" TEXT;
ALTER TABLE "Employee" ADD COLUMN "postalCode" TEXT;
ALTER TABLE "Employee" ADD COLUMN "shift" TEXT DEFAULT 'General (9:00 AM – 6:00 PM)';
ALTER TABLE "Employee" ADD COLUMN "skills" TEXT;
ALTER TABLE "Employee" ADD COLUMN "state" TEXT;
ALTER TABLE "Employee" ADD COLUMN "uanNumber" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HrConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "freeLateArrivalsPerMonth" INTEGER NOT NULL DEFAULT 2,
    "freeEarlyLogoutsPerMonth" INTEGER NOT NULL DEFAULT 1,
    "earliestExcusableEarlyLogout" TEXT NOT NULL DEFAULT '17:00',
    "graceTimeMinutes" INTEGER NOT NULL DEFAULT 15,
    "halfDayHours" REAL NOT NULL DEFAULT 4,
    "fullDayHours" REAL NOT NULL DEFAULT 8,
    "unmarkedDaysUnpaid" BOOLEAN NOT NULL DEFAULT true,
    "weekendsPaid" BOOLEAN NOT NULL DEFAULT true,
    "paidLeaveDaysPerMonth" INTEGER NOT NULL DEFAULT 1,
    "basicPctOfCtc" REAL NOT NULL DEFAULT 50,
    "hraPctOfBasic" REAL NOT NULL DEFAULT 40,
    "bonusPctOfBasic" REAL NOT NULL DEFAULT 8.33,
    "employeePfPctOfBasic" REAL NOT NULL DEFAULT 12,
    "employerPfPctOfBasic" REAL NOT NULL DEFAULT 12,
    "employeePfMonthlyCap" REAL NOT NULL DEFAULT 1800,
    "employerPfMonthlyCap" REAL NOT NULL DEFAULT 1800,
    "gratuityPctOfBasic" REAL NOT NULL DEFAULT 4.81,
    "professionalTaxFlat" REAL NOT NULL DEFAULT 200,
    "concurrentLeaveCapPct" INTEGER NOT NULL DEFAULT 30,
    "concurrentLeaveCapFlat" INTEGER NOT NULL DEFAULT 2,
    "leaveReasonThresholdDays" INTEGER NOT NULL DEFAULT 4
);
INSERT INTO "new_HrConfig" ("earliestExcusableEarlyLogout", "freeEarlyLogoutsPerMonth", "freeLateArrivalsPerMonth", "fullDayHours", "graceTimeMinutes", "halfDayHours", "id", "paidLeaveDaysPerMonth", "unmarkedDaysUnpaid", "weekendsPaid") SELECT "earliestExcusableEarlyLogout", "freeEarlyLogoutsPerMonth", "freeLateArrivalsPerMonth", "fullDayHours", "graceTimeMinutes", "halfDayHours", "id", "paidLeaveDaysPerMonth", "unmarkedDaysUnpaid", "weekendsPaid" FROM "HrConfig";
DROP TABLE "HrConfig";
ALTER TABLE "new_HrConfig" RENAME TO "HrConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
