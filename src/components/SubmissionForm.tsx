"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const GRADES = ["P5", "P6", "S1", "S2", "S3", "S4", "S5", "S6"];

export function SubmissionForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [gradeLevel, setGradeLevel] = useState("S2");
  const [taskPrompt, setTaskPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, gradeLevel, taskPrompt: taskPrompt || undefined }),
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
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm text-muted">年級</span>
          <select
            value={gradeLevel}
            onChange={(e) => setGradeLevel(e.target.value)}
            className="w-full rounded-md border border-border bg-white p-2"
          >
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-muted">題目（可選）</span>
          <input
            value={taskPrompt}
            onChange={(e) => setTaskPrompt(e.target.value)}
            placeholder="例：一次難忘的旅行"
            className="w-full rounded-md border border-border bg-white p-2"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm text-muted">文章內容</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="在這裡輸入或貼上你的文章……"
          rows={16}
          className="w-full rounded-md border border-border bg-white p-4 font-serif leading-8"
        />
        <div className="mt-1 text-right text-xs text-muted">{charCount} 字</div>
      </label>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          導師需要 20–60 秒閱讀並給你回饋，請耐心等候。
        </p>
        <button
          type="submit"
          disabled={submitting || charCount < 20}
          className="rounded-md bg-accent px-5 py-2 text-white disabled:opacity-50"
        >
          {submitting ? "導師正在閱讀…" : "提交給導師"}
        </button>
      </div>
    </form>
  );
}
