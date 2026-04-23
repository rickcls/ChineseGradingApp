import type { RevisionSuggestionCard } from "@/lib/revisionSuggestions";

type RevisionSuggestionListProps = {
  suggestions: RevisionSuggestionCard[];
  advisoryNote?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function RevisionSuggestionList({
  suggestions,
  advisoryNote,
  emptyTitle,
  emptyDescription,
}: RevisionSuggestionListProps) {
  if (suggestions.length === 0) {
    if (!emptyTitle && !emptyDescription) return null;

    return (
      <div className="mt-4 rounded-2xl border border-good/20 bg-good/10 px-4 py-3 text-sm leading-7 text-ink/80">
        {emptyTitle ? <p className="font-medium text-ink">{emptyTitle}</p> : null}
        {emptyDescription ? <p className={emptyTitle ? "mt-1 text-muted" : "text-muted"}>{emptyDescription}</p> : null}
      </div>
    );
  }

  return (
    <>
      {advisoryNote ? <p className="mt-2 text-sm leading-7 text-ink/75">{advisoryNote}</p> : null}

      <ul className="mt-4 space-y-3">
        {suggestions.map((suggestion) => (
          <li
            key={suggestion.id}
            className={[
              "rounded-[1.1rem] border px-4 py-4 shadow-soft",
              suggestion.kind === "priority"
                ? "border-accent/20 bg-accent/5"
                : "border-good/25 bg-white/85",
            ].join(" ")}
          >
            <div className="flex flex-wrap items-center gap-2 text-[0.68rem] tracking-[0.16em] text-muted">
              <span
                className={[
                  "rounded-full px-2 py-0.5",
                  suggestion.kind === "priority"
                    ? "border border-accent/20 bg-white/80 text-accent"
                    : "border border-good/25 bg-good/10 text-good",
                ].join(" ")}
              >
                {suggestion.kind === "priority" ? "重點示範" : "句子示範"}
              </span>
              <span>{suggestion.label}</span>
            </div>

            <div className={["mt-3 grid gap-3", suggestion.beforeText ? "sm:grid-cols-2" : ""].join(" ")}>
              {suggestion.beforeText ? (
                <div className="rounded-[0.95rem] border border-border/70 bg-paper/70 px-3 py-3">
                  <p className="text-[0.68rem] tracking-[0.16em] text-muted">原句</p>
                  <p className="mt-1.5 font-serif text-sm leading-7 text-ink/80">「{suggestion.beforeText}」</p>
                </div>
              ) : null}

              <div className="rounded-[0.95rem] border border-good/30 bg-good/10 px-3 py-3">
                <p className="text-[0.68rem] tracking-[0.16em] text-good">
                  {suggestion.beforeText ? "參考改寫" : "可模仿寫法"}
                </p>
                <p className="mt-1.5 font-serif text-sm leading-7 text-ink">{suggestion.afterText}</p>
              </div>
            </div>

            <p className="mt-3 text-sm leading-7 text-ink/75">{suggestion.note}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
