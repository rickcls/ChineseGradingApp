import { z } from "zod";
import { generateModelText, ANALYSIS_MODEL } from "./anthropic";
import {
  DEFAULT_WRITING_RUBRIC,
  DSE_LEVEL_BANDS,
  dseLevelFromScore,
  dseLevelNote,
  minDseLevel,
  rubricAsMarkdown,
  scoreRangeForLevel,
  typoBonus,
  RECOMMENDED_WORD_COUNT,
  RubricDef,
  DseLevel,
} from "./rubric";
import { loadRubricGuideMarkdown } from "./rubricGuide";
import { TAXONOMY, taxonomyAsMarkdown, validCategory } from "./taxonomy";

export const PROMPT_VERSION = "v4-2026-04-md-rubric";

const ErrorItem = z.object({
  category: z.string(),
  subcategory: z.string(),
  evidence_span: z.string().min(1),
  char_offset_start: z.number().int().nonnegative(),
  char_offset_end: z.number().int().positive(),
  suggestion: z.string().min(1),
  example_fix: z.string().optional(),
  severity: z.number().int().min(1).max(3),
  confidence: z.number().min(0).max(1),
});

const RevisionPrioritySchema = z.object({
  focus: z.string().optional(),
  issue: z.string().min(1),
  why: z.string().optional().default(""),
  how: z.array(z.string().min(1)).min(1).max(6),
  example_before: z.string().optional(),
  example_after: z.string().optional(),
});

export type RevisionPriority = z.infer<typeof RevisionPrioritySchema>;

const AnalysisOutput = z.object({
  dse_level: z.string().optional(),
  scores: z.record(z.string(), z.coerce.number()),
  typo_count: z.coerce.number().int().nonnegative().optional(),
  word_count: z.coerce.number().int().nonnegative().optional(),
  coach_feedback: z.string().min(1),
  strengths: z.array(z.string()).default([]),
  revision_priorities: z.array(z.unknown()).min(1),
  errors: z.array(z.unknown()).default([]),
});

export type AnalysisError = z.infer<typeof ErrorItem>;
export type AnalysisResult = {
  scores: Record<string, number>;
  base_score: number;
  typo_count: number;
  typo_bonus: number;
  word_count: number;
  overall_score: number;
  dse_level: DseLevel;
  coach_feedback: string;
  strengths: string[];
  revision_priorities: RevisionPriority[];
  errors: AnalysisError[];
};

export type AnalysisInput = {
  text: string;
  gradeLevel: string;
  genre?: string;
  taskPrompt?: string;
};

function buildSystemPrompt(rubric: RubricDef, rubricGuideMarkdown: string): string {
  return [
    "你是香港中學文憑試（HKDSE）中國語文科卷二「命題寫作」的資深閱卷員。你同時要像一位溫和、具體、以學生為本的中文寫作導師，用鼓勵的口吻把評分理由與改善建議告訴學生。",
    "【最重要的評分原則：嚴格依照 HKDSE 尺度】",
    "- 真實水平分佈：大部分考生落在 Level 2–3；Level 4 屬於良好；Level 5 只佔約全港前 10–15%；5* 約前 4%；5** 僅約前 1%。",
    "- 只有三項全部成立才可考慮 Level 5 以上：(1) 立意深刻或具啟發性；(2) 選材剪裁恰當且具代表性；(3) 表達精煉，修辭靈活，有個人風格。缺一項就該降到 Level 4 或以下。",
    "- 預設取態：保守、嚴格。寧可低評半級也不可高評。",
    "",
    "【評分流程——務必依此順序進行】",
    "第 1 步（整體判斷）：先閱讀全文一次，形成整體印象，並從 U / 1 / 2 / 3 / 4 / 5 / 5* / 5** 中選出整體等級 dse_level。",
    "第 2 步（分項填分）：按第 1 步選定的等級，分別填出四項分數。四項分數必須落在該等級對應的總分區間內（見下表）。",
    "第 3 步（自我檢核）：確認 coach_feedback 中提及的等級、dse_level、以及四項分數之和，三者必須互相吻合。若有不一致，降級而非升級。",
    "",
    "【現行評分細則全文】",
    "以下 markdown 文件是目前採用的評分準則；若你原有印象與文件不同，一律以此文件為準：",
    rubricGuideMarkdown,
    "",
    "【結構化評分簡表（便於對應輸出欄位）】",
    rubricAsMarkdown(rubric),
    "",
    "【整體等級 ↔ 總分對照表（基本分，未含錯別字獎勵）】",
    buildLevelAnchorTable(),
    "",
    "【分項錨點：各項得分對應等級】",
    buildPerCriterionAnchorTable(rubric),
    "",
    "【典型水平參考】",
    "- 內容完整、敘事順暢但情感描寫一般、立意平實、表達通順但無突出文采 → Level 3（總分約 50–59）。這是中六學生最常見的中位水平。",
    "- 內容具體有代表性、結構完整、偶有佳句但整體未達精煉 → Level 4（總分約 66–79）。",
    "- 內容立意有深度、結構緊湊、語言有個人風格與文采 → Level 5（總分約 80–87）。",
    "- 絕大多數中學生作品落在 Level 2–4 之間。若你打算給 Level 5 或以上，請再問自己一次：這篇是否真的屬於全港前 15% 水平？若有遲疑，降級。",
    "",
    "【錯別字與字數】",
    `- 建議篇幅 ${RECOMMENDED_WORD_COUNT} 字或以上。字數明顯不足（例如少於 ${RECOMMENDED_WORD_COUNT - 150} 字）會令「內容」難以充實、「結構」難以完整，必須相應扣分。`,
    "- 錯別字獎勵獨立計算，不可把它混入四項基本分之中；全卷錯別字獎勵為：0–1 個 +3 分、2–4 個 +2 分、5–7 個 +1 分、8 個或以上不加分。",
    "- 注意：錯別字獎勵只是卷面加成，系統不會讓它推動等級邊界（即 Level 4 + 錯別字獎勵不會變成 Level 5）。等級由基本分決定。",
    "- 請在輸出中誠實申報 typo_count（全文錯別字數）與 word_count（中文字符數，不含標點與空白）。",
    "",
    "【你要找出的錯誤／批註類型】",
    "對每一處指出的錯誤，都必須附上逐字證據與字元位置（char_offset_start / char_offset_end，0-based，以 UTF-16 code unit 計，即 JavaScript string.length 的計算方式）。",
    "錯誤分類必須嚴格使用下列分類表：",
    taxonomyAsMarkdown(),
    "",
    "【導師語氣規則】",
    "1. 絕不替學生重寫整段或整篇；改寫示範以「一至兩句」為上限。",
    "2. 語氣溫和、具體、以學生為本；提問式（Socratic）可作輔助，但必須配合具體範例，不能只有空泛提問。",
    "3. 在 coach_feedback 中，要誠實點出本文對應的 DSE 等級以及主要升級方向；等級必須與 dse_level 欄位一致。",
    "",
    "【改進建議 revision_priorities 的詳細規格——最重要】",
    "- 要詳盡：把文章中所有明顯可改進之處都列出來（至少 3 項，最多 8 項），按對升級影響力排序，最關鍵的在最前。不要只列 1–2 項。",
    "- 範圍不應只集中在「內容」——要覆蓋內容／表達／結構／標點四個面向中凡有實際改進空間的部分。",
    "- 每一項必須包含以下完整結構：",
    "    · focus：建議屬於哪一項評分面向（內容 / 表達 / 結構 / 標點）",
    "    · issue：一句話指出問題所在",
    "    · why：1–2 句說明為何此問題令作品停留在目前 DSE 等級；改善後能帶來甚麼升級效果",
    "    · how：3–5 個可直接執行的步驟（不是空泛口號；每步要讓學生讀完就知道下一步動作是甚麼）",
    "    · example_before：（若適用）原文中的短引文，不超過 30 字",
    "    · example_after：示範改寫一至兩句，不超過 60 字；必須是具體可抄寫／可模仿的文字，不可只是「你可以這樣想」這類提問——學生要能一眼看到「原來寫成這樣就更好」",
    "- 絕對禁止在 example_after 中整段重寫，或超過兩句。若問題本質是「整篇立意偏離」，example_after 應示範「開頭主旨句」或「結尾昇華句」的一句改寫，而不是整段重構。",
    "- 若問題完全沒有具體正確答案（例如「情感深度不足」），仍要在 how 中給出三項具體可執行的練習方法，並在 example_after 寫一句可模仿的示範句。",
    "",
    "【example_fix 使用原則】",
    "- example_fix 是針對該 evidence_span 的短示範修訂，用來讓學生看懂「怎樣改」。",
    "- 長度規範：只改 evidence_span 範圍內的字句，不可擴張成整句／整段重寫（最多 25 個中文字）。",
    "- 只在錯別字／標點／詞語搭配／明顯語病等「有具體正確答案」的問題提供 example_fix。",
    "- 立意／選材／結構佈局／情感深度等開放性問題留空，只用 suggestion 做啟發式提問。",
    "",
    "【輸出格式】",
    "必須是嚴格的 JSON，符合指定 schema，除 JSON 外不得輸出其他文字。所有分數必須是整數。",
  ].join("\n");
}

function buildLevelAnchorTable(): string {
  return DSE_LEVEL_BANDS.map((band) => {
    const range = scoreRangeForLevel(band.level);
    return `- Level ${band.level}：總分 ${range.min}–${range.max}。${band.note}`;
  }).join("\n");
}

function buildPerCriterionAnchorTable(rubric: RubricDef): string {
  return rubric.criteria
    .map((c) => {
      const bands = c.descriptors
        .map((d) => {
          const mappedLevel = (() => {
            if (d.band === "上") return "Level 5 / 5* / 5**";
            if (d.band === "中上") return "Level 4";
            if (d.band === "中") return "Level 3";
            return "Level 1 / 2 / U";
          })();
          return `    · ${d.range[0]}–${d.range[1]} 分（${d.band}）→ ${mappedLevel}`;
        })
        .join("\n");
      return `- **${c.label}**（滿分 ${c.maxScore}）：\n${bands}`;
    })
    .join("\n");
}

function buildUserPrompt(input: AnalysisInput): string {
  const charCount = countChineseChars(input.text);
  const parts = [
    `學生年級：${input.gradeLevel}`,
    `文體：${input.genre || "命題寫作"}`,
  ];
  if (input.taskPrompt) parts.push(`題目：${input.taskPrompt}`);
  parts.push(`文章字數（系統估算）：約 ${charCount} 字`);
  parts.push("", "學生文章：", input.text);
  parts.push(
    "",
    "請嚴格以 HKDSE 命題寫作標準評分，輸出以下 JSON 結構（所有分數為整數）：",
    "{",
    '  "dse_level": "整體 DSE 等級，必須是 U / 1 / 2 / 3 / 4 / 5 / 5* / 5** 其中之一",',
    '  "scores": {',
    '    "content": 0-40 整數,',
    '    "expression": 0-30 整數,',
    '    "structure": 0-20 整數,',
    '    "punctuation": 0-10 整數',
    "  },",
    '  "typo_count": 全文錯別字總數（整數）,',
    '  "word_count": 全文中文字符數（不含標點空白）,',
    '  "coach_feedback": "3–6 句整體評語。開頭第一句請明確指出 DSE 等級並說明原因，用溫和但具體的口吻。等級措辭必須與 dse_level 欄位一致。",',
    '  "strengths": ["3–5 項具體亮點，每項一句"],',
    '  "revision_priorities": [',
    '    {',
    '      "focus": "內容 | 表達 | 結構 | 標點",',
    '      "issue": "一句話點出問題",',
    '      "why": "1–2 句說明為何此問題令作品停在目前等級，以及改善後能帶來甚麼升級效果",',
    '      "how": ["可執行步驟 1", "步驟 2", "步驟 3"],',
    '      "example_before": "（可選）原文短引文，不超過 30 字",',
    '      "example_after": "示範改寫一至兩句，不超過 60 字，必須是可直接抄寫／模仿的具體文字"',
    "    }",
    "    ... 至少 3 項、最多 8 項，按升級影響力排序",
    "  ],",
    '  "errors": [',
    '    {',
    '      "category": "分類表中的主分類",',
    '      "subcategory": "分類表中的子分類",',
    '      "evidence_span": "原文逐字引用",',
    '      "char_offset_start": 整數,',
    '      "char_offset_end": 整數,',
    '      "suggestion": "說明為何要改的具體建議或啟發式提問",',
    '      "example_fix": "（可選）針對 evidence_span 的短示範修訂；只在有具體正確答案時提供，長度不超過 25 字；開放性問題請留空",',
    '      "severity": 1 | 2 | 3,',
    '      "confidence": 0..1',
    '    }',
    '  ]',
    "}",
    "",
    "自我檢核（輸出前必做）：",
    "1. 分項分數之和是否落在 dse_level 對應的總分區間內？若不在，調整分項分數或調整 dse_level。",
    "2. coach_feedback 開頭提到的等級，是否與 dse_level 完全一致？若不一致，修正文字。",
    "3. 把這篇文章和「典型 Level 3 作文」（內容完整但平淡、表達通順但單一）比較一次——我給的是否合理？",
    "4. 如果我打算給 Level 5 或以上，立意是否真的深刻？表達是否真的精煉？有遲疑就降級。",
    "5. 如果字數明顯不足 600，內容與結構分是否已相應下調？",
    "6. 結構的 10 分制等效分數是否高於內容？若高於，請先下調結構分。",
  );
  return parts.join("\n");
}

function extractJson(text: string): string {
  const trimmed = text.trim();

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return extractJson(fenced[1]);
  }

  const unfenced = trimmed
    .replace(/^```[a-zA-Z0-9_-]*\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  if (unfenced !== trimmed) {
    return extractJson(unfenced);
  }

  const firstObjectBrace = trimmed.indexOf("{");
  const lastObjectBrace = trimmed.lastIndexOf("}");
  if (firstObjectBrace !== -1 && lastObjectBrace > firstObjectBrace) {
    return trimmed.slice(firstObjectBrace, lastObjectBrace + 1);
  }

  const firstArrayBracket = trimmed.indexOf("[");
  const lastArrayBracket = trimmed.lastIndexOf("]");
  if (firstArrayBracket !== -1 && lastArrayBracket > firstArrayBracket) {
    return trimmed.slice(firstArrayBracket, lastArrayBracket + 1);
  }

  return trimmed;
}

function parseRevisionPriority(value: unknown): RevisionPriority | null {
  // Backward-compat: old analyses stored plain strings in revision_priorities.
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return null;
    return { issue: text, why: "", how: [text] };
  }
  if (!isRecord(value)) return null;

  const howRaw = Array.isArray(value.how)
    ? value.how
    : typeof value.how === "string"
      ? [value.how]
      : [];
  const how = howRaw
    .map((item) => normalizeString(item))
    .filter((item): item is string => item.length > 0)
    .slice(0, 6);
  const issue = normalizeString(value.issue);
  if (issue.length === 0) return null;
  if (how.length === 0) {
    const fallback = normalizeString(value.why) || issue;
    how.push(fallback);
  }

  return {
    focus: normalizeCriterionFocus(value.focus),
    issue,
    why: normalizeString(value.why),
    how,
    example_before: sanitizeExampleLine(value.example_before, 30),
    example_after: sanitizeExampleLine(value.example_after, 60),
  };
}

function sanitizeExampleLine(value: unknown, maxChars: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  // Hard rule: at most two sentences. Drop anything longer to enforce the
  // "no paragraph-scale rewrite" policy even when the model overshoots.
  const sentenceCount = (trimmed.match(/[。！？!?…]/g) || []).length;
  if (sentenceCount > 2) return undefined;
  const chars = Array.from(trimmed);
  if (chars.length > maxChars) return undefined;
  return trimmed;
}

const VALID_DSE_LEVELS: DseLevel[] = ["U", "1", "2", "3", "4", "5", "5*", "5**"];

function parseDseLevel(value: unknown): DseLevel | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/^level\s*/i, "").replace(/^等級\s*/i, "");
  return (VALID_DSE_LEVELS as string[]).includes(trimmed) ? (trimmed as DseLevel) : null;
}

function countChineseChars(text: string): number {
  const matches = text.match(/[一-鿿㐀-䶿]/g);
  return matches ? matches.length : 0;
}

export async function analyzeSubmission(input: AnalysisInput): Promise<{
  result: AnalysisResult;
  modelName: string;
  promptVersion: string;
  rubric: RubricDef;
}> {
  const rubric = DEFAULT_WRITING_RUBRIC;
  const rubricGuideMarkdown = loadRubricGuideMarkdown();
  const rawText = await generateModelText({
    model: ANALYSIS_MODEL,
    maxTokens: 4096,
    temperature: 0.2,
    system: buildSystemPrompt(rubric, rubricGuideMarkdown),
    user: buildUserPrompt(input),
  });
  const raw = extractJson(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Model output was not valid JSON: ${(e as Error).message}`);
  }
  const parsedOutput = AnalysisOutput.parse(parsed);

  // Clamp per-criterion scores to their declared max.
  const clampedScores: Record<string, number> = {};
  for (const criterion of rubric.criteria) {
    const raw = Number(parsedOutput.scores[criterion.key]);
    const safe = Number.isFinite(raw) ? raw : 0;
    clampedScores[criterion.key] = Math.max(0, Math.min(criterion.maxScore, Math.round(safe)));
  }
  enforceStructureNotAboveContent(clampedScores, rubric);

  const baseScore = Object.values(clampedScores).reduce((a, b) => a + b, 0);
  const modelTypoCount = Number.isFinite(parsedOutput.typo_count as number)
    ? Number(parsedOutput.typo_count)
    : undefined;
  const fallbackWordCount = countChineseChars(input.text);
  const wordCount = Number.isFinite(parsedOutput.word_count as number)
    ? Number(parsedOutput.word_count)
    : fallbackWordCount;

  // Prefer declared typo count; otherwise approximate from flagged 錯別字／形近字／同音字 errors.
  const parsedErrorsRaw = parsedOutput.errors
    .map((item) => ErrorItem.safeParse(normalizeErrorItem(item)))
    .filter((item): item is { success: true; data: z.infer<typeof ErrorItem> } => item.success)
    .map((item) => item.data);

  const typoFromErrors = parsedErrorsRaw.filter(
    (e) => e.category === "字詞" && ["錯別字", "形近字", "同音字"].includes(e.subcategory),
  ).length;
  const typoCount = modelTypoCount ?? typoFromErrors;
  const bonus = typoBonus(typoCount);
  // Level is derived from base score only — the typo bonus is a presentation
  // top-up and must not push a piece across a level boundary. Overall score
  // still includes the bonus for the 0–103 total shown to the student.
  const overallScore = Math.min(100 + 3, baseScore + bonus);
  const scoreLevel = dseLevelFromScore(baseScore);
  const modelLevel = parseDseLevel(parsedOutput.dse_level);
  // When model's holistic judgment disagrees with the arithmetic, err
  // conservative: take the lower of the two. Holistic narratives are
  // usually more honest than inflated sub-scores.
  const dseLevel: DseLevel = modelLevel ? minDseLevel(scoreLevel, modelLevel) : scoreLevel;

  const result: AnalysisResult = {
    scores: clampedScores,
    base_score: baseScore,
    typo_count: typoCount,
    typo_bonus: bonus,
    word_count: wordCount,
    overall_score: overallScore,
    dse_level: dseLevel,
    coach_feedback: parsedOutput.coach_feedback.trim(),
    strengths: parsedOutput.strengths.map((item) => item.trim()).filter(Boolean),
    revision_priorities: parsedOutput.revision_priorities
      .map(parseRevisionPriority)
      .filter((item): item is RevisionPriority => item !== null)
      .slice(0, 8),
    errors: parsedErrorsRaw
      .filter((e) => validCategory(e.category, e.subcategory))
      .map((e) => realignErrorOffsets(e, input.text))
      .filter((e): e is AnalysisError => e !== null)
      .map((e) => ({ ...e, example_fix: sanitizeExampleFix(e.example_fix, e.evidence_span) })),
  };

  if (result.coach_feedback.length === 0) {
    result.coach_feedback = `我讀完了。以現有水平大約對應 HKDSE Level ${dseLevel}（${dseLevelNote(
      dseLevel,
    )}）。先別急著一次改完，挑一兩個最關鍵的位置慢慢整理就好。`;
  }

  if (result.revision_priorities.length === 0) {
    result.revision_priorities = [
      {
        focus: "內容",
        issue: "先從一段最想說清楚的內容開始整理。",
        why: "把立意、具體事例與情感鋪陳好，是所有升級改動的基礎。",
        how: [
          "挑選全文最能代表你想法的一段作為核心段。",
          "先用一句寫出該段的主旨句。",
          "補充兩到三個具體細節（人、事、景、感）支撐主旨。",
        ],
      },
    ];
  }

  return {
    result,
    modelName: ANALYSIS_MODEL,
    promptVersion: PROMPT_VERSION,
    rubric,
  };
}

export const ALL_CATEGORIES = TAXONOMY.map((t) => t.category);

function normalizeErrorItem(value: unknown) {
  const item = isRecord(value) ? value : {};

  return {
    category: normalizeString(item.category),
    subcategory: normalizeString(item.subcategory),
    evidence_span: normalizeString(item.evidence_span),
    char_offset_start: nonNegativeInteger(item.char_offset_start, 0),
    char_offset_end: positiveInteger(item.char_offset_end, 1),
    suggestion: normalizeString(item.suggestion),
    example_fix: normalizeOptionalString(item.example_fix),
    severity: boundedInteger(item.severity, 1, 3, 1),
    confidence: boundedNumber(item.confidence, 0, 1, 0.8),
  };
}

function boundedInteger(value: unknown, min: number, max: number, fallback: number) {
  return Math.round(boundedNumber(value, min, max, fallback));
}

function nonNegativeInteger(value: unknown, fallback: number) {
  const numeric = toFiniteNumber(value);
  if (numeric === null) return fallback;
  return Math.max(0, Math.floor(numeric));
}

function positiveInteger(value: unknown, fallback: number) {
  const numeric = toFiniteNumber(value);
  if (numeric === null) return fallback;
  return Math.max(1, Math.floor(numeric));
}

function boundedNumber(value: unknown, min: number, max: number, fallback: number) {
  const numeric = toFiniteNumber(value);
  if (numeric === null) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function toFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function normalizeCriterionFocus(value: unknown): string | undefined {
  const text = normalizeOptionalString(value);
  if (!text) return undefined;

  const normalized = text.replace(/\s+/g, "");
  if (["內容", "content"].includes(normalized)) return "內容";
  if (["表達", "expression"].includes(normalized)) return "表達";
  if (["結構", "structure"].includes(normalized)) return "結構";
  if (["標點", "標點字體", "punctuation"].includes(normalized)) return "標點";
  return text;
}

// Keep example_fix phrase-level: cap length relative to the evidence span so the
// model can't smuggle in a whole-paragraph rewrite.
function sanitizeExampleFix(example: string | undefined, evidenceSpan: string): string | undefined {
  if (!example) return undefined;
  const trimmed = example.trim();
  if (trimmed.length === 0) return undefined;
  const evidenceLen = Array.from(evidenceSpan).length;
  const hardCap = 25;
  const relativeCap = Math.max(6, Math.ceil(evidenceLen * 1.5));
  const allowed = Math.min(hardCap, relativeCap);
  const chars = Array.from(trimmed);
  if (chars.length <= allowed) return trimmed;
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function enforceStructureNotAboveContent(scores: Record<string, number>, rubric: RubricDef) {
  const content = rubric.criteria.find((criterion) => criterion.key === "content");
  const structure = rubric.criteria.find((criterion) => criterion.key === "structure");
  if (!content || !structure) return;

  const contentScore = scores[content.key];
  const structureScore = scores[structure.key];
  if (!Number.isFinite(contentScore) || !Number.isFinite(structureScore)) return;

  const maxStructureFromContent = Math.floor((contentScore / content.maxScore) * structure.maxScore);
  if (structureScore > maxStructureFromContent) {
    scores[structure.key] = Math.max(0, Math.min(structure.maxScore, maxStructureFromContent));
  }
}

// LLMs cannot reliably count UTF-16 offsets in long Chinese text, so trust the
// quoted evidence_span and relocate it in the source. The model's claimed
// offset is kept only as a tiebreaker when the span appears more than once.
function realignErrorOffsets(error: AnalysisError, sourceText: string): AnalysisError | null {
  const span = error.evidence_span;
  if (!span) return null;

  const hint = error.char_offset_start;
  const directMatch = findClosestOccurrence(sourceText, span, hint);
  if (directMatch !== -1) {
    return {
      ...error,
      char_offset_start: directMatch,
      char_offset_end: directMatch + span.length,
    };
  }

  const trimmedSpan = span.trim();
  if (trimmedSpan.length > 0 && trimmedSpan !== span) {
    const trimmedMatch = findClosestOccurrence(sourceText, trimmedSpan, hint);
    if (trimmedMatch !== -1) {
      return {
        ...error,
        evidence_span: trimmedSpan,
        char_offset_start: trimmedMatch,
        char_offset_end: trimmedMatch + trimmedSpan.length,
      };
    }
  }

  return null;
}

function findClosestOccurrence(haystack: string, needle: string, hint: number): number {
  if (needle.length === 0) return -1;
  let best = -1;
  let bestDist = Number.POSITIVE_INFINITY;
  let from = 0;
  while (true) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) break;
    const dist = Math.abs(idx - hint);
    if (dist < bestDist) {
      best = idx;
      bestDist = dist;
    }
    from = idx + 1;
  }
  return best;
}
