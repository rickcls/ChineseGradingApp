"use client";

import { useEffect, useRef, useState } from "react";

type SubmissionSource = "photo" | "scan";
type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PageItem = {
  id: string;
  fileName: string;
  previewUrl: string;
  imageDataUrl: string;
  recognizedText: string;
};

const MAX_PAGES = 8;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

let pdfJsPromise: Promise<PdfJsModule> | null = null;

type CameraCaptureFlowProps = {
  source: SubmissionSource;
  text: string;
  onTextChange: (value: string) => void;
};

export function CameraCaptureFlow({ source, text, onTextChange }: CameraCaptureFlowProps) {
  const [pages, setPages] = useState<PageItem[]>([]);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognitionStatus, setRecognitionStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [textIsStale, setTextIsStale] = useState(false);
  const pagesRef = useRef<PageItem[]>([]);

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  useEffect(() => {
    return () => {
      for (const page of pagesRef.current) {
        releasePreviewUrl(page.previewUrl);
      }
    };
  }, []);

  async function onSelectFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const existingPages = pagesRef.current;
    const validFiles: File[] = [];
    const issues: string[] = [];

    for (const file of files) {
      const validationMessage = validateUploadFile(file, source);
      if (validationMessage) {
        issues.push(validationMessage);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      setError(issues.join(" "));
      event.target.value = "";
      return;
    }

    const hadRecognizedText = existingPages.some((page) => page.recognizedText);

    setError(issues.length > 0 ? issues.join(" ") : null);
    setIsPreparing(true);
    setRecognitionStatus(`正在準備 ${validFiles.length} 個檔案…`);

    try {
      const preparedPages: PageItem[] = [];

      for (const file of validFiles) {
        const remainingSlots = MAX_PAGES - existingPages.length - preparedPages.length;
        if (remainingSlots <= 0) {
          throw new Error(`一次最多整理 ${MAX_PAGES} 頁，請分批上傳。`);
        }
        const nextPages = await fileToPageItems(file, remainingSlots);
        preparedPages.push(...nextPages);
      }

      setPages((current) => [...current, ...preparedPages]);
      if (hadRecognizedText) {
        setTextIsStale(true);
        setRecognitionStatus("頁面內容已更新，請重新辨識後再提交。");
      } else {
        setRecognitionStatus("圖片已加入，請先確認頁序，再開始辨識。");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "圖片辨識失敗，請稍後再試。");
      setRecognitionStatus(null);
    } finally {
      setIsPreparing(false);
      event.target.value = "";
    }
  }

  function movePage(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= pagesRef.current.length) return;

    setPages((current) => {
      const next = [...current];
      const [page] = next.splice(index, 1);
      next.splice(targetIndex, 0, page);
      return next;
    });

    if (pagesRef.current.some((page) => page.recognizedText)) {
      setTextIsStale(true);
      setRecognitionStatus("頁面順序已更新，請重新辨識後再提交。");
    }
  }

  function removePage(id: string) {
    const pageToRemove = pagesRef.current.find((page) => page.id === id);
    if (!pageToRemove) return;

    releasePreviewUrl(pageToRemove.previewUrl);
    const nextPages = pagesRef.current.filter((page) => page.id !== id);
    setPages(nextPages);

    if (nextPages.length === 0) {
      setTextIsStale(false);
      setRecognitionStatus(null);
      onTextChange("");
      return;
    }

    if (pagesRef.current.some((page) => page.recognizedText)) {
      setTextIsStale(true);
      setRecognitionStatus("頁面內容已更新，請重新辨識後再提交。");
    }
  }

  function clearPages() {
    for (const page of pagesRef.current) {
      releasePreviewUrl(page.previewUrl);
    }
    setPages([]);
    setTextIsStale(false);
    setRecognitionStatus(null);
    setError(null);
    onTextChange("");
  }

  async function runRecognition() {
    if (pagesRef.current.length === 0) {
      setError(source === "scan" ? "請先加入至少一張掃描圖片或 PDF。" : "請先加入至少一張圖片。");
      return;
    }

    const hadRecognizedText = pagesRef.current.some((page) => page.recognizedText);
    setError(null);
    setIsRecognizing(true);
    setTextIsStale(false);
    setRecognitionStatus(`正在按頁辨識 ${pagesRef.current.length} 張圖片…`);

    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          images: pagesRef.current.map((page) => ({ imageDataUrl: page.imageDataUrl })),
          source,
        }),
      });

      const body = (await res.json().catch(() => null)) as
        | { text?: string; pages?: Array<{ pageNumber: number; text: string }>; error?: string }
        | null;
      if (!res.ok) {
        throw new Error(body?.error || "圖片辨識失敗，請稍後再試。");
      }

      const recognizedText = body?.text?.trim() || "";
      if (!recognizedText) {
        throw new Error("圖片已上傳，但暫時讀不到文字，請手動補上或換一張更清晰的照片。");
      }

      const pageTexts = (body?.pages || []).map((page) => page.text.trim());
      setPages((current) =>
        current.map((page, index) => ({
          ...page,
          recognizedText: pageTexts[index] || "",
        })),
      );
      onTextChange(recognizedText);
      setRecognitionStatus(`辨識完成，共整理 ${pagesRef.current.length} 頁，請核對後再提交。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "圖片辨識失敗，請稍後再試。");
      setRecognitionStatus(null);
      setTextIsStale(hadRecognizedText);
    } finally {
      setIsRecognizing(false);
    }
  }

  const sourceLabel = source === "photo" ? "拍照交稿" : "掃描稿上傳";
  const selectLabel = source === "photo" ? "加入相機／相簿圖片" : "加入掃描圖片或 PDF";
  const acceptValue = source === "photo" ? "image/*" : "image/*,application/pdf";
  const isBusy = isPreparing || isRecognizing;

  return (
    <section className="space-y-4 rounded-[1.35rem] border border-border/70 bg-white/80 p-4 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="section-kicker">{sourceLabel}</p>
          <h3 className="mt-1 text-xl">先把每一頁排好順序，我們再一起核對文字</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="btn-secondary cursor-pointer">
            {selectLabel}
            <input
              type="file"
              accept={acceptValue}
              capture={source === "photo" ? "environment" : undefined}
              multiple
              className="hidden"
              onChange={onSelectFiles}
            />
          </label>
          <button
            type="button"
            onClick={runRecognition}
            disabled={pages.length === 0 || isBusy}
            className="btn-primary min-w-[9.5rem] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRecognizing ? "正在辨識…" : "開始辨識"}
          </button>
          {pages.length > 0 ? (
            <button
              type="button"
              onClick={clearPages}
              disabled={isBusy}
              className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
            >
              清空頁面
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-[1.15rem] border border-dashed border-border/80 bg-paper/70 p-4">
          {isPreparing ? (
            <div className="flex h-full min-h-[14rem] flex-col justify-between rounded-[1rem] bg-white/70 p-4">
              <div>
                <div className="h-3 w-24 animate-pulse rounded-full bg-accent/20" />
                <div className="mt-3 h-3 w-36 animate-pulse rounded-full bg-coral/20" />
              </div>
              <div className="h-40 animate-pulse rounded-[0.95rem] bg-accent/10" />
              <div className="h-3 w-28 animate-pulse rounded-full bg-accent/20" />
            </div>
          ) : pages.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
                <span className="pill">共 {pages.length} 頁</span>
                <span>{recognitionStatus || "請把第 1 頁放最前，確認好再開始辨識。"}</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {pages.map((page, index) => (
                  <article key={page.id} className="space-y-3 rounded-[1rem] border border-border/70 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="pill">第 {index + 1} 頁</span>
                      <span className="text-xs text-muted">{page.recognizedText ? "已辨識" : "待辨識"}</span>
                    </div>

                    <div className="overflow-hidden rounded-[0.9rem] border border-border/80 bg-paper/80">
                      <img src={page.previewUrl} alt={`第 ${index + 1} 頁稿件預覽`} className="h-auto w-full object-cover" />
                    </div>

                    <div className="truncate text-xs text-muted">{page.fileName}</div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => movePage(index, -1)}
                        disabled={index === 0 || isBusy}
                        className="btn-secondary px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        上移
                      </button>
                      <button
                        type="button"
                        onClick={() => movePage(index, 1)}
                        disabled={index === pages.length - 1 || isBusy}
                        className="btn-secondary px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        下移
                      </button>
                      <button
                        type="button"
                        onClick={() => removePage(page.id)}
                        disabled={isBusy}
                        className="btn-secondary px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        移除
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex min-h-[14rem] flex-col items-center justify-center rounded-[1rem] bg-white/70 px-5 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M8 7h1.5l1.2-1.8A1 1 0 0 1 11.53 4h.94a1 1 0 0 1 .83.45L14.5 7H16a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3Zm4 8.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h4 className="mt-4 text-lg">{source === "scan" ? "一次加入掃描圖片或 PDF" : "一次加入一頁或多頁清楚的稿件圖片"}</h4>
              <p className="mt-2 max-w-sm text-sm leading-7 text-muted">
                {source === "scan"
                  ? "系統會先把 PDF 拆成頁面，之後你仍可調整頁序，再開始辨識。"
                  : "你可以先把每一頁排好順序，再開始辨識。這樣系統較容易整理成連貫的文章版本。"}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.15rem] border border-border/70 bg-mist/70 p-4 text-sm leading-7 text-ink/80">
            <p className="font-medium text-ink">核對步驟</p>
            <ol className="mt-2 space-y-2 text-sm text-ink/75">
              <li>1. 一次加入一張或多張照片、掃描圖片，掃描模式也支援 PDF。</li>
              <li>2. 先用上移、下移調整頁序，再按「開始辨識」。</li>
              <li>3. 系統會按頁辨識，再整理成下方核對欄的文字版本。</li>
              <li>4. 確認無誤後提交，導師會以這份文字版作分析。</li>
            </ol>
          </div>

          {textIsStale ? (
            <div className="rounded-2xl border border-coral/25 bg-coral/10 px-4 py-3 text-sm text-ink/80">
              你剛剛調整了頁面內容或順序，下面文字可能仍是舊版本。請重新按一次「開始辨識」。
            </div>
          ) : null}

          <label className="block">
            <span className="field-label">核對後的文字版本</span>
            <textarea
              value={text}
              onChange={(event) => onTextChange(event.target.value)}
              rows={10}
              placeholder={
                isRecognizing
                  ? "系統正在按頁辨識圖片文字…"
                  : "把稿件內容輸入或貼到這裡。核對後再交給導師，回饋會更可靠。"
              }
              className="field-input min-h-[16rem] resize-y font-serif leading-8"
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-coral/25 bg-coral/10 px-4 py-3 text-sm text-ink/80">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function validateUploadFile(file: File, source: SubmissionSource) {
  if (file.type === "application/pdf") {
    if (source !== "scan") {
      return `${file.name} 是 PDF，請切換到「掃描稿」模式再上傳。`;
    }
    if (file.size > MAX_PDF_BYTES) {
      return `${file.name} 超過 20MB，請換一份較小的 PDF。`;
    }
    return null;
  }

  if (!file.type.startsWith("image/")) {
    return `${file.name} 不是圖片或 PDF 檔。`;
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return `${file.name} 超過 8MB，請換一張較小的圖片。`;
  }

  return null;
}

async function fileToPageItems(file: File, remainingSlots: number) {
  if (file.type === "application/pdf") {
    return pdfFileToPageItems(file, remainingSlots);
  }

  if (remainingSlots < 1) {
    throw new Error(`一次最多整理 ${MAX_PAGES} 頁，請分批上傳。`);
  }

  const previewUrl = URL.createObjectURL(file);

  try {
    const imageDataUrl = await fileToOptimizedDataUrl(file);
    return [
      {
        id: crypto.randomUUID(),
        fileName: file.name,
        previewUrl,
        imageDataUrl,
        recognizedText: "",
      },
    ];
  } catch (error) {
    releasePreviewUrl(previewUrl);
    throw error;
  }
}

async function pdfFileToPageItems(file: File, remainingSlots: number) {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
  });

  try {
    const pdf = await loadingTask.promise;
    if (pdf.numPages > remainingSlots) {
      throw new Error(`${file.name} 共 ${pdf.numPages} 頁，已超過本次剩餘可加入的 ${remainingSlots} 頁。`);
    }

    const pages: PageItem[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.max(1, Math.min(2, 1800 / Math.max(baseViewport.width, baseViewport.height)));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      const context = canvas.getContext("2d", { alpha: false });
      if (!context) {
        throw new Error(`無法讀取 ${file.name} 的第 ${pageNumber} 頁。`);
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport, canvas }).promise;
      const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);
      pages.push({
        id: crypto.randomUUID(),
        fileName: `${file.name} · 第 ${pageNumber} 頁`,
        previewUrl: imageDataUrl,
        imageDataUrl,
        recognizedText: "",
      });
      page.cleanup();
    }

    pdf.cleanup();
    await loadingTask.destroy();
    return pages;
  } catch (error) {
    await loadingTask.destroy().catch(() => null);
    const message = error instanceof Error ? error.message : "PDF 處理失敗";
    throw new Error(`PDF 處理失敗：${message}`);
  }
}

async function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((module) => {
      module.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return module;
    });
  }

  return pdfJsPromise;
}

function releasePreviewUrl(url: string) {
  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

async function fileToOptimizedDataUrl(file: File) {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(imageUrl);
    const maxDimension = 1800;
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("無法處理這張圖片，請換一張再試。");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL("image/jpeg", 0.86);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("圖片載入失敗，請重新選擇。"));
    image.src = src;
  });
}
