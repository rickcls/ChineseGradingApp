// Export teacher reviews as gold essays for scripts/eval-grading.ts.
//
//   npm run eval:export-reviews -- [--out eval/gold/teacher-reviews]
//
// The files contain student essays: eval/gold is git-ignored on purpose.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import type { GoldEssay } from "../src/lib/calibration";
import { DEFAULT_WRITING_RUBRIC, DSE_LEVELS, type DseLevel } from "../src/lib/rubric";

const prisma = new PrismaClient();

function argValue(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

async function main() {
  const outDir = argValue("out", "eval/gold/teacher-reviews");
  const reviews = await prisma.teacherReview.findMany({
    orderBy: { updatedAt: "asc" },
    include: {
      submission: { select: { verifiedText: true, taskPrompt: true, genre: true, user: { select: { gradeLevel: true } } } },
    },
  });

  mkdirSync(outDir, { recursive: true });
  let written = 0;
  for (const review of reviews) {
    if (!(DSE_LEVELS as readonly string[]).includes(review.dseLevel)) continue;
    const raw = (review.scores ?? {}) as Record<string, unknown>;
    const scores = Object.fromEntries(
      DEFAULT_WRITING_RUBRIC.criteria
        .map((criterion) => [criterion.key, Number(raw[criterion.key])] as const)
        .filter(([, value]) => Number.isFinite(value)),
    );

    const essay: GoldEssay = {
      id: `review-${review.id}`,
      source: `teacher review ${review.updatedAt.toISOString().slice(0, 10)}`,
      gradeLevel: review.submission.user.gradeLevel,
      genre: review.submission.genre ?? undefined,
      taskPrompt: review.submission.taskPrompt ?? undefined,
      text: review.submission.verifiedText,
      gold: {
        dseLevel: review.dseLevel as DseLevel,
        scores,
        ...(review.typoCount !== null ? { typoCount: review.typoCount } : {}),
      },
    };
    writeFileSync(path.join(outDir, `${essay.id}.json`), JSON.stringify(essay, null, 2));
    written += 1;
  }

  console.log(`Wrote ${written} gold essays to ${outDir}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
