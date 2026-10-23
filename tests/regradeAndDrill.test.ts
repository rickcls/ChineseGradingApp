import { describe, expect, it } from "vitest";
import type { AnalysisResult } from "../src/lib/analysis";
import { parseDrillFeedback, parseDrillTask, readDrillTask } from "../src/lib/practiceDrill";
import { compareGrades, readRegrade, regradeFromAnalysis, snapshotFromAnalysis } from "../src/lib/regradeCompare";

const err = (category: string, subcategory: string) => ({
  category,
  subcategory,
  evidenceSpan: "x",
  suggestion: "s",
  severity: 1,
});

describe("regradeFromAnalysis", () => {
  it("keeps the four scores, level, top priorities and errors", () => {
    const result = {
      scores: { content: 28, expression: 21, structure: 14, punctuation: 7 },
      base_score: 70,
      typo_count: 1,
      typo_bonus: 0,
      word_count: 650,
      overall_score: 70,
      dse_level: "5",
      coach_feedback: "進步明顯。",
      strengths: ["a", "b"],
      revision_priorities: [1, 2, 3, 4].map((n) => ({ focus: "內容", issue: `重點${n}`, why: "", how: ["x"] })),
      errors: [
        {
          category: "字詞",
          subcategory: "錯別字",
          evidence_span: "己經",
          char_offset_start: 0,
          char_offset_end: 2,
          suggestion: "已經",
          severity: 1,
          confidence: 0.9,
        },
      ],
    } as AnalysisResult;
    const stored = regradeFromAnalysis(result, { modelName: "m", promptVersion: "p", gradedAt: new Date("2026-10-23T00:00:00Z") });
    expect(stored.dseLevel).toBe("5");
    expect(stored.priorities.map((p) => p.issue)).toEqual(["重點1", "重點2", "重點3"]);
    expect(stored.errors[0]).toEqual({ category: "字詞", subcategory: "錯別字", evidenceSpan: "己經", suggestion: "已經", severity: 1 });
    expect(readRegrade(JSON.parse(JSON.stringify(stored)))?.overallScore).toBe(70);
    expect(readRegrade({ scores: {} })).toBeNull();
  });
});

describe("compareGrades", () => {
  const before = snapshotFromAnalysis(
    { scores: { content: 24, expression: 18, structure: 12, punctuation: 6, dse_level: "4" }, overallScore: 60 },
    [err("表達", "粵語入文"), err("表達", "粵語入文"), err("字詞", "錯別字"), err("結構", "段落銜接")],
  );

  it("reports level, score and per-issue changes", () => {
    const after = snapshotFromAnalysis(
      { scores: { content: 28, expression: 21, structure: 14, punctuation: 7, dse_level: "5" }, overallScore: 70 },
      [err("結構", "段落銜接"), err("語法", "歐化句式")],
    );
    const comparison = compareGrades(before, after);
    expect(comparison.levelChange).toBe(1);
    expect(comparison.overallDelta).toBe(10);
    expect(comparison.withinNoise).toBe(false);
    expect(comparison.criteria.map((c) => c.delta)).toEqual([4, 3, 2, 1]);
    expect(comparison.issues[0]).toEqual({ label: "表達・粵語入文", before: 2, after: 0 });
    expect(comparison.cleared.sort()).toEqual(["字詞・錯別字", "表達・粵語入文"]);
    expect(comparison.newIssues).toEqual(["語法・歐化句式"]);
  });

  it("marks small score changes as noise", () => {
    const after = snapshotFromAnalysis({ scores: { content: 24, expression: 18, structure: 12, punctuation: 8 }, overallScore: 62 }, []);
    const comparison = compareGrades(before, after);
    expect(comparison.withinNoise).toBe(true);
    // No stored level: derived from the overall score.
    expect(comparison.levelAfter).toBe("4");
  });
});

const taskReply = {
  title: "去掉粵語",
  situation: "描寫放學後在公園看見的情景。",
  focus: "用規範書面語代替口語",
  requirements: ["全段不用粵語詞", "至少一個比喻"],
  tips: ["把「佢哋」寫成「他們」"],
};

describe("parseDrillTask", () => {
  it("accepts two or three requirements and adds the word range", () => {
    const task = parseDrillTask("```json\n" + JSON.stringify(taskReply) + "\n```");
    expect(task.wordRange).toEqual([100, 200]);
    expect(readDrillTask(JSON.parse(JSON.stringify(task)))?.title).toBe("去掉粵語");
  });

  it("rejects tasks with too many requirements", () => {
    expect(() => parseDrillTask(JSON.stringify({ ...taskReply, requirements: ["a", "b", "c", "d"] }))).toThrow();
  });
});

describe("parseDrillFeedback", () => {
  const task = parseDrillTask(JSON.stringify(taskReply));
  const response = "放學後，他們在公園裏玩，夕陽像一個橙色的燈籠掛在天邊。";

  it("lines verdicts up with the requirements and keeps a fix quoted from the response", () => {
    const feedback = parseDrillFeedback(
      JSON.stringify({
        requirements: [
          { met: true, comment: "沒有粵語" },
          { met: true, comment: "比喻生動" },
        ],
        praise: "比喻很貼切。",
        next_step: "試試加入聲音描寫。",
        fix: { before: "他們在公園裏玩", after: "他們在公園裏追逐嬉戲" },
      }),
      task,
      response,
    );
    expect(feedback.allMet).toBe(true);
    expect(feedback.requirements[1]).toEqual({ requirement: "至少一個比喻", met: true, comment: "比喻生動" });
    expect(feedback.fix?.after).toBe("他們在公園裏追逐嬉戲");
  });

  it("drops a fix that does not quote the student or is too long, and treats missing verdicts as unmet", () => {
    const feedback = parseDrillFeedback(
      JSON.stringify({
        requirements: [{ met: true, comment: "ok" }],
        praise: "p",
        next_step: "n",
        fix: { before: "不存在的句子", after: "x" },
      }),
      task,
      response,
    );
    expect(feedback.fix).toBeUndefined();
    expect(feedback.requirements[1].met).toBe(false);
    expect(feedback.allMet).toBe(false);
  });
});
