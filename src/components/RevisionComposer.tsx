"use client";

import { useState } from "react";
import { NotebookQuickPanel } from "@/components/NotebookQuickPanel";
import type { NotebookEntrySummary } from "@/lib/notebook";
import type { RevisionSuggestionCard } from "@/lib/revisionSuggestions";

type RevisionComposerProps = {
  submissionId: string;
  originalText: string;
  priorities: string[];
  hasExistingRevision: boolean;
  aiSuggestions: RevisionSuggestionCard[];
  recentNotebookEntries: NotebookEntrySummary[];
};

type SupportTool = "none" | "notebook";

export function RevisionComposer({
  submissionId,
  originalText,
  priorities,
  hasExistingRevision,
  aiSuggestions,
  recentNotebookEntries,
}: RevisionComposerProps) {
  const [draft, setDraft] = useState(originalText);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSuggestionId, setActiveSuggestionId] = useState<string | null>(aiSuggestions[0]?.id ?? null);
  const [activeSupportTool, setActiveSupportTool] = useState<SupportTool>("none");
  const [notebookEntries, setNotebookEntries] = useState(recentNotebookEntries);

  const originalCount = Array.from(originalText).length;
  const draftCount = Array.from(draft).length;
  const hasChanged = draft.trim() !== originalText.trim();
  const featuredPriorities = priorities.slice(0, 3);
  const hiddenPriorityCount = Math.max(0, priorities.length - featuredPriorities.length);
  const activeSuggestion =
    aiSuggestions.find((suggestion) => suggestion.id === activeSuggestionId) || aiSuggestions[0] || null;
  const activeSuggestionIndex = activeSuggestion
    ? aiSuggestions.findIndex((suggestion) => suggestion.id === activeSuggestion.id)
    : -1;
  const canGoBackward = activeSuggestionIndex > 0;
  const canGoForward = activeSuggestionIndex !== -1 && activeSuggestionIndex < aiSuggestions.length - 1;
  const activeRewritePrompt = activeSuggestion
    ? activeSuggestion.beforeText
      ? `先把「${previewText(activeSuggestion.beforeText, 20)}」這一句修順，再慢慢整理其他地方。`
      : "先模仿這張示範卡的句式和節奏，把你最想修的一段寫得更清楚。"
    : "先改一段你最想修順的地方就可以，不用一開始就全篇重寫。";

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

      navigateTo(`/submissions/${submissionId}/compare`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "暫時未能儲存修訂。");
      setSubmitting(false);
    }
  }

  function selectAdjacent(step: number) {
    if (!aiSuggestions.length) return;
    const baseIndex = activeSuggestionIndex === -1 ? 0 : activeSuggestionIndex;
    const nextIndex = Math.min(aiSuggestions.length - 1, Math.max(0, baseIndex + step));
    setActiveSuggestionId(aiSuggestions[nextIndex].id);
  }

  function handleNotebookEntryCreated(entry: NotebookEntrySummary) {
    setNotebookEntries((current) => {
      const next = [entry, ...current.filter((item) => item.id !== entry.id)];
      return next.slice(0, 6);
    });
  }

  function toggleSupportTool(nextTool: Exclude<SupportTool, "none">) {
    setActiveSupportTool((current) => (current === nextTool ? "none" : nextTool));
  }

  return (
    <section className="paper-panel-strong p-6 sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <p className="section-kicker">訂正工作台</p>
          <div>
            <h2 className="text-2xl">把畫面收簡單一點，先做眼前這一步就好</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-ink/75">
              這裡只保留改寫最需要的三步：先挑重點、看一個示範、再直接動筆。完整 AI 範文已移到上方的獨立分頁。
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="pill">{originalCount} 字原稿</span>
          <span className="pill pill-positive">{draftCount} 字修訂稿</span>
          {hasExistingRevision ? (
            <button
              type="button"
              onClick={() => navigateTo(`/submissions/${submissionId}/compare`)}
              className="btn-secondary"
            >
              查看最近一次對照
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 rounded-[1.25rem] border border-border/70 bg-white/75 px-4 py-4">
        <div className="flex flex-wrap gap-2">
          <StepChip number="1" label="選重點" tone="primary" />
          <StepChip number="2" label="看示範" tone="positive" />
          <StepChip number="3" label="開始寫" tone="warm" />
        </div>
        <p className="mt-3 text-sm leading-7 text-ink/75">
          不用同時看很多卡片。先處理一個真正想改好的句子；如果想看整篇 AI 示範，可以切到上方的 `AI 參考範文`。
        </p>
      </div>

      <div className="mt-6 space-y-5">
        <div className="paper-panel p-5 sm:p-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
            <div className="space-y-4">
              <div>
                <p className="section-kicker">第 1 步</p>
                <h3 className="mt-2 text-xl">先決定這一輪只改甚麼</h3>
                <p className="mt-2 text-sm leading-7 text-ink/75">
                  先看最值得優先處理的 2–3 項，不必把整份回饋一次消化完。
                </p>
              </div>

              <ul className="space-y-3">
                {featuredPriorities.map((priority, index) => (
                  <li
                    key={`${priority}-${index}`}
                    className="rounded-[1rem] border border-border/70 bg-paper/70 px-4 py-3 text-sm leading-7 text-ink/85"
                  >
                    {priority}
                  </li>
                ))}
              </ul>

              {hiddenPriorityCount > 0 ? (
                <div className="rounded-[1rem] border border-border/60 bg-white/80 px-4 py-3 text-sm leading-7 text-ink/70">
                  還有 {hiddenPriorityCount} 項可以之後再看，先把眼前這幾項修順就很好。
                </div>
              ) : null}

              <div className="rounded-[1rem] border border-accent/15 bg-accent/5 px-4 py-3 text-sm leading-7 text-ink/75">
                <p className="font-medium text-ink">導師提醒</p>
                <p className="mt-1">先把最想說清楚的一段寫順，通常比一開始就修標點更有感。</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="section-kicker">第 2 步</p>
                  <h3 className="mt-2 text-xl">只看一張示範卡，再照著改</h3>
                </div>
                {aiSuggestions.length > 0 ? <span className="pill">{aiSuggestions.length} 張示範卡</span> : null}
              </div>

              {aiSuggestions.length > 0 && activeSuggestion ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {aiSuggestions.map((suggestion, index) => {
                      const isActive = suggestion.id === activeSuggestion.id;
                      return (
                        <button
                          key={suggestion.id}
                          type="button"
                          onClick={() => setActiveSuggestionId(suggestion.id)}
                          aria-pressed={isActive}
                          className={[
                            "rounded-full border px-3 py-2 text-sm transition",
                            isActive
                              ? "border-accent/30 bg-accent text-white shadow-soft"
                              : "border-border/70 bg-white/85 text-ink/75 hover:border-accent/20 hover:text-accent",
                          ].join(" ")}
                        >
                          {index + 1}. {previewText(suggestion.label, 8)}
                        </button>
                      );
                    })}
                  </div>

                  <div className="rounded-[1.15rem] border border-border/70 bg-white/80 p-4 shadow-soft">
                    <div className="flex flex-wrap items-center gap-2 text-[0.68rem] tracking-[0.16em] text-muted">
                      <span
                        className={[
                          "rounded-full px-2 py-0.5 tracking-normal",
                          activeSuggestion.kind === "priority"
                            ? "border border-accent/20 bg-accent/5 text-accent"
                            : "border border-good/25 bg-good/10 text-good",
                        ].join(" ")}
                      >
                        {activeSuggestion.kind === "priority" ? "重點示範" : "句子示範"}
                      </span>
                      <span>{activeSuggestion.label}</span>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-[1rem] border border-border/70 bg-paper/70 p-4">
                        <p className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted">原句</p>
                        <p className="mt-2 font-serif text-base leading-8 text-ink/85">
                          {activeSuggestion.beforeText || "這張示範卡偏向整體寫法，你可以直接學它的句式和節奏。"}
                        </p>
                      </div>

                      <div className="rounded-[1rem] border border-good/30 bg-good/10 p-4">
                        <p className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-good">參考改寫</p>
                        <p className="mt-2 font-serif text-base leading-8 text-ink">{activeSuggestion.afterText}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-[1rem] border border-accent/20 bg-accent/5 px-4 py-3 text-sm leading-7 text-ink/80">
                      {activeSuggestion.note}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        <span className="pill bg-white/85">先保留原意</span>
                        <span className="pill bg-white/85">再調整句式</span>
                        <span className="pill bg-white/85">不必逐字照抄</span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => selectAdjacent(-1)}
                          disabled={!canGoBackward}
                          className="btn-secondary px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          上一張
                        </button>
                        <button
                          type="button"
                          onClick={() => selectAdjacent(1)}
                          disabled={!canGoForward}
                          className="btn-secondary px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          下一張
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-[1rem] border border-border/70 bg-paper/70 px-4 py-4 text-sm leading-7 text-ink/75">
                  這次沒有額外的單句示範也沒關係。直接看上面的改寫重點，再在下方挑一段開始修就可以。
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="paper-panel p-5 sm:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="section-kicker">第 3 步</p>
              <h3 className="mt-2 text-xl">現在直接改寫，不用離開這裡</h3>
              <p className="mt-2 text-sm leading-7 text-ink/75">{activeRewritePrompt}</p>
            </div>

            {activeSuggestion ? (
              <div className="rounded-[1rem] border border-border/70 bg-white/80 px-4 py-3 text-sm leading-6 text-ink/75">
                <div className="text-[0.68rem] uppercase tracking-[0.16em] text-muted">目前對照</div>
                <div className="mt-1">{previewText(activeSuggestion.beforeText || activeSuggestion.afterText, 20)}</div>
              </div>
            ) : null}
          </div>

          <label className="mt-4 block">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={16}
              className="field-input min-h-[26rem] resize-y font-serif leading-8"
            />
          </label>

          <div className="mt-4 rounded-[1rem] border border-border/70 bg-white/75 px-4 py-3 text-sm text-ink/75">
            {hasChanged ? "已偵測到你的修改。寫完這一版後，就可以直接看前後對照。" : "先改一兩句也可以，這裡會保留你目前這一版。"}
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-ink/80">
              {error}
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

        <div className="paper-panel-muted p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="section-kicker">需要時再打開</p>
              <h3 className="mt-2 text-xl">把輔助工具先收起來，畫面會更乾淨</h3>
              <p className="mt-2 text-sm leading-7 text-ink/75">
                這裡先只保留筆記本。完整的 `AI 參考範文` 已搬到上方分頁，避免和改寫區擠在一起。
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => toggleSupportTool("notebook")}
                aria-pressed={activeSupportTool === "notebook"}
                className={supportToolButtonClass(activeSupportTool === "notebook")}
              >
                學習筆記
              </button>
            </div>
          </div>

          {activeSupportTool === "none" ? (
            <div className="mt-4 rounded-[1rem] border border-border/70 bg-white/80 px-4 py-3 text-sm leading-7 text-ink/75">
              先完成上面三步就好。想記錄一句提醒時，再回來打開筆記本。
            </div>
          ) : null}

          {activeSupportTool === "notebook" ? (
            <div className="mt-4">
              <NotebookQuickPanel
                entries={notebookEntries}
                submissionId={submissionId}
                onEntryCreated={handleNotebookEntryCreated}
                intro="把你真正想帶走的一句提醒或一個句式記下來就夠，不用在這裡寫很長。"
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function previewText(text: string, limit: number) {
  const chars = Array.from(text.trim());
  if (chars.length <= limit) return text.trim();
  return `${chars.slice(0, limit).join("")}…`;
}

function navigateTo(url: string) {
  window.location.assign(url);
}

function StepChip({
  number,
  label,
  tone,
}: {
  number: string;
  label: string;
  tone: "primary" | "positive" | "warm";
}) {
  const toneClass =
    tone === "primary"
      ? "border-accent/20 bg-accent/5 text-accent"
      : tone === "positive"
        ? "border-good/25 bg-good/10 text-good"
        : "border-coral/20 bg-coral/10 text-ink/75";

  return (
    <span className={["inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm", toneClass].join(" ")}>
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/85 text-xs font-medium text-ink">
        {number}
      </span>
      <span>{label}</span>
    </span>
  );
}

function supportToolButtonClass(isActive: boolean) {
  return [
    "rounded-full border px-4 py-2 text-sm transition",
    isActive
      ? "border-accent/30 bg-accent text-white shadow-soft"
      : "border-border/70 bg-white/85 text-ink/75 hover:border-accent/20 hover:text-accent",
  ].join(" ");
}
