// Timed exam practice for the typed essay form: countdown, exam phases,
// pacing against the 600-字 target, and a local draft so a long essay is not
// lost on refresh. Pure functions; the form owns the clock and storage.

export const EXAM_PRESETS = [
  { minutes: 135, label: "全卷 2 小時 15 分", hint: "甲部＋乙部，與 DSE 卷二相同" },
  { minutes: 90, label: "乙部 90 分鐘", hint: "命題寫作的常見時間分配" },
  { minutes: 45, label: "短練習 45 分鐘", hint: "練開首、結尾或一個段落" },
] as const;

export const TARGET_CHARS = 600;
const PLAN_SHARE = 0.15;
const CHECK_SHARE = 0.12;

export type ExamPhase = "plan" | "write" | "check" | "over";

export type TimerSnapshot = {
  elapsedMs: number;
  remainingMs: number;
  expired: boolean;
  phase: ExamPhase;
  warning: "15min" | "5min" | null;
};

export function timerSnapshot(startedAt: number, minutes: number, now: number): TimerSnapshot {
  const durationMs = minutes * 60_000;
  const elapsedMs = Math.max(0, Math.min(durationMs, now - startedAt));
  const remainingMs = durationMs - elapsedMs;
  const expired = remainingMs <= 0;
  const share = elapsedMs / durationMs;
  const phase: ExamPhase = expired ? "over" : share < PLAN_SHARE ? "plan" : share < 1 - CHECK_SHARE ? "write" : "check";
  const warning = expired ? null : remainingMs <= 5 * 60_000 ? "5min" : remainingMs <= 15 * 60_000 ? "15min" : null;
  return { elapsedMs, remainingMs, expired, phase, warning };
}

export const PHASE_LABEL: Record<ExamPhase, string> = {
  plan: "審題、定立意、列大綱",
  write: "專心寫作",
  check: "留時間檢查錯別字和標點",
  over: "時間到",
};

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = String(minutes).padStart(hours > 0 ? 2 : 1, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export type Pace = { expected: number; status: "planning" | "ahead" | "on-track" | "behind" };

// Writing is expected to happen between the planning and checking phases,
// at an even rate towards the target length.
export function paceFor(chars: number, elapsedMs: number, minutes: number, target = TARGET_CHARS): Pace {
  const durationMs = minutes * 60_000;
  const writeStart = durationMs * PLAN_SHARE;
  const writeEnd = durationMs * (1 - CHECK_SHARE);
  if (elapsedMs < writeStart) return { expected: 0, status: "planning" };
  const progress = Math.min(1, (elapsedMs - writeStart) / (writeEnd - writeStart));
  const expected = Math.round(target * progress);
  if (chars >= expected + 60) return { expected, status: "ahead" };
  if (chars >= expected - 60) return { expected, status: "on-track" };
  return { expected, status: "behind" };
}

export const DRAFT_KEY = "essay-draft-v1";

export type EssayDraft = {
  text: string;
  taskPrompt: string;
  genre: string;
  // finishedMs: elapsed time when the student pressed 交卷 (null while still writing).
  timer: { startedAt: number; minutes: number; finishedMs: number | null } | null;
  savedAt: number;
};

export function parseDraft(raw: string | null): EssayDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<EssayDraft>;
    if (typeof value.text !== "string" || value.text.trim().length === 0 || typeof value.savedAt !== "number") return null;
    const timer =
      value.timer &&
      typeof value.timer.startedAt === "number" &&
      typeof value.timer.minutes === "number" &&
      value.timer.minutes > 0
        ? {
            startedAt: value.timer.startedAt,
            minutes: value.timer.minutes,
            finishedMs: typeof value.timer.finishedMs === "number" ? value.timer.finishedMs : null,
          }
        : null;
    return {
      text: value.text,
      taskPrompt: typeof value.taskPrompt === "string" ? value.taskPrompt : "",
      genre: typeof value.genre === "string" ? value.genre : "",
      timer,
      savedAt: value.savedAt,
    };
  } catch {
    return null;
  }
}
