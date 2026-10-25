// Credit transaction reasons: the codes stored in CreditTransaction.reason and
// how the admin pages show them. An admin's optional note is stored after "：".

const REASON_LABELS: Record<string, string> = {
  essay_submission: "提交文章",
  essay_submission_refund: "批改失敗退回",
  revision_regrade: "重新評分",
  revision_regrade_refund: "重新評分失敗退回",
  initial_free_credits: "新用戶贈送",
  admin_adjustment: "管理員調整",
  class_distribution: "課堂派發",
  compensation: "補償",
  testing: "測試",
};

// Reasons an admin can pick when adding or removing credits.
export const ADMIN_CREDIT_REASONS = [
  { value: "class_distribution", label: "課堂派發" },
  { value: "compensation", label: "補償（例如批改出錯）" },
  { value: "testing", label: "測試" },
  { value: "admin_adjustment", label: "其他" },
] as const;

export const ADMIN_REASON_VALUES = ADMIN_CREDIT_REASONS.map((reason) => reason.value) as [string, ...string[]];

const NOTE_SEPARATOR = "：";

export function buildCreditReason(code: string, note?: string): string {
  const trimmed = note?.trim();
  return trimmed ? `${code}${NOTE_SEPARATOR}${trimmed.slice(0, 120)}` : code;
}

export function formatCreditReason(reason: string): string {
  const separator = reason.indexOf(NOTE_SEPARATOR);
  const code = separator === -1 ? reason : reason.slice(0, separator);
  const note = separator === -1 ? "" : reason.slice(separator + NOTE_SEPARATOR.length);
  const label = REASON_LABELS[code];
  if (!label) return reason;
  return note ? `${label}：${note}` : label;
}

// Recorded automatically when essays are graded or refunded.
export const USAGE_REASONS = ["essay_submission", "essay_submission_refund", "revision_regrade", "revision_regrade_refund"];

export function isUsageReason(reason: string): boolean {
  return USAGE_REASONS.includes(reason);
}
