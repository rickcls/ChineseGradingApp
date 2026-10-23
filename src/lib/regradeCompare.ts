import type { AnalysisResult } from "./analysis";
import { DEFAULT_WRITING_RUBRIC, dseLevelFromScore, dseLevelRank, type DseLevel } from "./rubric";

// Re-grading a revision: a compact snapshot of the new grade (stored on
// RevisionSession.regrade) and a before → after comparison with the
// original analysis. Pure, so the compare page and tests share it.

export type SnapshotError = {
  category: string;
  subcategory: string;
  evidenceSpan: string;
  suggestion: string;
  severity: number;
};

export type GradeSnapshot = {
  scores: Record<string, number>;
  overallScore: number;
  dseLevel: DseLevel;
  errors: SnapshotError[];
};

export type StoredRegrade = GradeSnapshot & {
  typoCount: number;
  wordCount: number;
  coachFeedback: string;
  strengths: string[];
  priorities: { focus?: string; issue: string }[];
  modelName: string;
  promptVersion: string;
  gradedAt: string;
};

// AI grading of the same text varies by a couple of points between runs, so
// a change this small is not evidence of improvement either way.
export const NOISE_POINTS = 2;

export function regradeFromAnalysis(
  result: AnalysisResult,
  meta: { modelName: string; promptVersion: string; gradedAt: Date },
): StoredRegrade {
  return {
    scores: Object.fromEntries(DEFAULT_WRITING_RUBRIC.criteria.map((c) => [c.key, result.scores[c.key] ?? 0])),
    overallScore: result.overall_score,
    dseLevel: result.dse_level,
    typoCount: result.typo_count,
    wordCount: result.word_count,
    coachFeedback: result.coach_feedback,
    strengths: result.strengths.slice(0, 5),
    priorities: result.revision_priorities.slice(0, 3).map((p) => ({ focus: p.focus, issue: p.issue })),
    errors: result.errors.map((e) => ({
      category: e.category,
      subcategory: e.subcategory,
      evidenceSpan: e.evidence_span,
      suggestion: e.suggestion,
      severity: e.severity,
    })),
    modelName: meta.modelName,
    promptVersion: meta.promptVersion,
    gradedAt: meta.gradedAt.toISOString(),
  };
}

export function readRegrade(value: unknown): StoredRegrade | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<StoredRegrade>;
  if (!record.scores || typeof record.overallScore !== "number" || typeof record.dseLevel !== "string") return null;
  if (!Array.isArray(record.errors)) return null;
  return record as StoredRegrade;
}

// The original grade as stored on Analysis (+ its ErrorRecords, already
// filtered by the caller to the ones that count).
export function snapshotFromAnalysis(
  analysis: { scores: unknown; overallScore: number },
  errors: SnapshotError[],
): GradeSnapshot {
  const raw = (analysis.scores && typeof analysis.scores === "object" ? analysis.scores : {}) as Record<string, unknown>;
  const scores = Object.fromEntries(
    DEFAULT_WRITING_RUBRIC.criteria.map((c) => [c.key, Number.isFinite(Number(raw[c.key])) ? Number(raw[c.key]) : 0]),
  );
  const dseLevel =
    typeof raw.dse_level === "string" ? (raw.dse_level as DseLevel) : dseLevelFromScore(analysis.overallScore);
  return { scores, overallScore: analysis.overallScore, dseLevel, errors };
}

export type GradeComparison = {
  levelBefore: DseLevel;
  levelAfter: DseLevel;
  levelChange: number;
  overallBefore: number;
  overallAfter: number;
  overallDelta: number;
  withinNoise: boolean;
  criteria: { key: string; label: string; max: number; before: number; after: number; delta: number }[];
  issues: { label: string; before: number; after: number }[];
  cleared: string[];
  newIssues: string[];
};

function countByIssue(errors: SnapshotError[]) {
  const counts = new Map<string, number>();
  for (const error of errors) {
    const label = `${error.category}・${error.subcategory}`;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return counts;
}

export function compareGrades(before: GradeSnapshot, after: GradeSnapshot): GradeComparison {
  const beforeCounts = countByIssue(before.errors);
  const afterCounts = countByIssue(after.errors);
  const labels = Array.from(new Set([...beforeCounts.keys(), ...afterCounts.keys()]));
  const issues = labels
    .map((label) => ({ label, before: beforeCounts.get(label) ?? 0, after: afterCounts.get(label) ?? 0 }))
    .sort((a, b) => b.before - a.before || b.after - a.after || a.label.localeCompare(b.label));

  const overallDelta = after.overallScore - before.overallScore;
  return {
    levelBefore: before.dseLevel,
    levelAfter: after.dseLevel,
    levelChange: dseLevelRank(after.dseLevel) - dseLevelRank(before.dseLevel),
    overallBefore: before.overallScore,
    overallAfter: after.overallScore,
    overallDelta,
    withinNoise: Math.abs(overallDelta) <= NOISE_POINTS,
    criteria: DEFAULT_WRITING_RUBRIC.criteria.map((c) => {
      const b = before.scores[c.key] ?? 0;
      const a = after.scores[c.key] ?? 0;
      return { key: c.key, label: c.label, max: c.maxScore, before: b, after: a, delta: a - b };
    }),
    issues,
    cleared: issues.filter((i) => i.before > 0 && i.after === 0).map((i) => i.label),
    newIssues: issues.filter((i) => i.before === 0 && i.after > 0).map((i) => i.label),
  };
}
