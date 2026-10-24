"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_WRITING_RUBRIC, DSE_LEVELS, dseLevelFromScore, typoBonus } from "@/lib/rubric";

type TeacherReviewFormProps = {
  submissionId: string;
  initial: {
    scores: Record<string, number>;
    typoCount: number | null;
    dseLevel: string;
    comment: string;
  };
  hasExistingReview: boolean;
};

export function TeacherReviewForm({ submissionId, initial, hasExistingReview }: TeacherReviewFormProps) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      DEFAULT_WRITING_RUBRIC.criteria.map((criterion) => [criterion.key, String(initial.scores[criterion.key] ?? 0)]),
    ),
  );
  const [typoCount, setTypoCount] = useState(initial.typoCount === null ? "" : String(initial.typoCount));
  const [dseLevel, setDseLevel] = useState(initial.dseLevel);
  const [comment, setComment] = useState(initial.comment);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const numericScores = Object.fromEntries(
    DEFAULT_WRITING_RUBRIC.criteria.map((criterion) => [criterion.key, Number(scores[criterion.key])]),
  );
  const scoresValid = DEFAULT_WRITING_RUBRIC.criteria.every((criterion) => {
    const value = numericScores[criterion.key];
    return Number.isInteger(value) && value >= 0 && value <= criterion.maxScore;
  });
  const typoValue = typoCount.trim() === "" ? null : Number(typoCount);
  const typoValid = typoValue === null || (Number.isInteger(typoValue) && typoValue >= 0);
  const total = Object.values(numericScores).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  const finalScore = total + (typoValue === null || !typoValid ? 0 : typoBonus(typoValue));
  const suggestedLevel = dseLevelFromScore(finalScore);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!scoresValid || !typoValid) return;
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/teacher/submissions/${submissionId}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scores: numericScores,
          typoCount: typoValue,
          dseLevel,
          comment: comment.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
        throw new Error(typeof body?.error === "string" ? body.error : "儲存失敗，請稍後再試。");
      }
      setMessage({ tone: "good", text: "已儲存，學生會在作品頁看到你的評分。" });
      router.refresh();
    } catch (err) {
      setMessage({ tone: "bad", text: err instanceof Error ? err.message : "儲存失敗，請稍後再試。" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {DEFAULT_WRITING_RUBRIC.criteria.map((criterion) => (
          <label key={criterion.key} className="block">
            <span className="field-label">
              {criterion.label}（0–{criterion.maxScore}）
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={criterion.maxScore}
              step={1}
              value={scores[criterion.key]}
              onChange={(event) => setScores((current) => ({ ...current, [criterion.key]: event.target.value }))}
              className="field-input"
              required
            />
          </label>
        ))}
        <label className="block">
          <span className="field-label">錯別字數（可選）</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={typoCount}
            onChange={(event) => setTypoCount(event.target.value)}
            className="field-input"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <label className="block">
          <span className="field-label">老師評定等級</span>
          <select value={dseLevel} onChange={(event) => setDseLevel(event.target.value)} className="field-input">
            {DSE_LEVELS.map((level) => (
              <option key={level} value={level}>
                Level {level}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted">
            按分數推算：Level {suggestedLevel}（總分 {finalScore}）
          </span>
        </label>
        <label className="block">
          <span className="field-label">給學生的評語（可選）</span>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            maxLength={2000}
            className="field-input resize-y"
          />
        </label>
      </div>

      {!scoresValid || !typoValid ? (
        <p className="text-xs text-coral">請輸入範圍內的整數分數。</p>
      ) : null}
      {message ? (
        <p className={["text-sm", message.tone === "good" ? "text-good" : "text-coral"].join(" ")}>{message.text}</p>
      ) : null}

      <button type="submit" className="btn-primary" disabled={saving || !scoresValid || !typoValid} aria-busy={saving}>
        <span className="inline-flex items-center gap-2">
          {saving ? <span aria-hidden="true" className="pending-spinner" /> : null}
          <span>{hasExistingReview ? "更新覆核" : "儲存覆核"}</span>
        </span>
      </button>
    </form>
  );
}
