import { z } from "zod";
import {
  ANALYSIS_FALLBACK_MODEL,
  COACH_MODEL,
  generateModelText,
} from "@/lib/anthropic";
import {
  normalizeFocusTag,
  normalizeNotebookTags,
  type NotebookEntrySummary,
} from "@/lib/notebook";
import type { RevisionPriority } from "@/lib/revisionPriority";

export type NotebookNoteDraft = Pick<
  NotebookEntrySummary,
  "title" | "content" | "focusTag" | "tags"
>;

export type GenerateNotebookNoteDraftInput = {
  text: string;
  gradeLevel: string;
  genre?: string;
  taskPrompt?: string;
  coachFeedbackText: string;
  strengths: string[];
  revisionPriorities: RevisionPriority[];
  requestedFocusTag?: string;
};

const NOTEBOOK_NOTE_FALLBACK_MODEL =
  process.env.NOTEBOOK_NOTE_FALLBACK_MODEL || ANALYSIS_FALLBACK_MODEL;
const NOTEBOOK_NOTE_TIMEOUT_MS = parsePositiveInt(
  process.env.NOTEBOOK_NOTE_TIMEOUT_MS,
  45000,
);

const NotebookNoteDraftSchema = z.object({
  title: z.string().min(1).max(60).optional(),
  content: z.string().min(2).max(2600),
  focusTag: z.string().max(20).optional(),
  tags: z.array(z.string().min(1).max(30)).max(5).optional(),
});

export async function generateNotebookNoteDraft(
  input: GenerateNotebookNoteDraftInput,
): Promise<NotebookNoteDraft> {
  const raw = await generateModelText({
    system: buildSystemPrompt(),
    user: buildUserPrompt(input),
    model: COACH_MODEL,
    fallbackModel: NOTEBOOK_NOTE_FALLBACK_MODEL,
    maxTokens: 1500,
    temperature: 0.25,
    timeoutMs: NOTEBOOK_NOTE_TIMEOUT_MS,
    taskName: "notebook-note",
  });

  const parsed = NotebookNoteDraftSchema.parse(JSON.parse(extractJson(raw)));

  return {
    title: parsed.title?.trim() || undefined,
    content: parsed.content.trim(),
    focusTag: normalizeFocusTag(parsed.focusTag) || undefined,
    tags: normalizeNotebookTags(parsed.tags),
  };
}

function buildSystemPrompt() {
  return [
    "你是一位香港中文寫作導師，負責把一篇文章的回饋濃縮成一則可放入學生學習筆記本的提醒。",
    "請使用繁體中文（香港用語），語氣溫和、具體、可操作。",
    "只生成一則筆記，不要評分，不要重新批改整篇文章。",
    "筆記應幫學生下次寫作時真正用得上：聚焦一個評分面向，保留原文例子，提供可模仿示範，最後給下次寫作檢查方法。",
    "筆記必須清楚分段，使用指定小標題、短句和編號清單；不要寫成一整段散文。",
    "內容不可空泛，不可只寫『要更具體』『要改善表達』；必須說明學生下次可以怎樣落筆。",
    "輸出必須是嚴格 JSON，不要加 markdown 或其他說明。",
  ].join("\n");
}

function buildUserPrompt(input: GenerateNotebookNoteDraftInput) {
  const requestedFocusTag = normalizeFocusTag(input.requestedFocusTag);
  const matchingPriorities = requestedFocusTag
    ? input.revisionPriorities.filter((priority) => normalizeFocusTag(priority.focus) === requestedFocusTag)
    : input.revisionPriorities;
  const prioritiesForPrompt = matchingPriorities.length > 0 ? matchingPriorities : input.revisionPriorities;
  const priorities = prioritiesForPrompt
    .slice(0, 5)
    .map((priority, index) => {
      const parts = [
        `${index + 1}. ${priority.focus ? `【${priority.focus}】` : ""}${priority.issue}`,
      ];
      if (priority.why) parts.push(`   為何重要：${priority.why}`);
      if (priority.how.length > 0) parts.push(`   做法：${priority.how.join("；")}`);
      if (priority.example_before) parts.push(`   原文例子：${priority.example_before}`);
      if (priority.example_after) parts.push(`   示範：${priority.example_after}`);
      return parts.join("\n");
    })
    .join("\n");

  const strengths = input.strengths.length > 0 ? input.strengths.join("；") : "暫無特別列出";
  const criteriaGuide = requestedFocusTag
    ? MARKING_CRITERIA_GUIDE[requestedFocusTag as keyof typeof MARKING_CRITERIA_GUIDE]
    : "請按主要改進重點自行選擇最值得寫成筆記的一項評分準則。";

  return [
    `學生年級：${input.gradeLevel}`,
    `文體：${input.genre || "命題寫作"}`,
    input.taskPrompt ? `題目：${input.taskPrompt}` : "",
    requestedFocusTag ? `學生指定想生成的評分準則：${requestedFocusTag}` : "學生未指定評分準則：請由 AI 選擇最有學習價值的一項。",
    `評分準則要求：${criteriaGuide}`,
    "",
    "文章：",
    input.text,
    "",
    "整體導師回饋：",
    input.coachFeedbackText,
    "",
    "亮點：",
    strengths,
    "",
    "主要改進重點：",
    priorities || "暫無特別列出",
    matchingPriorities.length === 0 && requestedFocusTag
      ? `提醒：這次回饋中沒有明確標成「${requestedFocusTag}」的改進重點，但學生指定了這個準則；請仍然圍繞「${requestedFocusTag}」從文章和整體回饋中整理一則有例子的筆記。`
      : "",
    "",
    "筆記內容要求：",
    "1. 若學生指定評分準則，focusTag 必須使用該準則；否則從 內容 / 表達 / 結構 / 標點 中選一項。",
    "2. title 要具體，格式建議為「準則：可記住的動作」，例如「內容：補出心情轉折」。",
    "3. content 必須約 220–520 字，使用換行整理，不要寫成一整段。",
    "4. content 必須完全按以下架構和小標題輸出：",
    "   【學習重點】",
    "   準則：指出本筆記對應的準則。",
    "   一句話提醒：用一句短句講清楚下次要記住甚麼。",
    "",
    "   【原文觀察】",
    "   原文片段：引用或概括學生文章中一個短例子；如果沒有合適逐字引用，就用『這篇文章在……位置』具體描述。",
    "   可以更清楚的地方：只解釋這個例子為何值得修改。",
    "",
    "   【下次做法】",
    "   1. 第一個可立即執行的步驟。",
    "   2. 第二個可立即執行的步驟。",
    "",
    "   【示範句】",
    "   原句：填入剛才的原文片段或簡短概括。",
    "   可以改成：提供一句可模仿的中文示範句；可以改寫原文局部，但不要代寫整段。",
    "",
    "   【檢查清單】",
    "   □ 給第一個簡短檢查點。",
    "   □ 給第二個簡短檢查點。",
    "   □ 如有需要，給第三個簡短檢查點。",
    "5. 示範句要貼近本文題材和學生程度，不要寫成通用金句。",
    "6. 【下次做法】和【檢查清單】不可重複；前者教學生怎樣寫，後者幫學生交稿前自查。",
    "7. 如果準則是「內容」，重點放在扣題、材料、細節、情感或立意；如果是「表達」，重點放在句式、詞語、語氣、描寫或修辭；如果是「結構」，重點放在開首、段落、過渡、詳略或結尾；如果是「標點」，重點放在標點規則和例句。",
    "",
    "請輸出以下 JSON：",
    "{",
    '  "title": "不超過 20 字的具體筆記標題",',
    '  "content": "按指定架構包含【學習重點】【原文觀察】【下次做法】【示範句】【檢查清單】的完整筆記，保留換行",',
    '  "focusTag": "內容 | 表達 | 結構 | 標點 其中之一",',
    '  "tags": ["2 至 4 個短標籤"]',
    "}",
  ]
    .filter(Boolean)
    .join("\n");
}

const MARKING_CRITERIA_GUIDE = {
  內容: "看是否扣題、材料是否具體、有沒有細節支撐、情感或立意是否有展開。",
  表達: "看用詞、句式、描寫、語氣和修辭是否準確自然，能否令意思更鮮明。",
  結構: "看開首是否入題、段落是否有層次、過渡是否清楚、詳略和結尾是否配合主旨。",
  標點: "看標點是否幫助斷句、語氣和層次，尤其逗號、句號、引號、冒號等是否準確。",
} as const;

function extractJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return extractJson(fenced[1]);

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}

function parsePositiveInt(raw: string | undefined, fallback: number) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}
