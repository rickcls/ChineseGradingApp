"use client";

import { useState } from "react";
import {
  NOTEBOOK_FOCUS_TAGS,
  parseTagInput,
  type NotebookEntrySummary,
} from "@/lib/notebook";

type SubmissionOption = {
  id: string;
  label: string;
};

type NotebookWorkspaceProps = {
  initialEntries: NotebookEntrySummary[];
  submissionOptions: SubmissionOption[];
};

export function NotebookWorkspace({
  initialEntries,
  submissionOptions,
}: NotebookWorkspaceProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [search, setSearch] = useState("");
  const [focusFilter, setFocusFilter] = useState("");
  const [submissionFilter, setSubmissionFilter] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftFocusTag, setDraftFocusTag] = useState("");
  const [draftTags, setDraftTags] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editFocusTag, setEditFocusTag] = useState("");
  const [editTags, setEditTags] = useState("");

  const filteredEntries = entries.filter((entry) => {
    if (focusFilter && entry.focusTag !== focusFilter) return false;
    if (submissionFilter && entry.submissionId !== submissionFilter) return false;

    if (!search.trim()) return true;
    const query = search.trim().toLowerCase();
    const haystack = [entry.title, entry.content, entry.focusTag, entry.submissionPreview, ...entry.tags]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });

  async function createEntry() {
    if (draftContent.trim().length < 2) {
      setError("先寫下一條真正想帶走的提醒。");
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
          focusTag: draftFocusTag || undefined,
          tags: parseTagInput(draftTags),
          submissionId: submissionFilter || undefined,
        }),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.entry) {
        throw new Error(typeof body?.error === "string" ? body.error : "暫時未能儲存筆記。");
      }

      setEntries((current) => [body.entry as NotebookEntrySummary, ...current]);
      setDraftTitle("");
      setDraftContent("");
      setDraftFocusTag("");
      setDraftTags("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "暫時未能儲存筆記。");
    } finally {
      setSubmitting(false);
    }
  }

  function startEditing(entry: NotebookEntrySummary) {
    setEditingId(entry.id);
    setEditTitle(entry.title || "");
    setEditContent(entry.content);
    setEditFocusTag(entry.focusTag || "");
    setEditTags(entry.tags.join(", "));
  }

  async function saveEdit(entryId: string) {
    try {
      const response = await fetch(`/api/notebook/${entryId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim() || undefined,
          content: editContent.trim(),
          focusTag: editFocusTag || undefined,
          tags: parseTagInput(editTags),
        }),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.entry) {
        throw new Error(typeof body?.error === "string" ? body.error : "暫時未能更新筆記。");
      }

      setEntries((current) => current.map((entry) => (entry.id === entryId ? (body.entry as NotebookEntrySummary) : entry)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "暫時未能更新筆記。");
    }
  }

  async function deleteEntry(entryId: string) {
    try {
      const response = await fetch(`/api/notebook/${entryId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "暫時未能刪除筆記。");
      }

      setEntries((current) => current.filter((entry) => entry.id !== entryId));
      if (editingId === entryId) {
        setEditingId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "暫時未能刪除筆記。");
    }
  }

  const phraseCount = entries.filter((entry) => entry.entryType === "phrase").length;
  const lessonCount = entries.filter((entry) => entry.entryType === "lesson").length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="paper-panel p-5 sm:p-6">
          <p className="section-kicker">快速記錄</p>
          <h2 className="mt-2 text-2xl">把值得帶走的東西收進來</h2>
          <p className="mt-2 text-sm leading-7 text-ink/75">
            可以記句式、提醒、或你下一篇想刻意練的方向。先用自己的話記住，比囤很多內容卻不會回看更有用。
          </p>

          <div className="mt-4 grid gap-3">
            <label className="block">
              <span className="field-label">標題（可選）</span>
              <input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                className="field-input"
                placeholder="例如：如何把結尾寫得更有力"
              />
            </label>

            <label className="block">
              <span className="field-label">內容</span>
              <textarea
                value={draftContent}
                onChange={(event) => setDraftContent(event.target.value)}
                rows={5}
                className="field-input resize-y leading-7"
                placeholder="例如：結尾不要只停在事件結束，要補一句『這件事讓我明白……』，讓主題真正落地。"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
              <label className="block">
                <span className="field-label">重點分類</span>
                <select value={draftFocusTag} onChange={(event) => setDraftFocusTag(event.target.value)} className="field-input">
                  <option value="">未分類</option>
                  {NOTEBOOK_FOCUS_TAGS.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="field-label">自訂標籤</span>
                <input
                  value={draftTags}
                  onChange={(event) => setDraftTags(event.target.value)}
                  className="field-input"
                  placeholder="例如：情感、過渡、開頭"
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
              目前共有 {entries.length} 則筆記，其中 {phraseCount} 則句式收藏、{lessonCount} 則提醒。
            </span>
            <button
              type="button"
              onClick={createEntry}
              disabled={submitting || draftContent.trim().length < 2}
              className="btn-primary"
            >
              {submitting ? "儲存中…" : "加入筆記本"}
            </button>
          </div>
        </div>

        <div className="paper-panel p-5 sm:p-6">
          <p className="section-kicker">整理方式</p>
          <h2 className="mt-2 text-2xl">先用篩選把真正想回看的內容找出來</h2>

          <div className="mt-4 grid gap-3">
            <label className="block">
              <span className="field-label">搜尋</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="field-input"
                placeholder="搜尋標題、內容、標籤或文章片段"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="field-label">按重點分類</span>
                <select value={focusFilter} onChange={(event) => setFocusFilter(event.target.value)} className="field-input">
                  <option value="">全部分類</option>
                  {NOTEBOOK_FOCUS_TAGS.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="field-label">按文章篩選</span>
                <select
                  value={submissionFilter}
                  onChange={(event) => setSubmissionFilter(event.target.value)}
                  className="field-input"
                >
                  <option value="">全部文章</option>
                  {submissionOptions.map((submission) => (
                    <option key={submission.id} value={submission.id}>
                      {submission.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <StatCard label="全部筆記" value={`${entries.length}`} />
            <StatCard label="篩選結果" value={`${filteredEntries.length}`} tone="primary" />
            <StatCard label="有分類" value={`${entries.filter((entry) => Boolean(entry.focusTag)).length}`} tone="positive" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-kicker">全部筆記</p>
            <h2 className="mt-2 text-2xl">不是收藏越多越好，而是下次真的會拿出來用</h2>
          </div>
          <span className="pill">{filteredEntries.length} 則顯示中</span>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="paper-panel p-5 text-sm leading-7 text-muted">
            目前沒有符合篩選條件的筆記。可以先清除篩選，或新增一則你想帶走的提醒。
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredEntries.map((entry) => {
              const editing = editingId === entry.id;

              return (
                <article key={entry.id} className="paper-panel p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
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

                      {editing ? (
                        <input
                          value={editTitle}
                          onChange={(event) => setEditTitle(event.target.value)}
                          className="field-input"
                          placeholder="標題（可選）"
                        />
                      ) : entry.title ? (
                        <h3 className="text-xl text-ink">{entry.title}</h3>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {editing ? (
                        <>
                          <button type="button" onClick={() => saveEdit(entry.id)} className="btn-primary px-4 py-2 text-xs">
                            儲存修改
                          </button>
                          <button type="button" onClick={() => setEditingId(null)} className="btn-secondary px-4 py-2 text-xs">
                            取消
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => startEditing(entry)} className="btn-secondary px-4 py-2 text-xs">
                            編輯
                          </button>
                          <button type="button" onClick={() => deleteEntry(entry.id)} className="btn-secondary px-4 py-2 text-xs">
                            刪除
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {editing ? (
                    <div className="mt-4 grid gap-3">
                      <textarea
                        value={editContent}
                        onChange={(event) => setEditContent(event.target.value)}
                        rows={4}
                        className="field-input resize-y leading-7"
                      />

                      <div className="grid gap-3 sm:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
                        <select value={editFocusTag} onChange={(event) => setEditFocusTag(event.target.value)} className="field-input">
                          <option value="">未分類</option>
                          {NOTEBOOK_FOCUS_TAGS.map((tag) => (
                            <option key={tag} value={tag}>
                              {tag}
                            </option>
                          ))}
                        </select>
                        <input
                          value={editTags}
                          onChange={(event) => setEditTags(event.target.value)}
                          className="field-input"
                          placeholder="標籤，用逗號分隔"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="mt-4 text-sm leading-7 text-ink/85">{entry.content}</p>

                      {entry.sourceBeforeText || entry.sourceAfterText ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {entry.sourceBeforeText ? (
                            <div className="rounded-[1rem] border border-border/70 bg-paper/70 px-4 py-3">
                              <p className="text-[0.68rem] tracking-[0.16em] text-muted">原文片段</p>
                              <p className="mt-2 font-serif text-sm leading-7 text-ink/80">{entry.sourceBeforeText}</p>
                            </div>
                          ) : null}
                          {entry.sourceAfterText ? (
                            <div className="rounded-[1rem] border border-good/30 bg-good/10 px-4 py-3">
                              <p className="text-[0.68rem] tracking-[0.16em] text-good">參考片段</p>
                              <p className="mt-2 font-serif text-sm leading-7 text-ink">{entry.sourceAfterText}</p>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  )}

                  {entry.tags.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {entry.tags.map((tag) => (
                        <span key={`${entry.id}-${tag}`} className="pill bg-white/85">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "primary" | "positive";
}) {
  const toneClass =
    tone === "primary"
      ? "border-accent/20 bg-accent/5"
      : tone === "positive"
        ? "border-good/20 bg-good/10"
        : "border-border/70 bg-white/80";

  return (
    <div className={["rounded-[1rem] border px-4 py-4 shadow-soft", toneClass].join(" ")}>
      <p className="section-kicker">{label}</p>
      <div className="mt-2 text-3xl text-ink">{value}</div>
    </div>
  );
}
