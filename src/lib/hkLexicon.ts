// Rule-based pre-check for Hong Kong-specific writing problems: Cantonese in
// written Chinese (粵語入文), Europeanised sentence patterns (歐化句式) and
// run-on comma sentences (一逗到底). Hits give exact offsets; the model
// judges them in context, and "certain" Cantonese hits outside quotation
// marks are annotated even if the model misses them.

export type HkIssueKind = "cantonese" | "europeanised" | "run_on";

export type HkIssueHit = {
  kind: HkIssueKind;
  start: number;
  end: number;
  text: string;
  // Written-Chinese alternative (Cantonese) or a short explanation.
  hint: string;
  // Only used in colloquial Cantonese, never in standard written Chinese.
  certain: boolean;
  inQuote: boolean;
};

type LexiconEntry = { pattern: string; standard: string; certain: boolean };

// Longer entries win over shorter ones that overlap them (佢哋 before 佢).
const CANTONESE: LexiconEntry[] = [
  { pattern: "冚唪唥", standard: "全部", certain: true },
  { pattern: "多謝晒", standard: "非常感謝", certain: true },
  { pattern: "佢哋", standard: "他們", certain: true },
  { pattern: "我哋", standard: "我們", certain: true },
  { pattern: "你哋", standard: "你們", certain: true },
  { pattern: "乜嘢", standard: "甚麼", certain: true },
  { pattern: "咩嘢", standard: "甚麼", certain: true },
  { pattern: "係咪", standard: "是不是", certain: true },
  { pattern: "唔係", standard: "不是", certain: true },
  { pattern: "唔好", standard: "不要", certain: true },
  { pattern: "唔會", standard: "不會", certain: true },
  { pattern: "唔知", standard: "不知道", certain: true },
  { pattern: "唔使", standard: "不用", certain: true },
  { pattern: "唔該", standard: "謝謝／麻煩你", certain: true },
  { pattern: "嗰陣", standard: "那時", certain: true },
  { pattern: "呢個", standard: "這個", certain: true },
  { pattern: "呢度", standard: "這裏", certain: true },
  { pattern: "屋企", standard: "家", certain: true },
  { pattern: "返學", standard: "上學", certain: true },
  { pattern: "雪櫃", standard: "冰箱", certain: true },
  { pattern: "傾偈", standard: "聊天", certain: true },
  { pattern: "傾計", standard: "聊天", certain: true },
  { pattern: "搞掂", standard: "辦妥", certain: true },
  { pattern: "打風", standard: "颳颱風", certain: true },
  { pattern: "行街", standard: "逛街", certain: true },
  { pattern: "嘅", standard: "的", certain: true },
  { pattern: "咗", standard: "了", certain: true },
  { pattern: "啲", standard: "些／一點", certain: true },
  { pattern: "冇", standard: "沒有", certain: true },
  { pattern: "喺", standard: "在", certain: true },
  { pattern: "嚟", standard: "來", certain: true },
  { pattern: "嗰", standard: "那", certain: true },
  { pattern: "嘢", standard: "東西", certain: true },
  { pattern: "哋", standard: "們", certain: true },
  { pattern: "佢", standard: "他／她", certain: true },
  { pattern: "咁", standard: "這麼／那樣", certain: true },
  { pattern: "睇", standard: "看", certain: true },
  { pattern: "諗", standard: "想", certain: true },
  { pattern: "搵", standard: "找", certain: true },
  { pattern: "攞", standard: "拿", certain: true },
  { pattern: "瞓", standard: "睡", certain: true },
  { pattern: "攰", standard: "累", certain: true },
  { pattern: "嘥", standard: "浪費", certain: true },
  { pattern: "啱", standard: "對／剛剛", certain: true },
  // Also valid written or classical Chinese in some contexts (俾使, 畀予,
  // 揾英雄淚, 重點解說, 百花一齊開放, 返工 = redo work), so only the model decides.
  { pattern: "點解", standard: "為甚麼", certain: false },
  { pattern: "邊個", standard: "誰", certain: false },
  { pattern: "好似", standard: "好像", certain: false },
  { pattern: "一齊", standard: "一起", certain: false },
  { pattern: "食飯", standard: "吃飯", certain: false },
  { pattern: "返工", standard: "上班", certain: false },
  { pattern: "落雨", standard: "下雨", certain: false },
  { pattern: "俾", standard: "給", certain: false },
  { pattern: "畀", standard: "給", certain: false },
  { pattern: "揾", standard: "找", certain: false },
  { pattern: "唔", standard: "不", certain: false },
  { pattern: "咩", standard: "甚麼", certain: false },
  { pattern: "囉", standard: "（刪去語氣詞）", certain: false },
  { pattern: "喎", standard: "（刪去語氣詞）", certain: false },
];

const CLAUSE = "[^，。！？；：\\n]";

const EUROPEANISED: { regex: RegExp; hint: string }[] = [
  {
    regex: new RegExp(`作出(?:了)?(?:一個|一項|一些)?${CLAUSE}{0,12}?(?:決定|貢獻|努力|改變|回應|選擇)`, "g"),
    hint: "「作出…的決定／貢獻」較累贅，可直接用動詞，如「決定…」「貢獻…」。",
  },
  {
    regex: new RegExp(`在${CLAUSE}{1,15}的情況下`, "g"),
    hint: "「在…的情況下」較冗長，可簡化為「若…」「…時」。",
  },
  {
    regex: new RegExp(`當${CLAUSE}{1,15}的時候`, "g"),
    hint: "「當…的時候」可簡化為「…時」。",
  },
  {
    regex: /(?:進行|加以)(?:了)?(?:一次|一番|一些)?(?:討論|研究|調查|分析|改善|處理|檢討)/g,
    hint: "「進行討論／研究」可直接寫「討論」「研究」。",
  },
  {
    regex: /有[著着]/g,
    hint: "「有著」是歐化說法，一般寫「有」即可。",
  },
];

const RUN_ON_MIN_COMMAS = 6;
const RUN_ON_MIN_LENGTH = 80;

function quoteRanges(text: string): Array<[number, number]> {
  const pairs: Record<string, string> = { "「": "」", "『": "』", "“": "”" };
  const ranges: Array<[number, number]> = [];
  const stack: Array<{ close: string; start: number }> = [];
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (pairs[ch]) {
      stack.push({ close: pairs[ch], start: i });
    } else if (stack.length > 0 && ch === stack[stack.length - 1].close) {
      const open = stack.pop()!;
      if (stack.length === 0) ranges.push([open.start, i + 1]);
    }
  }
  return ranges;
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }) {
  return a.start < b.end && b.start < a.end;
}

export function detectHkIssues(text: string): HkIssueHit[] {
  const quotes = quoteRanges(text);
  const inQuote = (start: number, end: number) => quotes.some(([qs, qe]) => start >= qs && end <= qe);
  const hits: HkIssueHit[] = [];

  const entries = [...CANTONESE].sort((a, b) => b.pattern.length - a.pattern.length);
  for (const entry of entries) {
    let from = 0;
    while (true) {
      const start = text.indexOf(entry.pattern, from);
      if (start === -1) break;
      const end = start + entry.pattern.length;
      from = start + 1;
      const candidate = { start, end };
      if (hits.some((hit) => overlaps(hit, candidate))) continue;
      hits.push({
        kind: "cantonese",
        start,
        end,
        text: entry.pattern,
        hint: entry.standard,
        certain: entry.certain,
        inQuote: inQuote(start, end),
      });
    }
  }

  for (const rule of EUROPEANISED) {
    for (const match of text.matchAll(rule.regex)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      hits.push({ kind: "europeanised", start, end, text: match[0], hint: rule.hint, certain: false, inQuote: inQuote(start, end) });
    }
  }

  const sentencePattern = /[^。！？；\n]+[。！？；]?/g;
  for (const match of text.matchAll(sentencePattern)) {
    const sentence = match[0];
    const commas = (sentence.match(/[，,]/g) || []).length;
    if (commas < RUN_ON_MIN_COMMAS || sentence.length < RUN_ON_MIN_LENGTH) continue;
    const start = match.index ?? 0;
    hits.push({
      kind: "run_on",
      start,
      end: start + sentence.length,
      text: sentence,
      hint: `一句之內用了 ${commas} 個逗號，可能一逗到底，應在意思完整處改用句號。`,
      certain: false,
      inQuote: inQuote(start, start + sentence.length),
    });
  }

  return hits.sort((a, b) => a.start - b.start || a.end - b.end);
}

const KIND_LABEL: Record<HkIssueKind, string> = {
  cantonese: "粵語",
  europeanised: "歐化",
  run_on: "一逗到底",
};

const MAX_PROMPT_HITS = 40;

export function hkIssuesPromptBlock(hits: HkIssueHit[]): string | null {
  if (hits.length === 0) return null;
  const lines = hits.slice(0, MAX_PROMPT_HITS).map((hit) => {
    const quoted = hit.text.length > 30 ? `${hit.text.slice(0, 30)}…` : hit.text;
    const where = hit.inQuote ? "，位於引號內" : "";
    const advice = hit.kind === "cantonese" ? `書面語：${hit.hint}` : hit.hint;
    return `- [${KIND_LABEL[hit.kind]}] 「${quoted}」（第 ${hit.start} 字起${where}）→ ${advice}`;
  });
  if (hits.length > MAX_PROMPT_HITS) lines.push(`- ……另有 ${hits.length - MAX_PROMPT_HITS} 處，請自行留意同類問題。`);
  return [
    "【系統預檢：港式中文候選（由規則掃描找出，請逐一判斷）】",
    "確屬不當的，請列入 errors：粵語 → category「表達」、subcategory「粵語入文」；歐化 → 「語法」「歐化句式」；一逗到底 → 「標點」「一逗到底」。evidence_span 請直接引用候選原文。",
    "若其實是規範書面語（例如「重點解說」中的「點解」），或屬引號內刻意保留的人物口吻，則不要列入。",
    ...lines,
  ].join("\n");
}

const MAX_AUTO_ERRORS = 15;

type SpanError = { char_offset_start: number; char_offset_end: number };

// Certain Cantonese hits outside quotes that no model error covers become
// 表達／粵語入文 errors, so these never slip through.
export function missedCantoneseErrors(hits: HkIssueHit[], modelErrors: SpanError[]) {
  return hits
    .filter((hit) => hit.kind === "cantonese" && hit.certain && !hit.inQuote)
    .filter(
      (hit) =>
        !modelErrors.some((error) =>
          overlaps(hit, { start: error.char_offset_start, end: error.char_offset_end }),
        ),
    )
    .slice(0, MAX_AUTO_ERRORS)
    .map((hit) => ({
      category: "表達",
      subcategory: "粵語入文",
      evidence_span: hit.text,
      char_offset_start: hit.start,
      char_offset_end: hit.end,
      suggestion: `「${hit.text}」是粵語口語，書面語應寫作「${hit.hint}」。`,
      example_fix: hit.hint.includes("／") ? undefined : hit.hint,
      severity: 1,
      confidence: 0.95,
    }));
}
