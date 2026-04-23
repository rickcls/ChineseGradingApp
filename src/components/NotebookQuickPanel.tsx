"use client";

import Link from "next/link";
import { useState } from "react";
import {
  NOTEBOOK_FOCUS_TAGS,
  parseTagInput,
  type NotebookEntrySummary,
} from "@/lib/notebook";

type NotebookQuickPanelProps = {
  entries: NotebookEntrySummary[];
  submissionId?: string;
  onEntryCreated: (entry: NotebookEntrySummary) => void;
  title?: string;
  intro?: string;
};

export function NotebookQuickPanel({
  entries,
  submissionId,
  onEntryCreated,
  title = "學習筆記",
  intro = "把這次學到的句式、提醒或靈感記下來，下次寫作時就不用再從零開始想。",
}: NotebookQuickPanelProps) {
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [focusTag, setFocusTag] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createManualEntry() {
    if (draftContent.trim().length < 2) {
      setError("先寫下一句提醒或一個你想記住的句式。");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/notebook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entryType: "manual",
          title: draftTitle.trim() || undefined,
          content: draftContent.trim(),
          focusTag: focusTag || undefined,
          tags: parseTagInput(tagInput),
          submissionId,
        }),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.entry) {
        throw new Error(typeof body?.error === "string" ? body.error : "暫時未能儲存筆記。");
      }

      onEntryCreated(body.entry as NotebookEntrySummary);
      setDraftTitle("");
      setDraftContent("");
      setFocusTag("");
      setTagInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "暫時未能儲存筆記。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="paper-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-kicker">{title}</p>
          <h3 className="mt-2 text-xl">把這次學到的東西留下來</h3>
        </div>
        <Link href="/notebook" className="btn-secondary px-4 py-2 text-xs">
          打開完整筆記本
        </Link>
      </div>

      <p className="mt-2 text-sm leading-7 text-ink/75">{intro}</p>

      <div className="mt-4 grid gap-3">
        <label className="block">
          <span className="field-label">標題（可選）</span>
          <input
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            className="field-input"
            placeholder="例如：寫結尾時要記得點題"
          />
        </label>

        <label className="block">
          <span className="field-label">這次想記住甚麼？</span>
          <textarea
            value={draftContent}
            onChange={(event) => setDraftContent(event.target.value)}
            rows={4}
            className="field-input resize-y leading-7"
            placeholder="例如：先寫事件，再補一層心情，最後用一句話說清楚這件事對我有甚麼影響。"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
          <label className="block">
            <span className="field-label">重點分類</span>
            <select value={focusTag} onChange={(event) => setFocusTag(event.target.value)} className="field-input">
              <option value="">未分類</option>
              {NOTEBOOK_FOCUS_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="field-label">自訂標籤（用逗號分隔）</span>
            <input
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              className="field-input"
              placeholder="例如：過渡句，情感描寫"
            />
          </label>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-ink/80">
          {error}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs leading-6 text-muted">
          {submissionId ? "這則筆記會連回目前這篇文章。" : "這則筆記會儲存在你的個人筆記本中。"}
        </span>
        <button
          type="button"
          onClick={createManualEntry}
          disabled={submitting || draftContent.trim().length < 2}
          className="btn-primary"
        >
          {submitting ? "儲存中…" : "記下這次提醒"}
        </button>
      </div>

      <div className="mt-5 border-t border-border/60 pt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="section-kicker">最近筆記</p>
            <h4 className="mt-2 text-lg">把已經學過的東西拿回來用</h4>
          </div>
          <span className="pill">{entries.length} 則</span>
        </div>

        {entries.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-border/70 bg-white/75 px-4 py-3 text-sm leading-7 text-muted">
            還沒有筆記也沒關係。看到一句想學的句式、或一條真正有用的提醒時，再收進來就好。
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {entries.map((entry) => (
              <li key={entry.id} className="rounded-[1rem] border border-border/70 bg-white/80 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-[0.68rem] tracking-[0.16em] text-muted">
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 tracking-normal",
                      entry.entryType === "phrase"
                        ? "border border-good/25 bg-good/10 text-good"
                        : entry.entryType === "lesson"
                          ? "border border-accent/20 bg-accent/5 text-accent"
                          : "border border-border/80 bg-paper/80 text-ink/70",
                    ].join(" ")}
                  >
                    {entry.entryType === "phrase" ? "收藏句式" : entry.entryType === "lesson" ? "記下提醒" : "手動筆記"}
                  </span>
                  {entry.focusTag ? <span>{entry.focusTag}</span> : null}
                  {entry.submissionPreview ? <span>來自：{entry.submissionPreview}</span> : null}
                </div>
                {entry.title ? <p className="mt-2 font-medium text-ink">{entry.title}</p> : null}
                <p className={entry.title ? "mt-1 text-sm leading-7 text-ink/80" : "mt-2 text-sm leading-7 text-ink/80"}>
                  {entry.content}
                </p>
                {entry.tags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {entry.tags.map((tag) => (
                      <span key={`${entry.id}-${tag}`} className="pill bg-white/85">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
