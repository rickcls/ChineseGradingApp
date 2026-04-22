import { generateModelText, generateVisionModelText, OCR_MODEL } from "./anthropic";

type SubmissionSource = "photo" | "scan";

type ExtractTextFromImageInput = {
  imageDataUrl: string;
  source: SubmissionSource;
};

type ExtractTextFromImagesInput = {
  images: Array<{ imageDataUrl: string }>;
  source: SubmissionSource;
};

export type OCRPageResult = {
  pageNumber: number;
  text: string;
};

function cleanTranscript(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[a-z]*\n?/gi, "").replace(/```/g, ""))
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractTextFromSingleImage(input: ExtractTextFromImageInput) {
  const sourceHint =
    input.source === "photo"
      ? "這是一張手寫作文照片，可能有透視、陰影、傾斜和表格底紋。"
      : "這是一張作文掃描圖，整體應較清晰，但可能仍帶有表格底紋或邊界。";

  const text = await generateVisionModelText({
    model: OCR_MODEL,
    maxTokens: 4096,
    temperature: 0.1,
    system: [
      "你是一個專門做中文作文辨識的 OCR 助手。",
      "只輸出辨識後的正文，不要解釋，不要加前言，不要使用 markdown。",
      "忽略姓名、班別、日期、頁面標題、分數欄、格線說明等非作文正文內容。",
      "保留原本段落和換行。",
      "無法辨識的個別字可用 □ 代替，但不要亂猜整句。",
      "盡量使用繁體中文。",
    ].join("\n"),
    user: [
      sourceHint,
      "請讀取這張圖片中的學生作文正文，只回傳辨識出的文字。",
    ].join("\n\n"),
    imageDataUrl: input.imageDataUrl,
  });

  return cleanTranscript(text);
}

async function mergePageTexts(pages: OCRPageResult[], source: SubmissionSource) {
  if (pages.length === 1) {
    return pages[0]?.text ?? "";
  }

  const sourceHint =
    source === "photo"
      ? "以下內容來自多張手寫作文照片的逐頁 OCR。"
      : "以下內容來自多張作文掃描圖的逐頁 OCR。";

  const pageBlocks = pages
    .map((page) => [`[第 ${page.pageNumber} 頁開始]`, page.text, `[第 ${page.pageNumber} 頁結束]`].join("\n"))
    .join("\n\n");

  try {
    const merged = await generateModelText({
      model: OCR_MODEL,
      maxTokens: 8192,
      temperature: 0.1,
      system: [
        "你是一個專門整理中文作文 OCR 結果的助手。",
        "任務是把多頁作文的逐頁辨識結果，整理成一份依原順序連貫的正文。",
        "只輸出整理後的正文，不要解釋，不要加前言，不要使用 markdown。",
        "嚴格保留學生原意與原句，不可潤飾、改寫、補作內容。",
        "可以移除重複的頁首頁尾殘字、重複行與明顯重覆段落。",
        "如果段落剛好跨頁，可以把它接回同一段；如果不確定，就保留換行。",
        "保留原本段落與大致標點；無法確認的字保留原樣，不要自行猜測。",
        "忽略頁碼標記如 [第 1 頁開始] 這類提示。",
      ].join("\n"),
      user: [sourceHint, "請按頁面原順序整理以下作文 OCR 文字：", pageBlocks].join("\n\n"),
    });

    return cleanTranscript(merged);
  } catch {
    return cleanTranscript(pages.map((page) => page.text).join("\n\n"));
  }
}

export async function extractTextFromImage(input: ExtractTextFromImageInput) {
  return extractTextFromSingleImage(input);
}

export async function extractTextFromImages(input: ExtractTextFromImagesInput) {
  const pages: OCRPageResult[] = [];

  for (const [index, image] of input.images.entries()) {
    const pageNumber = index + 1;

    try {
      const text = await extractTextFromSingleImage({
        imageDataUrl: image.imageDataUrl,
        source: input.source,
      });
      pages.push({ pageNumber, text });
    } catch (error) {
      const message = error instanceof Error ? error.message : "OCR failed";
      throw new Error(`第 ${pageNumber} 頁辨識失敗：${message}`);
    }
  }

  return {
    text: await mergePageTexts(pages, input.source),
    pages,
  };
}
