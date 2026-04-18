import { z } from "zod";
import { generateModelText, ANALYSIS_MODEL } from "./anthropic";
import { DEFAULT_WRITING_RUBRIC, rubricAsMarkdown, totalMaxScore, RubricDef } from "./rubric";
import { TAXONOMY, taxonomyAsMarkdown, validCategory } from "./taxonomy";

export const PROMPT_VERSION = "v1-2026-04";

const ErrorItem = z.object({
  category: z.string(),
  subcategory: z.string(),
  evidence_span: z.string().min(1),
  char_offset_start: z.number().int().nonnegative(),
  char_offset_end: z.number().int().positive(),
  suggestion: z.string().min(1),
  severity: z.number().int().min(1).max(3),
  confidence: z.number().min(0).max(1).default(0.8),
});

const AnalysisOutput = z.object({
  scores: z.record(z.string(), z.number()),
  overall_score: z.number(),
  coach_feedback: z.string().min(1),
  strengths: z.array(z.string()).default([]),
  revision_priorities: z.array(z.string()).min(1).max(3),
  errors: z.array(ErrorItem),
});

export type AnalysisResult = z.infer<typeof AnalysisOutput>;

export type AnalysisInput = {
  text: string;
  gradeLevel: string;
  genre?: string;
  taskPrompt?: string;
};

function buildSystemPrompt(rubric: RubricDef): string {
  return [
    "你是一位有耐心的中文寫作導師，對學生既嚴謹又鼓勵。你的語氣溫和、具體、以學生為本，像一位真正的老師而不是機器。",
    "重要規則：",
    "1. 絕不替學生重寫整篇文章或任何段落；你只提供具體的修改建議與啟發式提問。",
    "2. 每一個你指出的錯誤，都必須附上原文中的「證據」：逐字引用的片段與字元位置 (char_offset_start / char_offset_end, 0-based, 以 UTF-16 code unit 為準，即 JavaScript string.length 的計算方式)。",
    "3. 錯誤分類必須嚴格使用下列分類表：",
    taxonomyAsMarkdown(),
    "4. 評分必須緊扣下列評分指標：",
    rubricAsMarkdown(rubric),
    "5. 語氣必須鼓勵、具體、提問式 (Socratic)，例如：「這段的中心句—你最想讓讀者相信的是甚麼？」",
    "6. 輸出必須是嚴格的 JSON，符合所提供 schema。除 JSON 外不得輸出其他文字。",
  ].join("\n\n");
}

function buildUserPrompt(input: AnalysisInput): string {
  const parts = [
    `學生年級: ${input.gradeLevel}`,
    `文體: ${input.genre || "記敘文"}`,
  ];
  if (input.taskPrompt) parts.push(`題目: ${input.taskPrompt}`);
  parts.push("", "學生文章：", input.text);
  parts.push(
    "",
    "請輸出以下 JSON 結構：",
    "{",
    '  "scores": { "content": number, "structure": number, "language": number, "mechanics": number, "expression": number },',
    '  "overall_score": number,',
    '  "coach_feedback": "一段 3–6 句的整體評語，使用導師口吻。",',
    '  "strengths": ["至少列出 2–3 項具體的亮點"],',
    '  "revision_priorities": ["2–3 項最值得先改善的重點，每項一句話"],',
    '  "errors": [',
    '    {',
    '      "category": "分類表中的主分類",',
    '      "subcategory": "分類表中的子分類",',
    '      "evidence_span": "原文逐字引用",',
    '      "char_offset_start": 整數,',
    '      "char_offset_end": 整數,',
    '      "suggestion": "具體建議或啟發式提問",',
    '      "severity": 1 | 2 | 3,',
    '      "confidence": 0..1',
    '    }',
    '  ]',
    "}",
  );
  return parts.join("\n");
}

function extractJson(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  return text.trim();
}

export async function analyzeSubmission(input: AnalysisInput): Promise<{
  result: AnalysisResult;
  modelName: string;
  promptVersion: string;
  rubric: RubricDef;
}> {
  const rubric = DEFAULT_WRITING_RUBRIC;
  const rawText = await generateModelText({
    model: ANALYSIS_MODEL,
    maxTokens: 4096,
    temperature: 0.2,
    system: buildSystemPrompt(rubric),
    user: buildUserPrompt(input),
  });
  const raw = extractJson(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Model output was not valid JSON: ${(e as Error).message}`);
  }
  const result = AnalysisOutput.parse(parsed);

  result.errors = result.errors.filter((e) => {
    if (!validCategory(e.category, e.subcategory)) return false;
    if (e.char_offset_end <= e.char_offset_start) return false;
    if (e.char_offset_end > input.text.length + 4) return false;
    return true;
  });

  const declaredTotal = Object.values(result.scores).reduce((a, b) => a + b, 0);
  if (!Number.isFinite(result.overall_score)) {
    result.overall_score = declaredTotal;
  }
  const cap = totalMaxScore(rubric);
  if (result.overall_score > cap) result.overall_score = cap;

  return {
    result,
    modelName: ANALYSIS_MODEL,
    promptVersion: PROMPT_VERSION,
    rubric,
  };
}

export const ALL_CATEGORIES = TAXONOMY.map((t) => t.category);
