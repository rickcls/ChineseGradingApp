import { readFileSync } from "node:fs";
import path from "node:path";

const RUBRIC_GUIDE_FILES = ["dse-chinese-writing-rubric.md", "DSE中文寫作評分.md"] as const;

const FALLBACK_RUBRIC_GUIDE = `# DSE 中文命題寫作評分標準 V10 (精簡備援版)

## 一、評分計算方式

- 內容 (立意、選材、感悟)：N x 4，佔 40%
- 表達 (用詞、句式、文氣)：N x 3，佔 30%
- 結構 (佈局、銜接、詳略)：N x 2，佔 20%
- 標點與字體 (運用準確度及卷面)：N x 1，佔 10%

## 二、核心評分原則與入品門檻 (Killer Criteria)

1. 內容與結構掛勾：「結構」品第原則上不能高於「內容」。
2. 離題判定：若判定為「離題」或「嚴重套題」，內容、表達、結構三項原始分 N 最高不應超過 3。
3. 字數受限：若字數低於 480 字，內容品第不得進入「中品」（N>=5）。
4. 表達門檻：若全篇充斥過度口語、語助詞或病句極多，表達原始分最高 3–5。
5. 0 分定義：白卷，或文字無法辨識，不成文句。

## 三、V10 評分矩陣與 DSE 潛力區間

- N=10：【Lv 5** 絕對展現】頂尖水平，必定 5**。
- N=9：【Lv 5* 穩 / 5** 競爭】實力強勁，極高機率 5**。
- N=8：【Lv 5 穩 / 具 5** 潛力】有深刻個人剖析、通順準確表達、完整勻稱佈局。
- N=7：【Lv 4 穩 / Lv 5 邊緣】切題真摯，流暢少語病，結構完整。
- N=6：【Lv 4 基本 (封頂)】大路文章，反思表面或組織公式化，無法上 Lv5。
- N=5：【Lv 3 穩 / Lv 4 邊緣】單薄平庸，未犯大錯可碰 Lv4。
- N=4：【Lv 2 穩 / Lv 3 邊緣 (封頂)】輕微離題或語病多，無法上 Lv4。
- N=3：【Lv 2 基本 (封頂) / Lv 1 邊緣】勉強拼湊，離題稍重即跌落 Lv1。
- N=2：【Lv 1 穩固區】嚴重離題，未能達基本要求。
- N=1：【U 級】極劣，無法評核。

## 四、感悟層次量表

- 頂尖層次 (N=9–10)：由小見大，昇華至哲理、普世價值或人文關懷。
- 上品層次 (N=7–8)：具獨特性與深刻個人剖析，能呈現價值觀轉變。
- 中品層次 (N=5–6)：感悟公式化或大路化，缺乏真切個人質感。
- 下品層次 (N=1–4)：感悟空泛、缺失，或與敘事脫節。

## 五、長短板效應

- 長板效應：適用於 N=7–8 文章。若內容與組織達 7–8，但表達出現 N=9 的「靈光一閃」，可觸發潛力爆發機制。
- 短板效應：適用於 N<=6。若組織公式化或標點一逗到底，必須啟動封頂機制，評語需指出等級上限。

## 六、扣分與字數

- 錯別字：0–1 個不扣分；2–4 個扣 1 分；5–7 個扣 2 分；8 個或以上扣 3 分（上限）。
- 建議 600 字以上。篇幅過短將直接拉低內容充實度及結構完整性。`;

let cachedRubricGuide: string | null = null;

export function loadRubricGuideMarkdown(): string {
  if (cachedRubricGuide) return cachedRubricGuide;

  for (const fileName of RUBRIC_GUIDE_FILES) {
    const filePath = path.join(/* turbopackIgnore: true */ process.cwd(), fileName);
    try {
      cachedRubricGuide = readFileSync(filePath, "utf8").trim();
      return cachedRubricGuide;
    } catch {
      // Try the next filename.
    }
  }

  cachedRubricGuide = FALLBACK_RUBRIC_GUIDE.trim();
  return cachedRubricGuide;
}
