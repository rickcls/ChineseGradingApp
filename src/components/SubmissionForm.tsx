"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CameraCaptureFlow } from "@/components/CameraCaptureFlow";
import { ExamTimerPanel, type ExamTimer } from "@/components/ExamTimerPanel";
import { TopicAnalysisPanel } from "@/components/TopicAnalysisPanel";
import { DRAFT_KEY, parseDraft, timerSnapshot, type EssayDraft } from "@/lib/examTimer";

const GRADES = ["P5", "P6", "S1", "S2", "S3", "S4", "S5", "S6"];
const GENRES = [
  { value: "", label: "自動判斷" },
  { value: "記敘抒情文", label: "記敘／抒情" },
  { value: "議論文", label: "議論（論說）" },
  { value: "描寫文", label: "描寫" },
  { value: "說明文", label: "說明" },
] as const;
const MODES = [
  { value: "typed", label: "直接輸入", helper: "適合已經有電子文字稿" },
  { value: "photo", label: "拍照交稿", helper: "手機拍稿後核對文字再提交" },
  { value: "scan", label: "掃描稿", helper: "上傳掃描圖片，再整理成文字版" },
] as const;

type SubmissionSource = (typeof MODES)[number]["value"];

export function SubmissionForm({
  currentCredits,
  creditsUnlimited = false,
  defaultGradeLevel,
}: {
  currentCredits?: number;
  creditsUnlimited?: boolean;
  defaultGradeLevel?: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [gradeLevel, setGradeLevel] = useState(
    defaultGradeLevel && GRADES.includes(defaultGradeLevel) ? defaultGradeLevel : "S2",
  );
  const [genre, setGenre] = useState("");
  const [taskPrompt, setTaskPrompt] = useState("");
  const [source, setSource] = useState<SubmissionSource>("typed");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressChars, setProgressChars] = useState(0);
  const [progressPhase, setProgressPhase] = useState<"reading" | "persisting" | null>(null);
  const [timer, setTimer] = useState<ExamTimer | null>(null);
  const [now, setNow] = useState(0);
  const [pasteBlocked, setPasteBlocked] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<EssayDraft | null>(null);

  const timerFinished =
    timer !== null && (timer.finishedMs !== null || timerSnapshot(timer.startedAt, timer.minutes, now).expired);
  const timerRunning = timer !== null && !timerFinished;

  // Offer to restore an unsubmitted draft from this device.
  useEffect(() => {
    try {
      setPendingDraft(parseDraft(window.localStorage.getItem(DRAFT_KEY)));
    } catch {
      // Storage unavailable (private mode): drafts are a convenience only.
    }
    setNow(Date.now());
  }, []);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  useEffect(() => {
    if (pendingDraft || (!text.trim() && !timer)) return;
    const id = window.setTimeout(() => {
      const draft: EssayDraft = { text, taskPrompt, genre, timer, savedAt: Date.now() };
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // Ignore storage errors.
      }
    }, 800);
    return () => window.clearTimeout(id);
  }, [text, taskPrompt, genre, timer, pendingDraft]);

  function clearDraft() {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Ignore storage errors.
    }
  }

  function restoreDraft() {
    if (!pendingDraft) return;
    setText(pendingDraft.text);
    setTaskPrompt(pendingDraft.taskPrompt);
    setGenre(pendingDraft.genre);
    setTimer(pendingDraft.timer);
    setSource("typed");
    setNow(Date.now());
    setPendingDraft(null);
  }

  function discardDraft() {
    clearDraft();
    setPendingDraft(null);
  }

  function timedFields() {
    if (!timer || source !== "typed") return {};
    const elapsed = timer.finishedMs ?? Math.min(Date.now() - timer.startedAt, timer.minutes * 60_000);
    return { timedMinutes: timer.minutes, writingSeconds: Math.round(elapsed / 1000) };
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setProgressChars(0);
    setProgressPhase("reading");

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          text,
          gradeLevel,
          taskPrompt: taskPrompt.trim() || undefined,
          genre: genre || undefined,
          ocrText: source !== "typed" && ocrText ? ocrText : undefined,
          source,
          stream: true,
          ...timedFields(),
        }),
      });

      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        throw new Error(extractSubmissionErrorFromRaw(raw));
      }

      if (!res.body) {
        throw new Error("伺服器沒有回傳串流內容，請稍後再試。");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let doneId: string | null = null;

      while (!doneId) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sepIdx: number;
        while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);
          const payload = parseSseEventPayload(rawEvent);
          if (!payload) continue;
          if (payload.type === "progress") {
            if (typeof payload.chars === "number") setProgressChars(payload.chars);
            if (payload.phase === "persisting") setProgressPhase("persisting");
            continue;
          }
          if (payload.type === "done" && typeof payload.id === "string") {
            doneId = payload.id;
            break;
          }
          if (payload.type === "error") {
            throw new Error(
              typeof payload.message === "string" ? payload.message : "分析失敗",
            );
          }
        }
      }

      if (!doneId) {
        throw new Error("伺服器中斷了分析串流，請稍後再試。");
      }

      clearDraft();
      router.push(`/submissions/${doneId}`);
    } catch (err) {
      setError(formatNetworkAwareError(err, "提交失敗，請稍後再試。"));
      setSubmitting(false);
      setProgressPhase(null);
    }
  }

  const charCount = Array.from(text).length;
  const isTooLong = charCount > 8000;
  const hasNoCredits = !creditsUnlimited && typeof currentCredits === "number" && currentCredits <= 0;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="paper-panel-strong p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-4">
            <div>
              <p className="section-kicker">交稿方式</p>
              <h2 className="mt-2 text-2xl">選一個最輕鬆的開始方式</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-ink/75">
                不管你是直接輸入、拍照交稿，還是先整理掃描稿，導師都會先陪你看清楚文章，再給具體可行的下一步。
              </p>
            </div>

            <div className="grid gap-3">
              {MODES.map((mode) => {
                const active = mode.value === source;
                return (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => setSource(mode.value)}
                    className={[
                      "choice-card",
                      active ? "choice-card-active" : "choice-card-idle",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-medium text-ink">{mode.label}</div>
                        <div className="mt-1 text-sm text-muted">{mode.helper}</div>
                      </div>
                      <span
                        className={[
                          "mt-1 h-5 w-5 rounded-full border",
                          active ? "border-accent bg-accent" : "border-border bg-white",
                        ].join(" ")}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="paper-panel-muted p-4">
            <p className="section-kicker">導師會怎樣看這篇文章</p>
            <ul className="mt-3 space-y-3 text-sm leading-7 text-ink/80">
              <li>1. 先讀懂你的內容和想表達的重點。</li>
              <li>2. 用年級相符的標準看內容、結構、語言、字詞標點和立意。</li>
              <li>3. 告訴你做得好的地方，再挑 2–3 項最值得先改的重點。</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <label className="block">
          <span className="field-label">年級</span>
          <select
            value={gradeLevel}
            onChange={(event) => setGradeLevel(event.target.value)}
            className="field-input"
          >
            {GRADES.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="field-label">文體</span>
          <select
            value={genre}
            onChange={(event) => setGenre(event.target.value)}
            className="field-input"
          >
            {GENRES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block md:col-span-2">
          <span className="field-label">題目或寫作任務（建議填寫，導師會檢查是否扣題）</span>
          <input
            value={taskPrompt}
            onChange={(event) => setTaskPrompt(event.target.value)}
            placeholder="例：一次難忘的旅行"
            className="field-input"
          />
        </label>
      </section>

      <TopicAnalysisPanel taskPrompt={taskPrompt} genre={genre} gradeLevel={gradeLevel} />

      {pendingDraft ? (
        <div className="flex flex-col gap-3 rounded-[1.2rem] border border-accent/30 bg-accent/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-ink/85">
            找到上次未提交的草稿（{Array.from(pendingDraft.text).length} 字，
            {new Date(pendingDraft.savedAt).toLocaleString("zh-HK")} 保存
            {pendingDraft.timer ? `，限時 ${pendingDraft.timer.minutes} 分鐘` : ""}）。
          </span>
          <span className="flex gap-2">
            <button type="button" className="btn-primary" onClick={restoreDraft}>
              恢復草稿
            </button>
            <button type="button" className="btn-secondary" onClick={discardDraft}>
              捨棄
            </button>
          </span>
        </div>
      ) : null}

      {source === "typed" ? (
        <section className="space-y-4">
          <ExamTimerPanel
            timer={timer}
            now={now}
            chars={charCount}
            onStart={(minutes) => {
              const startedAt = Date.now();
              setNow(startedAt);
              setTimer({ startedAt, minutes, finishedMs: null });
            }}
            onFinish={() =>
              setTimer((current) => (current ? { ...current, finishedMs: Date.now() - current.startedAt } : current))
            }
            onCancel={() => {
              setTimer(null);
              setPasteBlocked(false);
            }}
          />
          {pasteBlocked && timerRunning ? (
            <p className="text-xs text-coral">限時模擬中不能貼上文字，請直接輸入。</p>
          ) : null}
          <label className="block">
            <span className="field-label">文章內容</span>
            <textarea
              value={text}
              readOnly={timerFinished}
              onPaste={(event) => {
                if (!timerRunning) return;
                event.preventDefault();
                setPasteBlocked(true);
              }}
              onChange={(event) => setText(event.target.value)}
              placeholder="把文章貼在這裡。你不需要先寫得很完美，先交出來，我們再一起修。"
              rows={16}
              className="field-input min-h-[24rem] resize-y font-serif leading-8 read-only:cursor-not-allowed read-only:bg-paper/80 read-only:text-ink/75"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="paper-panel-muted px-4 py-4">
              <p className="section-kicker">字數</p>
              <div className="mt-2 text-2xl text-ink">{charCount}</div>
              <p className="mt-1 text-xs text-muted">
                HKDSE 命題寫作建議 600 字以上；字數不足會直接影響「內容」與「結構」得分。
              </p>
            </div>
            <div className="paper-panel-muted px-4 py-4">
              <p className="section-kicker">建議做法</p>
              <p className="mt-2 text-sm leading-7 text-ink/80">先把內容寫順，再回頭看標點和詞語，會更有效率。</p>
            </div>
            <div className="paper-panel-muted px-4 py-4">
              <p className="section-kicker">導師口吻</p>
              <p className="mt-2 text-sm leading-7 text-ink/80">我會指出可改善處，也會告訴你哪些地方已經有亮點。</p>
            </div>
          </div>
        </section>
      ) : (
        <CameraCaptureFlow
          source={source}
          text={text}
          onTextChange={setText}
          onOcrTextChange={setOcrText}
        />
      )}

      {error ? (
        <div className="rounded-[1.2rem] border border-coral/25 bg-coral/10 px-4 py-3 text-sm text-ink/80">
          {error}
        </div>
      ) : null}

      {isTooLong ? (
        <div className="rounded-[1.2rem] border border-coral/25 bg-coral/10 px-4 py-3 text-sm text-ink/80">
          目前文字約 {charCount} 字，已超過系統暫時可分析的 8000 字上限，請刪減後再提交。
        </div>
      ) : null}

      <div className="paper-panel flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-ink/80">導師通常需要 20–60 秒閱讀和整理回饋。</p>
          <p className="text-xs text-muted">
            如果這篇文章還不完整也沒關係，先交一版，我們再慢慢修。當前字數：{charCount}
            {creditsUnlimited
              ? "；可用點數：無限"
              : typeof currentCredits === "number"
                ? `；可用點數：${currentCredits}`
                : ""}
            。
          </p>
        </div>
        <button
          type="submit"
          disabled={submitting || charCount < 20 || isTooLong || hasNoCredits}
          aria-busy={submitting}
          className="btn-primary min-w-[11rem]"
        >
          <span className="inline-flex items-center gap-2">
            {submitting ? <span aria-hidden="true" className="pending-spinner" /> : null}
            <span>{submitting ? submitButtonLabel(progressPhase, progressChars) : hasNoCredits ? "沒有可用點數" : "提交給導師"}</span>
          </span>
        </button>
      </div>
    </form>
  );
}

function parseSseEventPayload(rawEvent: string): Record<string, unknown> | null {
  const dataLines: string[] = [];
  for (const line of rawEvent.split("\n")) {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith("data:")) continue;
    dataLines.push(trimmed.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  try {
    const parsed = JSON.parse(dataLines.join("\n"));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function submitButtonLabel(
  phase: "reading" | "persisting" | null,
  chars: number,
) {
  if (phase === "persisting") return "整理評語中…";
  if (chars > 0) return `導師正在閱讀…已生成 ${chars} 字`;
  return "導師正在閱讀…";
}

function extractSubmissionError(body: unknown) {
  if (typeof body === "string") return body;
  if (!body || typeof body !== "object") return "提交失敗";

  const record = body as {
    error?: unknown;
  };

  if (typeof record.error === "string") {
    return record.error;
  }

  if (record.error && typeof record.error === "object") {
    const flattened = record.error as {
      fieldErrors?: Record<string, string[] | undefined>;
      formErrors?: string[];
    };

    const formMessage = flattened.formErrors?.find(Boolean);
    if (formMessage) return formMessage;

    const fieldMessage = Object.values(flattened.fieldErrors || {})
      .flat()
      .find(Boolean);
    if (fieldMessage) return fieldMessage;
  }

  return "提交失敗";
}

function extractSubmissionErrorFromRaw(raw: string) {
  if (!raw.trim()) return "提交失敗";

  try {
    return extractSubmissionError(JSON.parse(raw));
  } catch {
    const titleMatch = raw.match(/<title>(.*?)<\/title>/i);
    if (titleMatch?.[1]) {
      return titleMatch[1].trim();
    }

    const collapsed = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (collapsed) {
      return collapsed.slice(0, 180);
    }
    return "提交失敗";
  }
}

function formatNetworkAwareError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;

  const message = error.message.trim();
  if (/failed to fetch/i.test(message)) {
    return "連線中斷或伺服器回應逾時，請稍後再試。若你正在用 Vercel 部署版，這通常代表後端函式超時。";
  }
  if (/networkerror|load failed/i.test(message)) {
    return "目前無法連線到伺服器，請檢查網絡後再試。";
  }
  return message || fallback;
}
