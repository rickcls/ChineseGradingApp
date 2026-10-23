import { describe, expect, it } from "vitest";
import { detectHkIssues, hkIssuesPromptBlock, missedCantoneseErrors } from "../src/lib/hkLexicon";
import { validCategory } from "../src/lib/taxonomy";

function cantonese(text: string) {
  return detectHkIssues(text).filter((hit) => hit.kind === "cantonese");
}

describe("detectHkIssues: Cantonese", () => {
  it("prefers the longest entry and keeps exact offsets", () => {
    const text = "放學後佢哋去咗公園。";
    const hits = cantonese(text);
    expect(hits.map((h) => [h.text, h.start, h.end, h.hint])).toEqual([
      ["佢哋", 3, 5, "他們"],
      ["咗", 6, 7, "了"],
    ]);
    expect(hits.every((h) => h.certain && !h.inQuote)).toBe(true);
  });

  it("marks context-dependent words as uncertain", () => {
    const [hit] = cantonese("老師的重點解說很清楚。");
    expect(hit.text).toBe("點解");
    expect(hit.certain).toBe(false);
  });

  it("flags hits inside quotation marks", () => {
    const [hit] = cantonese("媽媽說：「我唔知呀。」");
    expect(hit.text).toBe("唔知");
    expect(hit.inQuote).toBe(true);
  });

  it("finds nothing in standard written Chinese", () => {
    const text = "我們在學校裏學習，老師說這個問題很重要。他們的關係很好，你呢？";
    expect(detectHkIssues(text)).toEqual([]);
  });
});

describe("detectHkIssues: Europeanised and run-on sentences", () => {
  it.each([
    ["我們作出了一個重要的決定。", "作出了一個重要的決定"],
    ["在沒有老師幫助的情況下，他完成了功課。", "在沒有老師幫助的情況下"],
    ["當我回到家的時候，天已經黑了。", "當我回到家的時候"],
    ["大家對這件事進行討論。", "進行討論"],
  ])("finds the pattern in %s", (text, expected) => {
    const hits = detectHkIssues(text).filter((hit) => hit.kind === "europeanised");
    expect(hits.map((h) => h.text)).toContain(expected);
    expect(hits.every((h) => !h.certain)).toBe(true);
  });

  it("flags a long sentence strung together with commas", () => {
    const clause = "我們一起走到海邊看日落";
    const sentence = `${Array(8).fill(clause).join("，")}。`;
    const [hit] = detectHkIssues(sentence).filter((h) => h.kind === "run_on");
    expect(hit.start).toBe(0);
    expect(hit.end).toBe(sentence.length);
  });

  it("ignores ordinary sentences with a few commas", () => {
    expect(detectHkIssues("我喜歡春天，因為天氣溫暖，花也開了。").filter((h) => h.kind === "run_on")).toEqual([]);
  });
});

describe("hkIssuesPromptBlock", () => {
  it("is omitted when nothing is found", () => {
    expect(hkIssuesPromptBlock([])).toBeNull();
  });

  it("lists each candidate with its written-Chinese alternative", () => {
    const block = hkIssuesPromptBlock(detectHkIssues("佢好開心。"))!;
    expect(block).toContain("[粵語] 「佢」（第 0 字起）→ 書面語：他／她");
  });
});

describe("missedCantoneseErrors", () => {
  const text = "佢哋冇嚟。佢話：「我唔知。」重點解說。";
  const hits = detectHkIssues(text);

  it("adds certain hits outside quotes that the model did not annotate", () => {
    const covered = { char_offset_start: 0, char_offset_end: 2 }; // 佢哋
    const added = missedCantoneseErrors(hits, [covered]);
    expect(added.map((e) => e.evidence_span)).toEqual(["冇", "嚟", "佢"]);
    expect(added.every((e) => validCategory(e.category, e.subcategory))).toBe(true);
    expect(added[0]).toMatchObject({ category: "表達", subcategory: "粵語入文", example_fix: "沒有" });
  });

  it("caps the number of automatic annotations", () => {
    const many = detectHkIssues("嘅".repeat(40));
    expect(missedCantoneseErrors(many, [])).toHaveLength(15);
  });
});
