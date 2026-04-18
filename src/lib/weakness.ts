import { prisma } from "./db";
import type { ErrorRecord } from "@prisma/client";

const EWMA_ALPHA = 0.3;
const CONFIRM_MIN_COUNT = 3;
const CONFIRM_MIN_SUBMISSIONS = 2;
const CONFIRM_MIN_DAYS = 2;
const IMPROVING_REDUCTION = 0.5;
const RESOLVED_CONSECUTIVE = 3;

type Windowed = { submissionId: string; count: number; severitySum: number; date: string };

export async function updateWeaknessProfiles(params: {
  userId: string;
  submissionId: string;
  submissionDate: Date;
  errors: Pick<ErrorRecord, "category" | "subcategory" | "severity" | "ocrSuspect">[];
}) {
  const { userId, submissionId, submissionDate, errors } = params;
  const dateKey = submissionDate.toISOString().slice(0, 10);

  const eligible = errors.filter((e) => !e.ocrSuspect);

  const grouped = new Map<string, { count: number; severitySum: number }>();
  for (const e of eligible) {
    const key = `${e.category}::${e.subcategory}`;
    const cur = grouped.get(key) || { count: 0, severitySum: 0 };
    cur.count += 1;
    cur.severitySum += e.severity;
    grouped.set(key, cur);
  }

  const existing = await prisma.weaknessProfile.findMany({ where: { userId } });
  const existingKeys = new Set(existing.map((w) => `${w.category}::${w.subcategory}`));

  for (const [key, agg] of grouped) {
    const [category, subcategory] = key.split("::");
    const newSeverity = agg.severitySum / agg.count;
    const prior = existing.find((w) => w.category === category && w.subcategory === subcategory);

    const windowArr: Windowed[] = Array.isArray(prior?.recentCounts)
      ? (prior!.recentCounts as unknown as Windowed[])
      : [];

    const windowNext = [
      ...windowArr.filter((w) => w.submissionId !== submissionId),
      { submissionId, count: agg.count, severitySum: agg.severitySum, date: dateKey },
    ].slice(-10);

    const severityEwma = prior
      ? EWMA_ALPHA * newSeverity + (1 - EWMA_ALPHA) * prior.severityEwma
      : newSeverity;

    const evidenceSubmissionIds = prior
      ? Array.from(new Set([...prior.evidenceSubmissionIds, submissionId]))
      : [submissionId];

    const status = deriveStatus({ windowNext, evidenceCount: (prior?.evidenceCount ?? 0) + agg.count });

    await prisma.weaknessProfile.upsert({
      where: {
        userId_category_subcategory: { userId, category, subcategory },
      },
      create: {
        userId,
        category,
        subcategory,
        evidenceCount: agg.count,
        evidenceSubmissionIds,
        severityEwma,
        status,
        recentCounts: windowNext as unknown as object,
        firstSeenAt: submissionDate,
        lastSeenAt: submissionDate,
      },
      update: {
        evidenceCount: { increment: agg.count },
        evidenceSubmissionIds,
        severityEwma,
        status,
        recentCounts: windowNext as unknown as object,
        lastSeenAt: submissionDate,
      },
    });
  }

  for (const w of existing) {
    const key = `${w.category}::${w.subcategory}`;
    if (grouped.has(key)) continue;
    const windowArr: Windowed[] = Array.isArray(w.recentCounts)
      ? (w.recentCounts as unknown as Windowed[])
      : [];
    const windowNext = [
      ...windowArr.filter((x) => x.submissionId !== submissionId),
      { submissionId, count: 0, severitySum: 0, date: dateKey },
    ].slice(-10);
    const status = deriveStatus({ windowNext, evidenceCount: w.evidenceCount });
    await prisma.weaknessProfile.update({
      where: { id: w.id },
      data: { recentCounts: windowNext as unknown as object, status },
    });
  }

  return { updated: grouped.size, carriedForward: existing.length - grouped.size };
}

function deriveStatus(params: { windowNext: Windowed[]; evidenceCount: number }): "watching" | "confirmed" | "improving" | "resolved" {
  const { windowNext, evidenceCount } = params;
  const nonzero = windowNext.filter((w) => w.count > 0);
  const distinctSubmissions = new Set(nonzero.map((w) => w.submissionId)).size;
  const distinctDays = new Set(nonzero.map((w) => w.date)).size;

  const tail = windowNext.slice(-RESOLVED_CONSECUTIVE);
  if (tail.length === RESOLVED_CONSECUTIVE && tail.every((w) => w.count === 0)) {
    return "resolved";
  }

  const last2 = windowNext.slice(-2);
  const prev2 = windowNext.slice(-4, -2);
  if (last2.length === 2 && prev2.length === 2) {
    const lastSum = last2.reduce((a, b) => a + b.count, 0);
    const prevSum = prev2.reduce((a, b) => a + b.count, 0);
    if (prevSum > 0 && lastSum / prevSum <= 1 - IMPROVING_REDUCTION) {
      return "improving";
    }
  }

  if (
    evidenceCount >= CONFIRM_MIN_COUNT &&
    distinctSubmissions >= CONFIRM_MIN_SUBMISSIONS &&
    distinctDays >= CONFIRM_MIN_DAYS
  ) {
    return "confirmed";
  }

  return "watching";
}
