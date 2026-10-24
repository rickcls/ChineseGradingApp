import {
  DEFAULT_WRITING_RUBRIC,
  dseLevelFromScore,
  dseLevelRank,
  maxDseLevel,
  minDseLevel,
  type DseLevel,
  type RubricDef,
} from "./rubric";

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

// AI grading of the same essay varies by a couple of points between runs.
export const SCORE_NOISE_POINTS = 2;

export type LevelRange = { low: DseLevel; high: DseLevel; reason: "boundary" | "holistic" };

// The levels the essay could plausibly be at: the final total ± SCORE_NOISE_POINTS
// (short-board caps included), widened to the score-supported level when the holistic
// level came out lower. Null when every reading gives the same level.
export function levelRange(
  level: DseLevel,
  overallScore: number,
  scores: Record<string, number>,
  rubric: RubricDef,
): LevelRange | null {
  const scoreLevel = (score: number) =>
    applyShortBoardLevelCap(dseLevelFromScore(Math.max(0, Math.min(100, score))), scores, rubric);
  const low = minDseLevel(level, scoreLevel(overallScore - SCORE_NOISE_POINTS));
  const high = maxDseLevel(level, scoreLevel(overallScore + SCORE_NOISE_POINTS));
  if (low === high) return null;
  const reason = dseLevelRank(level) < dseLevelRank(scoreLevel(overallScore)) ? "holistic" : "boundary";
  return { low, high, reason };
}

// levelRange for a stored Analysis row. Its scores JSON also holds non-criterion fields;
// a missing criterion score is skipped by the caps rather than read as 0.
export function storedLevelRange(
  level: DseLevel,
  storedScores: unknown,
  overallScore: number,
  rubric: RubricDef = DEFAULT_WRITING_RUBRIC,
): LevelRange | null {
  const raw = (storedScores && typeof storedScores === "object" ? storedScores : {}) as Record<string, unknown>;
  const scores = Object.fromEntries(rubric.criteria.map((c) => [c.key, Number(raw[c.key])]));
  return levelRange(level, overallScore, scores, rubric);
}

export function describeLevelRange(range: LevelRange): string {
  return range.reason === "holistic"
    ? `各項分數支持較高等級，但整體判斷較保守，所以取較低者；實際可能介乎 Level ${range.low}–${range.high}。`
    : `總分接近等級分界，AI 評分有約 ±${SCORE_NOISE_POINTS} 分的正常波動，實際可能介乎 Level ${range.low}–${range.high}。`;
}

// The typo deduction must be traceable to highlighted evidence, so count the
// validated 錯別字／形近字／同音字 errors instead of trusting a self-reported total.
export function countEvidenceTypos(errors: { category: string; subcategory: string }[]): number {
  return errors.filter(
    (e) => e.category === "字詞" && (TYPO_SUBCATEGORIES as readonly string[]).includes(e.subcategory),
  ).length;
}
