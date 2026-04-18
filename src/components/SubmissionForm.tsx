"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CameraCaptureFlow } from "@/components/CameraCaptureFlow";

const GRADES = ["P5", "P6", "S1", "S2", "S3", "S4", "S5", "S6"];
const MODES = [
  { value: "typed", label: "直接輸入", helper: "適合已經有電子文字稿" },
  { value: "photo", label: "拍照交稿", helper: "手機拍稿後核對文字再提交" },
  { value: "scan", label: "掃描稿", helper: "上傳掃描圖片，再整理成文字版" },
] as const;

type SubmissionSource = (typeof MODES)[number]["value"];

export function SubmissionForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [gradeLevel, setGradeLevel] = useState("S2");
  const [taskPrompt, setTaskPrompt] = useState("");
  const [source, setSource] = useState<SubmissionSource>("typed");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text,
          gradeLevel,
          taskPrompt: taskPrompt || undefined,
          source,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "提交失敗" }));
        throw new Error(typeof body?.error === "string" ? body.error : "提交失敗");
      }

      const { id } = await res.json();
      router.push(`/submissions/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失敗");
      setSubmitting(false);
    }
  }

  const charCount = Array.from(text).length;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="paper-panel-strong p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-4">
            <div>
              <p className="section-kicker">交稿方式</p>
              <h2 className="mt-2 text-2xl">選一個最輕鬆的開始方式</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-ink/75">
                不管你是直接輸入、拍照交稿，還是先整理掃描稿，導師都會先陪你看清楚文章，再給具體可行的下一步。
              </p>
            </div>

            <div className="grid gap-3">
              {MODES.map((mode) => {
                const active = mode.value === source;
                return (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => setSource(mode.value)}
                    className={[
                      "rounded-[1.15rem] border px-4 py-4 text-left transition",
                      active
                        ? "border-accent/30 bg-accent/5 shadow-soft"
                        : "border-border/70 bg-white/70 hover:border-accent/20 hover:bg-white/90",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-medium text-ink">{mode.label}</div>
                        <div className="mt-1 text-sm text-muted">{mode.helper}</div>
                      </div>
                      <span
                        className={[
                          "mt-1 h-5 w-5 rounded-full border",
                          active ? "border-accent bg-accent" : "border-border bg-white",
                        ].join(" ")}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="paper-panel-muted p-4">
            <p className="section-kicker">導師會怎樣看這篇文章</p>
            <ul className="mt-3 space-y-3 text-sm leading-7 text-ink/80">
              <li>1. 先讀懂你的內容和想表達的重點。</li>
              <li>2. 用年級相符的標準看內容、結構、語言、字詞標點和立意。</li>
              <li>3. 告訴你做得好的地方，再挑 2–3 項最值得先改的重點。</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="field-label">年級</span>
          <select
            value={gradeLevel}
            onChange={(event) => setGradeLevel(event.target.value)}
            className="field-input"
          >
            {GRADES.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="field-label">題目或寫作任務（可選）</span>
          <input
            value={taskPrompt}
            onChange={(event) => setTaskPrompt(event.target.value)}
            placeholder="例：一次難忘的旅行"
            className="field-input"
          />
        </label>
      </section>

      {source === "typed" ? (
        <section className="space-y-4">
          <label className="block">
            <span className="field-label">文章內容</span>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="把文章貼在這裡。你不需要先寫得很完美，先交出來，我們再一起修。"
              rows={16}
              className="field-input min-h-[24rem] resize-y font-serif leading-8"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="paper-panel-muted px-4 py-4">
              <p className="section-kicker">字數</p>
              <div className="mt-2 text-2xl text-ink">{charCount}</div>
              <p className="mt-1 text-xs text-muted">至少 20 字就可以開始分析</p>
            </div>
            <div className="paper-panel-muted px-4 py-4">
              <p className="section-kicker">建議做法</p>
              <p className="mt-2 text-sm leading-7 text-ink/80">先把內容寫順，再回頭看標點和詞語，會更有效率。</p>
            </div>
            <div className="paper-panel-muted px-4 py-4">
              <p className="section-kicker">導師口吻</p>
              <p className="mt-2 text-sm leading-7 text-ink/80">我會指出可改善處，也會告訴你哪些地方已經有亮點。</p>
            </div>
          </div>
        </section>
      ) : (
        <CameraCaptureFlow
          source={source}
          text={text}
          onTextChange={setText}
        />
      )}

      {error ? (
        <div className="rounded-[1.2rem] border border-coral/25 bg-coral/10 px-4 py-3 text-sm text-ink/80">
          {error}
        </div>
      ) : null}

      <div className="paper-panel flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-ink/80">導師通常需要 20–60 秒閱讀和整理回饋。</p>
          <p className="text-xs text-muted">如果這篇文章還不完整也沒關係，先交一版，我們再慢慢修。</p>
        </div>
        <button
          type="submit"
          disabled={submitting || charCount < 20}
          className="btn-primary min-w-[11rem]"
        >
          {submitting ? "導師正在閱讀…" : "提交給導師"}
        </button>
      </div>
    </form>
  );
}
