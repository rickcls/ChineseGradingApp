"use client";

import { useState } from "react";

type ErrorLike = {
  id: string;
  category: string;
  subcategory: string;
  charOffsetStart: number;
  charOffsetEnd: number;
  severity: number;
  suggestion: string;
  ocrSuspect: boolean;
};

export function AnnotatedText({ text, errors }: { text: string; errors: ErrorLike[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sorted = [...errors].sort((a, b) => a.charOffsetStart - b.charOffsetStart);
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  sorted.forEach((e, i) => {
    const start = Math.max(cursor, e.charOffsetStart);
    const end = Math.min(text.length, e.charOffsetEnd);
    if (start > cursor) nodes.push(<span key={`t-${i}`}>{text.slice(cursor, start)}</span>);
    if (end > start) {
      const cls = `err-${Math.min(3, Math.max(1, e.severity))}${e.ocrSuspect ? " ocr-suspect" : ""}`;
      nodes.push(
        <mark
          key={`m-${e.id}`}
          className={cls}
          onClick={() => setActiveId(activeId === e.id ? null : e.id)}
          style={{ cursor: "pointer" }}
          title={`${e.category}・${e.subcategory}`}
        >
          {text.slice(start, end)}
        </mark>,
      );
      cursor = end;
    }
  });
  if (cursor < text.length) nodes.push(<span key="tail">{text.slice(cursor)}</span>);

  const active = errors.find((e) => e.id === activeId) || null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs text-muted">
        <span className="pill">點一下有底線的字句，就能看到導師建議</span>
        <span className="pill pill-positive">綠色：已接近通順</span>
        <span className="pill pill-warm">珊瑚色：值得優先整理</span>
        <span className="pill">藍色：結構或表達可以再推進</span>
      </div>

      <div className="prose-zh whitespace-pre-wrap rounded-[1.35rem] border border-border/80 bg-white/90 p-5 font-serif shadow-soft sm:p-6">
        {nodes}
      </div>
      {active ? (
        <div className="rounded-[1.2rem] border border-accent/20 bg-accent/5 p-4 text-sm shadow-soft">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="pill bg-white/80">
              建議重點
            </span>
            <span>
            {active.category}・{active.subcategory}
            {active.ocrSuspect ? "・OCR 可能讀錯" : ""}
            </span>
          </div>
          <div className="leading-7 text-ink">{active.suggestion}</div>
        </div>
      ) : (
        <div className="rounded-[1.1rem] border border-border/70 bg-white/60 px-4 py-3 text-xs text-muted">
          先從一兩個高亮位置開始看就好，不需要一次把所有問題都改完。
        </div>
      )}
    </div>
  );
}
