-- CreateTable
CREATE TABLE "IntegrationChannel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "values" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SyncLogEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT
);

-- CreateTable
CREATE TABLE "MappingQueueRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobPortalJobId" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "source" TEXT DEFAULT 'Job Portal',
    "applicationCount" INTEGER NOT NULL DEFAULT 0,
    "dateReceived" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'Needs Mapping',
    "sampleSkills" TEXT,
    "sampleLocation" TEXT,
    "suggestedRequirementId" TEXT,
    "mappedTo" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "MappingQueueRow_jobPortalJobId_key" ON "MappingQueueRow"("jobPortalJobId");
