import { describe, expect, it } from "vitest";
import {
  GoldEssaySchema,
  evaluateEssays,
  medianLevel,
  quadraticWeightedKappa,
  summarizeCalibration,
  summarizeEssay,
  type EssayRun,
  type GoldEssay,
} from "../src/lib/calibration";
import type { DseLevel } from "../src/lib/rubric";

function essay(id: string, level: DseLevel, scores?: Record<string, number>): GoldEssay {
  return { id, text: "這是一篇用來測試校準流程的學生文章內容。", gold: { dseLevel: level, scores } };
}

function run(level: DseLevel, overallScore: number, scores: Record<string, number> = {}): EssayRun {
  return { dseLevel: level, overallScore, scores };
}

describe("medianLevel", () => {
  it("takes the middle run", () => {
    expect(medianLevel(["5", "3", "4"])).toBe("4");
  });

  it("takes the lower middle for an even count", () => {
    expect(medianLevel(["3", "5"])).toBe("3");
  });
});

describe("summarizeEssay", () => {
  it("reports level difference, spread and score variation", () => {
    const result = summarizeEssay(essay("a", "3", { content: 20 }), [
      run("4", 62, { content: 24 }),
      run("4", 64, { content: 26 }),
      run("3", 57, { content: 22 }),
    ]);
    expect(result.medianLevel).toBe("4");
    expect(result.levelDiff).toBe(1);
    expect(result.levelSpread).toBe(1);
    expect(result.scoreMean).toBeCloseTo(61);
    expect(result.scoreStdev).toBeCloseTo(3.606, 2);
    expect(result.criterionDiffs).toEqual({ content: 4 });
  });
});

describe("quadraticWeightedKappa", () => {
  it("is 1 for perfect agreement", () => {
    expect(quadraticWeightedKappa([1, 3, 4, 5], [1, 3, 4, 5])).toBeCloseTo(1);
  });

  it("drops when predictions are off by one", () => {
    const kappa = quadraticWeightedKappa([1, 2, 3, 4, 5], [2, 3, 4, 5, 6])!;
    expect(kappa).toBeLessThan(1);
    expect(kappa).toBeGreaterThan(0);
  });

  it("is negative when predictions are reversed", () => {
    expect(quadraticWeightedKappa([1, 2, 5, 6], [6, 5, 2, 1])!).toBeLessThan(0);
  });

  it("is undefined when every level is identical", () => {
    expect(quadraticWeightedKappa([3, 3], [3, 3])).toBeNull();
  });
});

describe("summarizeCalibration", () => {
  it("aggregates agreement, bias and instability", () => {
    const results = [
      summarizeEssay(essay("exact", "4"), [run("4", 65), run("4", 66)]),
      summarizeEssay(essay("high", "3", { content: 20 }), [run("4", 61, { content: 26 }), run("5", 72, { content: 28 })]),
      summarizeEssay(essay("low", "5"), [run("3", 55), run("3", 54)]),
    ];
    const summary = summarizeCalibration(results);
    expect(summary.essays).toBe(3);
    expect(summary.exactAgreement).toBeCloseTo(1 / 3);
    expect(summary.withinOneAgreement).toBeCloseTo(2 / 3);
    expect(summary.meanLevelBias).toBeCloseTo((0 + 1 - 2) / 3);
    expect(summary.inflationRate).toBeCloseTo(1 / 3);
    expect(summary.deflationRate).toBeCloseTo(1 / 3);
    expect(summary.unstableEssays).toEqual(["high"]);
    expect(summary.criterionBias).toEqual({ content: 7 });
  });
});

describe("evaluateEssays", () => {
  it("records failed runs and skips essays with no successful run", async () => {
    let calls = 0;
    const { results, failures } = await evaluateEssays({
      essays: [essay("ok", "3"), essay("broken", "4")],
      runs: 2,
      concurrency: 2,
      analyze: async (item) => {
        calls += 1;
        if (item.id === "broken") throw new Error("timeout");
        return run("3", 55);
      },
    });
    expect(calls).toBe(4);
    expect(results.map((r) => r.id)).toEqual(["ok"]);
    expect(failures).toEqual([
      { id: "broken", run: 1, message: "timeout" },
      { id: "broken", run: 2, message: "timeout" },
    ]);
  });
});

describe("GoldEssaySchema", () => {
  it("rejects an unknown level", () => {
    expect(GoldEssaySchema.safeParse({ ...essay("x", "3"), gold: { dseLevel: "6" } }).success).toBe(false);
  });
});
