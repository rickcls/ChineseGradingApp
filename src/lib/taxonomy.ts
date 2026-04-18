export type TaxonomyEntry = {
  category: string;
  subcategories: { key: string; description: string }[];
};

export const TAXONOMY: TaxonomyEntry[] = [
  {
    category: "字詞",
    subcategories: [
      { key: "錯別字", description: "錯寫、漏寫或多寫筆畫。" },
      { key: "形近字", description: "字形相近而混淆。" },
      { key: "同音字", description: "讀音相同但意義不同。" },
      { key: "詞語搭配不當", description: "動賓或修飾語組合不自然。" },
    ],
  },
  {
    category: "語法",
    subcategories: [
      { key: "語序", description: "句子成分排列順序錯誤。" },
      { key: "成分殘缺", description: "缺少主語、謂語或賓語等核心成分。" },
      { key: "搭配不當", description: "詞與詞之間的邏輯關係不成立。" },
      { key: "句式雜糅", description: "兩種句式混雜使用，導致結構混亂。" },
    ],
  },
  {
    category: "標點",
    subcategories: [
      { key: "逗號誤用", description: "停頓位置不當。" },
      { key: "句號問號混淆", description: "陳述句與疑問句語氣不分。" },
      { key: "引號使用", description: "引用對話或特定稱謂符號不規範。" },
    ],
  },
  {
    category: "結構",
    subcategories: [
      { key: "中心不明", description: "文章缺乏核心主題。" },
      { key: "段落銜接", description: "段與段之間缺乏過渡與邏輯聯繫。" },
      { key: "詳略失當", description: "重點不夠突出，次要內容過於冗長。" },
      { key: "開頭結尾", description: "起筆平淡或收結草率。" },
    ],
  },
  {
    category: "內容",
    subcategories: [
      { key: "材料單薄", description: "內容空洞，缺乏具體實例支撐。" },
      { key: "脫離題意", description: "離題或未能針對要求作答。" },
      { key: "立意平淡", description: "觀點缺乏深度或新意。" },
    ],
  },
  {
    category: "表達",
    subcategories: [
      { key: "修辭貧乏", description: "缺乏比喻、擬人等文學手法。" },
      { key: "用詞單一", description: "重複使用相同詞彙，語言不夠豐富。" },
      { key: "語言乾澀", description: "敘述生硬，缺乏感染力。" },
    ],
  },
];

export function validCategory(category: string, subcategory: string): boolean {
  const cat = TAXONOMY.find((t) => t.category === category);
  if (!cat) return false;
  return cat.subcategories.some((s) => s.key === subcategory);
}

export function taxonomyAsMarkdown(): string {
  return TAXONOMY.map(
    (t) =>
      `- **${t.category}**\n` +
      t.subcategories.map((s) => `  - ${s.key}：${s.description}`).join("\n"),
  ).join("\n");
}
