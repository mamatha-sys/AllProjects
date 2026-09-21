-- Administration prototype-parity pass.
-- Additive only: plain ALTER TABLE ... ADD COLUMN and CREATE TABLE. No table
-- rebuild — SQLite rebuilds silently drop columns a migration did not know
-- about, which has already caused a real bug in this repo.

-- Company Setup: headquarters line + employment policy list.
ALTER TABLE "Company" ADD COLUMN "hq" TEXT;
ALTER TABLE "Company" ADD COLUMN "policies" TEXT;

-- Notifications: the prototype's central event log columns.
ALTER TABLE "Notification" ADD COLUMN "channel" TEXT;
ALTER TABLE "Notification" ADD COLUMN "recipient" TEXT;
ALTER TABLE "Notification" ADD COLUMN "status" TEXT;

-- Employee Management: STL / TL columns (the prototype renders them but never
-- writes them; here the create and Assign Roles paths do).
ALTER TABLE "Employee" ADD COLUMN "stl" TEXT;
ALTER TABLE "Employee" ADD COLUMN "tl" TEXT;

-- Organization Structure: the approval & escalation chain.
CREATE TABLE "OrgRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "approveDays" INTEGER,
    "position" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Integrations: one row per catalog channel, plus its run history.
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "state" TEXT NOT NULL DEFAULT 'Not Connected',
    "values" TEXT,
    "connectedAt" DATETIME,
    "lastSync" DATETIME,
    "lastTest" DATETIME,
    "lastTestResult" TEXT,
    "recordsSynced" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "IntegrationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "integrationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "by" TEXT,
    "result" TEXT NOT NULL,
    "synced" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "entities" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationEvent_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "IntegrationEvent_integrationId_idx" ON "IntegrationEvent"("integrationId");

-- Job Portal Synchronisation: the Sync Logs table.
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "recordRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
