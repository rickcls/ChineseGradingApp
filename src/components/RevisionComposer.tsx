"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ModelPassagePanel } from "@/components/ModelPassagePanel";
import { NotebookQuickPanel } from "@/components/NotebookQuickPanel";
import type { StoredModelPassage } from "@/lib/modelPassage";
import type { NotebookEntrySummary } from "@/lib/notebook";
import type { RevisionSuggestionCard } from "@/lib/revisionSuggestions";

type RevisionComposerProps = {
  submissionId: string;
  originalText: string;
  priorities: string[];
  hasExistingRevision: boolean;
  aiSuggestions: RevisionSuggestionCard[];
  initialModelPassage: StoredModelPassage | null;
  recentNotebookEntries: NotebookEntrySummary[];
};

export function RevisionComposer({
  submissionId,
  originalText,
  priorities,
  hasExistingRevision,
  aiSuggestions,
  initialModelPassage,
  recentNotebookEntries,
}: RevisionComposerProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(originalText);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSuggestionId, setActiveSuggestionId] = useState<string | null>(aiSuggestions[0]?.id ?? null);
  const [notebookEntries, setNotebookEntries] = useState(recentNotebookEntries);

  const originalCount = Array.from(originalText).length;
  const draftCount = Array.from(draft).length;
  const hasChanged = draft.trim() !== originalText.trim();
  const activeSuggestion = aiSuggestions.find((suggestion) => suggestion.id === activeSuggestionId) || aiSuggestions[0] || null;
  const activeSuggestionIndex = activeSuggestion
    ? aiSuggestions.findIndex((suggestion) => suggestion.id === activeSuggestion.id)
    : -1;
  const canGoBackward = activeSuggestionIndex > 0;
  const canGoForward = activeSuggestionIndex !== -1 && activeSuggestionIndex < aiSuggestions.length - 1;
  const activeRewritePrompt = activeSuggestion
    ? activeSuggestion.beforeText
      ? `現在先試著把「${previewText(activeSuggestion.beforeText, 20)}」這一句修順，再回頭整理其他地方。`
      : "現在先模仿這張示範卡的句式和節奏，把你最想修的一段寫得更清楚。"
    : "直接在原文上修改也可以，先把最想修的一段寫順就很好。";

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

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
        <div className="order-2 space-y-4 xl:order-1">
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

          {aiSuggestions.length > 0 ? (
            <div className="paper-panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="section-kicker">AI 參考改寫</p>
                  <h3 className="mt-2 text-lg">挑一句來對照著改</h3>
                </div>
                <span className="pill">{aiSuggestions.length} 張示範卡</span>
              </div>
              <p className="mt-2 text-sm leading-7 text-ink/75">
                不要一次看全部。先選一張，再看右邊的原句和參考改寫，會更容易直接動筆。
              </p>

              <div className="mt-4 space-y-2.5">
                {aiSuggestions.map((suggestion, index) => {
                  const isActive = suggestion.id === activeSuggestion?.id;
                  return (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() => setActiveSuggestionId(suggestion.id)}
                      aria-pressed={isActive}
                      className={[
                        "w-full rounded-[1.1rem] border px-4 py-3 text-left transition",
                        isActive
                          ? "border-accent/30 bg-accent/[0.08] shadow-soft"
                          : "border-border/70 bg-white/75 hover:border-accent/20 hover:bg-white/90",
                      ].join(" ")}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={[
                            "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                            isActive
                              ? "border-accent/30 bg-accent text-white"
                              : "border-border/80 bg-white text-ink/70",
                          ].join(" ")}
                        >
                          {index + 1}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-[0.68rem] tracking-[0.16em] text-muted">
                            <span
                              className={[
                                "rounded-full px-2 py-0.5 tracking-normal",
                                suggestion.kind === "priority"
                                  ? "border border-accent/20 bg-accent/5 text-accent"
                                  : "border border-good/25 bg-good/10 text-good",
                              ].join(" ")}
                            >
                              {suggestion.kind === "priority" ? "重點示範" : "句子示範"}
                            </span>
                            <span>{suggestion.label}</span>
                          </div>

                          <p className="mt-2 text-sm leading-6 text-ink/85">
                            {suggestion.beforeText
                              ? `原句：${previewText(suggestion.beforeText, 26)}`
                              : `示範：${previewText(suggestion.afterText, 26)}`}
                          </p>
                          <p className="mt-1 text-xs leading-6 text-good">
                            參考改寫：{previewText(suggestion.afterText, 26)}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <NotebookQuickPanel
            entries={notebookEntries}
            submissionId={submissionId}
            onEntryCreated={handleNotebookEntryCreated}
            intro="把 AI 示範卡、你自己的修改心得，或任何之後想再翻回來用的提醒收進來。"
          />

          <div className="paper-panel-muted p-4 text-sm leading-7 text-ink/75">
            <p className="font-medium text-ink">導師提醒</p>
            <p className="mt-2">
              不用追求一下子全改完。先把最想說清楚的一段修順，再回頭看字詞和標點，會更輕鬆。
            </p>
          </div>
        </div>

        <div className="order-1 space-y-4 xl:order-2">
          {activeSuggestion ? (
            <div className="paper-panel p-5 sm:p-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="section-kicker">目前參考</p>
                  <h3 className="mt-2 text-2xl">先比對這一句，再回到下方重寫</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-ink/75">
                    一次只專心處理一張示範卡，會比同時看很多建議更容易真的改進句子。
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="pill">
                    第 {activeSuggestionIndex + 1} / {aiSuggestions.length} 張
                  </span>
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

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-[1.15rem] border border-border/70 bg-paper/70 p-4">
                  <p className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted">原句</p>
                  <p className="mt-2 font-serif text-base leading-8 text-ink/85">
                    {activeSuggestion.beforeText || "這張是整體寫法示範，你可以模仿它的句式和節奏。"}
                  </p>
                </div>

                <div className="rounded-[1.15rem] border border-good/30 bg-good/10 p-4">
                  <p className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-good">參考改寫</p>
                  <p className="mt-2 font-serif text-base leading-8 text-ink">{activeSuggestion.afterText}</p>
                </div>
              </div>

              <div className="mt-4 rounded-[1rem] border border-accent/20 bg-accent/5 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-[0.68rem] tracking-[0.16em] text-muted">
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 tracking-normal",
                      activeSuggestion.kind === "priority"
                        ? "border border-accent/20 bg-white/80 text-accent"
                        : "border border-good/25 bg-good/10 text-good",
                    ].join(" ")}
                  >
                    {activeSuggestion.kind === "priority" ? "重點示範" : "句子示範"}
                  </span>
                  <span>{activeSuggestion.label}</span>
                </div>
                <p className="mt-2 text-sm leading-7 text-ink/80">{activeSuggestion.note}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="pill bg-white/85">先保留原意</span>
                <span className="pill bg-white/85">再調整詞語和句式</span>
                <span className="pill bg-white/85">不必逐字照抄</span>
              </div>
            </div>
          ) : null}

          <div className="paper-panel p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <span className="field-label mb-0">你的修訂版本</span>
                <p className="mt-1 text-sm leading-7 text-ink/75">{activeRewritePrompt}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <span className="pill">{originalCount} 字原稿</span>
                <span className="pill pill-positive">{draftCount} 字修訂稿</span>
              </div>
            </div>

            <label className="mt-4 block">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={16}
                className="field-input min-h-[28rem] resize-y font-serif leading-8"
              />
            </label>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-white/75 px-4 py-3 text-sm text-ink/75">
              <span className="text-xs text-muted">
                {hasChanged ? "已偵測到你的修改，完成後可查看前後對照。" : "可以先改一兩句最想修好的地方，這裡會即時保留你的新版本。"}
              </span>
              {activeSuggestion ? (
                <span className="pill bg-white/85">
                  目前對照：{previewText(activeSuggestion.beforeText || activeSuggestion.afterText, 14)}
                </span>
              ) : null}
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
        </div>
      </div>

      <div className="mt-6">
        <ModelPassagePanel
          submissionId={submissionId}
          originalText={originalText}
          initialPassage={initialModelPassage}
          context="workbench"
          onNotebookEntryCreated={handleNotebookEntryCreated}
        />
      </div>
    </section>
  );
}

function previewText(text: string, limit: number) {
  const chars = Array.from(text.trim());
  if (chars.length <= limit) return text.trim();
  return `${chars.slice(0, limit).join("")}…`;
}
