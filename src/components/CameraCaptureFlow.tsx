"use client";

import { useEffect, useState } from "react";

type SubmissionSource = "photo" | "scan";

type CameraCaptureFlowProps = {
  source: SubmissionSource;
  text: string;
  onTextChange: (value: string) => void;
};

export function CameraCaptureFlow({ source, text, onTextChange }: CameraCaptureFlowProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function onSelectFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("請選擇相片或掃描圖片檔。");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setError("圖片請控制在 8MB 以內，這樣手機上傳會更順。");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setError(null);
    setIsPreparing(true);
    setFileName(file.name);

    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);
    window.setTimeout(() => setIsPreparing(false), 500);
  }

  const sourceLabel = source === "photo" ? "拍照交稿" : "掃描稿上傳";

  return (
    <section className="space-y-4 rounded-[1.35rem] border border-border/70 bg-white/80 p-4 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="section-kicker">{sourceLabel}</p>
          <h3 className="mt-1 text-xl">先把稿件拍清楚，我們再一起核對文字</h3>
        </div>
        <label className="btn-secondary cursor-pointer">
          {source === "photo" ? "開啟相機／相簿" : "選擇掃描圖片"}
          <input
            type="file"
            accept="image/*"
            capture={source === "photo" ? "environment" : undefined}
            className="hidden"
            onChange={onSelectFile}
          />
        </label>
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
          ) : previewUrl ? (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-[1rem] border border-border/80 bg-white">
                <img src={previewUrl} alt="已上傳稿件預覽" className="h-auto w-full object-cover" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
                <span className="pill">{fileName || "已選擇圖片"}</span>
                <span>建議保持字跡端正、光線均勻，核對會更輕鬆。</span>
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
              <h4 className="mt-4 text-lg">拍一張清楚、平整的稿件照片</h4>
              <p className="mt-2 max-w-sm text-sm leading-7 text-muted">
                拍照後，先自己核對文字再提交給導師。這樣能減少辨識偏差，也讓回饋更準確。
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.15rem] border border-border/70 bg-mist/70 p-4 text-sm leading-7 text-ink/80">
            <p className="font-medium text-ink">核對步驟</p>
            <ol className="mt-2 space-y-2 text-sm text-ink/75">
              <li>1. 上傳照片或掃描稿。</li>
              <li>2. 把下方文字欄當成核對版，補上或修正內容。</li>
              <li>3. 確認無誤後提交，導師會以這份文字版作分析。</li>
            </ol>
          </div>

          <label className="block">
            <span className="field-label">核對後的文字版本</span>
            <textarea
              value={text}
              onChange={(event) => onTextChange(event.target.value)}
              rows={10}
              placeholder="把稿件內容輸入或貼到這裡。核對後再交給導師，回饋會更可靠。"
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
