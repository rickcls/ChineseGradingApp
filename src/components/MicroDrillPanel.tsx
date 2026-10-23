"use client";

import { useState } from "react";
import type { DrillView } from "@/lib/drillView";

type MicroDrillPanelProps = {
  category: string;
  subcategory: string;
  initialDrill: DrillView | null;
  maxChecks: number;
};

const MIN_CHARS = 20;
const MAX_CHARS = 300;

export function MicroDrillPanel({ category, subcategory, initialDrill, maxChecks }: MicroDrillPanelProps) {
  const [drill, setDrill] = useState(initialDrill);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(initialDrill?.response ?? "");
  const [loading, setLoading] = useState<"task" | "check" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const length = Array.from(text.trim()).length;
  const checksLeft = drill ? maxChecks - drill.attempts : maxChecks;

  async function request(url: string, body: unknown, kind: "task" | "check") {
    setLoading(kind);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => null)) as { drill?: DrillView; error?: unknown } | null;
      if (!res.ok || !payload?.drill) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "暫時未能完成，請稍後再試。");
      }
      return payload.drill;
    } catch (err) {
      setError(err instanceof Error ? err.message : "暫時未能完成，請稍後再試。");
      return null;
    } finally {
      setLoading(null);
    }
  }

  async function startDrill(fresh: boolean) {
    const next = await request("/api/drills", { category, subcategory, fresh }, "task");
    if (next) {
      setDrill(next);
      setText(next.response ?? "");
      setOpen(true);
    }
  }

  async function check() {
    if (!drill) return;
    const next = await request(`/api/drills/${drill.id}/check`, { response: text }, "check");
    if (next) setDrill(next);
  }

  if (!open) {
    return (
      <div className="space-y-1">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => (drill ? setOpen(true) : startDrill(false))}
          disabled={loading !== null}
          aria-busy={loading === "task"}
        >
          <span className="inline-flex items-center gap-2">
            {loading === "task" ? <span aria-hidden="true" className="pending-spinner" /> : null}
            <span>
              {loading === "task" ? "出題中…" : drill && !drill.completed ? "繼續上次的 150 字練習" : "做個 150 字小練習"}
            </span>
          </span>
        </button>
        {error ? <p className="text-xs text-coral">{error}</p> : null}
      </div>
    );
  }

  if (!drill) return null;
  const feedback = drill.feedback;
  const outOfChecks = !drill.completed && checksLeft <= 0;

  return (
    <div className="space-y-3 rounded-[1rem] border border-accent/20 bg-white/85 p-4 text-sm leading-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-ink">📝 {drill.task.title}</p>
        <button type="button" className="text-xs text-muted underline" onClick={() => setOpen(false)}>
          收起
        </button>
      </div>
      <p className="text-ink/85">{drill.task.situation}</p>
      <p className="text-ink/75">練習重點：{drill.task.focus}</p>
      <ul className="space-y-1">
        {drill.task.requirements.map((requirement, index) => {
          const verdict = feedback?.requirements[index];
          return (
            <li key={requirement} className="flex gap-2">
              <span aria-hidden="true">{verdict ? (verdict.met ? "✅" : "⬜") : "▫️"}</span>
              <span>
                {requirement}
                {verdict ? <span className="block text-xs text-muted">{verdict.comment}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
      {drill.task.tips.length ? <p className="text-xs text-muted">提示：{drill.task.tips.join("；")}</p> : null}

      {!drill.completed && !outOfChecks ? (
        <>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={5}
            maxLength={MAX_CHARS + 50}
            placeholder={`寫 ${drill.task.wordRange[0]}–${drill.task.wordRange[1]} 字`}
            className="field-input resize-y font-serif leading-8"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={["text-xs", length > MAX_CHARS ? "text-coral" : "text-muted"].join(" ")}>
              {length} 字・還可檢查 {checksLeft} 次
            </span>
            <button
              type="button"
              className="btn-primary"
              onClick={check}
              disabled={loading !== null || length < MIN_CHARS || length > MAX_CHARS}
              aria-busy={loading === "check"}
            >
              <span className="inline-flex items-center gap-2">
                {loading === "check" ? <span aria-hidden="true" className="pending-spinner" /> : null}
                <span>{loading === "check" ? "導師正在看…" : "交給導師看"}</span>
              </span>
            </button>
          </div>
        </>
      ) : null}

      {feedback ? (
        <div className="space-y-2 rounded-[0.9rem] border border-good/25 bg-good/10 px-3 py-2">
          <p>👍 {feedback.praise}</p>
          <p>➡️ {feedback.nextStep}</p>
          {feedback.fix ? (
            <p className="font-serif">
              「{feedback.fix.before}」→「{feedback.fix.after}」
            </p>
          ) : null}
        </div>
      ) : null}

      {drill.completed || outOfChecks ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-ink">{drill.completed ? "全部要求達到，完成！🎉" : `已用完 ${maxChecks} 次檢查。`}</span>
          <button type="button" className="btn-secondary" onClick={() => startDrill(true)} disabled={loading !== null}>
            {loading === "task" ? "出題中…" : "再來一題"}
          </button>
        </div>
      ) : null}
      {error ? <p className="text-xs text-coral">{error}</p> : null}
    </div>
  );
}
