-- CreateTable
CREATE TABLE "LabAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER,
    "grade" TEXT,
    "finalAttempt" INTEGER,
    "durationMs" INTEGER,
    "aiUsed" BOOLEAN NOT NULL DEFAULT false,
    "reviewUsed" BOOLEAN NOT NULL DEFAULT false,
    "patchUsed" BOOLEAN NOT NULL DEFAULT false,
    "verifyPassed" BOOLEAN NOT NULL DEFAULT false,
    "filesTouchedCount" INTEGER,
    "diffPreview" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LabAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LabProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPlayedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "bestScore" INTEGER,
    "bestGrade" TEXT,
    "attemptsCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "aiUsageCount" INTEGER NOT NULL DEFAULT 0,
    "reviewUsageCount" INTEGER NOT NULL DEFAULT 0,
    "patchUsageCount" INTEGER NOT NULL DEFAULT 0,
    "lastStatus" TEXT NOT NULL DEFAULT 'STARTED',
    "lastDurationMs" INTEGER,
    CONSTRAINT "LabProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeaderboardEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "grade" TEXT,
    "durationMs" INTEGER,
    "attemptsCount" INTEGER NOT NULL DEFAULT 1,
    "verifyPassed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeaderboardEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LabAttempt_userId_labId_idx" ON "LabAttempt"("userId", "labId");

-- CreateIndex
CREATE INDEX "LabAttempt_userId_createdAt_idx" ON "LabAttempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LabAttempt_labId_createdAt_idx" ON "LabAttempt"("labId", "createdAt");

-- CreateIndex
CREATE INDEX "LabAttempt_userId_success_idx" ON "LabAttempt"("userId", "success");

-- CreateIndex
CREATE UNIQUE INDEX "LabProgress_userId_labId_key" ON "LabProgress"("userId", "labId");

-- CreateIndex
CREATE INDEX "LabProgress_userId_lastPlayedAt_idx" ON "LabProgress"("userId", "lastPlayedAt");

-- CreateIndex
CREATE INDEX "LabProgress_userId_completedAt_idx" ON "LabProgress"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "LabProgress_labId_bestScore_idx" ON "LabProgress"("labId", "bestScore");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_labId_score_idx" ON "LeaderboardEntry"("labId", "score");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_labId_durationMs_idx" ON "LeaderboardEntry"("labId", "durationMs");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_userId_createdAt_idx" ON "LeaderboardEntry"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardEntry_userId_labId_key" ON "LeaderboardEntry"("userId", "labId");
