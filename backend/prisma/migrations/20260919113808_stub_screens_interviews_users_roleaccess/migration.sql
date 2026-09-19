-- Interview Calendar, Users admin and Role Catalog.
--
-- Prisma's generated form of this migration rebuilt both "Application" and
-- "User" (create new_X / copy a fixed column list / drop / rename), because
-- SQLite has no ALTER COLUMN. A rebuild copies only the columns the schema knew
-- about when the migration was generated, which silently drops anything a
-- migration added outside it. Every change below is purely additive, so it is
-- written as ALTER TABLE ... ADD COLUMN instead: no table is ever rebuilt and no
-- existing column can be lost. Adding a NOT NULL column with a constant DEFAULT
-- is supported by SQLite's ADD COLUMN.

-- CreateTable
CREATE TABLE "InterviewEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "fromSlot" TEXT,
    "toSlot" TEXT,
    "by" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InterviewEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoleAccess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "moduleEnabled" BOOLEAN NOT NULL DEFAULT false,
    "features" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "RoleAccess_role_moduleId_key" ON "RoleAccess"("role", "moduleId");

-- AlterTable: Application — recruitment/client interview detail + AI interview detail.
ALTER TABLE "Application" ADD COLUMN "interviewCode" TEXT;
ALTER TABLE "Application" ADD COLUMN "interviewRound" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Application" ADD COLUMN "interviewType" TEXT;
ALTER TABLE "Application" ADD COLUMN "interviewer" TEXT;
ALTER TABLE "Application" ADD COLUMN "interviewMode" TEXT;
ALTER TABLE "Application" ADD COLUMN "interviewLocation" TEXT;
ALTER TABLE "Application" ADD COLUMN "interviewMeetingLink" TEXT;
ALTER TABLE "Application" ADD COLUMN "interviewScore" INTEGER;
ALTER TABLE "Application" ADD COLUMN "interviewResult" TEXT;
ALTER TABLE "Application" ADD COLUMN "interviewFeedback" TEXT;
ALTER TABLE "Application" ADD COLUMN "interviewCreatedBy" TEXT;
ALTER TABLE "Application" ADD COLUMN "interviewCancelReason" TEXT;
ALTER TABLE "Application" ADD COLUMN "interviewRescheduleCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Application" ADD COLUMN "interviewStartedAt" DATETIME;
ALTER TABLE "Application" ADD COLUMN "interviewCompletedAt" DATETIME;
ALTER TABLE "Application" ADD COLUMN "aiInterviewDeadline" TEXT;
ALTER TABLE "Application" ADD COLUMN "aiInterviewFeedback" TEXT;

-- AlterTable: User — login administration columns for the Users screen.
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE "User" ADD COLUMN "branch" TEXT;
ALTER TABLE "User" ADD COLUMN "team" TEXT;
ALTER TABLE "User" ADD COLUMN "lastLoginAt" DATETIME;
