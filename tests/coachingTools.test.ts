import { describe, expect, it } from "vitest";
import { isTopicAnalysisResult, normalizeTopic, parseTopicAnalysis } from "../src/lib/topicAnalysis";
import { parseThemeElevation, readThemeElevation } from "../src/lib/themeElevation";

const topicReply = {
  key_phrases: [{ phrase: "終於", meaning: "經過一段過程才達成", requirement: "要寫出之前的掙扎和轉變" }],
  requirements: ["記敘一次經歷", "寫出感悟"],
  pitfalls: [{ pitfall: "只寫結果", why: "忽略「終於」前的過程" }],
  angles: [
    { angle: "終於學會堅持", material: "練琴的經歷" },
    { angle: "終於明白父母的苦心", material: "與父親的衝突" },
    { angle: "終於接納不完美的自己", material: "比賽落敗後的反思" },
  ],
  checklist: ["有沒有寫出轉變前後的對比？"],
};

describe("parseTopicAnalysis", () => {
  it("parses fenced JSON and labels angles from basic to profound", () => {
    const result = parseTopicAnalysis("```json\n" + JSON.stringify(topicReply) + "\n```");
    expect(result.keyPhrases[0].phrase).toBe("終於");
    expect(result.angles.map((a) => a.depth)).toEqual(["基本", "深入", "深刻"]);
    expect(isTopicAnalysisResult(result)).toBe(true);
  });

  it("rejects a reply without key phrases", () => {
    expect(() => parseTopicAnalysis(JSON.stringify({ ...topicReply, key_phrases: [] }))).toThrow();
  });

  it("normalizes whitespace in the topic used for caching", () => {
    expect(normalizeTopic("  那一次，\n我終於   明白了  ")).toBe("那一次， 我終於 明白了");
  });
});

const elevationReply = {
  current_theme: "我學會了珍惜時間",
  diagnosis: "結尾只停在口號，未寫出為何改變。",
  ladder: [
    { direction: "由遲到的教訓看自我管理", connect: "第二段趕巴士的細節", example: "原來時間從不等人，等人的只有遺憾。" },
    { direction: "體會母親每天早起的付出", connect: "第一段母親叫醒我", example: "母親的鬧鐘比我的早響了十年。" },
    {
      direction: "思考快與慢的人生節奏",
      connect: "全文的時間意象",
      // Over the 80-character cap: a paragraph, not a one-line hint.
      example: "人生的快與慢".repeat(15),
    },
  ],
  caution: "不要在最後一段突然引用名言說教。",
};

describe("parseThemeElevation", () => {
  const meta = { modelName: "test-model", generatedAt: new Date("2026-10-23T00:00:00Z") };

  it("assigns the three levels in order and keeps short examples", () => {
    const result = parseThemeElevation(JSON.stringify(elevationReply), meta);
    expect(result.ladder.map((s) => s.level)).toEqual(["個人成長", "人情與社會", "哲理與文化"]);
    expect(result.ladder[0].example).toBe("原來時間從不等人，等人的只有遺憾。");
    expect(result.generatedAt).toBe("2026-10-23T00:00:00.000Z");
  });

  it("drops examples long enough to be a rewritten paragraph", () => {
    const result = parseThemeElevation(JSON.stringify(elevationReply), meta);
    expect(result.ladder[2].example).toBeUndefined();
    expect(result.ladder[2].direction).toBe("思考快與慢的人生節奏");
  });

  it("requires exactly three levels", () => {
    const twoSteps = { ...elevationReply, ladder: elevationReply.ladder.slice(0, 2) };
    expect(() => parseThemeElevation(JSON.stringify(twoSteps), meta)).toThrow();
  });

  it("reads stored values defensively", () => {
    const stored = parseThemeElevation(JSON.stringify(elevationReply), meta);
    expect(readThemeElevation(JSON.parse(JSON.stringify(stored)))?.currentTheme).toBe("我學會了珍惜時間");
    expect(readThemeElevation(null)).toBeNull();
    expect(readThemeElevation({ currentTheme: "x", ladder: [] })).toBeNull();
  });
});
