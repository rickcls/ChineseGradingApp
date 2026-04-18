export type RubricCriterion = {
  key: string;
  label: string;
  maxScore: number;
  descriptors: { band: string; range: [number, number]; description: string }[];
};

export type RubricDef = {
  gradeLevel: string;
  type: "writing";
  genre: string;
  criteria: RubricCriterion[];
};

// Starter rubric: 初中記敘文 (generic narrative, grade 初一~初三)
// Total: 100 points. Grade-level calibration can layer in later.
export const DEFAULT_WRITING_RUBRIC: RubricDef = {
  gradeLevel: "generic",
  type: "writing",
  genre: "記敘文",
  criteria: [
    {
      key: "content",
      label: "內容",
      maxScore: 25,
      descriptors: [
        { band: "優", range: [21, 25], description: "內容豐富具體，有鮮活細節與真實情感。" },
        { band: "良", range: [16, 20], description: "內容較為充實，有具體事例但略欠生動。" },
        { band: "中", range: [11, 15], description: "內容基本完整，事例薄弱或稍顯空洞。" },
        { band: "下", range: [0, 10], description: "內容空洞或離題，缺少具體材料。" },
      ],
    },
    {
      key: "structure",
      label: "結構",
      maxScore: 20,
      descriptors: [
        { band: "優", range: [17, 20], description: "層次分明，段落銜接自然，首尾呼應。" },
        { band: "良", range: [13, 16], description: "結構清晰，銜接基本順暢。" },
        { band: "中", range: [9, 12], description: "結構可辨，但銜接生硬或段落失衡。" },
        { band: "下", range: [0, 8], description: "結構混亂，缺乏主線。" },
      ],
    },
    {
      key: "language",
      label: "語言",
      maxScore: 25,
      descriptors: [
        { band: "優", range: [21, 25], description: "用詞準確豐富，句式變化得當。" },
        { band: "良", range: [16, 20], description: "語言通順，偶有不當。" },
        { band: "中", range: [11, 15], description: "語言基本通順，用詞或句式單一。" },
        { band: "下", range: [0, 10], description: "語病明顯，影響表達。" },
      ],
    },
    {
      key: "mechanics",
      label: "字詞與標點",
      maxScore: 15,
      descriptors: [
        { band: "優", range: [13, 15], description: "幾乎無錯別字，標點規範。" },
        { band: "良", range: [10, 12], description: "錯別字與標點錯誤少於 3 處。" },
        { band: "中", range: [6, 9], description: "錯別字或標點錯誤較多。" },
        { band: "下", range: [0, 5], description: "錯別字或標點錯誤嚴重。" },
      ],
    },
    {
      key: "expression",
      label: "表達與立意",
      maxScore: 15,
      descriptors: [
        { band: "優", range: [13, 15], description: "立意深刻新穎，表達有感染力。" },
        { band: "良", range: [10, 12], description: "立意明確，表達有一定感染力。" },
        { band: "中", range: [6, 9], description: "立意一般，表達平實。" },
        { band: "下", range: [0, 5], description: "立意模糊，表達乾澀。" },
      ],
    },
  ],
};

export function totalMaxScore(r: RubricDef): number {
  return r.criteria.reduce((acc, c) => acc + c.maxScore, 0);
}

export function rubricAsMarkdown(r: RubricDef): string {
  return r.criteria
    .map(
      (c) =>
        `- **${c.label}** (滿分 ${c.maxScore})\n` +
        c.descriptors
          .map((d) => `  - ${d.band} (${d.range[0]}–${d.range[1]})：${d.description}`)
          .join("\n"),
    )
    .join("\n");
}
