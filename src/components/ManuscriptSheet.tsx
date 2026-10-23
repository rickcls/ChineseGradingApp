import type { ManuscriptCell } from "@/lib/manuscript";

const RED_PEN = "#c8372d";

export function circledNumber(n: number) {
  return n >= 1 && n <= 20 ? String.fromCodePoint(0x2460 + n - 1) : `(${n})`;
}

// 原稿紙 grid with red-pen marks: circles for character/punctuation
// errors, wavy underlines for wording and sentence problems, and a small
// number linking each mark to its note.
export function ManuscriptSheet({ rows, columns }: { rows: ManuscriptCell[][]; columns: number }) {
  // On phones the 20-column grid scrolls sideways instead of shrinking past legibility.
  return (
    <div className="overflow-x-auto rounded-[0.6rem] border border-[#e3b7a5] bg-white print:overflow-visible">
      <div className="manuscript-sheet min-w-[34rem] space-y-1.5 p-2 sm:p-3 print:min-w-0">
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="grid border-y border-l border-[#e3b7a5]"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {row.map((cell, cellIndex) => (
              <div
                key={cellIndex}
                className="relative flex aspect-square items-center justify-center border-r border-[#e3b7a5] font-serif text-[clamp(0.85rem,2.4vw,1.05rem)] leading-none text-ink"
              >
                {cell.char ? (
                  <span
                    className={
                      cell.mark === "circle"
                        ? "flex h-[86%] w-[86%] items-center justify-center rounded-full border-[1.5px]"
                        : cell.mark === "wavy"
                          ? "underline decoration-wavy decoration-[1.5px] underline-offset-[0.28em]"
                          : undefined
                    }
                    style={
                      cell.mark === "circle"
                        ? { borderColor: RED_PEN }
                        : cell.mark === "wavy"
                          ? { textDecorationColor: RED_PEN }
                          : undefined
                    }
                  >
                    {cell.char}
                  </span>
                ) : null}
                {cell.marker !== null ? (
                  <span
                    className="absolute right-[1px] top-[1px] font-sans text-[clamp(0.5rem,1.3vw,0.6rem)] leading-none"
                    style={{ color: RED_PEN }}
                  >
                    {circledNumber(cell.marker)}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
