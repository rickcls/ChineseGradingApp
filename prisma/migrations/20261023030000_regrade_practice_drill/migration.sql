-- Re-grade results for revisions, and 150-字 practice drills.

-- AlterTable
ALTER TABLE "RevisionSession" ADD COLUMN     "regrade" JSONB;

-- CreateTable
CREATE TABLE "PracticeDrill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT NOT NULL,
    "task" JSONB NOT NULL,
    "response" TEXT,
    "feedback" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PracticeDrill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PracticeDrill_userId_createdAt_idx" ON "PracticeDrill"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "PracticeDrill" ADD CONSTRAINT "PracticeDrill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

