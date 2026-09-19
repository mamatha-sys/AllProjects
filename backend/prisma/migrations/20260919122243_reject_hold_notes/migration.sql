-- AlterTable
ALTER TABLE "Application" ADD COLUMN "holdAt" DATETIME;
ALTER TABLE "Application" ADD COLUMN "holdComment" TEXT;
ALTER TABLE "Application" ADD COLUMN "holdReasonCategory" TEXT;
ALTER TABLE "Application" ADD COLUMN "holdResumedAt" DATETIME;
ALTER TABLE "Application" ADD COLUMN "holdReviewDate" TEXT;
ALTER TABLE "Application" ADD COLUMN "holdStageBefore" TEXT;
ALTER TABLE "Application" ADD COLUMN "rejectedAt" DATETIME;
ALTER TABLE "Application" ADD COLUMN "rejectedComment" TEXT;
ALTER TABLE "Application" ADD COLUMN "rejectedDetail" TEXT;
ALTER TABLE "Application" ADD COLUMN "rejectedReasonCategory" TEXT;
ALTER TABLE "Application" ADD COLUMN "rejectedSide" TEXT;
ALTER TABLE "Application" ADD COLUMN "rejectedStageBefore" TEXT;

-- CreateTable
CREATE TABLE "ApplicationNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "authorName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApplicationNote_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
