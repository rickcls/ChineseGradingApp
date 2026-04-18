"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RevisionComposerProps = {
  submissionId: string;
  originalText: string;
  priorities: string[];
  hasExistingRevision: boolean;
};

export function RevisionComposer({
  submissionId,
  originalText,
  priorities,
  hasExistingRevision,
}: RevisionComposerProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(originalText);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const originalCount = Array.from(originalText).length;
  const draftCount = Array.from(draft).length;
  const hasChanged = draft.trim() !== originalText.trim();

  async function submitRevision() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/submissions/${submissionId}/revision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ revisedText: draft }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "暫時未能儲存修訂。" }));
        throw new Error(typeof body?.error === "string" ? body.error : "暫時未能儲存修訂。");
      }

      router.push(`/submissions/${submissionId}/compare`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "暫時未能儲存修訂。");
      setSubmitting(false);
    }
  }

  return (
    <section className="paper-panel-strong p-6 sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <p className="section-kicker">訂正工作台</p>
          <div>
            <h2 className="text-2xl">先挑 1–2 項重點來改，壓力會小很多</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-ink/75">
              你可以直接在原文上修改，完成後我會幫你整理成修改前後對照，讓你更容易看見自己的進步。
            </p>
          </div>
        </div>
        {hasExistingRevision ? (
          <button type="button" onClick={() => router.push(`/submissions/${submissionId}/compare`)} className="btn-secondary">
            查看最近一次對照
          </button>
        ) : null}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="space-y-4">
          <div className="paper-panel-muted p-4">
            <p className="section-kicker">這次先看這些</p>
            <ul className="mt-3 space-y-3">
              {priorities.map((priority, index) => (
                <li
                  key={`${priority}-${index}`}
                  className="rounded-2xl border border-border/70 bg-white/80 px-4 py-3 text-sm leading-7 text-ink/80"
                >
                  {priority}
                </li>
              ))}
            </ul>
          </div>
          <div className="paper-panel-muted p-4 text-sm leading-7 text-ink/75">
            <p className="font-medium text-ink">導師提醒</p>
            <p className="mt-2">
              不用追求一下子全改完。先把最想說清楚的一段修順，再回頭看字詞和標點，會更輕鬆。
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="field-label">你的修訂版本</span>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={14}
              className="field-input min-h-[22rem] resize-y font-serif leading-8"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-white/75 px-4 py-3 text-sm text-ink/75">
            <div className="flex flex-wrap gap-3">
              <span className="pill">{originalCount} 字原稿</span>
              <span className="pill pill-positive">{draftCount} 字修訂稿</span>
            </div>
            <span className="text-xs text-muted">
              {hasChanged ? "已偵測到你的修改，完成後可查看前後對照。" : "先改動幾句看看，這裡就會記錄你的新版本。"}
            </span>
          </div>

          {error ? (
            <div className="rounded-2xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-ink/80">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs leading-6 text-muted">
              這一步只會儲存你的修訂版本，不會立刻重新評分。
            </p>
            <button
              type="button"
              onClick={submitRevision}
              disabled={submitting || !hasChanged || draft.trim().length < 20}
              className="btn-primary"
            >
              {submitting ? "正在整理前後對照…" : "儲存修訂並查看對照"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
