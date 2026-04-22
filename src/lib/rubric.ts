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

// HKDSE 中國語文 卷二乙部「命題寫作」評分標準
// 內容 40% / 表達 30% / 結構 20% / 標點字體 10% — 全卷 100 分 + 錯別字最多 +3 分
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
        "立意與主旨：中心思想是否深刻、清晰、具啟發性；是否緊扣題旨",
        "選材與剪裁：事例／論據／景象是否恰當、充實、有代表性；詳略是否得宜",
        "見解與感悟：是否有個人獨到見解；情感是否真摯；是否引發深層思考",
      ],
      descriptors: [
        { band: "上", range: [33, 40], description: "立意深刻新穎，緊扣題旨；選材具代表性且剪裁得當；見解獨到，情感真摯動人。" },
        { band: "中上", range: [25, 32], description: "立意清晰有一定深度；選材充實能支持中心；見解合理，情感自然。" },
        { band: "中", range: [17, 24], description: "立意明確但略欠深入；選材可用但較平淡；見解或感悟一般。" },
        { band: "下", range: [0, 16], description: "立意不清或偏離題旨；內容空洞、材料單薄；缺少個人見解或情感。" },
      ],
    },
    {
      key: "expression",
      label: "表達",
      maxScore: 30,
      weight: 0.3,
      focus: [
        "遣詞造句：用詞是否精準、豐富、生動；句式是否靈活有變化",
        "文筆與風格：行文是否流暢、簡潔、有氣勢",
        "修辭運用：比喻、排比、對比、象徵等是否恰當並增強感染力",
      ],
      descriptors: [
        { band: "上", range: [25, 30], description: "遣詞精準豐富，句式靈活多變；行文流暢有氣勢；修辭運用恰到好處並有個人風格。" },
        { band: "中上", range: [19, 24], description: "用詞適切，句式具變化；文筆通順；偶用修辭使文章生色。" },
        { band: "中", range: [13, 18], description: "用詞尚可但略欠變化；句式較單一；少有修辭或運用生硬。" },
        { band: "下", range: [0, 12], description: "用詞貧乏、句式粗糙；文筆生硬或語病頻出；幾無修辭。" },
      ],
    },
    {
      key: "structure",
      label: "結構",
      maxScore: 20,
      weight: 0.2,
      focus: [
        "佈局與組織：整體架構是否完整勻稱；開頭結尾是否呼應",
        "段落與層次：段落劃分是否合理；層次是否分明",
        "過渡與銜接：段落與句子之間是否自然連貫",
      ],
      descriptors: [
        { band: "上", range: [17, 20], description: "佈局完整勻稱，首尾呼應；段落層次分明；過渡自然連貫。" },
        { band: "中上", range: [13, 16], description: "結構清晰；段落劃分合理；銜接基本順暢。" },
        { band: "中", range: [9, 12], description: "結構可辨但欠勻稱；段落略失衡或銜接生硬。" },
        { band: "下", range: [0, 8], description: "結構鬆散或混亂，缺乏主線；段落無層次。" },
      ],
    },
    {
      key: "punctuation",
      label: "標點字體",
      maxScore: 10,
      weight: 0.1,
      focus: [
        "標點符號是否準確運用，輔助文意表達",
        "字體是否端正清晰，卷面整潔",
      ],
      descriptors: [
        { band: "上", range: [9, 10], description: "標點準確到位；字體端正清晰；卷面整潔。" },
        { band: "中上", range: [7, 8], description: "標點偶有失當；字體大致工整。" },
        { band: "中", range: [4, 6], description: "標點錯誤較多或運用單調；字體潦草，影響閱讀。" },
        { band: "下", range: [0, 3], description: "標點大量錯誤或字體難以辨認。" },
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
// 以「基本分」（即四項評分項目相加，未計錯別字獎勵）映射。
// 錯別字獎勵只是卷面整潔的加成，不應令作品跨越等級邊界。
// 邊界根據 rubric 描述帶（上／中上／中／下）推算：
//   - Level 5 下限 ≈ 四項全部命中「上」帶下限：33 + 25 + 17 + 9 = 84（容差放寬至 80）
//   - Level 4 下限 ≈ 四項全部命中「中上」帶下限：25 + 19 + 13 + 7 = 64（容差放寬至 66 以避免 65 跨級歧義）
//   - Level 3 下限 ≈ 四項全部命中「中」帶下限：17 + 13 + 9 + 4 = 43（取 50 為合格界，匹配一般教師觀感）
//   - Level 2 下限 ≈「中」下緣與「下」上緣之間
export type DseLevel = "U" | "1" | "2" | "3" | "4" | "5" | "5*" | "5**";

export const DSE_LEVEL_BANDS: { level: DseLevel; min: number; note: string }[] = [
  { level: "5**", min: 94, note: "頂尖水平（約全港考生前 1%）：立意深刻獨到，表達精煉傳神，結構嚴謹。" },
  { level: "5*", min: 88, note: "卓越水平（約前 4%）：見解深刻，表達優美，結構完整。" },
  { level: "5", min: 80, note: "優良水平（約前 10–15%）：內容充實有見地，表達流暢有文采。" },
  { level: "4", min: 66, note: "良好水平：內容清晰具體，表達通順，結構完整，但未達文采／深度。" },
  { level: "3", min: 50, note: "合格水平（一般中學生中位數）：內容尚算完整但欠深度；表達通順但欠變化。" },
  { level: "2", min: 37, note: "未達標：內容薄弱，表達粗糙，結構欠完整。" },
  { level: "1", min: 22, note: "遠遜水平：嚴重偏離題旨或內容／表達嚴重不足。" },
  { level: "U", min: 0, note: "未能評等：完全離題、內容過少或不能辨讀。" },
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

// 建議分數區間（基本分，未含錯別字獎勵）——用於 prompt 錨定
export function scoreRangeForLevel(level: DseLevel): { min: number; max: number } {
  const idx = DSE_LEVEL_BANDS.findIndex((b) => b.level === level);
  const band = DSE_LEVEL_BANDS[idx];
  const higher = DSE_LEVEL_BANDS[idx - 1];
  return { min: band.min, max: higher ? higher.min - 1 : 100 };
}

export function dseLevelNote(level: DseLevel): string {
  return DSE_LEVEL_BANDS.find((b) => b.level === level)?.note || "";
}

// 錯別字獎勵（以全卷總計）
// 0–1: +3；2–4: +2；5–7: +1；8+: 不加分
export function typoBonus(typoCount: number): number {
  if (typoCount <= 1) return 3;
  if (typoCount <= 4) return 2;
  if (typoCount <= 7) return 1;
  return 0;
}

export const RECOMMENDED_WORD_COUNT = 600;
