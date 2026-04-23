import type { RevisionPriority } from "./revisionPriority";

export type RevisionSuggestionCard = {
  id: string;
  kind: "priority" | "error";
  label: string;
  beforeText?: string;
  afterText: string;
  note: string;
};

type ErrorSuggestionSource = {
  id: string;
  category: string;
  subcategory: string;
  evidenceSpan: string;
  suggestion: string;
  exampleFix?: string | null;
  severity: number;
  charOffsetStart: number;
};

type SuggestionInput = {
  priorities: RevisionPriority[];
  errors: ErrorSuggestionSource[];
};

const WORKBENCH_PRIORITY_LIMIT = 5;
const WORKBENCH_ERROR_LIMIT = 2;
const COMPARE_LIMIT = 4;
const PRIORITY_FOCUS_WEIGHT: Record<string, number> = {
  內容: 0,
  結構: 1,
  表達: 2,
  標點: 3,
};

export function buildWorkbenchRevisionSuggestions({
  priorities,
  errors,
}: SuggestionInput): RevisionSuggestionCard[] {
  const seen = new Set<string>();
  const cards: RevisionSuggestionCard[] = [];

  cards.push(
    ...takeUniqueCards(
      rankPrioritiesForSuggestions(priorities)
        .map((priority, index) => buildPriorityCard(priority, index))
        .filter((card): card is RevisionSuggestionCard => card !== null),
      WORKBENCH_PRIORITY_LIMIT,
      seen,
    ),
  );

  cards.push(
    ...takeUniqueCards(
      [...errors]
        .sort((a, b) => {
          if (a.severity !== b.severity) return b.severity - a.severity;
          return a.charOffsetStart - b.charOffsetStart;
        })
        .map(buildErrorCard)
        .filter((card): card is RevisionSuggestionCard => card !== null),
      WORKBENCH_ERROR_LIMIT,
      seen,
    ),
  );

  return cards;
}

export function buildRemainingRevisionSuggestions({
  priorities,
  errors,
  revisedText,
}: SuggestionInput & { revisedText: string }): RevisionSuggestionCard[] {
  const seen = new Set<string>();
  const cards: RevisionSuggestionCard[] = [];

  cards.push(
    ...takeUniqueCards(
      rankPrioritiesForSuggestions(priorities)
        .map((priority, index) => buildPriorityCard(priority, index))
        .filter((card): card is RevisionSuggestionCard => card !== null)
        .filter((card) => card.beforeText && includesNormalized(revisedText, card.beforeText)),
      COMPARE_LIMIT,
      seen,
    ),
  );

  if (cards.length < COMPARE_LIMIT) {
    cards.push(
      ...takeUniqueCards(
        [...errors]
          .sort((a, b) => {
            if (a.severity !== b.severity) return b.severity - a.severity;
            return a.charOffsetStart - b.charOffsetStart;
          })
          .filter((error) => includesNormalized(revisedText, error.evidenceSpan))
          .map(buildErrorCard)
          .filter((card): card is RevisionSuggestionCard => card !== null),
        COMPARE_LIMIT - cards.length,
        seen,
      ),
    );
  }

  return cards;
}

export function includesNormalized(haystack: string, needle: string) {
  const normalizedHaystack = normalizeComparableText(haystack);
  const normalizedNeedle = normalizeComparableText(needle);
  return normalizedNeedle ? normalizedHaystack.includes(normalizedNeedle) : false;
}

function buildPriorityCard(
  priority: RevisionPriority,
  index: number,
): RevisionSuggestionCard | null {
  if (!priority.example_after) return null;

  return {
    id: `priority-${index}`,
    kind: "priority",
    label: priority.focus ? `${priority.focus}・修改重點` : "修改重點",
    beforeText: priority.example_before,
    afterText: priority.example_after,
    note: priority.issue,
  };
}

function buildErrorCard(error: ErrorSuggestionSource): RevisionSuggestionCard | null {
  if (!error.exampleFix) return null;

  return {
    id: `error-${error.id}`,
    kind: "error",
    label: `${error.category}・${error.subcategory}`,
    beforeText: error.evidenceSpan,
    afterText: error.exampleFix,
    note: error.suggestion,
  };
}

function takeUniqueCards(
  cards: RevisionSuggestionCard[],
  limit: number,
  seen: Set<string>,
) {
  const picked: RevisionSuggestionCard[] = [];

  for (const card of cards) {
    if (picked.length >= limit) break;

    const dedupeKey = buildSuggestionKey(card.beforeText, card.afterText);
    if (seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    picked.push(card);
  }

  return picked;
}

function buildSuggestionKey(beforeText: string | undefined, afterText: string) {
  return `${normalizeComparableText(beforeText || "")}::${normalizeComparableText(afterText)}`;
}

function normalizeComparableText(text: string) {
  return text.replace(/\s+/g, "");
}

function rankPrioritiesForSuggestions(priorities: RevisionPriority[]) {
  return [...priorities].sort((a, b) => {
    const aExample = a.example_after ? 0 : 1;
    const bExample = b.example_after ? 0 : 1;
    if (aExample !== bExample) return aExample - bExample;

    const aFocus = PRIORITY_FOCUS_WEIGHT[a.focus || ""] ?? 99;
    const bFocus = PRIORITY_FOCUS_WEIGHT[b.focus || ""] ?? 99;
    if (aFocus !== bFocus) return aFocus - bFocus;

    return 0;
  });
}
