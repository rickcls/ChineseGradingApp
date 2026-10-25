import { describe, expect, it } from "vitest";
import { buildCreditReason, formatCreditReason, isUsageReason } from "../src/lib/creditReasons";

describe("credit reasons", () => {
  it("shows stored codes in Chinese, with an admin's note", () => {
    expect(formatCreditReason("essay_submission")).toBe("提交文章");
    expect(formatCreditReason("revision_regrade_refund")).toBe("重新評分失敗退回");
    expect(formatCreditReason(buildCreditReason("class_distribution", " 第一次作文 "))).toBe("課堂派發：第一次作文");
  });

  it("keeps free-text reasons from before as they are", () => {
    expect(formatCreditReason("bonus for helping")).toBe("bonus for helping");
  });

  it("stores the code alone when there is no note and caps long notes", () => {
    expect(buildCreditReason("testing", "   ")).toBe("testing");
    expect(buildCreditReason("testing", "長".repeat(200))).toHaveLength("testing：".length + 120);
  });

  it("tells grading usage from admin changes", () => {
    expect(isUsageReason("essay_submission")).toBe(true);
    expect(isUsageReason("revision_regrade_refund")).toBe(true);
    expect(isUsageReason("class_distribution")).toBe(false);
    expect(isUsageReason("initial_free_credits")).toBe(false);
  });
});
