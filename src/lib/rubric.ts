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
// 內容 40% / 表達 30% / 結構 20% / 標點 10% — 全卷 100 分 + 錯別字最多 +3 分
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
        { band: "上", range: [33, 40], description: "明確扣題，材料充分而有代表性，能展現深度、見解或真切感悟。" },
        { band: "中上", range: [25, 32], description: "基本扣題，內容具體，材料能支撐主旨，但深度或展開力度仍可提升。" },
        { band: "中", range: [17, 24], description: "主旨可辨但不夠集中，材料一般或展開不足，內容平穩而不突出。" },
        { band: "下", range: [0, 16], description: "偏題或內容薄弱，材料空泛、單薄，難以有效支撐主旨。" },
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
        { band: "上", range: [25, 30], description: "用詞準確，句式靈活，修辭自然，整體文氣成熟而有感染力。" },
        { band: "中上", range: [19, 24], description: "基本達意且通順，偶有句式變化與恰當修辭，但文采仍未穩定。" },
        { band: "中", range: [13, 18], description: "大致可讀，但較平直單調，偶有生硬或輕微語病。" },
        { band: "下", range: [0, 12], description: "語病較多，句子欠順或殘缺，詞語運用薄弱，影響整體理解。" },
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
        { band: "上", range: [17, 20], description: "佈局完整，層次清楚，段落安排得宜，過渡自然。" },
        { band: "中上", range: [13, 16], description: "文章大致成篇，條理尚清，但局部安排或銜接仍可更緊密。" },
        { band: "中", range: [9, 12], description: "結構可辨但較鬆散，段落失衡或前後脈絡不夠清楚。" },
        { band: "下", range: [0, 8], description: "脈絡混亂或幾乎不成篇，缺乏基本章法與清楚主線。" },
      ],
    },
    {
      key: "punctuation",
      label: "標點",
      maxScore: 10,
      weight: 0.1,
      focus: [
        "標點符號是否準確運用，能否配合語氣、語意與停頓",
        "標點是否幫助而非阻礙閱讀與文意理解",
      ],
      descriptors: [
        { band: "上", range: [9, 10], description: "標點大致準確，能配合語氣、語意與停頓。" },
        { band: "中上", range: [7, 8], description: "標點基本準確，偶有小誤，但不影響理解。" },
        { band: "中", range: [4, 6], description: "錯誤較多，已開始影響閱讀流暢度。" },
        { band: "下", range: [0, 3], description: "大量缺漏或誤用，嚴重妨礙理解。" },
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
