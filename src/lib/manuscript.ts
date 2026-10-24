// Lays an essay out on a 原稿紙 grid (one character or punctuation mark per
// cell, two indent cells per paragraph) and maps annotation spans onto
// cells so they can be drawn as red-pen marks.

export type MarkKind = "circle" | "wavy";

// "punctuation" circles only the punctuation marks inside the span (so a
// run-on sentence does not circle every character); if the span has none,
// e.g. a missing comma, it falls back to a wavy underline.
export type SpanKind = MarkKind | "punctuation";

export type ManuscriptSpan = {
  start: number;
  end: number;
  kind: SpanKind;
};

export type ManuscriptCell = {
  char: string;
  // UTF-16 offset of the character in the source text; null for indent/padding.
  offset: number | null;
  mark: MarkKind | null;
  // 1-based annotation number shown on the first cell of each span.
  marker: number | null;
};

const TYPO_SUBCATEGORIES = new Set(["錯別字", "形近字", "同音字"]);

const PUNCTUATION = /[，。、；：？！「」『』（）《》〈〉…—．,.;:?!"'()]/;

// Typos are circled, punctuation errors circle the marks themselves, and
// everything else gets a wavy underline.
export function markKindFor(error: { category: string; subcategory: string }): SpanKind {
  if (error.category === "標點") return "punctuation";
  if (error.category === "字詞" && TYPO_SUBCATEGORIES.has(error.subcategory)) return "circle";
  return "wavy";
}

const blank = (): ManuscriptCell => ({ char: "", offset: null, mark: null, marker: null });

export function layoutManuscript(text: string, spans: ManuscriptSpan[], columns = 20): ManuscriptCell[][] {
  const cells: ManuscriptCell[] = [];
  const padRow = () => {
    while (cells.length % columns !== 0) cells.push(blank());
  };

  let index = 0;
  let atParagraphStart = true;
  while (index < text.length) {
    const codePoint = text.codePointAt(index)!;
    const char = String.fromCodePoint(codePoint);

    if (char === "\n" || char === "\r") {
      if (!atParagraphStart) padRow();
      atParagraphStart = true;
      index += char.length;
      continue;
    }
    if (atParagraphStart && (char === " " || char === "\t")) {
      index += 1;
      continue;
    }
    if (atParagraphStart) {
      // Students who already indent with full-width spaces keep their own.
      if (char !== "　") cells.push(blank(), blank());
      atParagraphStart = false;
    }

    cells.push({ char: char === " " || char === "\t" ? "" : char, offset: index, mark: null, marker: null });
    index += char.length;
  }
  padRow();

  const byOffset = new Map<number, ManuscriptCell>();
  for (const cell of cells) if (cell.offset !== null) byOffset.set(cell.offset, cell);

  const ordered = [...spans].sort((a, b) => a.start - b.start || a.end - b.end);
  ordered.forEach((span, spanIndex) => {
    const spanCells: ManuscriptCell[] = [];
    for (let offset = span.start; offset < span.end; offset += 1) {
      const cell = byOffset.get(offset);
      if (cell) spanCells.push(cell);
    }
    if (spanCells.length === 0) return;

    const punctuationCells = spanCells.filter((cell) => PUNCTUATION.test(cell.char));
    const apply = (cell: ManuscriptCell, kind: MarkKind) => {
      if (cell.mark !== "circle") cell.mark = kind;
    };
    if (span.kind === "punctuation" && punctuationCells.length > 0) {
      punctuationCells.forEach((cell) => apply(cell, "circle"));
    } else {
      spanCells.forEach((cell) => apply(cell, span.kind === "circle" ? "circle" : "wavy"));
    }

    // Two spans starting on the same cell: put the later number on the next free cell.
    const markerCell = spanCells.find((cell) => cell.marker === null);
    if (markerCell) markerCell.marker = spanIndex + 1;
  });

  const rows: ManuscriptCell[][] = [];
  for (let start = 0; start < cells.length; start += columns) rows.push(cells.slice(start, start + columns));
  return rows;
}
