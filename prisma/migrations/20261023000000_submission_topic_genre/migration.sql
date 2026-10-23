-- Keep the student's 題目 and 文體 with the submission so grading, model
-- passages and notebook notes can all use them.
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "taskPrompt" TEXT;
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "genre" TEXT;
