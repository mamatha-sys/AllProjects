-- CreateTable
CREATE TABLE "TdsCertificate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Not received',
    "certNumber" TEXT,
    "certDate" TEXT,
    "quarter" TEXT,
    "amount" REAL,
    "notes" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TdsCertificate_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedInvoiceView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "filters" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "TdsCertificate_invoiceId_key" ON "TdsCertificate"("invoiceId");
