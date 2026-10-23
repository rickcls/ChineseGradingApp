import { describe, expect, it } from "vitest";
import { DEFAULT_WRITING_RUBRIC, dseLevelFromScore, typoBonus } from "../src/lib/rubric";
import {
  applyShortBoardLevelCap,
  countEvidenceTypos,
  enforceContentLedCap,
  enforceStructureBandCap,
  enforceWordCountContentCap,
} from "../src/lib/scoring";

const rubric = DEFAULT_WRITING_RUBRIC;

function scores(content: number, expression: number, structure: number, punctuation: number) {
  return { content, expression, structure, punctuation };
}

describe("typoBonus (rubric §3.5)", () => {
  it.each([
    [0, 0],
    [2, 0],
    [3, -1],
    [4, -1],
    [5, -2],
    [7, -2],
    [8, -3],
    [20, -3],
  ])("%i typos → %i", (count, expected) => {
    expect(typoBonus(count)).toBe(expected);
  });
});

describe("dseLevelFromScore (rubric part 2 matrix)", () => {
  it.each([
    [100, "5**"],
    [95, "5**"],
    [94, "5*"],
    [90, "5*"],
    [89, "5"],
    [70, "5"],
    [69, "4"],
    [60, "4"],
    [59, "3"],
    [50, "3"],
    [49, "2"],
    [30, "2"],
    [29, "1"],
    [20, "1"],
    [19, "U"],
  ])("%i → Level %s", (score, level) => {
    expect(dseLevelFromScore(score)).toBe(level);
  });
});

describe("enforceWordCountContentCap", () => {
  it("caps content at N=4 below 400 characters", () => {
    const s = scores(30, 20, 14, 7);
    enforceWordCountContentCap(s, rubric, 399);
    expect(s.content).toBe(16);
  });

  it("leaves content alone from 400 characters", () => {
    const s = scores(30, 20, 14, 7);
    enforceWordCountContentCap(s, rubric, 400);
    expect(s.content).toBe(30);
  });
});

describe("enforceStructureBandCap", () => {
  it("allows structure one band above content", () => {
    const s = scores(24, 18, 14, 7);
    enforceStructureBandCap(s, rubric);
    expect(s.structure).toBe(14);
  });

  it("clamps structure more than one band above content", () => {
    const s = scores(24, 18, 16, 7);
    enforceStructureBandCap(s, rubric);
    expect(s.structure).toBe(14);
  });

  it("uses the proportional band for in-between content scores", () => {
    const s = scores(26, 18, 20, 7);
    enforceStructureBandCap(s, rubric);
    expect(s.structure).toBe(15);
  });

  it("never exceeds the structure maximum", () => {
    const s = scores(40, 30, 20, 10);
    enforceStructureBandCap(s, rubric);
    expect(s.structure).toBe(20);
  });
});

describe("enforceContentLedCap (rubric §3.3)", () => {
  it("caps expression and structure at N=4 when content is N<=2", () => {
    const s = scores(8, 20, 10, 6);
    enforceContentLedCap(s, rubric);
    expect(s).toEqual(scores(8, 12, 8, 6));
  });

  it("does nothing when content is above N=2", () => {
    const s = scores(9, 20, 10, 6);
    enforceContentLedCap(s, rubric);
    expect(s).toEqual(scores(9, 20, 10, 6));
  });
});

describe("applyShortBoardLevelCap", () => {
  it("caps at Level 4 when any criterion is N<=6", () => {
    expect(applyShortBoardLevelCap("5*", scores(36, 27, 18, 6), rubric)).toBe("4");
  });

  it("caps at Level 3 when any criterion is N<=4", () => {
    expect(applyShortBoardLevelCap("5", scores(16, 24, 16, 8), rubric)).toBe("3");
  });

  it("keeps the level when every criterion is N>=7", () => {
    expect(applyShortBoardLevelCap("5", scores(28, 21, 14, 7), rubric)).toBe("5");
  });
});

describe("countEvidenceTypos", () => {
  it("counts only 字詞 typo subcategories", () => {
    expect(
      countEvidenceTypos([
        { category: "字詞", subcategory: "錯別字" },
        { category: "字詞", subcategory: "形近字" },
        { category: "字詞", subcategory: "同音字" },
        { category: "字詞", subcategory: "詞語搭配不當" },
        { category: "語法", subcategory: "語序" },
      ]),
    ).toBe(3);
  });
});
