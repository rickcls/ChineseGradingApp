import { describe, expect, it } from "vitest";
import { deriveStatus } from "../src/lib/weakness";

function windowOf(entries: Array<[count: number, date: string]>) {
  return entries.map(([count, date], index) => ({
    submissionId: `s${index}`,
    count,
    severitySum: count * 2,
    date,
  }));
}

describe("deriveStatus", () => {
  it("stays watching with too little evidence", () => {
    expect(deriveStatus({ windowNext: windowOf([[2, "2026-10-01"]]), evidenceCount: 2 })).toBe("watching");
  });

  it("confirms after 3+ errors across 2 submissions on 2 days", () => {
    const windowNext = windowOf([
      [2, "2026-10-01"],
      [1, "2026-10-02"],
    ]);
    expect(deriveStatus({ windowNext, evidenceCount: 3 })).toBe("confirmed");
  });

  it("marks improving when the last two submissions halve the prior two", () => {
    const windowNext = windowOf([
      [3, "2026-10-01"],
      [3, "2026-10-02"],
      [1, "2026-10-03"],
      [1, "2026-10-04"],
    ]);
    expect(deriveStatus({ windowNext, evidenceCount: 8 })).toBe("improving");
  });

  it("resolves after three clean submissions in a row", () => {
    const windowNext = windowOf([
      [3, "2026-10-01"],
      [0, "2026-10-02"],
      [0, "2026-10-03"],
      [0, "2026-10-04"],
    ]);
    expect(deriveStatus({ windowNext, evidenceCount: 3 })).toBe("resolved");
  });
});
