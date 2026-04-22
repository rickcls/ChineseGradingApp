// Shared shape for a single revision priority. Kept in its own module with
// zero runtime dependencies so both server and client components can import it.
export type RevisionPriority = {
  focus?: string;
  issue: string;
  why: string;
  how: string[];
  example_before?: string;
  example_after?: string;
};

// Accepts:
//   - new object form: { focus, issue, why, how, example_before, example_after }
//   - legacy string form (previous schema): a plain sentence
// Returns a clean RevisionPriority[] ready for rendering.
export function normalizeRevisionPriorities(raw: unknown): RevisionPriority[] {
  if (!Array.isArray(raw)) return [];
  const out: RevisionPriority[] = [];
  for (const item of raw) {
    const normalized = normalizeOne(item);
    if (normalized) out.push(normalized);
  }
  return out;
}

function normalizeOne(value: unknown): RevisionPriority | null {
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return null;
    return { issue: text, why: "", how: [text] };
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  const issue = typeof record.issue === "string" ? record.issue.trim() : "";
  if (!issue) return null;

  const howRaw = Array.isArray(record.how)
    ? record.how
    : typeof record.how === "string"
      ? [record.how]
      : [];
  const how = howRaw
    .map((step) => (typeof step === "string" ? step.trim() : ""))
    .filter((step) => step.length > 0)
    .slice(0, 6);

  return {
    focus: optionalString(record.focus),
    issue,
    why: typeof record.why === "string" ? record.why.trim() : "",
    how: how.length > 0 ? how : [issue],
    example_before: optionalString(record.example_before),
    example_after: optionalString(record.example_after),
  };
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}
