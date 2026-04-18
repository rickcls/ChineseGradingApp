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
      <div className="prose-zh whitespace-pre-wrap rounded-lg border border-border bg-white p-5 font-serif">
        {nodes}
      </div>
      {active ? (
        <div className="rounded-lg border-l-4 border-accent bg-white p-4 text-sm shadow-sm">
          <div className="mb-1 text-xs text-muted">
            {active.category}・{active.subcategory}
            {active.ocrSuspect ? "・OCR 可能讀錯" : ""}
          </div>
          <div className="text-ink">{active.suggestion}</div>
        </div>
      ) : (
        <div className="text-xs text-muted">點擊高亮字句可看到導師的建議。</div>
      )}
    </div>
  );
}
