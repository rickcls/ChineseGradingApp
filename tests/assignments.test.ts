import { describe, expect, it } from "vitest";
import {
  AssignmentInput,
  AssignmentUpdate,
  assignmentProgress,
  commonIssues,
  dateFromDueAt,
  dueAtFromDate,
  levelDistribution,
  modelPassageLocked,
} from "../src/lib/assignments";

describe("AssignmentInput", () => {
  it("accepts a topic with an optional genre, instructions and due date", () => {
    const parsed = AssignmentInput.safeParse({ classId: "c1", taskPrompt: " 那一次，我終於明白了 ", genre: "記敘抒情文", dueDate: "2026-10-31" });
    expect(parsed.success && parsed.data.taskPrompt).toBe("那一次，我終於明白了");
  });

  it("rejects an unknown genre, a one-character topic and a non-date due date", () => {
    expect(AssignmentInput.safeParse({ classId: "c1", taskPrompt: "題目", genre: "小說" }).success).toBe(false);
    expect(AssignmentInput.safeParse({ classId: "c1", taskPrompt: "題" }).success).toBe(false);
    expect(AssignmentInput.safeParse({ classId: "c1", taskPrompt: "題目", dueDate: "31/10/2026" }).success).toBe(false);
  });

  it("requires an update to change something", () => {
    expect(AssignmentUpdate.safeParse({}).success).toBe(false);
    expect(AssignmentUpdate.safeParse({ modelPassageReleased: true }).success).toBe(true);
    expect(AssignmentUpdate.safeParse({ dueDate: null }).success).toBe(true);
  });
});

describe("due dates", () => {
  it("are due at the end of the day in Hong Kong", () => {
    const dueAt = dueAtFromDate("2026-10-31");
    expect(dueAt.toISOString()).toBe("2026-10-31T15:59:59.000Z");
    expect(dateFromDueAt(dueAt)).toBe("2026-10-31");
  });
});

describe("assignmentProgress", () => {
  const due = new Date("2026-10-31T15:59:59Z");
  const before = new Date("2026-10-30T10:00:00Z");
  const after = new Date("2026-11-01T10:00:00Z");

  it("judges lateness on the first submission", () => {
    expect(assignmentProgress(due, before, after)).toBe("submitted");
    expect(assignmentProgress(due, after, after)).toBe("late");
    expect(assignmentProgress(null, after, after)).toBe("submitted");
  });

  it("marks missing work overdue only after the due date", () => {
    expect(assignmentProgress(due, null, before)).toBe("not_submitted");
    expect(assignmentProgress(due, null, after)).toBe("overdue");
    expect(assignmentProgress(null, null, after)).toBe("not_submitted");
  });
});

describe("modelPassageLocked", () => {
  it("locks only unreleased assignment essays", () => {
    expect(modelPassageLocked({ assignment: null })).toBe(false);
    expect(modelPassageLocked({ assignment: { modelPassageReleased: false } })).toBe(true);
    expect(modelPassageLocked({ assignment: { modelPassageReleased: true } })).toBe(false);
  });
});

describe("commonIssues", () => {
  const error = (subcategory: string, extra: Partial<{ ocrSuspect: boolean; studentReaction: string | null }> = {}) => ({
    category: subcategory === "錯別字" ? "字詞" : "表達",
    subcategory,
    ocrSuspect: false,
    studentReaction: null,
    ...extra,
  });

  it("ranks problems by how many students have them, counting each student once", () => {
    const issues = commonIssues([
      { errors: [error("粵語入文"), error("粵語入文"), error("粵語入文"), error("錯別字")] },
      { errors: [error("錯別字"), error("用詞單一")] },
      { errors: [error("錯別字")] },
    ]);
    expect(issues.slice(0, 2)).toEqual([
      { category: "字詞", subcategory: "錯別字", students: 3, occurrences: 3 },
      { category: "表達", subcategory: "粵語入文", students: 1, occurrences: 3 },
    ]);
  });

  it("leaves out OCR suspects and annotations students reported as wrong", () => {
    const issues = commonIssues([
      { errors: [error("錯別字", { ocrSuspect: true }), error("粵語入文", { studentReaction: "wrong" })] },
    ]);
    expect(issues).toEqual([]);
  });
});

describe("levelDistribution", () => {
  it("counts levels highest first and ignores unknown values", () => {
    expect(levelDistribution(["4", "5", "4", "3", "", "6"])).toEqual([
      { level: "5", count: 1 },
      { level: "4", count: 2 },
      { level: "3", count: 1 },
    ]);
  });
});
