-- 審題助手 results (cached, also used for the daily limit) and 立意昇華
-- suggestions stored on the analysis they were generated for.

-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN     "themeElevation" JSONB;

-- CreateTable
CREATE TABLE "TopicAnalysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskPrompt" TEXT NOT NULL,
    "genre" TEXT,
    "gradeLevel" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "modelName" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TopicAnalysis_userId_createdAt_idx" ON "TopicAnalysis"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "TopicAnalysis" ADD CONSTRAINT "TopicAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

