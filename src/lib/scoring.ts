import { minDseLevel, type DseLevel, type RubricDef } from "./rubric";

// Deterministic post-processing rules from dse-chinese-writing-rubric.md.
// Kept free of I/O so they can be unit-tested without a model call.

// §3.5：少於 400 字，內容不得進入中品 (N>=5)。400–599 字只在 prompt 中酌情扣分。
export const HARD_WORD_COUNT_THRESHOLD = 400;

export const TYPO_SUBCATEGORIES = ["錯別字", "形近字", "同音字"] as const;

function criterionN(scores: Record<string, number>, rubric: RubricDef, key: string): number | null {
  const criterion = rubric.criteria.find((c) => c.key === key);
  const raw = scores[key];
  if (!criterion || !Number.isFinite(raw)) return null;
  return (raw / criterion.maxScore) * 10;
}

function capCriterionAtN(scores: Record<string, number>, rubric: RubricDef, key: string, maxN: number) {
  const criterion = rubric.criteria.find((c) => c.key === key);
  if (!criterion || !Number.isFinite(scores[key])) return;
  // Multiply before dividing, plus an epsilon, so float error cannot floor a whole-number cap down by one.
  const maxScore = Math.max(0, Math.min(criterion.maxScore, Math.floor((maxN * criterion.maxScore) / 10 + 1e-9)));
  scores[key] = Math.min(scores[key], maxScore);
}

export function enforceWordCountContentCap(scores: Record<string, number>, rubric: RubricDef, wordCount: number) {
  if (wordCount >= HARD_WORD_COUNT_THRESHOLD) return;
  capCriterionAtN(scores, rubric, "content", 4);
}

// §1.1：結構分最高可比內容分高出一品第 (structure N <= content N + 1)。
export function enforceStructureBandCap(scores: Record<string, number>, rubric: RubricDef) {
  const contentN = criterionN(scores, rubric, "content");
  if (contentN === null) return;
  capCriterionAtN(scores, rubric, "structure", contentN + 1);
}

// §3.3：內容 2 分或以下，表達與結構均不得超過 4 分。
export function enforceContentLedCap(scores: Record<string, number>, rubric: RubricDef) {
  const contentN = criterionN(scores, rubric, "content");
  if (contentN === null || contentN > 2) return;
  capCriterionAtN(scores, rubric, "expression", 4);
  capCriterionAtN(scores, rubric, "structure", 4);
}

export function applyShortBoardLevelCap(
  level: DseLevel,
  scores: Record<string, number>,
  rubric: RubricDef,
): DseLevel {
  let cap: DseLevel = "5**";

  for (const criterion of rubric.criteria) {
    const nScore = criterionN(scores, rubric, criterion.key);
    if (nScore === null) continue;

    if (nScore <= 1) cap = minDseLevel(cap, "U");
    else if (nScore <= 2) cap = minDseLevel(cap, "1");
    else if (nScore <= 4) cap = minDseLevel(cap, "3");
    else if (nScore <= 6) cap = minDseLevel(cap, "4");
  }

  return minDseLevel(level, cap);
}

// The typo deduction must be traceable to highlighted evidence, so count the
// validated 錯別字／形近字／同音字 errors instead of trusting a self-reported total.
export function countEvidenceTypos(errors: { category: string; subcategory: string }[]): number {
  return errors.filter(
    (e) => e.category === "字詞" && (TYPO_SUBCATEGORIES as readonly string[]).includes(e.subcategory),
  ).length;
}
