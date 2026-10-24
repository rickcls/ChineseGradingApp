"use client";

import { EXAM_PRESETS, PHASE_LABEL, TARGET_CHARS, formatClock, paceFor, timerSnapshot } from "@/lib/examTimer";

export type ExamTimer = { startedAt: number; minutes: number; finishedMs: number | null };

type ExamTimerPanelProps = {
  timer: ExamTimer | null;
  now: number;
  chars: number;
  onStart: (minutes: number) => void;
  onFinish: () => void;
  onCancel: () => void;
};

const PACE_LABEL = {
  planning: "先想清楚再落筆",
  ahead: "進度超前",
  "on-track": "進度剛好",
  behind: "進度落後，先寫完主體段",
} as const;

export function ExamTimerPanel({ timer, now, chars, onStart, onFinish, onCancel }: ExamTimerPanelProps) {
  if (!timer) {
    return (
      <div className="paper-panel-muted px-4 py-4">
        <p className="section-kicker">限時模擬（可選）</p>
        <p className="mt-1 text-sm leading-7 text-ink/80">
          像考試一樣計時寫作：開始後不能貼上文字，時間到會鎖定文章。草稿會自動保存在這部裝置。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAM_PRESETS.map((preset) => (
            <button key={preset.minutes} type="button" className="btn-secondary" title={preset.hint} onClick={() => onStart(preset.minutes)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const snapshot = timerSnapshot(timer.startedAt, timer.minutes, timer.finishedMs !== null ? timer.startedAt + timer.finishedMs : now);
  const finished = timer.finishedMs !== null || snapshot.expired;
  const pace = paceFor(chars, snapshot.elapsedMs, timer.minutes);
  const tone = finished
    ? "border-border bg-white/90"
    : snapshot.warning === "5min"
      ? "border-coral bg-coral/10"
      : snapshot.warning === "15min"
        ? "border-coral/50 bg-coral/5"
        : "border-accent/30 bg-accent/5";

  return (
    <div className={["sticky top-2 z-20 rounded-[1.1rem] border-2 px-4 py-3 shadow-soft backdrop-blur", tone].join(" ")} role="timer" aria-live="off">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-3xl tabular-nums text-ink">
            {finished ? formatClock(snapshot.elapsedMs) : formatClock(snapshot.remainingMs)}
          </span>
          <span className="text-sm text-ink/80">
            {finished
              ? snapshot.expired && timer.finishedMs === null
                ? "時間到！文章已鎖定，可以直接提交。"
                : `已交卷，用了 ${formatClock(snapshot.elapsedMs)}。`
              : PHASE_LABEL[snapshot.phase]}
          </span>
        </div>
        {!finished ? (
          <div className="flex gap-2">
            <button type="button" className="btn-primary" onClick={onFinish}>
              完成，交卷
            </button>
            <button type="button" className="btn-secondary" onClick={onCancel}>
              取消計時
            </button>
          </div>
        ) : null}
      </div>
      {!finished ? (
        <p className="mt-1 text-xs text-muted">
          限時 {timer.minutes} 分鐘・{chars} / {TARGET_CHARS} 字
          {pace.status === "planning" ? `・${PACE_LABEL.planning}` : `・此刻宜寫到約 ${pace.expected} 字（${PACE_LABEL[pace.status]}）`}
          {snapshot.warning === "5min" ? "・最後 5 分鐘：檢查錯別字和標點" : snapshot.warning === "15min" ? "・剩 15 分鐘：準備收結" : ""}
        </p>
      ) : null}
    </div>
  );
}
