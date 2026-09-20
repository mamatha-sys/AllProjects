-- DropIndex
DROP INDEX "Invoice_invoiceNumber_key";

-- AlterTable
ALTER TABLE "Company" ADD COLUMN "addressLine1" TEXT;
ALTER TABLE "Company" ADD COLUMN "addressLine2" TEXT;
ALTER TABLE "Company" ADD COLUMN "bankAccName" TEXT;
ALTER TABLE "Company" ADD COLUMN "bankAccNo" TEXT;
ALTER TABLE "Company" ADD COLUMN "bankBranch" TEXT;
ALTER TABLE "Company" ADD COLUMN "bankIfsc" TEXT;
ALTER TABLE "Company" ADD COLUMN "bankName" TEXT;
ALTER TABLE "Company" ADD COLUMN "city" TEXT;
ALTER TABLE "Company" ADD COLUMN "country" TEXT DEFAULT 'India';
ALTER TABLE "Company" ADD COLUMN "gstin" TEXT;
ALTER TABLE "Company" ADD COLUMN "legalName" TEXT;
ALTER TABLE "Company" ADD COLUMN "logo" TEXT;
ALTER TABLE "Company" ADD COLUMN "pan" TEXT;
ALTER TABLE "Company" ADD COLUMN "pincode" TEXT;
ALTER TABLE "Company" ADD COLUMN "signatoryName" TEXT;
ALTER TABLE "Company" ADD COLUMN "signatoryTitle" TEXT;
ALTER TABLE "Company" ADD COLUMN "signature" TEXT;
ALTER TABLE "Company" ADD COLUMN "stamp" TEXT;
ALTER TABLE "Company" ADD COLUMN "state" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "hsnSac" TEXT DEFAULT '998512';

-- CreateIndex
CREATE INDEX "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");
