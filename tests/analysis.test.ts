import { describe, expect, it } from "vitest";
import { extractJson, realignErrorOffsets, type AnalysisError } from "../src/lib/analysis";

function error(span: string, start: number): AnalysisError {
  return {
    category: "字詞",
    subcategory: "錯別字",
    evidence_span: span,
    char_offset_start: start,
    char_offset_end: start + span.length,
    suggestion: "改正",
    severity: 1,
    confidence: 0.9,
  };
}

describe("extractJson", () => {
  it("unwraps fenced JSON", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("drops prose around the object", () => {
    expect(extractJson('評分如下：{"a":{"b":2}} 完')).toBe('{"a":{"b":2}}');
  });
});

describe("realignErrorOffsets", () => {
  const text = "我今天很開心，因為我今天去了公圓。";

  it("relocates a span whose offsets the model miscounted", () => {
    const fixed = realignErrorOffsets(error("公圓", 3), text);
    expect(fixed?.char_offset_start).toBe(text.indexOf("公圓"));
    expect(fixed?.char_offset_end).toBe(text.indexOf("公圓") + 2);
  });

  it("picks the occurrence closest to the model's hint", () => {
    const second = text.lastIndexOf("今天");
    expect(realignErrorOffsets(error("今天", second - 1), text)?.char_offset_start).toBe(second);
  });

  it("trims whitespace around the quoted span", () => {
    const fixed = realignErrorOffsets(error(" 公圓 ", 0), text);
    expect(fixed?.evidence_span).toBe("公圓");
  });

  it("drops errors whose span is not in the text", () => {
    expect(realignErrorOffsets(error("公園", 0), text)).toBeNull();
  });
});
