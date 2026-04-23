import { z } from "zod";

export const NOTEBOOK_FOCUS_TAGS = ["內容", "表達", "結構", "標點"] as const;
export const NOTEBOOK_ENTRY_TYPES = ["manual", "phrase", "lesson"] as const;

export type NotebookFocusTag = (typeof NOTEBOOK_FOCUS_TAGS)[number];
export type NotebookEntryTypeValue = (typeof NOTEBOOK_ENTRY_TYPES)[number];

export type NotebookEntrySummary = {
  id: string;
  entryType: NotebookEntryTypeValue;
  title?: string;
  content: string;
  focusTag?: string;
  tags: string[];
  submissionId?: string;
  submissionPreview?: string;
  sourcePassageId?: string;
  sourceBeforeText?: string;
  sourceAfterText?: string;
  createdAt: string;
  updatedAt: string;
};

export type NotebookCreateInput = {
  entryType: NotebookEntryTypeValue;
  title?: string;
  content: string;
  focusTag?: string;
  tags?: string[];
  submissionId?: string;
  sourcePassageId?: string;
  sourceBeforeText?: string;
  sourceAfterText?: string;
};

export const NotebookCreateSchema = z.object({
  entryType: z.enum(NOTEBOOK_ENTRY_TYPES),
  title: z.string().max(120).optional(),
  content: z.string().min(2).max(4000),
  focusTag: z.string().max(20).optional(),
  tags: z.array(z.string().min(1).max(30)).max(10).optional(),
  submissionId: z.string().optional(),
  sourcePassageId: z.string().optional(),
  sourceBeforeText: z.string().max(200).optional(),
  sourceAfterText: z.string().max(200).optional(),
});

export const NotebookUpdateSchema = z.object({
  title: z.string().max(120).optional(),
  content: z.string().min(2).max(4000).optional(),
  focusTag: z.string().max(20).optional(),
  tags: z.array(z.string().min(1).max(30)).max(10).optional(),
});

type NotebookRecord = {
  id: string;
  entryType: NotebookEntryTypeValue;
  title: string | null;
  content: string;
  focusTag: string | null;
  tags: string[];
  submissionId: string | null;
  sourcePassageId: string | null;
  sourceBeforeText: string | null;
  sourceAfterText: string | null;
  createdAt: Date;
  updatedAt: Date;
  submission?: {
    id: string;
    verifiedText: string;
  } | null;
};

export function serializeNotebookEntry(record: NotebookRecord): NotebookEntrySummary {
  return {
    id: record.id,
    entryType: record.entryType,
    title: record.title || undefined,
    content: record.content,
    focusTag: record.focusTag || undefined,
    tags: record.tags,
    submissionId: record.submissionId || undefined,
    submissionPreview: record.submission?.verifiedText ? previewSubmission(record.submission.verifiedText) : undefined,
    sourcePassageId: record.sourcePassageId || undefined,
    sourceBeforeText: record.sourceBeforeText || undefined,
    sourceAfterText: record.sourceAfterText || undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function normalizeNotebookTags(tags: string[] | undefined) {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const tag of tags || []) {
    const value = tag.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    cleaned.push(value);
  }

  return cleaned.slice(0, 10);
}

export function parseTagInput(value: string) {
  return normalizeNotebookTags(value.split(/[，,]/g));
}

export function normalizeFocusTag(value: string | undefined) {
  return detectFocusTag(value);
}

export function detectFocusTag(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (NOTEBOOK_FOCUS_TAGS.includes(trimmed as NotebookFocusTag)) {
    return trimmed as NotebookFocusTag;
  }

  const ranked = NOTEBOOK_FOCUS_TAGS
    .map((tag) => ({ tag, index: trimmed.indexOf(tag) }))
    .filter((item) => item.index !== -1)
    .sort((a, b) => a.index - b.index);

  return ranked[0]?.tag;
}

export function previewSubmission(text: string) {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (!singleLine) return "未命名文章";
  return singleLine.length > 20 ? `${singleLine.slice(0, 20)}…` : singleLine;
}
