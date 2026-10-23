import { beforeEach, describe, expect, it, vi } from "vitest";

const generateModelText = vi.fn();

vi.mock("../src/lib/anthropic", () => ({
  ANALYSIS_MODEL: "test-model",
  ANALYSIS_FALLBACK_MODEL: "test-model",
  generateModelText: (input: unknown) => generateModelText(input),
  generateModelTextStream: (input: unknown) => generateModelText(input),
}));

const { analyzeSubmission } = await import("../src/lib/analysis");

// 268 Chinese characters: below the 400-character hard cap.
const essay = `${"我們今天去公圓散步，天氣很好。".repeat(20)}最後大家都很開新。`;

function typo(span: string, subcategory = "同音字") {
  return {
    category: "字詞",
    subcategory,
    evidence_span: span,
    char_offset_start: 0,
    char_offset_end: span.length,
    suggestion: "改正錯字",
    severity: 1,
    confidence: 0.9,
  };
}

function modelReply(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    dse_level: "5",
    scores: { content: 32, expression: 24, structure: 20, punctuation: 8 },
    typo_count: 0,
    word_count: 999,
    coach_feedback: "整體表達清楚。",
    strengths: ["描寫具體"],
    revision_priorities: [{ focus: "內容", issue: "加入感受", why: "", how: ["補一句心情"] }],
    errors: [typo("公圓"), typo("開新", "形近字"), typo("不存在的字")],
    ...overrides,
  });
}

describe("analyzeSubmission", () => {
  beforeEach(() => {
    generateModelText.mockReset();
  });

  it("wraps the essay and passes genre and topic to the model", async () => {
    generateModelText.mockResolvedValue(modelReply());
    await analyzeSubmission({ text: essay, gradeLevel: "S5", genre: "議論文", taskPrompt: "論逆境" });

    const { user, system } = generateModelText.mock.calls[0][0] as { user: string; system: string };
    expect(user).toContain(`<student_essay>\n${essay}\n</student_essay>`);
    expect(user).toContain("文體：議論文");
    expect(user).toContain("題目：論逆境");
    expect(system).toContain("0–2 個 不扣分");
    expect(system).not.toContain("480");
  });

  it("applies the md caps and counts typos from evidence", async () => {
    generateModelText.mockResolvedValue(modelReply());
    const { result } = await analyzeSubmission({ text: essay, gradeLevel: "S5" });

    // Word count is counted in code, not taken from the model's 999.
    expect(result.word_count).toBeLessThan(400);
    // <400 chars caps content at N=4; structure then follows content N + 1.
    expect(result.scores.content).toBe(16);
    expect(result.scores.structure).toBe(10);
    // Two typos survive realignment (the third span is not in the essay): no deduction.
    expect(result.errors).toHaveLength(2);
    expect(result.typo_count).toBe(2);
    expect(result.typo_bonus).toBe(0);
    // 16 + 24 + 10 + 8 = 58 → Level 3, and content N=4 caps it at Level 3 anyway.
    expect(result.overall_score).toBe(58);
    expect(result.dse_level).toBe("3");
  });

  it("deducts once three typos are evidenced, even if the model reports none", async () => {
    const longEssay = `${essay}${"這是補充的段落，內容充實。".repeat(15)}我已經很努力了，但是還有很多的不足。`;
    generateModelText.mockResolvedValue(
      modelReply({
        scores: { content: 28, expression: 21, structure: 14, punctuation: 7 },
        errors: [typo("公圓"), typo("開新", "形近字"), typo("不足", "錯別字")],
      }),
    );
    const { result } = await analyzeSubmission({ text: longEssay, gradeLevel: "S5" });

    expect(result.word_count).toBeGreaterThanOrEqual(400);
    expect(result.typo_count).toBe(3);
    expect(result.typo_bonus).toBe(-1);
    // 70 − 1 = 69 → Level 4 (Level 5 needs 70 after the deduction).
    expect(result.overall_score).toBe(69);
    expect(result.dse_level).toBe("4");
  });
});
