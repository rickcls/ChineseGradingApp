import { describe, expect, it } from "vitest";
import { layoutManuscript, markKindFor } from "../src/lib/manuscript";

const chars = (row: { char: string }[]) => row.map((cell) => cell.char || "_").join("");

describe("layoutManuscript", () => {
  it("indents each paragraph by two cells and starts it on a new row", () => {
    const rows = layoutManuscript("春天來了。\n花開了。", [], 10);
    expect(rows.map(chars)).toEqual(["__春天來了。___", "__花開了。____"]);
  });

  it("wraps long paragraphs across rows", () => {
    const rows = layoutManuscript("一二三四五六七八九十", [], 6);
    expect(rows.map(chars)).toEqual(["__一二三四", "五六七八九十"]);
  });

  it("keeps a student's own full-width indent and skips blank lines", () => {
    const rows = layoutManuscript("　　我們\n\n\n  你們", [], 6);
    expect(rows.map(chars)).toEqual(["　　我們__", "__你們__"]);
  });

  it("maps UTF-16 offsets, including characters outside the BMP", () => {
    const text = "𠀋字";
    const [row] = layoutManuscript(text, [{ start: 2, end: 3, kind: "circle" }], 4);
    expect(row[2]).toMatchObject({ char: "𠀋", offset: 0, mark: null });
    expect(row[3]).toMatchObject({ char: "字", offset: 2, mark: "circle", marker: 1 });
  });

  it("numbers spans in reading order and lets circles win over underlines", () => {
    const text = "我已經很努力了";
    const [row] = layoutManuscript(
      text,
      [
        { start: 3, end: 6, kind: "wavy" },
        { start: 1, end: 2, kind: "circle" },
        { start: 1, end: 4, kind: "wavy" },
      ],
      9,
    );
    const byChar = Object.fromEntries(row.filter((c) => c.offset !== null).map((c) => [c.char, c]));
    expect(byChar["已"]).toMatchObject({ mark: "circle", marker: 1 });
    expect(byChar["經"]).toMatchObject({ mark: "wavy", marker: 2 });
    expect(byChar["很"]).toMatchObject({ mark: "wavy", marker: 3 });
    expect(byChar["了"].mark).toBeNull();
  });
});

describe("punctuation spans", () => {
  it("circle only the punctuation marks in the span", () => {
    const text = "我們去公園，然後吃飯，再回家。";
    const [row] = layoutManuscript(text, [{ start: 0, end: text.length, kind: "punctuation" }], 20);
    const circled = row.filter((c) => c.mark === "circle").map((c) => c.char);
    expect(circled).toEqual(["，", "，", "。"]);
    expect(row.filter((c) => c.mark === "wavy")).toEqual([]);
  });

  it("fall back to an underline when the span has no punctuation", () => {
    const [row] = layoutManuscript("我回家吃飯", [{ start: 0, end: 5, kind: "punctuation" }], 8);
    expect(row.filter((c) => c.offset !== null).every((c) => c.mark === "wavy")).toBe(true);
  });
});

describe("markKindFor", () => {
  it("circles typos and punctuation, underlines the rest", () => {
    expect(markKindFor({ category: "字詞", subcategory: "錯別字" })).toBe("circle");
    expect(markKindFor({ category: "標點", subcategory: "一逗到底" })).toBe("punctuation");
    expect(markKindFor({ category: "字詞", subcategory: "詞語搭配不當" })).toBe("wavy");
    expect(markKindFor({ category: "表達", subcategory: "粵語入文" })).toBe("wavy");
  });
});
