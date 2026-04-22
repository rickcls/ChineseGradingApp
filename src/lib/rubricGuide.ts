import { readFileSync } from "node:fs";
import path from "node:path";

const RUBRIC_GUIDE_FILES = ["dse-chinese-writing-rubric.md", "DSE中文寫作評分.md"] as const;

const FALLBACK_RUBRIC_GUIDE = `# DSE 中文命題寫作評分準則（10 分制操作化版本）

## 一、評分結構

- 內容：0–10 分，換算為 N x 4
- 表達：0–10 分，換算為 N x 3
- 結構：0–10 分，換算為 N x 2
- 標點：0–10 分，換算為 N x 1

## 二、核心評分原則

1. 先評整體，再定分數。
2. 內容優先：若明顯偏題，內容分不宜偏高。
3. 結構不得高於內容。
4. 標點獨立評分：只評標點運用，不評字體。
5. 以整體表現定分，不因個別佳句或小錯而過度拉高或拉低。

## 三、各項快速入分提示

### 內容
- 8–10：明確扣題，材料充分，能展現深度、見解或真切感悟。
- 5–7：基本扣題，但深度、選材代表性或展開力度不足。
- 3–4：偏題、空泛、材料薄弱，未能有效支撐主旨。
- 0–2：嚴重離題、內容過少，或幾乎無可評主旨。

### 表達
- 8–10：用詞準確，句式靈活，修辭自然，整體文氣成熟。
- 5–7：基本達意，尚算通順，但較平直，文采與變化不足。
- 3–4：語病較多，句子欠順，詞語運用薄弱。
- 0–2：大量不通順或殘缺句，影響整體理解。

### 結構
- 8–10：佈局完整，層次清楚，段落安排得宜，過渡自然。
- 5–7：文章大致成篇，但有鬆散、失衡或個別段落安排不佳。
- 3–4：脈絡不清，段落關係弱，結構鬆散。
- 0–2：幾乎不成篇，缺乏基本章法。

### 標點
- 8–10：標點大致準確，能配合語氣、語意與停頓。
- 5–7：錯誤稍多，但不致嚴重妨礙理解。
- 3–4：錯誤頻繁，已影響閱讀流暢度。
- 0–2：大量缺漏或誤用，嚴重妨礙理解。

## 四、判分提醒

- 有文采但偏題：表達可高，內容不可高。
- 內容尚可但結構散亂：結構分應明顯低於內容分。
- 材料很多但沒有剪裁：不等於內容充實，仍應下調內容分。
- 只靠修辭堆砌而文意空泛：表達不宜判為上品。

## 五、錯別字與字數要求

- 錯別字加分按全卷總數計算：0–1 個 +3，2–4 個 +2，5–7 個 +1，8 個或以上不加分。
- 建議字數：600 字以上。
- 若篇幅明顯不足而內容未充分展開，內容及結構一般不宜判高分。`;

let cachedRubricGuide: string | null = null;

export function loadRubricGuideMarkdown(): string {
  if (cachedRubricGuide) return cachedRubricGuide;

  for (const fileName of RUBRIC_GUIDE_FILES) {
    const filePath = path.join(process.cwd(), fileName);
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
