-- Students can flag an annotation ("wrong" keeps it out of weakness profiles),
-- and teachers can record their own marking of an analysed essay.

-- AlterTable
ALTER TABLE "ErrorRecord" ADD COLUMN     "studentReaction" TEXT;

-- CreateTable
CREATE TABLE "TeacherReview" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "scores" JSONB NOT NULL,
    "typoCount" INTEGER,
    "dseLevel" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherReview_submissionId_idx" ON "TeacherReview"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherReview_analysisId_reviewerUserId_key" ON "TeacherReview"("analysisId", "reviewerUserId");

-- AddForeignKey
ALTER TABLE "TeacherReview" ADD CONSTRAINT "TeacherReview_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherReview" ADD CONSTRAINT "TeacherReview_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherReview" ADD CONSTRAINT "TeacherReview_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

