import { z } from "zod";
import { ANALYSIS_FALLBACK_MODEL, ANALYSIS_MODEL, generateModelText } from "./anthropic";
import type { RevisionPriority } from "./revisionPriority";

export const MODEL_PASSAGE_PROMPT_VERSION = "v1-2026-04-reference-passage";
export const MODEL_PASSAGE_MODEL = process.env.MODEL_PASSAGE_MODEL || ANALYSIS_MODEL;
export const MODEL_PASSAGE_FALLBACK_MODEL =
  process.env.MODEL_PASSAGE_FALLBACK_MODEL || ANALYSIS_FALLBACK_MODEL;
const MODEL_PASSAGE_TIMEOUT_MS = parsePositiveInt(process.env.MODEL_PASSAGE_TIMEOUT_MS, 120000);
const MODEL_PASSAGE_REPAIR_TIMEOUT_MS = parsePositiveInt(process.env.MODEL_PASSAGE_REPAIR_TIMEOUT_MS, 30000);

const StoredHighlightSchema = z.object({
  focus: z.string().min(1),
  beforeText: z.string().optional(),
  afterText: z.string().min(1),
  whatChanged: z.string().min(1),
  whyItHelps: z.string().min(1),
  keepInMind: z.string().min(1),
  saveablePhrase: z.string().optional(),
});

const RawHighlightSchema = z.object({
  focus: z.string().min(1),
  before_text: z.string().optional(),
  after_text: z.string().min(1),
  what_changed: z.string().min(1),
  why_it_helps: z.string().min(1),
  keep_in_mind: z.string().min(1),
  saveable_phrase: z.string().optional(),
});

const RawModelPassageSchema = z.object({
  generated_passage: z.string().min(40),
  highlights: z.array(RawHighlightSchema).min(5).max(8),
});

export type ModelPassageHighlight = {
  id: string;
  focus: string;
  beforeText?: string;
  afterText: string;
  whatChanged: string;
  whyItHelps: string;
  keepInMind: string;
  saveablePhrase?: string;
};

export type StoredModelPassage = {
  id: string;
  submissionId: string;
  generatedText: string;
  highlights: ModelPassageHighlight[];
  modelName: string;
  promptVersion: string;
  createdAt: string;
  updatedAt: string;
};

type GenerateModelPassageInput = {
  text: string;
  gradeLevel: string;
  genre?: string;
  taskPrompt?: string;
  coachFeedbackText?: string;
  revisionPriorities?: RevisionPriority[];
};

type StoredPassageRecord = {
  id: string;
  submissionId: string;
  generatedText: string;
  highlights: unknown;
  modelName: string;
  promptVersion: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function generateModelPassage(input: GenerateModelPassageInput) {
  const rawText = await generateModelText({
    model: MODEL_PASSAGE_MODEL,
    fallbackModel: MODEL_PASSAGE_FALLBACK_MODEL,
    system: buildSystemPrompt(),
    user: buildUserPrompt(input),
    maxTokens: 2600,
    temperature: 0.35,
    timeoutMs: MODEL_PASSAGE_TIMEOUT_MS,
    taskName: "model-passage",
  });

  const parsed = await parseModelPassagePayload(rawText);
  const highlights = parsed.highlights.map((item, index) => ({
    id: `highlight-${index + 1}`,
    focus: item.focus.trim(),
    beforeText: optionalString(item.before_text),
    afterText: item.after_text.trim(),
    whatChanged: item.what_changed.trim(),
    whyItHelps: item.why_it_helps.trim(),
    keepInMind: item.keep_in_mind.trim(),
    saveablePhrase: optionalString(item.saveable_phrase),
  }));

  return {
    generatedText: parsed.generated_passage.trim(),
    highlights,
    modelName: MODEL_PASSAGE_MODEL,
    promptVersion: MODEL_PASSAGE_PROMPT_VERSION,
  };
}

export function serializeModelPassage(record: StoredPassageRecord): StoredModelPassage {
  const parsedHighlights = z.array(StoredHighlightSchema).safeParse(record.highlights);
  const highlights = (parsedHighlights.success ? parsedHighlights.data : []).map((item, index) => ({
    id: `${record.id}-highlight-${index + 1}`,
    focus: item.focus,
    beforeText: item.beforeText,
    afterText: item.afterText,
    whatChanged: item.whatChanged,
    whyItHelps: item.whyItHelps,
    keepInMind: item.keepInMind,
    saveablePhrase: item.saveablePhrase,
  }));

  return {
    id: record.id,
    submissionId: record.submissionId,
    generatedText: record.generatedText,
    highlights,
    modelName: record.modelName,
    promptVersion: record.promptVersion,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function findNormalizedMatch(source: string, snippet: string | undefined) {
  if (!snippet) return null;

  const normalizedSnippet = normalizeComparableText(snippet);
  if (!normalizedSnippet) return null;

  let normalizedSource = "";
  const indexMap: number[] = [];

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (/\s/.test(char)) continue;
    normalizedSource += char;
    indexMap.push(index);
  }

  const matchIndex = normalizedSource.indexOf(normalizedSnippet);
  if (matchIndex === -1) return null;

  const start = indexMap[matchIndex];
  const end = indexMap[matchIndex + normalizedSnippet.length - 1] + 1;

  return {
    start,
    end,
    text: source.slice(start, end),
  };
}

function buildSystemPrompt() {
  return [
    "你是香港學生的中文寫作教練，要產出一篇『AI 參考範文』，目的不是替學生交功課，而是讓學生對照學習。",
    "你的任務是：在完全保留學生核心情節、事實、人物關係、立場與主題方向的前提下，把原文潤飾成一篇較成熟、較完整、較易模仿的參考版本。",
    "必須遵守：",
    "1. 不可虛構重大情節、人物背景、時間地點或結局。",
    "2. 可以補足過渡句、心理感受、感官細節、主旨句、結尾昇華句，但只可作輕度充實，不可把文章改寫成另一個故事。",
    "3. 語氣要符合中學生程度，不能過分華麗、艱澀或像成人專欄。",
    "4. 參考範文應保留原文大致篇幅與段落節奏，可稍微更完整，但不要暴增篇幅。",
    "5. highlights 是教學重點，不是逐句 diff。請挑 5–8 個最值得學生學習的改動。",
    "6. 若能引用原文片段，before_text 必須逐字對應原文；若不適合逐字引用，可留空。",
    "7. after_text 應是對應的改寫片段，讓學生一眼看出『這裡是怎樣變得更好』。",
    "8. what_changed 要說清楚改動了甚麼；why_it_helps 要說清楚為何這樣更好；keep_in_mind 要寫成學生之後可記住的提醒。",
    "9. saveable_phrase 只在真的值得收藏的句式或片語時才提供，否則留空。",
    "只輸出嚴格 JSON，不要加解說文字。",
  ].join("\n");
}

function buildUserPrompt(input: GenerateModelPassageInput) {
  const priorities = (input.revisionPriorities || []).slice(0, 4);

  return [
    `學生年級：${input.gradeLevel}`,
    `文體：${input.genre || "記敘／命題寫作"}`,
    input.taskPrompt ? `題目：${input.taskPrompt}` : null,
    input.coachFeedbackText ? `現有導師評語：${input.coachFeedbackText}` : null,
    priorities.length
      ? [
          "現有修訂重點：",
          ...priorities.map((priority, index) => `${index + 1}. ${priority.focus ? `[${priority.focus}] ` : ""}${priority.issue}`),
        ].join("\n")
      : null,
    "",
    "學生原文：",
    input.text,
    "",
    "請輸出以下 JSON：",
    "{",
    '  "generated_passage": "完整 AI 參考範文",',
    '  "highlights": [',
    "    {",
    '      "focus": "內容 | 表達 | 結構 | 標點",',
    '      "before_text": "可選；逐字引用原文片段",',
    '      "after_text": "對應改寫片段",',
    '      "what_changed": "說明這裡改了甚麼",',
    '      "why_it_helps": "說明這樣有甚麼效果",',
    '      "keep_in_mind": "學生下次可記住的提醒",',
    '      "saveable_phrase": "可選；值得收藏的句式或片語"',
    "    }",
    "  ]",
    "}",
    "",
    "額外要求：",
    "1. generated_passage 必須是完整通順的全文，不是大綱。",
    "2. highlights 按教學價值排序，前面優先放內容、結構、情感、過渡等高層次改動；若有字詞或標點修正，可放後面。",
    "3. after_text 請盡量從 generated_passage 中直接擷取，使學生容易對照。",
    "4. 不要把整篇寫成唯一正解，仍要保留原文的學生語氣與事件核心。",
  ]
    .filter(Boolean)
    .join("\n");
}

function extractJson(text: string): string {
  const trimmed = text.trim();

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return extractJson(fenced[1]);
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

async function parseModelPassagePayload(rawText: string) {
  const extracted = extractJson(rawText);
  const initialParse = tryParseModelPassagePayload(extracted);
  if (initialParse.success) {
    return initialParse.data;
  }

  const repairedText = await repairModelPassagePayload(extracted);
  const repairedParse = tryParseModelPassagePayload(repairedText);
  if (repairedParse.success) {
    return repairedParse.data;
  }

  const message = repairedParse.errorMessage || initialParse.errorMessage || "unknown parse error";
  throw new Error(`MODEL_PASSAGE_PARSE_FAILED: ${message}`);
}

function buildJsonRepairCandidates(text: string) {
  const base = stripBom(text).trim();
  const candidates = new Set<string>([base]);

  const normalizedQuotes = base
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
  candidates.add(normalizedQuotes);

  const withoutTrailingCommas = normalizedQuotes.replace(/,\s*([}\]])/g, "$1");
  candidates.add(withoutTrailingCommas);

  const withInsertedObjectCommas = withoutTrailingCommas
    .replace(/}\s*\n\s*{/g, "},\n{")
    .replace(/}\s*{/g, "},{");
  candidates.add(withInsertedObjectCommas);

  const withInsertedArrayCommas = withInsertedObjectCommas
    .replace(/"\s*\n\s*{/g, '",\n{')
    .replace(/"\s*{/g, '",{');
  candidates.add(withInsertedArrayCommas);

  return Array.from(candidates).filter(Boolean);
}

function tryParseModelPassagePayload(text: string) {
  const candidates = buildJsonRepairCandidates(text);
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      return {
        success: true as const,
        data: RawModelPassageSchema.parse(JSON.parse(candidate)),
      };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    success: false as const,
    errorMessage: lastError instanceof Error ? lastError.message : "unknown parse error",
  };
}

async function repairModelPassagePayload(rawText: string) {
  const repaired = await generateModelText({
    model: MODEL_PASSAGE_MODEL,
    fallbackModel: MODEL_PASSAGE_FALLBACK_MODEL,
    system: [
      "你是一個 JSON 修復器。",
      "你的工作不是重寫內容，而是把使用者提供的『幾乎正確但格式壞掉的 JSON』修成合法 JSON。",
      "必須保留原有內容、欄位名稱和語意，只可做最低限度的格式修補，例如補逗號、補引號、刪多餘逗號、修正不完整陣列結構。",
      "輸出必須只有合法 JSON，不要附加任何說明。",
      '目標 schema：{"generated_passage":"string","highlights":[{"focus":"string","before_text":"string?","after_text":"string","what_changed":"string","why_it_helps":"string","keep_in_mind":"string","saveable_phrase":"string?"}]}',
    ].join("\n"),
    user: ["請把下面這段內容修成合法 JSON，只輸出修好的 JSON：", rawText].join("\n\n"),
    maxTokens: 3200,
    temperature: 0,
    timeoutMs: MODEL_PASSAGE_REPAIR_TIMEOUT_MS,
    taskName: "model-passage-repair",
  });

  return extractJson(repaired);
}

function normalizeComparableText(text: string) {
  return text.replace(/\s+/g, "");
}

function stripBom(text: string) {
  return text.replace(/^\uFEFF/, "");
}

function optionalString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parsePositiveInt(raw: string | undefined, fallback: number) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}
