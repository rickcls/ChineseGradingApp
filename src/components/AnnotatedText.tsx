"use client";

import { useRef, useState } from "react";

type ErrorLike = {
  id: string;
  category: string;
  subcategory: string;
  evidenceSpan: string;
  charOffsetStart: number;
  charOffsetEnd: number;
  severity: number;
  suggestion: string;
  exampleFix?: string | null;
  ocrSuspect: boolean;
};

type SentenceBlock = {
  key: string;
  start: number;
  end: number;
  text: string;
};

type ContextWindow = {
  start: number;
  end: number;
  label: string;
  prefixEllipsis: boolean;
  suffixEllipsis: boolean;
};

type DerivedError = ErrorLike & {
  context: ContextWindow;
  preview: string;
  sentence: SentenceBlock;
};

const SENTENCE_BOUNDARIES = new Set(["。", "！", "？", "；", "\n"]);

export function AnnotatedText({ text, errors }: { text: string; errors: ErrorLike[] }) {
  const sentenceRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const sentenceBlocks = splitSentenceBlocks(text);
  const sorted = errors
    .map((error) => clampError(error, text.length))
    .sort((a, b) => {
      if (a.charOffsetStart !== b.charOffsetStart) return a.charOffsetStart - b.charOffsetStart;
      if (a.charOffsetEnd !== b.charOffsetEnd) return a.charOffsetEnd - b.charOffsetEnd;
      return a.id.localeCompare(b.id);
    })
    .map((error) => {
      const sentence = findSentenceForError(sentenceBlocks, error);
      const context = buildContextWindow(text, sentence, error);
      const preview =
        buildPreview(text.slice(context.start, context.end), context.prefixEllipsis, context.suffixEllipsis) ||
        buildPreview(error.evidenceSpan, false, false) ||
        "查看這一處原文";

      return {
        ...error,
        context,
        preview,
        sentence,
      };
    });

  const [activeId, setActiveId] = useState<string | null>(sorted[0]?.id ?? null);
  const active = sorted.find((error) => error.id === activeId) || sorted[0] || null;
  const activeIndex = active ? sorted.findIndex((error) => error.id === active.id) : -1;

  function selectError(errorId: string) {
    setActiveId(errorId);
    const selected = sorted.find((error) => error.id === errorId);
    if (!selected) return;

    const sentenceNode = sentenceRefs.current[selected.sentence.key];
    if (!sentenceNode) return;

    requestAnimationFrame(() => {
      sentenceNode.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function selectAdjacent(step: number) {
    if (!sorted.length) return;
    const baseIndex = activeIndex === -1 ? 0 : activeIndex;
    const nextIndex = Math.min(sorted.length - 1, Math.max(0, baseIndex + step));
    selectError(sorted[nextIndex].id);
  }

  const feedbackPanel = active ? (
    <AnnotationFeedbackPanel
      active={active}
      activeIndex={activeIndex}
      canGoBackward={activeIndex > 0}
      canGoForward={activeIndex !== -1 && activeIndex < sorted.length - 1}
      onSelectAdjacent={selectAdjacent}
      totalCount={sorted.length}
      text={text}
    />
  ) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs text-muted">
        <span className="pill">先在上方清單選一句，原文與建議會同步定位</span>
        <span className="pill pill-positive">綠色：小幅整理就更順</span>
        <span className="pill pill-warm">珊瑚色：值得優先處理</span>
        <span className="pill">藍色：結構或表達可以再推進</span>
      </div>

      {sorted.length > 0 ? (
        <>
          <div className="flex snap-x gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-2 lg:overflow-visible xl:grid-cols-3">
            {sorted.map((error, index) => {
              const isActive = active?.id === error.id;

              return (
                <button
                  key={error.id}
                  type="button"
                  className={[
                    "annotation-issue-card min-w-[16rem] snap-start lg:min-w-0",
                    issueCardTone(error.severity, isActive),
                    isActive ? "annotation-issue-card-active" : "",
                  ].join(" ")}
                  onClick={() => selectError(error.id)}
                  aria-pressed={isActive}
                  title={`${error.category}・${error.subcategory}`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-[0.68rem] uppercase tracking-[0.16em] text-muted">
                    <span className="font-semibold text-ink">第 {index + 1} 處</span>
                    <span className={["rounded-full px-2 py-0.5 normal-case tracking-normal", severityPillTone(error.severity)].join(" ")}>
                      {severityLabel(error.severity)}
                    </span>
                  </div>
                  <p className="mt-3 font-serif text-base leading-7 text-ink">{error.preview}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>{error.category}・{error.subcategory}</span>
                    {error.ocrSuspect ? <span className="pill bg-white/80">OCR 可能讀錯</span> : null}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="space-y-4">
              <div className="annotation-mobile-sheet lg:hidden">{feedbackPanel}</div>

              <div className="annotation-passage prose-zh whitespace-pre-wrap rounded-[1.35rem] border border-border/80 bg-white/90 p-5 font-serif shadow-soft sm:p-6">
                {sentenceBlocks.map((sentence) => {
                  const sentenceErrors = sorted.filter(
                    (error) => error.charOffsetEnd > sentence.start && error.charOffsetStart < sentence.end,
                  );
                  const isActiveSentence =
                    active?.sentence.start === sentence.start && active?.sentence.end === sentence.end;

                  return (
                    <span
                      key={sentence.key}
                      ref={(node) => {
                        sentenceRefs.current[sentence.key] = node;
                      }}
                      className={["annotation-sentence", isActiveSentence ? "annotation-sentence-active" : ""].join(" ")}
                    >
                      {renderTextRange({
                        activeId: active?.id || null,
                        errors: sentenceErrors,
                        interactive: true,
                        rangeEnd: sentence.end,
                        rangeStart: sentence.start,
                        text,
                        onSelect: selectError,
                      })}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="annotation-sticky-panel">{feedbackPanel}</div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="annotation-passage prose-zh whitespace-pre-wrap rounded-[1.35rem] border border-border/80 bg-white/90 p-5 font-serif shadow-soft sm:p-6">
            {text}
          </div>
          <div className="rounded-[1.1rem] border border-border/70 bg-white/60 px-4 py-3 text-xs text-muted">
            先從一兩個高亮位置開始看就好，不需要一次把所有問題都改完。
          </div>
        </>
      )}
    </div>
  );
}

function AnnotationFeedbackPanel({
  active,
  activeIndex,
  canGoBackward,
  canGoForward,
  onSelectAdjacent,
  totalCount,
  text,
}: {
  active: DerivedError;
  activeIndex: number;
  canGoBackward: boolean;
  canGoForward: boolean;
  onSelectAdjacent: (step: number) => void;
  totalCount: number;
  text: string;
}) {
  return (
    <div className="annotation-feedback-panel max-h-[42vh] overflow-y-auto lg:max-h-none">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="pill bg-white/85">第 {activeIndex + 1} / {totalCount} 處</span>
            <span>{active.category}・{active.subcategory}</span>
            {active.ocrSuspect ? <span className="pill bg-white/85">OCR 可能讀錯</span> : null}
          </div>
          <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-accent">{active.context.label}</p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="annotation-jump-button"
            onClick={() => onSelectAdjacent(-1)}
            disabled={!canGoBackward}
          >
            上一處
          </button>
          <button
            type="button"
            className="annotation-jump-button"
            onClick={() => onSelectAdjacent(1)}
            disabled={!canGoForward}
          >
            下一處
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-[1rem] border border-border/70 bg-white/75 px-4 py-3 shadow-soft">
        <p className="font-serif text-base leading-8 text-ink">
          {active.context.prefixEllipsis ? <span className="text-muted">...</span> : null}
          {renderTextRange({
            activeId: active.id,
            errors: [active],
            interactive: false,
            rangeEnd: active.context.end,
            rangeStart: active.context.start,
            text,
          })}
          {active.context.suffixEllipsis ? <span className="text-muted">...</span> : null}
        </p>
      </div>

      <div className="mt-4 rounded-[1rem] border border-accent/20 bg-accent/5 px-4 py-3 text-sm shadow-soft">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">導師提醒</p>
        <p className="mt-2 leading-7 text-ink">{active.suggestion}</p>
      </div>

      {active.exampleFix ? (
        <div className="mt-3 rounded-[1rem] border border-good/30 bg-good/10 px-4 py-3 text-sm shadow-soft">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-good">可以試這樣改</p>
          <p className="mt-2 font-serif leading-7 text-ink">{active.exampleFix}</p>
        </div>
      ) : null}

      <div className="mt-3 text-xs leading-6 text-muted">
        對應片段：
        <span className="ml-1 font-serif text-ink/80">「{active.evidenceSpan}」</span>
      </div>
    </div>
  );
}

function renderTextRange({
  activeId,
  errors,
  interactive,
  onSelect,
  rangeEnd,
  rangeStart,
  text,
}: {
  activeId: string | null;
  errors: ErrorLike[];
  interactive: boolean;
  onSelect?: (errorId: string) => void;
  rangeEnd: number;
  rangeStart: number;
  text: string;
}) {
  const relevant = errors
    .filter((error) => error.charOffsetEnd > rangeStart && error.charOffsetStart < rangeEnd)
    .sort((a, b) => {
      if (a.charOffsetStart !== b.charOffsetStart) return a.charOffsetStart - b.charOffsetStart;
      if (a.charOffsetEnd !== b.charOffsetEnd) return a.charOffsetEnd - b.charOffsetEnd;
      return a.id.localeCompare(b.id);
    });

  if (relevant.length === 0) {
    return [<span key={`${rangeStart}-${rangeEnd}`}>{text.slice(rangeStart, rangeEnd)}</span>];
  }

  const boundaries = new Set<number>([rangeStart, rangeEnd]);
  relevant.forEach((error) => {
    boundaries.add(Math.max(rangeStart, error.charOffsetStart));
    boundaries.add(Math.min(rangeEnd, error.charOffsetEnd));
  });

  const ordered = Array.from(boundaries).sort((a, b) => a - b);
  const nodes: React.ReactNode[] = [];

  for (let index = 0; index < ordered.length - 1; index += 1) {
    const segmentStart = ordered[index];
    const segmentEnd = ordered[index + 1];
    if (segmentEnd <= segmentStart) continue;

    const segmentText = text.slice(segmentStart, segmentEnd);
    const overlapping = relevant.filter(
      (error) => error.charOffsetStart < segmentEnd && error.charOffsetEnd > segmentStart,
    );

    if (overlapping.length === 0) {
      nodes.push(<span key={`text-${segmentStart}-${segmentEnd}`}>{segmentText}</span>);
      continue;
    }

    const chosen = overlapping.find((error) => error.id === activeId) || overlapping[0];
    const className = [
      interactive ? "annotation-mark" : "",
      `err-${Math.min(3, Math.max(1, chosen.severity))}`,
      chosen.ocrSuspect ? "ocr-suspect" : "",
      chosen.id === activeId ? "annotation-mark-active" : "",
    ]
      .filter(Boolean)
      .join(" ");

    if (interactive && onSelect) {
      nodes.push(
        <button
          key={`mark-${chosen.id}-${segmentStart}-${segmentEnd}`}
          type="button"
          className={className}
          onClick={() => onSelect(chosen.id)}
          aria-pressed={chosen.id === activeId}
          title={`${chosen.category}・${chosen.subcategory}`}
        >
          {segmentText}
        </button>,
      );
      continue;
    }

    nodes.push(
      <mark key={`context-${chosen.id}-${segmentStart}-${segmentEnd}`} className={className}>
        {segmentText}
      </mark>,
    );
  }

  return nodes;
}

function splitSentenceBlocks(text: string): SentenceBlock[] {
  if (text.length === 0) {
    return [{ key: "0-0", start: 0, end: 0, text: "" }];
  }

  const blocks: SentenceBlock[] = [];
  let start = 0;

  for (let index = 0; index < text.length; index += 1) {
    if (!isSentenceBoundary(text[index])) continue;

    const end = index + 1;
    blocks.push({
      key: `${start}-${end}`,
      start,
      end,
      text: text.slice(start, end),
    });
    start = end;
  }

  if (start < text.length) {
    blocks.push({
      key: `${start}-${text.length}`,
      start,
      end: text.length,
      text: text.slice(start),
    });
  }

  return blocks.length > 0 ? blocks : [{ key: `0-${text.length}`, start: 0, end: text.length, text }];
}

function findSentenceForError(blocks: SentenceBlock[], error: ErrorLike): SentenceBlock {
  return (
    blocks.find((block) => error.charOffsetStart < block.end && error.charOffsetEnd > block.start) ||
    blocks[blocks.length - 1] || { key: "0-0", start: 0, end: 0, text: "" }
  );
}

function buildContextWindow(text: string, sentence: SentenceBlock, error: ErrorLike): ContextWindow {
  const sentenceText = normalizeWhitespace(text.slice(sentence.start, sentence.end));
  if (sentenceText.length > 0 && sentenceText.length <= 90) {
    return {
      start: sentence.start,
      end: sentence.end,
      label: "所在句子",
      prefixEllipsis: false,
      suffixEllipsis: false,
    };
  }

  let start = Math.max(sentence.start, error.charOffsetStart - 18);
  let end = Math.min(sentence.end, error.charOffsetEnd + 18);
  const minWindow = Math.min(Math.max(30, error.evidenceSpan.length + 18), sentence.end - sentence.start || 30);
  const currentWindow = end - start;

  if (currentWindow < minWindow) {
    const missing = minWindow - currentWindow;
    const extendLeft = Math.min(start - sentence.start, Math.floor(missing / 2));
    start -= extendLeft;
    end = Math.min(sentence.end, end + (missing - extendLeft));

    const stillMissing = minWindow - (end - start);
    if (stillMissing > 0) {
      start = Math.max(sentence.start, start - stillMissing);
    }
  }

  return {
    start,
    end,
    label: "附近片段",
    prefixEllipsis: start > sentence.start,
    suffixEllipsis: end < sentence.end,
  };
}

function buildPreview(text: string, prefixEllipsis: boolean, suffixEllipsis: boolean) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return "";

  const shortened = normalized.length > 30 ? `${normalized.slice(0, 30)}...` : normalized;
  const withPrefix = prefixEllipsis ? `...${shortened}` : shortened;
  const withSuffix = suffixEllipsis && !withPrefix.endsWith("...") ? `${withPrefix}...` : withPrefix;
  return withSuffix;
}

function clampError(error: ErrorLike, textLength: number): ErrorLike {
  if (textLength <= 0) {
    return { ...error, charOffsetStart: 0, charOffsetEnd: 0 };
  }

  const start = Math.max(0, Math.min(textLength - 1, error.charOffsetStart));
  const end = Math.max(start + 1, Math.min(textLength, error.charOffsetEnd));

  return {
    ...error,
    charOffsetStart: start,
    charOffsetEnd: end,
  };
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isSentenceBoundary(char: string) {
  return SENTENCE_BOUNDARIES.has(char);
}

function severityLabel(severity: number) {
  if (severity >= 3) return "重點";
  if (severity === 2) return "優先";
  return "細修";
}

function severityPillTone(severity: number) {
  if (severity >= 3) return "bg-accent/12 text-accent";
  if (severity === 2) return "bg-coral/12 text-coral";
  return "bg-good/12 text-good";
}

function issueCardTone(severity: number, isActive: boolean) {
  if (isActive) return "border-accent/30 bg-accent/10 shadow-float";
  if (severity >= 3) return "border-accent/18 bg-white/80 hover:border-accent/35";
  if (severity === 2) return "border-coral/18 bg-white/80 hover:border-coral/35";
  return "border-good/18 bg-white/80 hover:border-good/35";
}
