import { describe, expect, it } from "vitest";
import { buildOcrSuspectChecker, ocrOriginMask } from "../src/lib/ocrSuspect";

function spanError(text: string, span: string, subcategory = "同音字", category = "字詞") {
  const start = text.indexOf(span);
  return { category, subcategory, char_offset_start: start, char_offset_end: start + span.length };
}

describe("ocrOriginMask", () => {
  it("marks substituted characters as student-typed", () => {
    expect(ocrOriginMask("abcdef", "abXdef")).toEqual([true, true, false, true, true, true]);
  });

  it("marks inserted characters as student-typed", () => {
    expect(ocrOriginMask("abc", "abZZc")).toEqual([true, true, false, false, true]);
  });

  it("handles identical text", () => {
    expect(ocrOriginMask("我們", "我們")).toEqual([true, true]);
  });
});

describe("buildOcrSuspectChecker", () => {
  const ocrText = "我們去□□玩，天氣很好，大家都很開新。";
  const verifiedText = "我們去公圓玩，天氣很好，大家都很開新。";

  it("never flags typed submissions", () => {
    const check = buildOcrSuspectChecker({ source: "typed", ocrText: verifiedText, verifiedText });
    expect(check(spanError(verifiedText, "開新"))).toBe(false);
  });

  it("flags typos left exactly as the OCR produced them", () => {
    const check = buildOcrSuspectChecker({ source: "photo", ocrText, verifiedText });
    expect(check(spanError(verifiedText, "開新"))).toBe(true);
  });

  it("trusts typos the student typed while verifying", () => {
    const check = buildOcrSuspectChecker({ source: "photo", ocrText, verifiedText });
    expect(check(spanError(verifiedText, "公圓"))).toBe(false);
  });

  it("does not flag non-character errors in OCR text", () => {
    const check = buildOcrSuspectChecker({ source: "scan", ocrText, verifiedText });
    expect(check(spanError(verifiedText, "天氣很好", "成分殘缺", "語法"))).toBe(false);
  });

  it("flags any error overlapping an unresolved placeholder", () => {
    const text = "我們去□園玩。";
    const check = buildOcrSuspectChecker({ source: "photo", ocrText: text, verifiedText: text });
    expect(check(spanError(text, "去□園", "語序", "語法"))).toBe(true);
  });

  it("treats every character as OCR output when the transcript is missing", () => {
    const check = buildOcrSuspectChecker({ source: "photo", ocrText: null, verifiedText });
    expect(check(spanError(verifiedText, "公圓"))).toBe(true);
  });
});
