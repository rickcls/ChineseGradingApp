import { z } from "zod";
import { DSE_LEVELS, dseLevelRank, type DseLevel } from "./rubric";

// Calibration compares AI grading with teacher (gold) grading on the same
// essays. Pure functions only; scripts/eval-grading.ts does the I/O.

const LevelSchema = z.enum(DSE_LEVELS as [DseLevel, ...DseLevel[]]);

export const GoldEssaySchema = z.object({
  id: z.string().min(1),
  source: z.string().optional(),
  gradeLevel: z.string().optional(),
  genre: z.string().optional(),
  taskPrompt: z.string().optional(),
  text: z.string().min(20),
  gold: z.object({
    dseLevel: LevelSchema,
    scores: z.record(z.string(), z.number()).optional(),
    typoCount: z.number().int().nonnegative().optional(),
  }),
});

export type GoldEssay = z.infer<typeof GoldEssaySchema>;

export type EssayRun = {
  dseLevel: DseLevel;
  overallScore: number;
  scores: Record<string, number>;
};

export type EssayResult = {
  id: string;
  goldLevel: DseLevel;
  aiLevels: DseLevel[];
  medianLevel: DseLevel;
  // Positive = AI graded higher than the teacher (in DSE level steps).
  levelDiff: number;
  // Highest minus lowest level across repeated runs; 0 = perfectly stable.
  levelSpread: number;
  scoreMean: number;
  scoreStdev: number;
  // AI minus gold, per criterion, using the mean of the runs.
  criterionDiffs: Record<string, number> | null;
};

export type CalibrationSummary = {
  essays: number;
  exactAgreement: number;
  withinOneAgreement: number;
  meanLevelBias: number;
  meanAbsLevelError: number;
  inflationRate: number;
  deflationRate: number;
  quadraticWeightedKappa: number | null;
  meanScoreStdev: number;
  unstableEssays: string[];
  criterionBias: Record<string, number> | null;
};

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1));
}

// Median level of repeated runs; with an even count take the lower middle
// (the conservative choice, matching how the grader resolves disagreements).
export function medianLevel(levels: DseLevel[]): DseLevel {
  if (levels.length === 0) throw new Error("medianLevel needs at least one level");
  const ranks = levels.map(dseLevelRank).sort((a, b) => a - b);
  return DSE_LEVELS[ranks[Math.floor((ranks.length - 1) / 2)]];
}

export function summarizeEssay(essay: GoldEssay, runs: EssayRun[]): EssayResult {
  if (runs.length === 0) throw new Error(`No successful runs for ${essay.id}`);

  const aiLevels = runs.map((run) => run.dseLevel);
  const ranks = aiLevels.map(dseLevelRank);
  const median = medianLevel(aiLevels);

  let criterionDiffs: Record<string, number> | null = null;
  if (essay.gold.scores) {
    criterionDiffs = {};
    for (const [key, goldScore] of Object.entries(essay.gold.scores)) {
      const aiScores = runs.map((run) => run.scores[key]).filter((v): v is number => Number.isFinite(v));
      if (aiScores.length > 0) criterionDiffs[key] = mean(aiScores) - goldScore;
    }
  }

  return {
    id: essay.id,
    goldLevel: essay.gold.dseLevel,
    aiLevels,
    medianLevel: median,
    levelDiff: dseLevelRank(median) - dseLevelRank(essay.gold.dseLevel),
    levelSpread: Math.max(...ranks) - Math.min(...ranks),
    scoreMean: mean(runs.map((run) => run.overallScore)),
    scoreStdev: stdev(runs.map((run) => run.overallScore)),
    criterionDiffs,
  };
}

// Quadratic weighted kappa over the 8 DSE levels: 1 = perfect agreement,
// 0 = chance, < 0 = worse than chance. null when undefined (e.g. every gold
// and predicted level is identical, so chance agreement is already perfect).
export function quadraticWeightedKappa(gold: number[], predicted: number[], categories = DSE_LEVELS.length): number | null {
  if (gold.length !== predicted.length || gold.length === 0) return null;
  const n = gold.length;
  const observed = Array.from({ length: categories }, () => new Array<number>(categories).fill(0));
  const goldHist = new Array<number>(categories).fill(0);
  const predHist = new Array<number>(categories).fill(0);
  for (let k = 0; k < n; k += 1) {
    observed[gold[k]][predicted[k]] += 1;
    goldHist[gold[k]] += 1;
    predHist[predicted[k]] += 1;
  }

  let weightedObserved = 0;
  let weightedExpected = 0;
  const denom = (categories - 1) ** 2;
  for (let i = 0; i < categories; i += 1) {
    for (let j = 0; j < categories; j += 1) {
      const weight = (i - j) ** 2 / denom;
      weightedObserved += weight * observed[i][j];
      weightedExpected += (weight * goldHist[i] * predHist[j]) / n;
    }
  }
  if (weightedExpected === 0) return null;
  return 1 - weightedObserved / weightedExpected;
}

export function summarizeCalibration(results: EssayResult[]): CalibrationSummary {
  const n = results.length;
  const share = (predicate: (r: EssayResult) => boolean) => (n === 0 ? 0 : results.filter(predicate).length / n);

  const withCriteria = results.filter((r) => r.criterionDiffs && Object.keys(r.criterionDiffs).length > 0);
  let criterionBias: Record<string, number> | null = null;
  if (withCriteria.length > 0) {
    const keys = new Set(withCriteria.flatMap((r) => Object.keys(r.criterionDiffs!)));
    criterionBias = {};
    for (const key of keys) {
      criterionBias[key] = mean(
        withCriteria.map((r) => r.criterionDiffs![key]).filter((v): v is number => Number.isFinite(v)),
      );
    }
  }

  return {
    essays: n,
    exactAgreement: share((r) => r.levelDiff === 0),
    withinOneAgreement: share((r) => Math.abs(r.levelDiff) <= 1),
    meanLevelBias: mean(results.map((r) => r.levelDiff)),
    meanAbsLevelError: mean(results.map((r) => Math.abs(r.levelDiff))),
    inflationRate: share((r) => r.levelDiff > 0),
    deflationRate: share((r) => r.levelDiff < 0),
    quadraticWeightedKappa: quadraticWeightedKappa(
      results.map((r) => dseLevelRank(r.goldLevel)),
      results.map((r) => dseLevelRank(r.medianLevel)),
    ),
    meanScoreStdev: mean(results.map((r) => r.scoreStdev)),
    unstableEssays: results.filter((r) => r.levelSpread > 0).map((r) => r.id),
    criterionBias,
  };
}

export type AnalyzeFn = (essay: GoldEssay) => Promise<EssayRun>;

export type EssayFailure = { id: string; run: number; message: string };

// Grades every essay `runs` times (essays in parallel up to `concurrency`,
// runs of one essay in sequence). Failed runs are reported, not fatal; an
// essay with no successful run is left out of the results.
export async function evaluateEssays(params: {
  essays: GoldEssay[];
  runs: number;
  concurrency: number;
  analyze: AnalyzeFn;
  onEssayDone?: (result: EssayResult | null, essay: GoldEssay) => void;
}): Promise<{ results: EssayResult[]; failures: EssayFailure[] }> {
  const { essays, runs, analyze, onEssayDone } = params;
  const concurrency = Math.max(1, params.concurrency);
  const results: (EssayResult | null)[] = new Array(essays.length).fill(null);
  const failures: EssayFailure[] = [];
  let next = 0;

  async function worker() {
    while (next < essays.length) {
      const index = next;
      next += 1;
      const essay = essays[index];
      const essayRuns: EssayRun[] = [];
      for (let run = 1; run <= runs; run += 1) {
        try {
          essayRuns.push(await analyze(essay));
        } catch (error) {
          failures.push({ id: essay.id, run, message: error instanceof Error ? error.message : String(error) });
        }
      }
      results[index] = essayRuns.length > 0 ? summarizeEssay(essay, essayRuns) : null;
      onEssayDone?.(results[index], essay);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, essays.length) }, () => worker()));
  return { results: results.filter((r): r is EssayResult => r !== null), failures };
}
