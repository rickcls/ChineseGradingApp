"use client";

import { useState } from "react";
import type { ThemeElevation, ThemeElevationStep } from "@/lib/themeElevation";

type ThemeElevationPanelProps = {
  submissionId: string;
  initial: ThemeElevation | null;
};

const STEP_TONES = ["border-good/25 bg-good/10", "border-accent/25 bg-accent/5", "border-coral/25 bg-coral/10"];

export function ThemeElevationPanel({ submissionId, initial }: ThemeElevationPanelProps) {
  const [elevation, setElevation] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, "saving" | "saved">>({});

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/submissions/${submissionId}/theme-elevation`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as { elevation?: ThemeElevation; error?: unknown } | null;
      if (!res.ok || !body?.elevation) {
        throw new Error(typeof body?.error === "string" ? body.error : "暫時未能生成立意昇華建議，請稍後再試。");
      }
      setElevation(body.elevation);
      setSaved({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "暫時未能生成立意昇華建議，請稍後再試。");
    } finally {
      setLoading(false);
    }
  }

  async function saveExample(step: ThemeElevationStep) {
    if (!step.example) return;
    setSaved((current) => ({ ...current, [step.level]: "saving" }));
    try {
      const res = await fetch("/api/notebook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entryType: "phrase",
          title: `立意昇華・${step.level}`,
          content: `${step.example}\n\n方向：${step.direction}`,
          focusTag: "內容",
          tags: ["立意昇華", step.level],
          submissionId,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved((current) => ({ ...current, [step.level]: "saved" }));
    } catch {
      setSaved((current) => {
        const next = { ...current };
        delete next[step.level];
        return next;
      });
      setError("暫時未能存入筆記本，請稍後再試。");
    }
  }

  return (
    <div className="paper-panel p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="section-kicker">立意昇華</p>
          <h3 className="mt-1 text-2xl">結尾只停在「我學會了…」？試試把立意推深一層</h3>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-ink/75">
            以你文章裏的事件和細節為基礎，示範三個由淺至深的方向。選一個最貼近你真實感受的，用自己的話寫，不要整句照抄。
          </p>
        </div>
        <button type="button" onClick={generate} disabled={loading} aria-busy={loading} className={elevation ? "btn-secondary" : "btn-primary"}>
          <span className="inline-flex items-center gap-2">
            {loading ? <span aria-hidden="true" className="pending-spinner" /> : null}
            <span>{loading ? "整理中…" : elevation ? "重新生成" : "生成立意昇華建議"}</span>
          </span>
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-coral">{error}</p> : null}

      {elevation ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-[1rem] border border-border/70 bg-white/75 px-4 py-3 text-sm leading-7">
            <p>
              <span className="font-medium text-ink">現在的立意：</span>
              {elevation.currentTheme}
            </p>
            <p className="mt-1 text-ink/80">{elevation.diagnosis}</p>
          </div>

          <ol className="grid gap-4 lg:grid-cols-3">
            {elevation.ladder.map((step, index) => (
              <li key={step.level} className={["rounded-[1.15rem] border p-4 text-sm leading-7", STEP_TONES[index]].join(" ")}>
                <span className="pill bg-white/80">
                  第 {index + 1} 層・{step.level}
                </span>
                <p className="mt-3 text-ink">{step.direction}</p>
                <p className="mt-2 text-ink/75">扣連原文：{step.connect}</p>
                {step.example ? (
                  <>
                    <blockquote className="mt-3 border-l-2 border-ink/20 pl-3 font-serif text-base leading-8 text-ink">
                      {step.example}
                    </blockquote>
                    <button
                      type="button"
                      className="pill mt-3"
                      onClick={() => saveExample(step)}
                      disabled={Boolean(saved[step.level])}
                    >
                      {saved[step.level] === "saved" ? "已存入筆記" : saved[step.level] === "saving" ? "儲存中…" : "存入筆記本"}
                    </button>
                  </>
                ) : null}
              </li>
            ))}
          </ol>

          <p className="rounded-[1rem] border border-coral/25 bg-coral/10 px-4 py-3 text-sm leading-7 text-ink/85">
            ⚠️ {elevation.caution}
          </p>
        </div>
      ) : null}
    </div>
  );
}
