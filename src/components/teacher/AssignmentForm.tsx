"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GENRE_OPTIONS } from "@/lib/genres";

type AssignmentFormProps = {
  classes: { id: string; name: string; studentCount: number }[];
  defaultClassId?: string;
};

export function AssignmentForm({ classes, defaultClassId }: AssignmentFormProps) {
  const router = useRouter();
  const [classId, setClassId] = useState(
    defaultClassId && classes.some((klass) => klass.id === defaultClassId) ? defaultClassId : (classes[0]?.id ?? ""),
  );
  const [taskPrompt, setTaskPrompt] = useState("");
  const [genre, setGenre] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/teacher/assignments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          classId,
          taskPrompt: taskPrompt.trim(),
          genre: genre || undefined,
          instructions: instructions.trim() || undefined,
          dueDate: dueDate || undefined,
        }),
      });
      const body = (await res.json().catch(() => null)) as { id?: string; error?: unknown } | null;
      if (!res.ok || !body?.id) {
        throw new Error(typeof body?.error === "string" ? body.error : "未能建立任務，請檢查題目後再試。");
      }
      router.push(`/teacher/assignments/${body.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未能建立任務，請稍後再試。");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="field-label">班級</span>
          <select value={classId} onChange={(event) => setClassId(event.target.value)} className="field-input" required>
            {classes.map((klass) => (
              <option key={klass.id} value={klass.id}>
                {klass.name}（{klass.studentCount} 人）
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">文體</span>
          <select value={genre} onChange={(event) => setGenre(event.target.value)} className="field-input">
            <option value="">不限</option>
            {GENRE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">截止日期（可選）</span>
          <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="field-input" />
        </label>
      </div>
      <label className="block">
        <span className="field-label">題目</span>
        <input
          value={taskPrompt}
          onChange={(event) => setTaskPrompt(event.target.value)}
          placeholder="例：那一次，我終於明白了"
          maxLength={500}
          required
          className="field-input"
        />
      </label>
      <label className="block">
        <span className="field-label">寫作要求（可選，學生會看到）</span>
        <textarea
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="例：不少於 600 字；要有具體事例，結尾要寫出感悟。"
          className="field-input"
        />
      </label>
      <p className="text-xs leading-6 text-muted">
        學生提交時使用自己的點數，題目和文體會自動套用。AI 參考範文預設不開放，你可以在任務頁隨時開放。
      </p>
      {error ? <p className="text-sm text-coral">{error}</p> : null}
      <button type="submit" className="btn-primary" disabled={saving || !classId || taskPrompt.trim().length < 2}>
        {saving ? "建立中…" : "佈置任務"}
      </button>
    </form>
  );
}
