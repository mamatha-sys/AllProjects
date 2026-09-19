-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "address" TEXT;
ALTER TABLE "Employee" ADD COLUMN "dateOfBirth" DATETIME;
ALTER TABLE "Employee" ADD COLUMN "emergencyContactName" TEXT;
ALTER TABLE "Employee" ADD COLUMN "emergencyContactPhone" TEXT;
ALTER TABLE "Employee" ADD COLUMN "employeeType" TEXT DEFAULT 'Full-time';
ALTER TABLE "Employee" ADD COLUMN "gender" TEXT;
ALTER TABLE "Employee" ADD COLUMN "offboardingStatus" TEXT;
ALTER TABLE "Employee" ADD COLUMN "offboardingTasks" TEXT;
ALTER TABLE "Employee" ADD COLUMN "onboardingTasks" TEXT;
ALTER TABLE "Employee" ADD COLUMN "pendingChanges" TEXT;

-- AlterTable
ALTER TABLE "Payslip" ADD COLUMN "bonus" REAL DEFAULT 0;
ALTER TABLE "Payslip" ADD COLUMN "employeePf" REAL DEFAULT 0;
ALTER TABLE "Payslip" ADD COLUMN "employerPf" REAL DEFAULT 0;
ALTER TABLE "Payslip" ADD COLUMN "gratuity" REAL DEFAULT 0;
ALTER TABLE "Payslip" ADD COLUMN "lopDays" REAL DEFAULT 0;
ALTER TABLE "Payslip" ADD COLUMN "professionalTax" REAL DEFAULT 0;
ALTER TABLE "Payslip" ADD COLUMN "specialAllowance" REAL DEFAULT 0;

-- CreateTable
CREATE TABLE "AttendanceRegularization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "requestedCheckIn" TEXT,
    "requestedCheckOut" TEXT,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" DATETIME,
    CONSTRAINT "AttendanceRegularization_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeaveType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cap" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'yr',
    "carries" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "LeaveReason" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SalaryStructure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "payMode" TEXT NOT NULL DEFAULT 'Package',
    "ctc" REAL NOT NULL DEFAULT 0,
    "stipend" REAL NOT NULL DEFAULT 0,
    "basic" REAL NOT NULL DEFAULT 0,
    "hra" REAL NOT NULL DEFAULT 0,
    "bonus" REAL NOT NULL DEFAULT 0,
    "specialAllowance" REAL NOT NULL DEFAULT 0,
    "employerPf" REAL NOT NULL DEFAULT 0,
    "employeePf" REAL NOT NULL DEFAULT 0,
    "professionalTax" REAL NOT NULL DEFAULT 0,
    "gratuity" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalaryStructure_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FnfRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "lastWorkingDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "settlementAmount" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    CONSTRAINT "FnfRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

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
    "paidLeaveDaysPerMonth" INTEGER NOT NULL DEFAULT 1
);
INSERT INTO "new_HrConfig" ("earliestExcusableEarlyLogout", "freeEarlyLogoutsPerMonth", "freeLateArrivalsPerMonth", "id") SELECT "earliestExcusableEarlyLogout", "freeEarlyLogoutsPerMonth", "freeLateArrivalsPerMonth", "id" FROM "HrConfig";
DROP TABLE "HrConfig";
ALTER TABLE "new_HrConfig" RENAME TO "HrConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "LeaveType_code_key" ON "LeaveType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructure_employeeId_key" ON "SalaryStructure"("employeeId");
