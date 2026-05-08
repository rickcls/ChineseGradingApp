export type RubricCriterion = {
  key: string;
  label: string;
  maxScore: number;
  weight: number;
  focus: string[];
  descriptors: { band: string; range: [number, number]; description: string }[];
};

export type RubricDef = {
  gradeLevel: string;
  type: "writing";
  genre: string;
  criteria: RubricCriterion[];
};

// HKDSE 中國語文 卷二乙部「命題寫作」評分標準 V10
// 內容 40% / 表達 30% / 結構 20% / 標點與字體 10% — 全卷 100 分，錯別字另行扣分
export const DEFAULT_WRITING_RUBRIC: RubricDef = {
  gradeLevel: "HKDSE",
  type: "writing",
  genre: "命題寫作",
  criteria: [
    {
      key: "content",
      label: "內容",
      maxScore: 40,
      weight: 0.4,
      focus: [
        "扣題與立意：是否切合題旨，主旨是否清晰、集中而有深度",
        "選材與展開：材料是否恰當、具代表性，能否充分支撐主旨",
        "感悟與見解：是否展現真切體會、分析能力或較成熟的思考",
      ],
      descriptors: [
        { band: "N=10", range: [40, 40], description: "立意極深刻，昇華至哲理或普世價值，反思直擊人心。" },
        { band: "N=9", range: [36, 36], description: "見解獨到，能超越個人經歷，扣連社會或文化層面的反思，選材極具慧眼。" },
        { band: "N=8", range: [32, 32], description: "主旨清晰緊扣題旨，有深刻個人剖析；極佳切入點可具爆發力。" },
        { band: "N=7", range: [28, 28], description: "切中題旨，具個人體會，合理真摯，無偏題風險。" },
        { band: "N=6", range: [24, 24], description: "內容達標，但反思表面或大路，缺乏獨特見解，Level 4 封頂。" },
        { band: "N=5", range: [20, 20], description: "尚算切題，但內容空泛、單薄，選材多為常見套路。" },
        { band: "N=4", range: [16, 16], description: "僅觸及皮毛或部分偏題，立意模糊，無法上 Level 4。" },
        { band: "N=3", range: [12, 12], description: "內容貧乏，大部分偏離題旨，思想幼稚或論點難以自圓其說。" },
        { band: "N=2", range: [8, 8], description: "嚴重離題或內容空洞，不知所云。" },
        { band: "N=1", range: [4, 4], description: "隻字片語、抄襲提示或完全文不對題，屬 U 級水平。" },
        { band: "N=0", range: [0, 0], description: "白卷，或文字無法辨識、不成文句。" },
      ],
    },
    {
      key: "expression",
      label: "表達",
      maxScore: 30,
      weight: 0.3,
      focus: [
        "遣詞造句：用詞是否準確，句式是否清楚並有變化",
        "文氣與流暢度：行文是否自然順暢，語意是否清楚易懂",
        "修辭與風格：修辭是否恰當，是否有助提升感染力而非堆砌",
      ],
      descriptors: [
        { band: "N=10", range: [30, 30], description: "文筆極成熟，具強烈且自覺的個人風格，文字精煉，意象運用大巧不工。" },
        { band: "N=9", range: [27, 27], description: "行文流暢優美，句式靈活且具音樂感，能精準將抽象情感轉化為具體意象。" },
        { band: "N=8", range: [24, 24], description: "文筆通順準確，句式有變化，具備靈光一閃的修辭或金句。" },
        { band: "N=7", range: [21, 21], description: "流暢少語病，用詞妥當，能恰當運用基本修辭，偶有佳句。" },
        { band: "N=6", range: [18, 18], description: "語句基本通順，但詞彙一般，修辭刻意或單一，欠缺自然美，Level 4 封頂。" },
        { band: "N=5", range: [15, 15], description: "詞彙貧乏，句式單調，偶有語病或沙石，極少修辭。" },
        { band: "N=4", range: [12, 12], description: "語病頻繁，部分詞不達意，行文口語化嚴重，無法上 Level 4。" },
        { band: "N=3", range: [9, 9], description: "語法錯誤嚴重，大量錯別字，行文極不流暢。" },
        { band: "N=2", range: [6, 6], description: "文理不通，詞彙極度匱乏，幾乎無法傳達完整意思。" },
        { band: "N=1", range: [3, 3], description: "語無倫次，無法構成有意義句子，屬 U 級水平。" },
        { band: "N=0", range: [0, 0], description: "白卷，或文字無法辨識、不成文句。" },
      ],
    },
    {
      key: "structure",
      label: "結構",
      maxScore: 20,
      weight: 0.2,
      focus: [
        "佈局：整體架構是否完整，能否形成清楚的開展方向",
        "段落與層次：段落安排是否合理，詳略是否得宜，層次是否分明",
        "過渡與銜接：前後脈絡是否連貫，段落之間是否自然承接",
      ],
      descriptors: [
        { band: "N=10", range: [20, 20], description: "佈局堪稱藝術，敘事張力極強，伏筆與呼應完美，層次推進渾然天成。" },
        { band: "N=9", range: [18, 18], description: "佈局精巧，組織嚴謹，節奏控制得宜，詳略極度得當。" },
        { band: "N=8", range: [16, 16], description: "佈局完整勻稱，段落銜接順暢，起承轉合設計明確，不落俗套。" },
        { band: "N=7", range: [14, 14], description: "結構完整，條理清晰，起承轉合自然，段落分配均勻。" },
        { band: "N=6", range: [12, 12], description: "有分段意識，但組織公式化或八股，起承轉合生硬，Level 4 封頂。" },
        { band: "N=5", range: [10, 10], description: "具基本結構，但過渡生硬，或段落比例嚴重失衡。" },
        { band: "N=4", range: [8, 8], description: "結構鬆散，缺乏條理，發展跳躍突兀，無法上 Level 4。" },
        { band: "N=3", range: [6, 6], description: "結構殘缺，段落混亂，缺乏連貫性，可能一段到底或無邏輯分段。" },
        { band: "N=2", range: [4, 4], description: "無組織可言，字數嚴重不足，或僅為支離破碎片段。" },
        { band: "N=1", range: [2, 2], description: "無法評估組織結構，屬 U 級水平。" },
        { band: "N=0", range: [0, 0], description: "白卷，或文字無法辨識、不成文句。" },
      ],
    },
    {
      key: "punctuation",
      label: "標點與字體",
      maxScore: 10,
      weight: 0.1,
      focus: [
        "標點符號是否準確運用，能否配合語氣、語意與停頓",
        "卷面與字體是否清晰整潔，是否幫助而非阻礙閱讀",
      ],
      descriptors: [
        { band: "N=10", range: [10, 10], description: "精準駕馭進階標點以控制節奏語氣；字體端正優美，卷面賞心悅目。" },
        { band: "N=9", range: [9, 9], description: "標點完全正確，能善用標點加強語氣；字體清晰整齊，極少塗改。" },
        { band: "N=8", range: [8, 8], description: "基礎標點準確，偶能運用引號、問號等增添色彩；字體端正易認。" },
        { band: "N=7", range: [7, 7], description: "標點基本正確，極少錯用；卷面整潔，塗改不影響閱讀。" },
        { band: "N=6", range: [6, 6], description: "標點運用單調；字體尚可，或有較多不影響閱讀的塗改，Level 4 封頂。" },
        { band: "N=5", range: [5, 5], description: "偶有標點錯誤或一逗到底初現；字體較潦草但仍可辨讀。" },
        { band: "N=4", range: [4, 4], description: "標點常有錯誤；字體潦草，需花時間辨認，無法上 Level 4。" },
        { band: "N=3", range: [3, 3], description: "標點錯亂或極少使用；字體難以辨認，卷面凌亂。" },
        { band: "N=2", range: [2, 2], description: "幾乎無標點或亂點一通；字體極難辨認。" },
        { band: "N=1", range: [1, 1], description: "無法評估，屬 U 級水平。" },
        { band: "N=0", range: [0, 0], description: "白卷，或文字無法辨識、不成文句。" },
      ],
    },
  ],
};

export function totalMaxScore(r: RubricDef): number {
  return r.criteria.reduce((acc, c) => acc + c.maxScore, 0);
}

export function rubricAsMarkdown(r: RubricDef): string {
  return r.criteria
    .map((c) => {
      const header = `- **${c.label}**（佔 ${Math.round(c.weight * 100)}%，滿分 ${c.maxScore}）`;
      const focus = c.focus.map((f) => `  - 考核重點：${f}`).join("\n");
      const bands = c.descriptors
        .map((d) => `  - ${d.band}（${d.range[0]}–${d.range[1]} 分）：${d.description}`)
        .join("\n");
      return `${header}\n${focus}\n${bands}`;
    })
    .join("\n");
}

// HKDSE 中文科 5** / 5* / 5 / 4 / 3 / 2 / 1 / U 等級對照
// V10 以 10 分制 N 的「潛力區間」作錨點，再換算到 100 分總分。
export type DseLevel = "U" | "1" | "2" | "3" | "4" | "5" | "5*" | "5**";

export const DSE_LEVEL_BANDS: { level: DseLevel; min: number; note: string }[] = [
  { level: "5**", min: 95, note: "頂尖水平：立意昇華至哲理或普世價值，表達與佈局皆近乎無可挑剔。" },
  { level: "5*", min: 90, note: "實力強勁：見解獨到，表達優美，組織嚴謹，具競爭 5** 的條件。" },
  { level: "5", min: 80, note: "優良水平：主旨深刻、表達準確有亮點，結構完整順暢，具 5** 潛力。" },
  { level: "4", min: 60, note: "良好水平：表現穩健或基本達標，但深度、文采或節奏未能穩入 Level 5。" },
  { level: "3", min: 50, note: "合格水平：尚算切題但內容單薄平庸，表達或結構有明顯進步空間。" },
  { level: "2", min: 30, note: "未達標：偏題、語病或結構問題明顯，只達 Level 2 至 Level 3 邊緣。" },
  { level: "1", min: 20, note: "遠遜水平：嚴重離題或未能達基本要求。" },
  { level: "U", min: 0, note: "未能評等：極劣、完全離題、內容過少或不能辨讀。" },
];

export function dseLevelFromScore(score: number): DseLevel {
  for (const band of DSE_LEVEL_BANDS) {
    if (score >= band.min) return band.level;
  }
  return "U";
}

const LEVEL_ORDER: DseLevel[] = ["U", "1", "2", "3", "4", "5", "5*", "5**"];

export function dseLevelRank(level: DseLevel): number {
  return LEVEL_ORDER.indexOf(level);
}

export function minDseLevel(a: DseLevel, b: DseLevel): DseLevel {
  return dseLevelRank(a) <= dseLevelRank(b) ? a : b;
}

// 建議分數區間（扣除錯別字後的最終總分）——用於 prompt 錨定
export function scoreRangeForLevel(level: DseLevel): { min: number; max: number } {
  const idx = DSE_LEVEL_BANDS.findIndex((b) => b.level === level);
  const band = DSE_LEVEL_BANDS[idx];
  const higher = DSE_LEVEL_BANDS[idx - 1];
  return { min: band.min, max: higher ? higher.min - 1 : 100 };
}

export function dseLevelNote(level: DseLevel): string {
  return DSE_LEVEL_BANDS.find((b) => b.level === level)?.note || "";
}

// 錯別字扣分（V10：以全卷總計）
// 0–1: 不扣分；2–4: -1；5–7: -2；8+: -3
export function typoBonus(typoCount: number): number {
  if (typoCount <= 1) return 0;
  if (typoCount <= 4) return -1;
  if (typoCount <= 7) return -2;
  return -3;
}

export const RECOMMENDED_WORD_COUNT = 600;
