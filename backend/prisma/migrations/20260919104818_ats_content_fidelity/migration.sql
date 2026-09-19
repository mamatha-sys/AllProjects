-- AlterTable
ALTER TABLE "Application" ADD COLUMN "aiInterviewScore" INTEGER;
ALTER TABLE "Application" ADD COLUMN "aiInterviewStatus" TEXT DEFAULT 'Required';
ALTER TABLE "Application" ADD COLUMN "applicationMethod" TEXT DEFAULT 'Manual';
ALTER TABLE "Application" ADD COLUMN "firstSource" TEXT;
ALTER TABLE "Application" ADD COLUMN "joiningDate" TEXT;
ALTER TABLE "Application" ADD COLUMN "matchScore" INTEGER;
ALTER TABLE "Application" ADD COLUMN "offeredCtc" REAL;
ALTER TABLE "Application" ADD COLUMN "resumeScore" INTEGER;
ALTER TABLE "Application" ADD COLUMN "source" TEXT;
ALTER TABLE "Application" ADD COLUMN "sourceCampaign" TEXT;

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN "availability" TEXT DEFAULT 'Available after notice period';
ALTER TABLE "Candidate" ADD COLUMN "currentCompany" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "currentDesignation" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "currentSalary" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "dob" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "education" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "expectedSalary" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "firstSource" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "gender" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "goodToHaveSkills" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "institute" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "jobPreference" TEXT DEFAULT 'Permanent';
ALTER TABLE "Candidate" ADD COLUMN "location" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "noticePeriod" TEXT DEFAULT '30 Days';
ALTER TABLE "Candidate" ADD COLUMN "passingYear" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "preferredEmploymentType" TEXT DEFAULT 'Full Time';
ALTER TABLE "Candidate" ADD COLUMN "preferredLocation" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "preferredWorkMode" TEXT DEFAULT 'Hybrid';
ALTER TABLE "Candidate" ADD COLUMN "profileStatus" TEXT DEFAULT 'Active';
ALTER TABLE "Candidate" ADD COLUMN "relevantExperienceYears" REAL;
ALTER TABLE "Candidate" ADD COLUMN "resumeName" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "resumeScore" INTEGER;
ALTER TABLE "Candidate" ADD COLUMN "softSkills" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "sourceCampaign" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "specialization" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "technicalSkills" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "location" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legalName" TEXT,
    "website" TEXT,
    "ownerDepartment" TEXT,
    "yearEstablished" TEXT,
    "landline" TEXT,
    "status" TEXT DEFAULT 'Active',
    "activeDate" TEXT,
    "clientType" TEXT,
    "priority" TEXT DEFAULT 'High',
    "contactName" TEXT,
    "contactDesignation" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "contactWhatsApp" TEXT,
    "secondaryContactName" TEXT,
    "secondaryContactDesignation" TEXT,
    "secondaryContactPhone" TEXT,
    "secondaryContactEmail" TEXT,
    "commPrimary" TEXT,
    "commSecondary" TEXT,
    "commChannels" TEXT,
    "houseNumber" TEXT,
    "street" TEXT,
    "landmark" TEXT,
    "area" TEXT,
    "pincode" TEXT,
    "country" TEXT DEFAULT 'India',
    "state" TEXT,
    "gst" TEXT,
    "pan" TEXT,
    "tan" TEXT,
    "businessType" TEXT DEFAULT 'Private Limited',
    "tdsPercent" REAL DEFAULT 10,
    "gstPercent" REAL DEFAULT 18,
    "paymentTerms" TEXT DEFAULT 'Invoice 6 days after joining; payment due within 6 days of invoice',
    "guaranteePeriod" TEXT DEFAULT '30 Days',
    "invoiceTrigger" TEXT DEFAULT 'Candidate Joining',
    "paymentDue" TEXT DEFAULT '6 days after invoice',
    "commercialNotes" TEXT,
    "accountManager" TEXT,
    "bdeOwner" TEXT,
    "riskFlag" TEXT DEFAULT 'None',
    "riskNotes" TEXT,
    "agreementId" TEXT,
    "agreementStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "agreementRequired" TEXT DEFAULT 'Yes',
    "agreementTemplate" TEXT DEFAULT 'Standard Recruitment / Staffing',
    "agreementStart" TEXT,
    "agreementEnd" TEXT,
    "agreementActivatedAt" DATETIME,
    "agreementDocument" TEXT,
    "agreementFeePercent" REAL DEFAULT 8.33,
    "esignToken" TEXT,
    "agreementSentAt" DATETIME,
    "agreementViewedAt" DATETIME,
    "agreementSignedAt" DATETIME,
    "agreementSignedBy" TEXT,
    "agreementSignedByTitle" TEXT
);
INSERT INTO "new_Client" ("agreementDocument", "agreementFeePercent", "agreementId", "agreementSentAt", "agreementSignedAt", "agreementSignedBy", "agreementSignedByTitle", "agreementStatus", "agreementViewedAt", "createdAt", "esignToken", "id", "industry", "location", "name") SELECT "agreementDocument", "agreementFeePercent", "agreementId", "agreementSentAt", "agreementSignedAt", "agreementSignedBy", "agreementSignedByTitle", "agreementStatus", "agreementViewedAt", "createdAt", "esignToken", "id", "industry", "location", "name" FROM "Client";
DROP TABLE "Client";
ALTER TABLE "new_Client" RENAME TO "Client";
CREATE UNIQUE INDEX "Client_agreementId_key" ON "Client"("agreementId");
CREATE UNIQUE INDEX "Client_esignToken_key" ON "Client"("esignToken");
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
    CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("amount", "candidateId", "clientId", "createdAt", "dueDate", "gst", "id", "invoiceDate", "paymentTerms", "requirementId", "status", "tds") SELECT "amount", "candidateId", "clientId", "createdAt", "dueDate", "gst", "id", "invoiceDate", "paymentTerms", "requirementId", "status", "tds" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
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
INSERT INTO "new_Requirement" ("bdeId", "clientId", "createdAt", "department", "description", "experience", "id", "openings", "priority", "recruiterId", "skills", "status", "title", "updatedAt") SELECT "bdeId", "clientId", "createdAt", "department", "description", "experience", "id", "openings", "priority", "recruiterId", "skills", "status", "title", "updatedAt" FROM "Requirement";
DROP TABLE "Requirement";
ALTER TABLE "new_Requirement" RENAME TO "Requirement";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
