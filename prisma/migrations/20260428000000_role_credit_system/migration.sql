-- Preserve the existing anonymous user table while moving the application
-- identity model to Clerk-backed AppUser rows.
DO $$
BEGIN
  IF to_regclass('"AppUser"') IS NULL AND to_regclass('"User"') IS NOT NULL THEN
    ALTER TABLE "User" RENAME TO "AppUser";
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('"User_email_key"') IS NOT NULL AND to_regclass('"AppUser_email_key"') IS NULL THEN
    ALTER INDEX "User_email_key" RENAME TO "AppUser_email_key";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'AppUser' AND column_name = 'displayName'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'AppUser' AND column_name = 'name'
  ) THEN
    ALTER TABLE "AppUser" RENAME COLUMN "displayName" TO "name";
  END IF;
END $$;

DO $$
BEGIN
  CREATE TYPE "UserRole" AS ENUM ('student', 'teacher', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "AppUser" ADD COLUMN IF NOT EXISTS "clerkUserId" TEXT;
ALTER TABLE "AppUser" ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'student';
ALTER TABLE "AppUser" ADD COLUMN IF NOT EXISTS "credits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AppUser" ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "AppUser" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "AppUser" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "AppUser" ALTER COLUMN "gradeLevel" SET DEFAULT 'S2';
ALTER TABLE "AppUser" ALTER COLUMN "updatedAt" DROP DEFAULT;

CREATE UNIQUE INDEX IF NOT EXISTS "AppUser_clerkUserId_key" ON "AppUser"("clerkUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "AppUser_email_key" ON "AppUser"("email");

CREATE TABLE IF NOT EXISTS "CreditTransaction" (
  "id" TEXT NOT NULL,
  "clerkUserId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "createdByClerkUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CreditTransaction_clerkUserId_idx" ON "CreditTransaction"("clerkUserId");
CREATE INDEX IF NOT EXISTS "CreditTransaction_createdAt_idx" ON "CreditTransaction"("createdAt");

CREATE TABLE IF NOT EXISTS "Class" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "teacherClerkUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Class_teacherClerkUserId_idx" ON "Class"("teacherClerkUserId");

CREATE TABLE IF NOT EXISTS "StudentClass" (
  "id" TEXT NOT NULL,
  "studentClerkUserId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,

  CONSTRAINT "StudentClass_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StudentClass_studentClerkUserId_classId_key" ON "StudentClass"("studentClerkUserId", "classId");
CREATE INDEX IF NOT EXISTS "StudentClass_studentClerkUserId_idx" ON "StudentClass"("studentClerkUserId");
CREATE INDEX IF NOT EXISTS "StudentClass_classId_idx" ON "StudentClass"("classId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StudentClass_classId_fkey'
  ) THEN
    ALTER TABLE "StudentClass"
      ADD CONSTRAINT "StudentClass_classId_fkey"
      FOREIGN KEY ("classId") REFERENCES "Class"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
