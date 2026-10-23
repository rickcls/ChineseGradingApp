"use client";

import { useState } from "react";
import type { TopicAnalysisResult } from "@/lib/topicAnalysis";

type TopicAnalysisPanelProps = {
  taskPrompt: string;
  genre: string;
  gradeLevel: string;
};

export function TopicAnalysisPanel({ taskPrompt, genre, gradeLevel }: TopicAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<TopicAnalysisResult | null>(null);
  const [analysedTopic, setAnalysedTopic] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topic = taskPrompt.trim();
  const canAnalyse = topic.length >= 2 && !loading;
  const stale = analysis !== null && analysedTopic !== topic;

  async function analyse() {
    if (!canAnalyse) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/topic-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskPrompt: topic, genre: genre || undefined, gradeLevel }),
      });
      const body = (await res.json().catch(() => null)) as { analysis?: TopicAnalysisResult; error?: unknown } | null;
      if (!res.ok || !body?.analysis) {
        throw new Error(typeof body?.error === "string" ? body.error : "暫時未能完成審題，請稍後再試。");
      }
      setAnalysis(body.analysis);
      setAnalysedTopic(topic);
    } catch (err) {
      setError(err instanceof Error ? err.message : "暫時未能完成審題，請稍後再試。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="paper-panel p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="section-kicker">審題助手</p>
          <h2 className="mt-1 text-xl">動筆前，先看清題目要你寫甚麼</h2>
          <p className="mt-1 max-w-2xl text-sm leading-7 text-ink/75">
            輸入題目後按「先審題」，會列出題眼、題目要求、常見離題陷阱和三個立意方向。不用點數，也不會替你寫文章。
          </p>
        </div>
        <button type="button" onClick={analyse} disabled={!canAnalyse} aria-busy={loading} className="btn-secondary min-w-[8rem]">
          <span className="inline-flex items-center gap-2">
            {loading ? <span aria-hidden="true" className="pending-spinner" /> : null}
            <span>{loading ? "審題中…" : analysis && !stale ? "重新審題" : "先審題"}</span>
          </span>
        </button>
      </div>

      {topic.length < 2 && !analysis ? <p className="mt-3 text-xs text-muted">請先在上方「題目」欄輸入題目。</p> : null}
      {error ? <p className="mt-3 text-sm text-coral">{error}</p> : null}
      {stale ? <p className="mt-3 text-xs text-coral">題目已更改，下面是舊題目的審題結果；如需要請重新審題。</p> : null}

      {analysis ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <h3 className="font-medium text-ink">題眼</h3>
            <ul className="space-y-3">
              {analysis.keyPhrases.map((item, index) => (
                <li key={`${item.phrase}-${index}`} className="rounded-[1rem] border border-accent/20 bg-accent/5 px-4 py-3 text-sm leading-7">
                  <span className="pill border-accent/30 text-accent">「{item.phrase}」</span>
                  <p className="mt-2 text-ink/85">{item.meaning}</p>
                  <p className="mt-1 text-ink">→ {item.requirement}</p>
                </li>
              ))}
            </ul>

            <h3 className="pt-2 font-medium text-ink">題目要求</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-7 text-ink/85">
              {analysis.requirements.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="font-medium text-ink">容易失分的寫法</h3>
            <ul className="space-y-2">
              {analysis.pitfalls.map((item, index) => (
                <li key={`${item.pitfall}-${index}`} className="rounded-[1rem] border border-coral/25 bg-coral/10 px-4 py-3 text-sm leading-7">
                  <p className="font-medium text-ink">{item.pitfall}</p>
                  <p className="text-ink/80">{item.why}</p>
                </li>
              ))}
            </ul>

            <h3 className="pt-2 font-medium text-ink">立意方向（由淺至深）</h3>
            <ol className="space-y-2">
              {analysis.angles.map((item, index) => (
                <li key={`${item.angle}-${index}`} className="rounded-[1rem] border border-good/25 bg-good/10 px-4 py-3 text-sm leading-7">
                  <span className="pill pill-positive">{item.depth}</span>
                  <p className="mt-2 text-ink">{item.angle}</p>
                  <p className="text-ink/75">材料：{item.material}</p>
                </li>
              ))}
            </ol>
          </div>

          <div className="lg:col-span-2">
            <h3 className="font-medium text-ink">寫作時問自己</h3>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {analysis.checklist.map((item, index) => (
                <li key={`${item}-${index}`} className="rounded-[1rem] border border-border/70 bg-white/75 px-4 py-2 text-sm leading-7 text-ink/85">
                  □ {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
