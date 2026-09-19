-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN "experienceYears" REAL;
ALTER TABLE "Candidate" ADD COLUMN "skills" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "location" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agreementId" TEXT,
    "agreementStatus" TEXT NOT NULL DEFAULT 'NOT_SENT',
    "agreementDocument" TEXT,
    "agreementFeePercent" REAL DEFAULT 8.33,
    "esignToken" TEXT,
    "agreementSentAt" DATETIME,
    "agreementViewedAt" DATETIME,
    "agreementSignedAt" DATETIME,
    "agreementSignedBy" TEXT,
    "agreementSignedByTitle" TEXT
);
INSERT INTO "new_Client" ("createdAt", "id", "industry", "location", "name") SELECT "createdAt", "id", "industry", "location", "name" FROM "Client";
DROP TABLE "Client";
ALTER TABLE "new_Client" RENAME TO "Client";
CREATE UNIQUE INDEX "Client_agreementId_key" ON "Client"("agreementId");
CREATE UNIQUE INDEX "Client_esignToken_key" ON "Client"("esignToken");
CREATE TABLE "new_Requirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "clientId" TEXT NOT NULL,
    "department" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "skills" TEXT,
    "experience" TEXT,
    "openings" INTEGER NOT NULL DEFAULT 1,
    "recruiterId" TEXT,
    "bdeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Requirement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Requirement_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Requirement_bdeId_fkey" FOREIGN KEY ("bdeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Requirement" ("bdeId", "clientId", "createdAt", "department", "description", "id", "priority", "recruiterId", "status", "title", "updatedAt") SELECT "bdeId", "clientId", "createdAt", "department", "description", "id", "priority", "recruiterId", "status", "title", "updatedAt" FROM "Requirement";
DROP TABLE "Requirement";
ALTER TABLE "new_Requirement" RENAME TO "Requirement";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
