-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "employeeCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "department" TEXT,
    "designation" TEXT,
    "location" TEXT,
    "dateOfJoining" DATETIME,
    "employmentStatus" TEXT NOT NULL DEFAULT 'Active',
    "employeeType" TEXT DEFAULT 'Full-time',
    "dateOfBirth" DATETIME,
    "gender" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "emergencyContactRelation" TEXT,
    "address" TEXT,
    "addressType" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "district" TEXT,
    "state" TEXT,
    "country" TEXT,
    "postalCode" TEXT,
    "bloodGroup" TEXT,
    "branch" TEXT,
    "shift" TEXT DEFAULT 'General (9:00 AM – 6:00 PM)',
    "employmentExperience" TEXT DEFAULT 'Fresher',
    "educationDetails" TEXT,
    "skills" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "ifscCode" TEXT,
    "panNumber" TEXT,
    "aadhaarNumber" TEXT,
    "uanNumber" TEXT,
    "pfNumber" TEXT,
    "esiNumber" TEXT,
    "onboardingTasks" TEXT,
    "offboardingStatus" TEXT,
    "offboardingTasks" TEXT,
    "pendingChanges" TEXT,
    "profileStage" TEXT NOT NULL DEFAULT 'Assigned',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "unlockRequestReason" TEXT,
    "unlockRequestStatus" TEXT,
    "unlockRequestCount" INTEGER NOT NULL DEFAULT 0,
    "reportingManagerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Employee_reportingManagerId_fkey" FOREIGN KEY ("reportingManagerId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("aadhaarNumber", "address", "addressLine1", "addressLine2", "addressType", "bankAccountNumber", "bankName", "bloodGroup", "branch", "city", "country", "createdAt", "dateOfBirth", "dateOfJoining", "department", "designation", "district", "educationDetails", "email", "emergencyContactName", "emergencyContactPhone", "emergencyContactRelation", "employeeCode", "employeeType", "employmentExperience", "employmentStatus", "esiNumber", "gender", "id", "ifscCode", "location", "name", "offboardingStatus", "offboardingTasks", "onboardingTasks", "panNumber", "pendingChanges", "pfNumber", "phone", "postalCode", "reportingManagerId", "shift", "skills", "state", "uanNumber", "updatedAt", "userId") SELECT "aadhaarNumber", "address", "addressLine1", "addressLine2", "addressType", "bankAccountNumber", "bankName", "bloodGroup", "branch", "city", "country", "createdAt", "dateOfBirth", "dateOfJoining", "department", "designation", "district", "educationDetails", "email", "emergencyContactName", "emergencyContactPhone", "emergencyContactRelation", "employeeCode", "employeeType", "employmentExperience", "employmentStatus", "esiNumber", "gender", "id", "ifscCode", "location", "name", "offboardingStatus", "offboardingTasks", "onboardingTasks", "panNumber", "pendingChanges", "pfNumber", "phone", "postalCode", "reportingManagerId", "shift", "skills", "state", "uanNumber", "updatedAt", "userId" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
