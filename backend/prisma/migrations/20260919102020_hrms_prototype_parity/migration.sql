-- AlterTable
ALTER TABLE "Holiday" ADD COLUMN "type" TEXT DEFAULT 'Festival';

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN "approvalReason" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN "days" REAL DEFAULT 1;
ALTER TABLE "LeaveRequest" ADD COLUMN "decidedBy" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN "rejectReason" TEXT;

-- AlterTable
ALTER TABLE "Payslip" ADD COLUMN "gross" REAL DEFAULT 0;
ALTER TABLE "Payslip" ADD COLUMN "lateCut" REAL DEFAULT 0;
ALTER TABLE "Payslip" ADD COLUMN "lateDays" REAL DEFAULT 0;
ALTER TABLE "Payslip" ADD COLUMN "payMode" TEXT DEFAULT 'Package';

-- CreateTable
CREATE TABLE "AttendancePunch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'In',
    "method" TEXT NOT NULL DEFAULT 'Web Check-in',
    "location" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendancePunch_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeaveBalance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "total" REAL NOT NULL DEFAULT 0,
    "taken" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeaveBalance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "month" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "department" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Processing',
    "employees" INTEGER NOT NULL DEFAULT 0,
    "totalGross" REAL NOT NULL DEFAULT 0,
    "totalDeductions" REAL NOT NULL DEFAULT 0,
    "totalLateCuts" REAL NOT NULL DEFAULT 0,
    "totalNet" REAL NOT NULL DEFAULT 0,
    "processedBy" TEXT,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EmployeeRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "date" TEXT,
    "amount" REAL,
    "hours" REAL,
    "category" TEXT,
    "priority" TEXT,
    "progressPct" INTEGER,
    "location" TEXT,
    "assignedTo" TEXT,
    "resolution" TEXT,
    "resolvedAt" TEXT,
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "csat" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmployeeRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_EmployeeRecord" ("amount", "category", "createdAt", "date", "detail", "employeeId", "hours", "id", "location", "priority", "progressPct", "status", "title", "type", "updatedAt") SELECT "amount", "category", "createdAt", "date", "detail", "employeeId", "hours", "id", "location", "priority", "progressPct", "status", "title", "type", "updatedAt" FROM "EmployeeRecord";
DROP TABLE "EmployeeRecord";
ALTER TABLE "new_EmployeeRecord" RENAME TO "EmployeeRecord";
CREATE TABLE "new_HrConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "freeLateArrivalsPerMonth" INTEGER NOT NULL DEFAULT 2,
    "freeEarlyLogoutsPerMonth" INTEGER NOT NULL DEFAULT 1,
    "earliestExcusableEarlyLogout" TEXT NOT NULL DEFAULT '17:00',
    "graceTimeMinutes" INTEGER NOT NULL DEFAULT 15,
    "graceTime" TEXT NOT NULL DEFAULT '09:30',
    "halfDayHours" REAL NOT NULL DEFAULT 4,
    "fullDayHours" REAL NOT NULL DEFAULT 8,
    "noticePeriodDays" INTEGER NOT NULL DEFAULT 45,
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
INSERT INTO "new_HrConfig" ("basicPctOfCtc", "bonusPctOfBasic", "concurrentLeaveCapFlat", "concurrentLeaveCapPct", "earliestExcusableEarlyLogout", "employeePfMonthlyCap", "employeePfPctOfBasic", "employerPfMonthlyCap", "employerPfPctOfBasic", "freeEarlyLogoutsPerMonth", "freeLateArrivalsPerMonth", "fullDayHours", "graceTimeMinutes", "gratuityPctOfBasic", "halfDayHours", "hraPctOfBasic", "id", "leaveReasonThresholdDays", "paidLeaveDaysPerMonth", "professionalTaxFlat", "unmarkedDaysUnpaid", "weekendsPaid") SELECT "basicPctOfCtc", "bonusPctOfBasic", "concurrentLeaveCapFlat", "concurrentLeaveCapPct", "earliestExcusableEarlyLogout", "employeePfMonthlyCap", "employeePfPctOfBasic", "employerPfMonthlyCap", "employerPfPctOfBasic", "freeEarlyLogoutsPerMonth", "freeLateArrivalsPerMonth", "fullDayHours", "graceTimeMinutes", "gratuityPctOfBasic", "halfDayHours", "hraPctOfBasic", "id", "leaveReasonThresholdDays", "paidLeaveDaysPerMonth", "professionalTaxFlat", "unmarkedDaysUnpaid", "weekendsPaid" FROM "HrConfig";
DROP TABLE "HrConfig";
ALTER TABLE "new_HrConfig" RENAME TO "HrConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AttendancePunch_employeeId_date_idx" ON "AttendancePunch"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveBalance_employeeId_type_key" ON "LeaveBalance"("employeeId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_month_key" ON "PayrollRun"("month");
