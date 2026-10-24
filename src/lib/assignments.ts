import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { GENRE_VALUES } from "./genres";
import { DSE_LEVELS, dseLevelRank, type DseLevel } from "./rubric";
import { countsTowardWeakness } from "./weakness";

// Teacher assignments: a writing task set for one class. Students submit with
// their own credits; the AI 參考範文 stays locked until the teacher releases it,
// so it can't be copied into the assigned essay.

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const AssignmentInput = z.object({
  classId: z.string().min(1),
  taskPrompt: z.string().trim().min(2, "請填寫題目").max(500),
  genre: z.enum(GENRE_VALUES).optional(),
  instructions: z.string().trim().max(1000).optional(),
  // A calendar date from <input type="date">; due at the end of that day in Hong Kong.
  dueDate: z.string().regex(DATE_ONLY).optional(),
});

export const AssignmentUpdate = z
  .object({
    modelPassageReleased: z.boolean().optional(),
    dueDate: z.string().regex(DATE_ONLY).nullable().optional(),
  })
  .refine((value) => value.modelPassageReleased !== undefined || value.dueDate !== undefined, "nothing to update");

export function dueAtFromDate(date: string): Date {
  return new Date(`${date}T23:59:59+08:00`);
}

export function dateFromDueAt(dueAt: Date): string {
  return new Date(dueAt.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}

// Classes a teacher manages; admins manage every class.
export function teacherClassWhere(params: { clerkUserId: string; isAdmin: boolean }): Prisma.ClassWhereInput {
  return params.isAdmin ? {} : { teacherClerkUserId: params.clerkUserId };
}

// Assignments set for classes the student is enrolled in.
export function studentAssignmentWhere(clerkUserId: string): Prisma.AssignmentWhereInput {
  return { class: { studentClasses: { some: { studentClerkUserId: clerkUserId } } } };
}

export function modelPassageLocked(submission: { assignment: { modelPassageReleased: boolean } | null }): boolean {
  return submission.assignment !== null && !submission.assignment.modelPassageReleased;
}

export type AssignmentProgress = "not_submitted" | "submitted" | "late" | "overdue";

export const PROGRESS_LABEL: Record<AssignmentProgress, string> = {
  not_submitted: "未提交",
  submitted: "已提交",
  late: "遲交",
  overdue: "逾期未交",
};

// Lateness is judged on the student's first submission; later ones are revisions.
export function assignmentProgress(dueAt: Date | null, firstSubmittedAt: Date | null, now: Date): AssignmentProgress {
  if (firstSubmittedAt) return dueAt && firstSubmittedAt > dueAt ? "late" : "submitted";
  return dueAt && now > dueAt ? "overdue" : "not_submitted";
}

type IssueError = {
  category: string;
  subcategory: string;
  ocrSuspect: boolean;
  studentReaction: string | null;
};

export type CommonIssue = { category: string; subcategory: string; students: number; occurrences: number };

// The problems most widespread across the class: for each subcategory, how many
// students' essays show it, counting only errors that also count toward weakness
// profiles (no OCR suspects, nothing the student reported as wrong).
export function commonIssues(essays: { errors: IssueError[] }[], limit = 5): CommonIssue[] {
  const byKey = new Map<string, CommonIssue>();
  for (const essay of essays) {
    const seen = new Set<string>();
    for (const error of essay.errors) {
      if (!countsTowardWeakness(error)) continue;
      const key = `${error.category}/${error.subcategory}`;
      const issue = byKey.get(key) ?? { category: error.category, subcategory: error.subcategory, students: 0, occurrences: 0 };
      issue.occurrences += 1;
      if (!seen.has(key)) {
        issue.students += 1;
        seen.add(key);
      }
      byKey.set(key, issue);
    }
  }
  return Array.from(byKey.values())
    .sort((a, b) => b.students - a.students || b.occurrences - a.occurrences)
    .slice(0, limit);
}

// Count of essays at each level, highest level first; levels nobody reached are left out.
export function levelDistribution(levels: string[]): { level: DseLevel; count: number }[] {
  const counts = new Map<DseLevel, number>();
  for (const value of levels) {
    const level = DSE_LEVELS.find((item) => item === value);
    if (level) counts.set(level, (counts.get(level) ?? 0) + 1);
  }
  return Array.from(counts, ([level, count]) => ({ level, count })).sort(
    (a, b) => dseLevelRank(b.level) - dseLevelRank(a.level),
  );
}
