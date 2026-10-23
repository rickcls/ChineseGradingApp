-- 限時模擬: time limit and time used for essays written under the exam timer.

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "timedMinutes" INTEGER,
ADD COLUMN     "writingSeconds" INTEGER;

