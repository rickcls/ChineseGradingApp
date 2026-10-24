// Grade every gold essay several times and compare the AI with the teacher.
//
//   npm run eval:grading -- [--dir eval/gold] [--runs 3] [--concurrency 2] [--limit N]
//
// Gold essays are JSON files (see eval/README.md). Each run is a real model
// call, so this costs roughly essays × runs analysis calls.
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ANALYSIS_MODEL } from "../src/lib/anthropic";
import { PROMPT_VERSION, analyzeSubmission } from "../src/lib/analysis";
import {
  GoldEssaySchema,
  evaluateEssays,
  summarizeCalibration,
  type EssayResult,
  type GoldEssay,
} from "../src/lib/calibration";

function argValue(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function listJsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return listJsonFiles(full);
    return entry.endsWith(".json") ? [full] : [];
  });
}

function loadGoldEssays(dir: string): GoldEssay[] {
  const essays: GoldEssay[] = [];
  for (const file of listJsonFiles(dir)) {
    const parsed = GoldEssaySchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
    if (!parsed.success) {
      console.warn(`Skipping ${file}: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
      continue;
    }
    essays.push(parsed.data);
  }
  return essays;
}

const pct = (value: number) => `${(value * 100).toFixed(0)}%`;
const signed = (value: number, digits = 2) => `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;

function printEssay(result: EssayResult | null, essay: GoldEssay) {
  if (!result) {
    console.log(`  ${essay.id}: every run failed`);
    return;
  }
  console.log(
    `  ${result.id}: teacher L${result.goldLevel} | AI ${result.aiLevels.map((l) => `L${l}`).join(" ")} ` +
      `→ L${result.medianLevel} (${signed(result.levelDiff, 0)}) | score ${result.scoreMean.toFixed(1)} ± ${result.scoreStdev.toFixed(1)}`,
  );
}

async function main() {
  const dir = argValue("dir", "eval/gold");
  const runs = Math.max(1, Number(argValue("runs", "3")) || 3);
  const concurrency = Math.max(1, Number(argValue("concurrency", "2")) || 2);
  const limit = Number(argValue("limit", "0")) || 0;

  let essays = loadGoldEssays(dir);
  if (limit > 0) essays = essays.slice(0, limit);
  if (essays.length === 0) {
    console.error(`No gold essays found in ${dir}. See eval/README.md for the file format.`);
    process.exit(1);
  }

  console.log(`Grading ${essays.length} essays × ${runs} runs with ${ANALYSIS_MODEL} (prompt ${PROMPT_VERSION})`);
  const { results, failures } = await evaluateEssays({
    essays,
    runs,
    concurrency,
    onEssayDone: printEssay,
    analyze: async (essay) => {
      const { result } = await analyzeSubmission({
        text: essay.text,
        gradeLevel: essay.gradeLevel || "S6",
        genre: essay.genre,
        taskPrompt: essay.taskPrompt,
      });
      return { dseLevel: result.dse_level, overallScore: result.overall_score, scores: result.scores };
    },
  });

  const summary = summarizeCalibration(results);
  console.log("");
  console.log(`Essays graded:          ${summary.essays} (${failures.length} failed runs)`);
  console.log(`Exact level agreement:  ${pct(summary.exactAgreement)}`);
  console.log(`Within one level:       ${pct(summary.withinOneAgreement)}`);
  console.log(`Mean level bias:        ${signed(summary.meanLevelBias)} (positive = AI grades higher than teachers)`);
  console.log(`AI higher / lower:      ${pct(summary.inflationRate)} / ${pct(summary.deflationRate)}`);
  console.log(
    `Quadratic weighted κ:   ${summary.quadraticWeightedKappa === null ? "n/a" : summary.quadraticWeightedKappa.toFixed(2)}`,
  );
  console.log(`Run-to-run score σ:     ${summary.meanScoreStdev.toFixed(1)} points`);
  console.log(`Level changed between runs on ${summary.unstableEssays.length} essay(s)`);
  if (summary.criterionBias) {
    const parts = Object.entries(summary.criterionBias).map(([key, value]) => `${key} ${signed(value, 1)}`);
    console.log(`Criterion bias (AI − teacher): ${parts.join(", ")}`);
  }

  const outDir = argValue("out", "eval/results");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(outDir, `${stamp}-${PROMPT_VERSION}.json`);
  writeFileSync(
    outFile,
    JSON.stringify({ model: ANALYSIS_MODEL, promptVersion: PROMPT_VERSION, runs, summary, results, failures }, null, 2),
  );
  console.log(`\nReport written to ${outFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
