"use client";

import { useState } from "react";
import { ModelPassagePanel } from "@/components/ModelPassagePanel";
import { NotebookQuickPanel } from "@/components/NotebookQuickPanel";
import { RevisionSuggestionList } from "@/components/RevisionSuggestionList";
import type { StoredModelPassage } from "@/lib/modelPassage";
import type { NotebookEntrySummary } from "@/lib/notebook";
import type { RevisionSuggestionCard } from "@/lib/revisionSuggestions";

type RevisionComparisonProps = {
  submissionId: string;
  beforeText: string;
  afterText: string;
  priorities: string[];
  createdAt: string;
  changedEvidenceCount: number;
  totalEvidenceCount: number;
  beforeChars: number;
  afterChars: number;
  changedEvidence: { id: string; evidenceSpan: string; suggestion: string }[];
  remainingEvidence: { id: string; evidenceSpan: string; suggestion: string }[];
  remainingAiSuggestions: RevisionSuggestionCard[];
  initialModelPassage: StoredModelPassage | null;
  recentNotebookEntries: NotebookEntrySummary[];
};

export function RevisionComparison({
  submissionId,
  beforeText,
  afterText,
  priorities,
  createdAt,
  changedEvidenceCount,
  totalEvidenceCount,
  beforeChars,
  afterChars,
  changedEvidence,
  remainingEvidence,
  remainingAiSuggestions,
  initialModelPassage,
  recentNotebookEntries,
}: RevisionComparisonProps) {
  const [notebookEntries, setNotebookEntries] = useState(recentNotebookEntries);
  const delta = afterChars - beforeChars;
  const ratioLabel = totalEvidenceCount === 0 ? "已完成一次完整修訂" : `${changedEvidenceCount} / ${totalEvidenceCount} 處原句片段已有改動`;

  function handleNotebookEntryCreated(entry: NotebookEntrySummary) {
    setNotebookEntries((current) => {
      const next = [entry, ...current.filter((item) => item.id !== entry.id)];
      return next.slice(0, 6);
    });
  }

  return (
    <div className="space-y-6">
      <section className="paper-panel-strong p-6 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="section-kicker">前後對照</p>
            <div>
              <h1 className="text-3xl">這次修改，哪裡已經更清楚了？</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-ink/75">
                這裡不是重新打分，而是幫你看見自己已經動手調整的地方。一次改好一兩項，已經很有價值。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-ink/75">
            <span className="pill">修訂時間 {new Date(createdAt).toLocaleDateString("zh-HK")}</span>
            <span className="pill pill-positive">{ratioLabel}</span>
            <span className="pill pill-warm">
              字數 {delta >= 0 ? "+" : ""}
              {delta}
            </span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="paper-panel p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="section-kicker">修改前</p>
              <h2 className="mt-1 text-xl">原文</h2>
            </div>
            <span className="pill">{beforeChars} 字</span>
          </div>
          <div className="prose-zh whitespace-pre-wrap rounded-[1.15rem] bg-paper/80 p-4 text-ink/90">
            {beforeText}
          </div>
        </div>

        <div className="paper-panel p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="section-kicker">修改後</p>
              <h2 className="mt-1 text-xl">你的新版本</h2>
            </div>
            <span className="pill pill-positive">{afterChars} 字</span>
          </div>
          <div className="prose-zh whitespace-pre-wrap rounded-[1.15rem] bg-white p-4 text-ink/90">
            {afterText}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="paper-panel p-5">
          <p className="section-kicker">這次專注的方向</p>
          <h2 className="mt-2 text-xl">修改提醒</h2>
          <ul className="mt-4 space-y-3">
            {priorities.map((priority, index) => (
              <li key={`${priority}-${index}`} className="rounded-2xl border border-border/70 bg-white/75 px-4 py-3 text-sm leading-7 text-ink/80">
                {priority}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="paper-panel p-5">
            <p className="section-kicker">你已經動手的地方</p>
            <h2 className="mt-2 text-xl">看起來已改寫的原句</h2>
            <ul className="mt-4 space-y-3">
              {changedEvidence.length === 0 ? (
                <li className="rounded-2xl border border-border/70 bg-white/75 px-4 py-3 text-sm leading-7 text-muted">
                  還看不出明顯改動，沒關係，可以先從一段最想修好的地方開始。
                </li>
              ) : (
                changedEvidence.map((item) => (
                  <li key={item.id} className="rounded-2xl border border-good/20 bg-good/10 px-4 py-3 text-sm leading-7 text-ink/80">
                    <div className="font-medium text-ink">「{item.evidenceSpan}」</div>
                    <div className="mt-1 text-muted">{item.suggestion}</div>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="paper-panel-muted p-5">
            <p className="section-kicker">下一輪可以再看看</p>
            <h2 className="mt-2 text-xl">似乎仍保留在文中的片段</h2>
            <ul className="mt-4 space-y-3">
              {remainingEvidence.length === 0 ? (
                <li className="rounded-2xl border border-border/70 bg-white/75 px-4 py-3 text-sm leading-7 text-muted">
                  這一輪你已經把原來被標出的片段都改動過了，做得很好。
                </li>
              ) : (
                remainingEvidence.map((item) => (
                  <li key={item.id} className="rounded-2xl border border-coral/20 bg-coral/10 px-4 py-3 text-sm leading-7 text-ink/80">
                    <div className="font-medium text-ink">「{item.evidenceSpan}」</div>
                    <div className="mt-1 text-muted">{item.suggestion}</div>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="paper-panel p-5">
            <p className="section-kicker">AI 參考改寫</p>
            <h2 className="mt-2 text-xl">仍可參考的句子示範</h2>
            <RevisionSuggestionList
              suggestions={remainingAiSuggestions}
              advisoryNote="這裡只保留看起來仍和現稿相關的示範，方便你決定下一輪要先修哪一句。"
              emptyTitle="這一輪可參考的示範已經差不多處理完了。"
              emptyDescription="你目前的修訂已不再明顯保留那些可對照的原句片段，可以先休息一下，或回到回饋頁挑新的重點再精修。"
            />
          </div>

          <NotebookQuickPanel
            entries={notebookEntries}
            submissionId={submissionId}
            onEntryCreated={handleNotebookEntryCreated}
            intro="把這次對照時發現的句式或提醒先記下來，之後寫下一篇時就更容易用回來。"
          />
        </div>
      </section>

      <ModelPassagePanel
        submissionId={submissionId}
        originalText={beforeText}
        initialPassage={initialModelPassage}
        context="compare"
        onNotebookEntryCreated={handleNotebookEntryCreated}
      />
    </div>
  );
}
