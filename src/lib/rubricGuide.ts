import { readFileSync } from "node:fs";
import path from "node:path";

const RUBRIC_GUIDE_FILES = ["dse-chinese-writing-rubric.md", "DSE中文寫作評分.md"] as const;

const FALLBACK_RUBRIC_GUIDE = `# DSE 中文命題寫作評分標準 (V7 精簡版)

## 一、評分結構

- 內容：0–10 分，換算為 N x 4
- 表達：0–10 分，換算為 N x 3
- 結構：0–10 分，換算為 N x 2
- 標點：0–10 分，換算為 N x 1

## 二、核心評分原則 (Killer Criteria)

1. 先評整體，再定分數。
2. 內容優先：若明顯偏題，內容分不宜偏高。
3. 結構不得高於內容。
4. 字數低於 480 字：內容品第不得進入中品（N≥5）。
5. 以整體表現定分，不因個別佳句或小錯而過度拉高或拉低。

## 三、各項快速入分提示

### 內容
- 8–10：立意深刻，意象具象徵功能，感悟達哲理層面，選材精當。
- 6–7：立意尚可，感悟有個人質感但未達哲理，選材恰當。
- 4–5：主旨大致可見，感悟流於公式化，選材一般。
- 1–3：立意薄弱、偏離或缺失，內容空泛。

### 表達
- 8–10：文筆成熟，修辭自然，文氣有感染力。
- 6–7：遣詞達意，句式偶有變化，基本修辭適當。
- 4–5：大致可讀，較平直，偶有生硬或語病。
- 1–3：病句較多，詞語貧乏，影響理解。

### 結構
- 8–10：佈局完整，敘事張力強，過渡自然，首尾呼應。
- 6–7：佈局大致完整，條理尚清，個別銜接稍弱。
- 4–5：結構大致尚存，略顯鬆散，段落銜接不順。
- 1–3：結構混亂或幾乎不成章法，缺乏過渡。

### 標點
- 8–10：標點大致準確，能配合語氣、語意與停頓。
- 5–7：錯誤稍多，但不致嚴重妨礙理解。
- 3–4：錯誤頻繁，已影響閱讀流暢度。
- 0–2：大量缺漏或誤用，嚴重妨礙理解。

## 四、判分提醒

- 有文采但偏題：表達可高，內容不可高。
- 內容尚可但結構散亂：結構分應明顯低於內容分。
- 感悟流於公式化（如「要接納不完美」）：不宜判 N≥7。
- 只靠修辭堆砌而文意空泛：表達不宜判為上品。

## 五、錯別字與字數要求

- 錯別字扣分按全卷總數計算：0–1 個 不扣分，2–4 個 扣1分，5–7 個 扣2分，8 個或以上 扣3分。
- 建議字數：600 字以上；低於 480 字內容不得進入中品。`;

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
