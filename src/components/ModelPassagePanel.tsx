"use client";

import { useState } from "react";
import {
  findNormalizedMatch,
  type ModelPassageHighlight,
  type StoredModelPassage,
} from "@/lib/modelPassage";
import { normalizeFocusTag, type NotebookEntrySummary } from "@/lib/notebook";

type ModelPassagePanelProps = {
  submissionId: string;
  originalText: string;
  initialPassage: StoredModelPassage | null;
  context?: "workbench" | "compare";
  onNotebookEntryCreated?: (entry: NotebookEntrySummary) => void;
};

type ActiveTab = "original" | "model" | "highlights";

export function ModelPassagePanel({
  submissionId,
  originalText,
  initialPassage,
  context = "workbench",
  onNotebookEntryCreated,
}: ModelPassagePanelProps) {
  const [passage, setPassage] = useState(initialPassage);
  const [expanded, setExpanded] = useState(Boolean(initialPassage));
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialPassage ? "highlights" : "model");
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(
    initialPassage?.highlights[0]?.id ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStates, setSaveStates] = useState<Record<string, "idle" | "saving" | "saved">>({});

  const activeHighlight =
    passage?.highlights.find((highlight) => highlight.id === activeHighlightId) ||
    passage?.highlights[0] ||
    null;
  const originalMatch = activeHighlight ? findNormalizedMatch(originalText, activeHighlight.beforeText) : null;
  const modelMatch = activeHighlight ? findNormalizedMatch(passage?.generatedText || "", activeHighlight.afterText) : null;

  async function openOrGenerate(forceRegenerate: boolean) {
    if (passage && !forceRegenerate) {
      setExpanded(true);
      return;
    }

    setExpanded(true);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/submissions/${submissionId}/model-passage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });

      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.passage) {
        throw new Error(toUserFacingPanelError(typeof body?.error === "string" ? body.error : ""));
      }

      const nextPassage = body.passage as StoredModelPassage;
      setPassage(nextPassage);
      setActiveHighlightId(nextPassage.highlights[0]?.id ?? null);
      setActiveTab("highlights");
    } catch (err) {
      setError(err instanceof Error ? toUserFacingPanelError(err.message) : "暫時未能生成 AI 參考範文。");
    } finally {
      setLoading(false);
    }
  }

  async function saveHighlight(highlight: ModelPassageHighlight, entryType: "phrase" | "lesson") {
    if (!passage) return;

    const key = `${highlight.id}:${entryType}`;
    const content =
      entryType === "phrase" ? highlight.saveablePhrase || highlight.afterText : highlight.keepInMind;

    setSaveStates((current) => ({ ...current, [key]: "saving" }));

    try {
      const response = await fetch("/api/notebook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entryType,
          title:
            entryType === "phrase"
              ? `${highlight.focus}・收藏句式`
              : `${highlight.focus}・寫作提醒`,
          content,
          focusTag: normalizeFocusTag(highlight.focus),
          tags: ["AI參考範文", highlight.focus].filter(Boolean),
          submissionId,
          sourcePassageId: passage.id,
          sourceBeforeText: highlight.beforeText,
          sourceAfterText: highlight.afterText,
        }),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.entry) {
        throw new Error(typeof body?.error === "string" ? body.error : "暫時未能存入筆記本。");
      }

      setSaveStates((current) => ({ ...current, [key]: "saved" }));
      onNotebookEntryCreated?.(body.entry as NotebookEntrySummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "暫時未能存入筆記本。");
      setSaveStates((current) => ({ ...current, [key]: "idle" }));
    }
  }

  if (!expanded && !passage) {
    return (
      <section className="paper-panel overflow-hidden">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="section-kicker">AI 參考範文</p>
              <h3 className="text-2xl">卡住時，先看一條示範路線，而不是一次看滿整頁建議</h3>
              <p className="max-w-3xl text-sm leading-7 text-ink/75">
                這不是標準答案，而是一篇保留你原來故事與意思的參考版本。它會示範怎樣把同一篇文章補得更完整，再拆成幾個容易吸收的學習重點。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MiniFeature
                label="先看全文"
                title="同一篇文章的 AI 範文"
                description="先感受整體節奏怎樣更順，知道修改可以朝哪個方向走。"
              />
              <MiniFeature
                label="再看重點"
                title="5–8 張變化卡"
                description="每張卡只講一個改動，避免學生一開始就被資訊量壓住。"
              />
              <MiniFeature
                label="最後帶走"
                title="把句式收進筆記"
                description="把真正想學會的寫法收藏起來，下次寫作就能再拿回來用。"
              />
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-accent/20 bg-accent/[0.07] p-5">
            <p className="section-kicker">生成後會看到</p>
            <div className="mt-3 space-y-3">
              <div className="rounded-[1rem] border border-white/80 bg-white/80 px-4 py-3 text-sm leading-7 text-ink/80">
                完整 AI 參考範文
              </div>
              <div className="rounded-[1rem] border border-white/80 bg-white/80 px-4 py-3 text-sm leading-7 text-ink/80">
                原文 vs AI 範文 對照
              </div>
              <div className="rounded-[1rem] border border-white/80 bg-white/80 px-4 py-3 text-sm leading-7 text-ink/80">
                可收藏的句式與提醒
              </div>
            </div>

            <button
              type="button"
              onClick={() => openOrGenerate(false)}
              disabled={loading}
              className="btn-primary mt-5 w-full justify-center"
            >
              {loading ? "AI 正在整理範文…" : "AI 生成參考範文"}
            </button>

            <p className="mt-3 text-xs leading-6 text-muted">
              {loading
                ? "這一步通常需要十多秒到一分鐘。只要按一次，等它整理完成就可以。"
                : "先完成自己的修訂最重要。這裡只是示範另一條可學習的寫法，不是唯一正解。"}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="paper-panel overflow-hidden">
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
        <div className="space-y-3">
          <p className="section-kicker">AI 參考範文</p>
          <h3 className="text-2xl">
            {context === "compare" ? "用 AI 範文再看一次：原文還可以怎樣變得更清楚" : "卡住時，看看同一篇文章還能怎樣寫得更完整"}
          </h3>
          <p className="max-w-3xl text-sm leading-7 text-ink/75">
            {context === "compare"
              ? "這裡保留的是同一篇文章的 AI 參考版本，你可以對照自己這次的修訂，再選擇要不要吸收其中的寫法。"
              : "先完成自己的修訂最重要；如果想找一條示範路線，再把 AI 範文當作參考，學它怎樣補細節、補感受和補過渡。"}
          </p>

          <div className="flex flex-wrap gap-2">
            {passage ? <span className="pill">更新於 {formatShortDate(passage.updatedAt)}</span> : null}
            {passage ? <span className="pill pill-positive">{passage.highlights.length} 個學習重點</span> : null}
            <span className="pill bg-white/85">不是標準答案</span>
          </div>
        </div>

        <div className="rounded-[1.15rem] border border-accent/20 bg-accent/[0.06] p-4">
          <p className="section-kicker">使用順序</p>
          <ol className="mt-3 space-y-2 text-sm leading-7 text-ink/80">
            <li>1. 先看全文，感受它怎樣更完整。</li>
            <li>2. 再看重點變化卡，學一兩個真正有用的改動。</li>
            <li>3. 把想帶走的句式或提醒收進筆記本。</li>
          </ol>

          {passage ? (
            <button type="button" onClick={() => openOrGenerate(true)} disabled={loading} className="btn-secondary mt-4 w-full justify-center">
              {loading ? "重新生成中…" : "重新生成"}
            </button>
          ) : (
            <button type="button" onClick={() => openOrGenerate(false)} disabled={loading} className="btn-primary mt-4 w-full justify-center">
              {loading ? "AI 正在整理範文…" : "AI 生成參考範文"}
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div className="mx-5 mb-1 rounded-[1.1rem] border border-coral/30 bg-coral/10 px-4 py-3 text-sm leading-7 text-ink/80 sm:mx-6">
          <div className="font-medium text-ink">這次範文沒有順利顯示</div>
          <div className="mt-1 text-muted">{error}</div>
        </div>
      ) : null}

      {!passage ? (
        <div className="mx-5 mb-5 rounded-[1.15rem] border border-border/70 bg-white/75 px-5 py-4 text-sm leading-7 text-ink/75 sm:mx-6">
          生成後，這裡會出現完整 AI 範文，以及 5–8 張重點變化卡。你不需要一次全部看完，只要先學會其中一兩個寫法就很有價值。
        </div>
      ) : (
        <>
          <div className="mx-5 mt-1 flex flex-wrap gap-2 sm:mx-6">
            {(["original", "model", "highlights"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={[
                  "rounded-full px-4 py-2 text-sm transition",
                  activeTab === tab
                    ? "bg-accent text-white shadow-soft"
                    : "border border-border/80 bg-white/80 text-ink/75 hover:border-accent/30 hover:text-accent",
                ].join(" ")}
              >
                {tab === "original" ? "原文" : tab === "model" ? "AI 範文" : "重點變化"}
              </button>
            ))}
          </div>

          {activeTab === "original" ? (
            <div className="mx-5 my-5 space-y-3 sm:mx-6">
              {activeHighlight ? (
                <div className="rounded-[1rem] border border-border/70 bg-paper/70 px-4 py-3 text-sm leading-7 text-ink/75">
                  目前對焦：
                  <span className="ml-2 font-medium text-ink">{activeHighlight.focus}</span>
                  {originalMatch ? "。原文已替你標出這次想學的片段。" : "。這一項比較像整體寫法提醒，所以以下只用卡片說明。"}
                </div>
              ) : null}
              <HighlightedPassage text={originalText} snippet={activeHighlight?.beforeText} tone="original" />
            </div>
          ) : null}

          {activeTab === "model" ? (
            <div className="mx-5 my-5 space-y-3 sm:mx-6">
              {activeHighlight ? (
                <div className="rounded-[1rem] border border-good/25 bg-good/10 px-4 py-3 text-sm leading-7 text-ink/75">
                  目前對焦：
                  <span className="ml-2 font-medium text-ink">{activeHighlight.focus}</span>
                  {modelMatch ? "。AI 範文中已標出相應的寫法。" : "。這一項在全文中未必是逐字重現，所以以下以卡片講解為主。"}
                </div>
              ) : null}
              <HighlightedPassage text={passage.generatedText} snippet={activeHighlight?.afterText} tone="model" />
            </div>
          ) : null}

          {activeTab === "highlights" ? (
            <div className="mx-5 my-5 space-y-4 sm:mx-6">
              {activeHighlight ? (
                <div className="rounded-[1.2rem] border border-accent/20 bg-accent/5 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-[0.68rem] tracking-[0.16em] text-muted">
                    <span className="rounded-full border border-accent/20 bg-white/80 px-2 py-0.5 tracking-normal text-accent">
                      {activeHighlight.focus}
                    </span>
                    <span>目前聚焦的改動</span>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[1rem] border border-border/70 bg-white/80 px-4 py-3">
                      <p className="text-[0.68rem] tracking-[0.16em] text-muted">原文片段</p>
                      <p className="mt-2 font-serif text-base leading-8 text-ink/85">
                        {activeHighlight.beforeText || "這項重點偏向整體寫法，未必有單一原句可對照。"}
                      </p>
                    </div>

                    <div className="rounded-[1rem] border border-good/30 bg-good/10 px-4 py-3">
                      <p className="text-[0.68rem] tracking-[0.16em] text-good">AI 改寫片段</p>
                      <p className="mt-2 font-serif text-base leading-8 text-ink">{activeHighlight.afterText}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    <InsightBlock label="它改了甚麼" tone="muted" text={activeHighlight.whatChanged} />
                    <InsightBlock label="為何這樣更好" tone="positive" text={activeHighlight.whyItHelps} />
                    <InsightBlock label="下次記住" tone="primary" text={activeHighlight.keepInMind} />
                  </div>
                </div>
              ) : null}

              <ul className="grid gap-4 lg:grid-cols-2">
                {passage.highlights.map((highlight) => {
                  const phraseState = saveStates[`${highlight.id}:phrase`] || "idle";
                  const lessonState = saveStates[`${highlight.id}:lesson`] || "idle";
                  const isActive = highlight.id === activeHighlight?.id;

                  return (
                    <li
                      key={highlight.id}
                      className={[
                        "rounded-[1.1rem] border px-4 py-4 shadow-soft transition",
                        isActive
                          ? "border-accent/30 bg-accent/[0.08]"
                          : "border-border/70 bg-white/80",
                      ].join(" ")}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 text-[0.68rem] tracking-[0.16em] text-muted">
                          <span className="rounded-full border border-accent/20 bg-white/80 px-2 py-0.5 tracking-normal text-accent">
                            {highlight.focus}
                          </span>
                          <span>{highlight.beforeText ? "可逐句對照" : "整體寫法示範"}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveHighlightId(highlight.id)}
                          className="btn-secondary px-4 py-2 text-xs"
                        >
                          {isActive ? "目前查看中" : "查看這項"}
                        </button>
                      </div>

                      <div className="mt-3 grid gap-3">
                        {highlight.beforeText ? (
                          <div className="rounded-[0.95rem] border border-border/70 bg-paper/70 px-3 py-3">
                            <p className="text-[0.68rem] tracking-[0.16em] text-muted">原文片段</p>
                            <p className="mt-1.5 font-serif text-sm leading-7 text-ink/80">{highlight.beforeText}</p>
                          </div>
                        ) : null}

                        <div className="rounded-[0.95rem] border border-good/30 bg-good/10 px-3 py-3">
                          <p className="text-[0.68rem] tracking-[0.16em] text-good">AI 改寫片段</p>
                          <p className="mt-1.5 font-serif text-sm leading-7 text-ink">{highlight.afterText}</p>
                        </div>
                      </div>

                      <p className="mt-3 text-sm leading-7 text-ink/80">{highlight.whatChanged}</p>
                      <p className="mt-2 text-sm leading-7 text-muted">{highlight.keepInMind}</p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => saveHighlight(highlight, "phrase")}
                          disabled={phraseState === "saving" || phraseState === "saved"}
                          className="btn-secondary px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {phraseState === "saved" ? "已收藏句式" : phraseState === "saving" ? "收藏中…" : "收藏句式"}
                        </button>
                        <button
                          type="button"
                          onClick={() => saveHighlight(highlight, "lesson")}
                          disabled={lessonState === "saving" || lessonState === "saved"}
                          className="btn-secondary px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {lessonState === "saved" ? "已記下提醒" : lessonState === "saving" ? "記錄中…" : "記下提醒"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function MiniFeature({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[1rem] border border-border/70 bg-white/80 px-4 py-4 shadow-soft">
      <p className="section-kicker">{label}</p>
      <p className="mt-2 font-medium text-ink">{title}</p>
      <p className="mt-2 text-sm leading-7 text-ink/75">{description}</p>
    </div>
  );
}

function HighlightedPassage({
  text,
  snippet,
  tone,
}: {
  text: string;
  snippet?: string;
  tone: "original" | "model";
}) {
  const match = snippet ? findNormalizedMatch(text, snippet) : null;
  const markClass =
    tone === "model"
      ? "rounded-md bg-good/20 px-1 text-ink"
      : "rounded-md bg-accent/15 px-1 text-ink";

  return (
    <div
      className={[
        "prose-zh whitespace-pre-wrap rounded-[1.15rem] p-4",
        tone === "model" ? "border border-good/20 bg-white" : "border border-border/70 bg-paper/80",
      ].join(" ")}
    >
      {!match ? (
        text
      ) : (
        <>
          {text.slice(0, match.start)}
          <mark className={markClass}>{text.slice(match.start, match.end)}</mark>
          {text.slice(match.end)}
        </>
      )}
    </div>
  );
}

function InsightBlock({
  label,
  text,
  tone,
}: {
  label: string;
  text: string;
  tone: "muted" | "positive" | "primary";
}) {
  const className =
    tone === "positive"
      ? "border-good/20 bg-white/80"
      : tone === "primary"
        ? "border-accent/20 bg-white/80"
        : "border-border/70 bg-white/80";

  return (
    <div className={["rounded-[1rem] border px-4 py-3", className].join(" ")}>
      <p className="text-[0.68rem] tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 text-sm leading-7 text-ink/80">{text}</p>
    </div>
  );
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("zh-HK", {
    month: "short",
    day: "numeric",
  });
}

function toUserFacingPanelError(message: string) {
  if (!message) return "暫時未能生成 AI 參考範文。";
  if (/Failed to fetch/i.test(message)) {
    return "連線在生成途中中斷了，通常是本機開發伺服器重新整理或暫時不穩。請再按一次，我會重新發出請求。";
  }
  if (/JSON|Expected .* after|Unexpected token|MODEL_PASSAGE_PARSE_FAILED/i.test(message)) {
    return "AI 這次已經整理出內容方向，但回傳格式不完整，所以暫時未能顯示。請再按一次重新整理。";
  }
  return message;
}
