import { describe, expect, it } from "vitest";
import { formatClock, paceFor, parseDraft, timerSnapshot } from "../src/lib/examTimer";

const MIN = 60_000;

describe("timerSnapshot", () => {
  it("moves through planning, writing and checking phases", () => {
    expect(timerSnapshot(0, 90, 5 * MIN).phase).toBe("plan");
    expect(timerSnapshot(0, 90, 30 * MIN).phase).toBe("write");
    expect(timerSnapshot(0, 90, 85 * MIN).phase).toBe("check");
  });

  it("warns at 15 and 5 minutes left and stops at zero", () => {
    expect(timerSnapshot(0, 90, 74 * MIN).warning).toBeNull();
    expect(timerSnapshot(0, 90, 76 * MIN).warning).toBe("15min");
    expect(timerSnapshot(0, 90, 86 * MIN).warning).toBe("5min");
    const over = timerSnapshot(0, 90, 120 * MIN);
    expect(over).toMatchObject({ expired: true, phase: "over", remainingMs: 0, elapsedMs: 90 * MIN, warning: null });
  });
});

describe("formatClock", () => {
  it.each([
    [2 * 60 * MIN + 15 * MIN, "2:15:00"],
    [29 * MIN + 5_000, "29:05"],
    [59_001, "1:00"],
    [0, "0:00"],
  ])("%i ms → %s", (ms, expected) => {
    expect(formatClock(ms)).toBe(expected);
  });
});

describe("paceFor", () => {
  it("expects no writing during planning", () => {
    expect(paceFor(0, 5 * MIN, 90).status).toBe("planning");
  });

  it("compares characters with an even pace towards 600", () => {
    // Writing window for 90 minutes: 13.5 → 79.2 minutes; halfway ≈ 46.35 minutes.
    const halfway = 46.35 * MIN;
    expect(paceFor(300, halfway, 90)).toMatchObject({ expected: 300, status: "on-track" });
    expect(paceFor(200, halfway, 90).status).toBe("behind");
    expect(paceFor(420, halfway, 90).status).toBe("ahead");
  });
});

describe("parseDraft", () => {
  it("restores a saved draft with its timer", () => {
    const draft = parseDraft(JSON.stringify({ text: "我的文章", taskPrompt: "題目", genre: "議論文", timer: { startedAt: 1, minutes: 90 }, savedAt: 2 }));
    expect(draft).toEqual({ text: "我的文章", taskPrompt: "題目", genre: "議論文", timer: { startedAt: 1, minutes: 90, finishedMs: null }, savedAt: 2 });
  });

  it("ignores empty, malformed or partial drafts", () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft("{not json")).toBeNull();
    expect(parseDraft(JSON.stringify({ text: "   ", savedAt: 1 }))).toBeNull();
    expect(parseDraft(JSON.stringify({ text: "文章", savedAt: 1, timer: { minutes: "90" } }))?.timer).toBeNull();
  });
});
