-- CreateTable
CREATE TABLE "ChainAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER,
    "grade" TEXT,
    "totalSteps" INTEGER NOT NULL,
    "completedSteps" INTEGER NOT NULL,
    "durationMs" INTEGER,
    "aiUsed" BOOLEAN NOT NULL DEFAULT false,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "seed" TEXT,
    "summary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChainAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChainProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPlayedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "bestScore" INTEGER,
    "bestGrade" TEXT,
    "attemptsCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "lastStatus" TEXT NOT NULL DEFAULT 'STARTED',
    "lastDurationMs" INTEGER,
    "lastSeed" TEXT,
    CONSTRAINT "ChainProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ChainAttempt_userId_chainId_idx" ON "ChainAttempt"("userId", "chainId");

-- CreateIndex
CREATE INDEX "ChainAttempt_userId_createdAt_idx" ON "ChainAttempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ChainAttempt_chainId_score_idx" ON "ChainAttempt"("chainId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "ChainProgress_userId_chainId_key" ON "ChainProgress"("userId", "chainId");

-- CreateIndex
CREATE INDEX "ChainProgress_userId_lastPlayedAt_idx" ON "ChainProgress"("userId", "lastPlayedAt");

-- CreateIndex
CREATE INDEX "ChainProgress_chainId_bestScore_idx" ON "ChainProgress"("chainId", "bestScore");
