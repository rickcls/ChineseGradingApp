import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./db";
import { DEFAULT_WRITING_RUBRIC, DSE_LEVELS, type DseLevel } from "./rubric";

// Teachers see submissions from students enrolled in their classes; admins see
// everything. Returns null when a teacher has no students at all.
export async function teacherSubmissionScope(params: {
  clerkUserId: string;
  isAdmin: boolean;
}): Promise<Prisma.SubmissionWhereInput | null> {
  if (params.isAdmin) return {};

  const memberships = await prisma.studentClass.findMany({
    where: { class: { teacherClerkUserId: params.clerkUserId } },
    select: { studentClerkUserId: true },
  });
  if (memberships.length === 0) return null;

  return { user: { clerkUserId: { in: memberships.map((m) => m.studentClerkUserId) } } };
}

const scoreShape = Object.fromEntries(
  DEFAULT_WRITING_RUBRIC.criteria.map((criterion) => [
    criterion.key,
    z.number().int().min(0).max(criterion.maxScore),
  ]),
) as Record<string, z.ZodNumber>;

export const TeacherReviewInput = z.object({
  scores: z.object(scoreShape),
  typoCount: z.number().int().min(0).max(200).nullable().optional(),
  dseLevel: z.enum(DSE_LEVELS as [DseLevel, ...DseLevel[]]),
  comment: z.string().trim().max(2000).optional(),
});

export type TeacherReviewInput = z.infer<typeof TeacherReviewInput>;

export type TeacherReviewView = {
  reviewerName: string;
  dseLevel: string;
  scores: Record<string, number>;
  typoCount: number | null;
  comment: string | null;
  updatedAt: string;
};

export function toTeacherReviewView(review: {
  dseLevel: string;
  scores: unknown;
  typoCount: number | null;
  comment: string | null;
  updatedAt: Date;
  reviewer: { name: string };
}): TeacherReviewView {
  const raw = (review.scores && typeof review.scores === "object" ? review.scores : {}) as Record<string, unknown>;
  const scores: Record<string, number> = {};
  for (const criterion of DEFAULT_WRITING_RUBRIC.criteria) {
    const value = Number(raw[criterion.key]);
    scores[criterion.key] = Number.isFinite(value) ? value : 0;
  }
  return {
    reviewerName: review.reviewer.name,
    dseLevel: review.dseLevel,
    scores,
    typoCount: review.typoCount,
    comment: review.comment,
    updatedAt: review.updatedAt.toISOString(),
  };
}
