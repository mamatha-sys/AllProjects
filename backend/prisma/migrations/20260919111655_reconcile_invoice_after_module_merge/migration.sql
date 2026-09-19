-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "candidateId" TEXT,
    "requirementId" TEXT,
    "amount" REAL NOT NULL,
    "gst" REAL NOT NULL DEFAULT 0,
    "tds" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "invoiceDate" TEXT NOT NULL,
    "dueDate" TEXT,
    "paymentTerms" TEXT DEFAULT 'Invoice 6 days after joining; payment due within 6 days of invoice',
    "feePercent" REAL,
    "offeredCtc" REAL,
    "joiningDate" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceNumber" TEXT,
    "receivedAmount" REAL NOT NULL DEFAULT 0,
    "paidDate" TEXT,
    "bankTxnId" TEXT,
    "notes" TEXT,
    CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("amount", "candidateId", "clientId", "createdAt", "dueDate", "feePercent", "gst", "id", "invoiceDate", "joiningDate", "offeredCtc", "paymentTerms", "requirementId", "status", "tds") SELECT "amount", "candidateId", "clientId", "createdAt", "dueDate", "feePercent", "gst", "id", "invoiceDate", "joiningDate", "offeredCtc", "paymentTerms", "requirementId", "status", "tds" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE TABLE "new_Requirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "clientId" TEXT NOT NULL,
    "department" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "skills" TEXT,
    "experience" TEXT,
    "openings" INTEGER NOT NULL DEFAULT 1,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "closingDate" TEXT,
    "jobDescription" TEXT,
    "responsibilities" TEXT,
    "qualifications" TEXT,
    "education" TEXT DEFAULT 'Any Degree',
    "goodToHaveSkills" TEXT,
    "employmentType" TEXT DEFAULT 'Full Time',
    "workMode" TEXT DEFAULT 'Work From Office',
    "location" TEXT,
    "preferredLocation" TEXT DEFAULT 'Any',
    "relevantExperience" TEXT,
    "joiningTimeline" TEXT DEFAULT 'Within 15 Days',
    "noticePeriodMax" TEXT DEFAULT '30 Days',
    "jobPreference" TEXT DEFAULT 'Permanent',
    "salaryType" TEXT DEFAULT 'Annual CTC',
    "currency" TEXT DEFAULT 'INR',
    "salary" TEXT,
    "tl" TEXT,
    "stl" TEXT,
    "postingSources" TEXT,
    "recruiterId" TEXT,
    "bdeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Requirement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Requirement_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Requirement_bdeId_fkey" FOREIGN KEY ("bdeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Requirement" ("bdeId", "clientId", "closingDate", "createdAt", "currency", "department", "description", "education", "employmentType", "experience", "goodToHaveSkills", "id", "internal", "jobDescription", "jobPreference", "joiningTimeline", "location", "noticePeriodMax", "openings", "postingSources", "preferredLocation", "priority", "qualifications", "recruiterId", "relevantExperience", "responsibilities", "salary", "salaryType", "skills", "status", "stl", "title", "tl", "updatedAt", "workMode") SELECT "bdeId", "clientId", "closingDate", "createdAt", "currency", "department", "description", "education", "employmentType", "experience", "goodToHaveSkills", "id", "internal", "jobDescription", "jobPreference", "joiningTimeline", "location", "noticePeriodMax", "openings", "postingSources", "preferredLocation", "priority", "qualifications", "recruiterId", "relevantExperience", "responsibilities", "salary", "salaryType", "skills", "status", "stl", "title", "tl", "updatedAt", "workMode" FROM "Requirement";
DROP TABLE "Requirement";
ALTER TABLE "new_Requirement" RENAME TO "Requirement";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
