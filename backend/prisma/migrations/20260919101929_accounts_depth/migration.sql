-- CreateTable
CREATE TABLE "InvoicePayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'Bank Transfer',
    "reference" TEXT,
    "notes" TEXT,
    "bankTxnId" TEXT,
    "recordedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BankTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "matchedInvoiceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reconStatus" TEXT NOT NULL DEFAULT 'Unmatched',
    "reference" TEXT,
    "balance" REAL,
    "matchedBy" TEXT,
    "matchedDate" TEXT,
    "clientName" TEXT,
    "importBatch" TEXT,
    "ignoredReason" TEXT
);
INSERT INTO "new_BankTransaction" ("amount", "createdAt", "date", "description", "id", "matched", "matchedInvoiceId", "type") SELECT "amount", "createdAt", "date", "description", "id", "matched", "matchedInvoiceId", "type" FROM "BankTransaction";
DROP TABLE "BankTransaction";
ALTER TABLE "new_BankTransaction" RENAME TO "BankTransaction";
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
    "paymentTerms" TEXT DEFAULT 'Net 30',
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
INSERT INTO "new_Invoice" ("amount", "candidateId", "clientId", "createdAt", "dueDate", "gst", "id", "invoiceDate", "paymentTerms", "requirementId", "status", "tds") SELECT "amount", "candidateId", "clientId", "createdAt", "dueDate", "gst", "id", "invoiceDate", "paymentTerms", "requirementId", "status", "tds" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE TABLE "new_OfficeExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "location" TEXT,
    "monthlyAmount" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vendor" TEXT,
    "expenseDate" TEXT,
    "gstAmount" REAL NOT NULL DEFAULT 0,
    "paidStatus" TEXT NOT NULL DEFAULT 'Paid',
    "recurring" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT
);
INSERT INTO "new_OfficeExpense" ("category", "createdAt", "id", "location", "monthlyAmount") SELECT "category", "createdAt", "id", "location", "monthlyAmount" FROM "OfficeExpense";
DROP TABLE "OfficeExpense";
ALTER TABLE "new_OfficeExpense" RENAME TO "OfficeExpense";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
